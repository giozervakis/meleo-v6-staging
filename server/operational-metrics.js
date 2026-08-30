import { performance } from 'node:perf_hooks'
import { config } from './config.js'
import { one } from './relational/pool.js'
import { redisGetJson, redisPing } from './redis.js'
import { observeError } from './metrics.js'

const WORKER_HEARTBEAT_KEY = 'meleo:observability:worker:heartbeat'
const WORKER_HEARTBEAT_FRESH_SECONDS = 30

const finite = value => {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export async function collectOperationalMetrics() {
  const out = {
    postgres_operational_up: 0,
    postgres_operational_query_ms: 0,
    redis_configured: config.redis.url ? 1 : 0,
    redis_up: 0,
    redis_ping_ms: 0,
    worker_up: 0,
    worker_heartbeat_age_seconds: 0,
    worker_active_jobs: 0,
    worker_concurrency: 0,
    worker_oldest_pending_seconds: 0,
    stripe_configured: config.stripeEnabled ? 1 : 0,
    stripe_subscriptions_active: 0,
    stripe_subscriptions_past_due: 0,
    stripe_reconcile_pending: 0,
    stripe_reconcile_processing: 0,
    stripe_reconcile_failed: 0,
    stripe_reconcile_last_success_age_seconds: 0
  }

  const dbStarted = performance.now()
  try {
    const row = await one(`
      SELECT
        COALESCE((
          SELECT EXTRACT(EPOCH FROM (now() - MIN(created_at)))
          FROM background_jobs
          WHERE status='pending' AND run_at<=now()
        ),0)::double precision AS worker_oldest_pending_seconds,

        (SELECT count(*)::int FROM professionals
         WHERE billing_mode='stripe' AND subscription_status='active')
          AS stripe_subscriptions_active,

        (SELECT count(*)::int FROM professionals
         WHERE billing_mode='stripe' AND subscription_status='past_due')
          AS stripe_subscriptions_past_due,

        (SELECT count(*)::int FROM background_jobs
         WHERE job_type='stripe_reconcile' AND status='pending')
          AS stripe_reconcile_pending,

        (SELECT count(*)::int FROM background_jobs
         WHERE job_type='stripe_reconcile' AND status='processing')
          AS stripe_reconcile_processing,

        (SELECT count(*)::int FROM background_jobs
         WHERE job_type='stripe_reconcile' AND status='failed')
          AS stripe_reconcile_failed,

        COALESCE((
          SELECT EXTRACT(EPOCH FROM (now() - MAX(completed_at)))
          FROM background_jobs
          WHERE job_type='stripe_reconcile' AND status='completed'
        ),0)::double precision AS stripe_reconcile_last_success_age_seconds
    `)

    out.postgres_operational_up = 1
    out.worker_oldest_pending_seconds = finite(row?.worker_oldest_pending_seconds)
    out.stripe_subscriptions_active = finite(row?.stripe_subscriptions_active)
    out.stripe_subscriptions_past_due = finite(row?.stripe_subscriptions_past_due)
    out.stripe_reconcile_pending = finite(row?.stripe_reconcile_pending)
    out.stripe_reconcile_processing = finite(row?.stripe_reconcile_processing)
    out.stripe_reconcile_failed = finite(row?.stripe_reconcile_failed)
    out.stripe_reconcile_last_success_age_seconds =
      finite(row?.stripe_reconcile_last_success_age_seconds)
  } catch {
    observeError('database','operational_metrics_probe_failed')
  } finally {
    out.postgres_operational_query_ms =
      Math.max(0, performance.now() - dbStarted)
  }

  if (!config.redis.url) return out

  const redisStarted = performance.now()
  try {
    out.redis_up = (await redisPing()) ? 1 : 0
    out.redis_ping_ms = Math.max(0, performance.now() - redisStarted)

    const heartbeat = await redisGetJson(WORKER_HEARTBEAT_KEY)
    const heartbeatMs = Date.parse(String(heartbeat?.ts || ''))
    if (Number.isFinite(heartbeatMs)) {
      const ageSeconds = Math.max(0, (Date.now() - heartbeatMs) / 1000)
      out.worker_heartbeat_age_seconds = ageSeconds
      out.worker_up = ageSeconds <= WORKER_HEARTBEAT_FRESH_SECONDS ? 1 : 0
      out.worker_active_jobs = finite(heartbeat?.active)
      out.worker_concurrency = finite(heartbeat?.concurrency)
    }
  } catch {
    out.redis_ping_ms = Math.max(0, performance.now() - redisStarted)
    observeError('redis','operational_metrics_probe_failed')
  }

  return out
}

export { WORKER_HEARTBEAT_KEY, WORKER_HEARTBEAT_FRESH_SECONDS }

export function evaluateOperationalAlerts({
  operational = {},
  queue = {}
} = {}) {
  const databaseDown =
    Number(operational.postgres_operational_up) !== 1

  const redisDown =
    Number(operational.redis_configured) === 1 &&
    Number(operational.redis_up) !== 1

  const workerDown =
    Number(operational.redis_configured) === 1 &&
    Number(operational.worker_up) !== 1

  const queueFailed =
    Number(queue.failed || 0) > 0

  const queueBacklog =
    Number(operational.worker_oldest_pending_seconds || 0) > 300

  const stripeReconcileFailed =
    Number(operational.stripe_reconcile_failed || 0) > 0

  const stripeReconcileStale =
    Number(operational.stripe_configured) === 1 &&
    Number(operational.stripe_reconcile_last_success_age_seconds || 0) > 7200

  const active = [
    databaseDown,
    redisDown,
    workerDown,
    queueFailed,
    queueBacklog,
    stripeReconcileFailed,
    stripeReconcileStale
  ].filter(Boolean).length

  return {
    alert_database_down: databaseDown ? 1 : 0,
    alert_redis_down: redisDown ? 1 : 0,
    alert_worker_down: workerDown ? 1 : 0,
    alert_queue_failed: queueFailed ? 1 : 0,
    alert_queue_backlog: queueBacklog ? 1 : 0,
    alert_stripe_reconcile_failed: stripeReconcileFailed ? 1 : 0,
    alert_stripe_reconcile_stale: stripeReconcileStale ? 1 : 0,
    alert_active_total: active
  }
}
