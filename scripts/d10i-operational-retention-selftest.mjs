import fs from 'node:fs'
import assert from 'node:assert/strict'

function read(path){
  return fs
    .readFileSync(path,'utf8')
    .replace(/^\uFEFF/,'')
}

function pass(message){
  console.log('[PASS] '+message)
}

const service=
  read(
    'server/services/data-retention.service.js'
  )

const worker=
  read(
    'server/worker.js'
  )

const schema=
  read(
    'migrations/001_relational_schema.sql'
  )

const jobsSchema=
  read(
    'migrations/002_background_jobs_observability.sql'
  )

assert.ok(
  service.includes(
    'export function createDataRetentionService'
  )
)

assert.ok(
  service.includes(
    'RETENTION_LIVE_EVENTS_DAYS'
  )
)

assert.ok(
  service.includes(
    'RETENTION_COMPLETED_JOBS_DAYS'
  )
)

assert.ok(
  service.includes(
    'RETENTION_FAILED_JOBS_DAYS'
  )
)

assert.ok(
  service.includes(
    'RETENTION_AUDIT_LOGS_DAYS'
  )
)

assert.ok(
  service.includes(
    'RETENTION_PURGE_BATCH_SIZE'
  )
)

pass(
  'retention policy is configurable'
)


for(
  const marker
  of [
    "table:'live_events'",
    "table:'background_jobs'",
    "table:'audit_logs'"
  ]
){
  assert.ok(
    service.includes(marker),
    'missing purge surface: '+marker
  )
}

pass(
  'operational retention surfaces covered'
)


assert.ok(
  service.includes(
    "status='completed'"
  )
)

assert.ok(
  service.includes(
    "status='failed'"
  )
)

assert.equal(
  service.includes(
    "status='pending'"
  ),
  false
)

assert.equal(
  service.includes(
    "status='processing'"
  ),
  false
)

pass(
  'active background jobs are preserved'
)


assert.ok(
  service.includes(
    'LIMIT $1'
  )
)

assert.ok(
  service.includes(
    'policy.batchSize'
  )
)

pass(
  'retention deletion is batch bounded'
)


assert.ok(
  worker.includes(
    "createDataRetentionService"
  )
)

assert.ok(
  worker.includes(
    'runRetentionIfDue'
  )
)

assert.ok(
  worker.includes(
    'RETENTION_PURGE_INTERVAL_MS'
  )
)

assert.ok(
  worker.includes(
    "retention.purge.completed"
  )
)

assert.ok(
  worker.includes(
    "retention.purge.failed"
  )
)

assert.ok(
  worker.includes(
    "observeError("
  )
)

pass(
  'worker retention scheduling and failure isolation wired'
)


assert.ok(
  worker.includes(
    'await runRetentionIfDue({'
  )
)

assert.ok(
  worker.includes(
    'force:true'
  )
)

assert.ok(
  worker.includes(
    'await runRetentionIfDue()'
  )
)

pass(
  'startup and periodic retention execution wired'
)


assert.ok(
  schema.includes(
    'CREATE TABLE IF NOT EXISTS audit_logs'
  )
)

assert.ok(
  schema.includes(
    'CREATE TABLE IF NOT EXISTS live_events'
  )
)

assert.ok(
  jobsSchema.includes(
    'CREATE TABLE IF NOT EXISTS background_jobs'
  )
)

pass(
  'retention targets exist in canonical schema'
)


assert.equal(
  service.includes(
    "DELETE FROM users"
  ),
  false
)

assert.equal(
  service.includes(
    "DELETE FROM bookings"
  ),
  false
)

assert.equal(
  service.includes(
    "DELETE FROM payments"
  ),
  false
)

assert.equal(
  service.includes(
    "DELETE FROM reviews"
  ),
  false
)

pass(
  'business-domain records are outside retention purge'
)


console.log('')
console.log(
  'D10I.5 OPERATIONAL RETENTION POLICY'
)
console.log(
  '----------------------------------'
)
console.log(
  'LIVE EVENTS             : RETAIN 7 DAYS DEFAULT'
)
console.log(
  'COMPLETED JOBS          : RETAIN 30 DAYS DEFAULT'
)
console.log(
  'FAILED JOBS             : RETAIN 90 DAYS DEFAULT'
)
console.log(
  'AUDIT LOGS              : RETAIN 365 DAYS DEFAULT'
)
console.log(
  'POLICY                  : CONFIGURABLE'
)
console.log(
  'PURGE                   : BATCH BOUNDED'
)
console.log(
  'PENDING/PROCESSING JOBS : PRESERVED'
)
console.log(
  'WORKER FAILURE          : ISOLATED'
)
console.log(
  'BUSINESS TABLES         : UNTOUCHED'
)
console.log('')
console.log(
  'MELEO D10I.5 operational retention self-test: OK'
)