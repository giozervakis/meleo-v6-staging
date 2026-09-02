import fs from 'node:fs'


const failures=[]


function check(condition,message){
  if(condition){
    console.log(`[PASS] ${message}`)
    return
  }

  failures.push(message)
  console.error(`[FAIL] ${message}`)
}


function read(path){
  return fs
    .readFileSync(path,'utf8')
    .replace(/^\uFEFF/,'')
}


const failure =
  read(
    'tests/integration/failure-injection-runtime.integration.mjs'
  )

const storage =
  read(
    'tests/integration/object-storage-failure.integration.mjs'
  )

const mail =
  read(
    'tests/integration/mail-failure.integration.mjs'
  )

const worker =
  read(
    'tests/integration/worker-retry-runtime.integration.mjs'
  )

const lifecycle =
  read(
    'server/routes/lifecycle.routes.js'
  )

const metrics =
  read(
    'server/operational-metrics.js'
  )

const workflow =
  read(
    '.github/workflows/quality-gate.yml'
  )


/*
 * POSTGRESQL FAILURE REHEARSAL
 */

check(
  failure.includes(
    'real PostgreSQL unique violation is injected'
  ),
  'PostgreSQL constraint failure is rehearsed'
)


check(
  failure.includes(
    'production PostgreSQL pool remains usable after constraint rollback'
  ),
  'PostgreSQL recovers after transactional failure'
)


check(
  failure.includes(
    'real PostgreSQL statement timeout is injected'
  ),
  'PostgreSQL timeout failure is rehearsed'
)


check(
  failure.includes(
    'statement timeout rolls back earlier transaction write'
  ),
  'PostgreSQL timeout preserves transaction rollback'
)


check(
  failure.includes(
    'production PostgreSQL pool recovers after statement timeout'
  ),
  'PostgreSQL pool recovers after timeout'
)


/*
 * REDIS FAILURE REHEARSAL
 */

check(
  failure.includes(
    'Redis unavailable dependency returns controlled failure without process crash'
  ),
  'Redis unavailability is controlled'
)


check(
  failure.includes(
    'Redis command timeout is followed by successful reconnect'
  ),
  'Redis timeout recovery is rehearsed'
)


check(
  failure.includes(
    'timed-out Redis connection is replaced by a new TCP connection'
  ),
  'Redis reconnect uses fresh transport'
)


/*
 * OBJECT STORAGE FAILURE REHEARSAL
 */

check(
  storage.includes(
    'S3 500 response propagates controlled storage error'
  ),
  'S3 HTTP 500 failure is rehearsed'
)


check(
  storage.includes(
    'hung S3 request is aborted by production timeout'
  ),
  'S3 hung request timeout is rehearsed'
)


check(
  storage.includes(
    'object storage serves healthy lifecycle after injected failures'
  ),
  'S3 recovery after failure is rehearsed'
)


check(
  storage.includes(
    'recovery performs exactly one S3 PUT'
  ) &&
  storage.includes(
    'recovery performs exactly one S3 GET'
  ) &&
  storage.includes(
    'recovery performs exactly one S3 DELETE'
  ),
  'S3 recovery remains single-attempt and deterministic'
)


/*
 * MAIL FAILURE REHEARSAL
 */

check(
  mail.includes(
    'Resend 500 becomes controlled delivery failure'
  ),
  'mail HTTP 500 failure is controlled'
)


check(
  mail.includes(
    'hung Resend request is aborted by production timeout'
  ),
  'mail timeout is rehearsed'
)


check(
  mail.includes(
    'transactional mail recovers on healthy provider'
  ),
  'mail provider recovery is rehearsed'
)


check(
  mail.includes(
    'recovery performs exactly one HTTP delivery request'
  ),
  'mail recovery has no hidden retry storm'
)


/*
 * WORKER FAILURE REHEARSAL
 */

check(
  worker.includes(
    'two concurrent workers produce exactly one claim winner'
  ),
  'worker concurrency race is rehearsed'
)


check(
  worker.includes(
    'first failure schedules 15-second retry'
  ) &&
  worker.includes(
    '30-second retry'
  ),
  'worker retry backoff is rehearsed'
)


check(
  worker.includes(
    'max-attempt failure becomes terminal dead-letter'
  ),
  'worker dead-letter path is rehearsed'
)


check(
  worker.includes(
    'stale recovery touches exactly expired processing lock'
  ),
  'worker stale-lock recovery is rehearsed'
)


check(
  worker.includes(
    'non-stale processing lock is not recovered'
  ),
  'worker fresh-lock protection is rehearsed'
)


/*
 * READINESS RESPONSE TO FAILURES
 */

check(
  lifecycle.includes(
    "criticalFailures.push('database')"
  ),
  'database failure can force readiness failure'
)


check(
  lifecycle.includes(
    "criticalFailures.push('redis')"
  ),
  'required Redis failure can force readiness failure'
)


check(
  lifecycle.includes(
    "criticalFailures.push('worker')"
  ),
  'worker failure can force readiness failure'
)


check(
  lifecycle.includes(
    '.status(503)'
  ),
  'critical dependency failure has HTTP 503 path'
)


check(
  lifecycle.includes(
    "degradedCapabilities.push(",
  ),
  'optional dependency degradation remains explicit'
)


/*
 * FAILURE OBSERVABILITY
 */

check(
  metrics.includes(
    'alert_database_down'
  ),
  'database outage is alertable'
)


check(
  metrics.includes(
    'alert_redis_down'
  ),
  'Redis outage is alertable'
)


check(
  metrics.includes(
    'alert_worker_down'
  ),
  'worker outage is alertable'
)


check(
  metrics.includes(
    'alert_queue_failed'
  ),
  'failed background jobs are alertable'
)


check(
  metrics.includes(
    'alert_queue_backlog'
  ),
  'queue backlog is alertable'
)


check(
  metrics.includes(
    'alert_stripe_reconcile_failed'
  ),
  'Stripe reconciliation failure is alertable'
)


check(
  metrics.includes(
    'alert_stripe_reconcile_stale'
  ),
  'stale Stripe reconciliation is alertable'
)


/*
 * CI REHEARSAL COVERAGE
 */

check(
  workflow.includes(
    'suite: failure-injection'
  ),
  'CI executes PostgreSQL/Redis failure injection suite'
)


check(
  workflow.includes(
    'suite: object-storage-failure'
  ),
  'CI executes object-storage failure suite'
)


check(
  workflow.includes(
    'suite: mail-failure'
  ),
  'CI executes mail failure suite'
)


check(
  workflow.includes(
    'suite: worker-retry'
  ),
  'CI executes worker recovery suite'
)


check(
  workflow.includes(
    'Critical E2E + baseline load'
  ),
  'CI includes system-level load rehearsal'
)


check(
  workflow.includes(
    'Upload runtime evidence'
  ),
  'CI preserves runtime rehearsal evidence'
)


check(
  workflow.includes(
    'Upload system evidence'
  ),
  'CI preserves system rehearsal evidence'
)


if(
  failures.length
){
  console.error('')
  console.error(
    `MELEO D10G.9 production failure rehearsal self-test: ${failures.length} failure(s)`
  )
  process.exit(1)
}


console.log('')
console.log(
  'MELEO D10G.9 production failure rehearsal contract: OK'
)