# RC3-C4 Operational Dependency Metrics

Status: IMPLEMENTED β€” staging runtime proof pending.

Adds bounded metrics for PostgreSQL, Redis, background-worker liveness/queue health,
and Stripe subscription/reconciliation state.

No PII, booking IDs, Stripe IDs, raw errors, or unbounded labels are exported.
Stripe metrics are derived from local MELEO state and reconciliation jobs; metrics
scrapes do not call Stripe directly. Worker liveness is shared through a short-lived
Redis heartbeat. No database migration is required.

Runtime closure requires protected staging /api/metrics evidence showing PostgreSQL
up, Redis configured/up, worker up with a fresh heartbeat, Stripe configured, and
finite reconciliation/latency gauges.

## Staging runtime evidence — 2026-08-30

Protected /api/metrics returned the following deployed operational values:

- meleo_postgres_operational_up 1
- meleo_postgres_operational_query_ms 2.157107000006363
- meleo_redis_configured 1
- meleo_redis_up 1
- meleo_redis_ping_ms 4.890058999997564
- meleo_worker_up 1
- meleo_worker_heartbeat_age_seconds 2.885
- meleo_worker_active_jobs 0
- meleo_worker_concurrency 2
- meleo_worker_oldest_pending_seconds 0
- meleo_stripe_configured 1
- meleo_stripe_subscriptions_active 2
- meleo_stripe_subscriptions_past_due 0
- meleo_stripe_reconcile_pending 0
- meleo_stripe_reconcile_processing 0
- meleo_stripe_reconcile_failed 0
- meleo_stripe_reconcile_last_success_age_seconds 104.779706

Runtime acceptance:
- PostgreSQL operational health: PASS
- Redis configured and reachable: PASS
- Worker heartbeat fresh and active: PASS
- Stripe staging integration configured: PASS
- Stripe reconciliation gauges present and finite: PASS
- Queue/worker gauges present and finite: PASS

## Closure

RC3-C4 is FULLY CLOSED.

This closure covers bounded operational metrics for PostgreSQL, Redis, worker liveness /
queue state, and Stripe subscription / reconciliation state, with static regression
coverage plus protected staging runtime proof.