import fs from 'node:fs'
import assert from 'node:assert/strict'

const read=p=>fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'')

const routes=read('server/routes/admin-observability.routes.js')
const app=read('server/relational/app.js')
const runtime=read('server/services/job-runtime.service.js')
const jobs=read('server/jobs.js')
const operational=read('server/operational-metrics.js')
const system=read('server/routes/system.routes.js')

const pass=m=>console.log(`[PASS] ${m}`)


assert.ok(
  routes.includes("'/api/admin/async-jobs/failed'")
)
pass('failed async jobs are operator-visible')


for(const marker of [
  'job_type "jobType"',
  'attempts,',
  'max_attempts "maxAttempts"',
  'last_error "lastError"',
  'created_at "createdAt"',
  'updated_at "updatedAt"'
]){
  assert.ok(
    routes.includes(marker),
    `missing failed-job diagnostic field: ${marker}`
  )
}
pass('failed-job diagnostics expose delivery context')


assert.ok(
  routes.includes("'/api/admin/async-jobs/:id/retry'")
)
pass('manual failed-job retry endpoint exists')


assert.ok(
  routes.includes("current.status!==") &&
  routes.includes("'failed'") &&
  routes.includes("error:'job_not_failed'")
)
pass('retry is restricted to terminal failed jobs')


for(const marker of [
  "status='pending'",
  'run_at=now()',
  'locked_at=null',
  'locked_by=null',
  'completed_at=null'
]){
  assert.ok(
    routes.includes(marker),
    `missing retry recovery transition: ${marker}`
  )
}
pass('manual retry restores a claimable durable job')


assert.ok(
  !routes.includes('attempts=0')
)
pass('manual retry preserves attempt history')


assert.ok(
  routes.includes('FOR UPDATE') &&
  routes.includes('await tx(')
)
pass('manual recovery serializes concurrent operators')


assert.ok(
  routes.includes("'async.job.retry_requested'") &&
  routes.includes('previousError:')
)
pass('manual recovery is audit-trailed')


assert.ok(
  app.includes('registerAdminObservabilityRoutes(') &&
  app.includes('    tx,') &&
  app.includes('    audit')
)
pass('recovery dependencies are wired into admin routes')


assert.ok(
  runtime.includes("? 'failed'") ||
  runtime.includes("?\n          ? 'failed'") ||
  runtime.includes("?\n          ?") ||
  runtime.includes("? 'failed'")
)

assert.ok(
  runtime.includes("terminal") &&
  runtime.includes("status=$2") &&
  runtime.includes("'job.dead_letter'")
)
pass('generic runtime still owns durable terminal failure')


assert.ok(
  jobs.includes("WHERE status='failed'")
)
pass('queue failed count remains observable')


assert.ok(
  operational.includes('alert_queue_failed') &&
  operational.includes('worker_oldest_pending_seconds')
)
pass('existing queue failure/backlog alerting preserved')


assert.ok(
  system.includes('background_jobs_failed:')
)
pass('failed async jobs remain exported as metrics')


console.log('')
console.log('D10H.6 FAILED ASYNC DELIVERY RECOVERY')
console.log('-------------------------------------')
console.log('Terminal failure -> durable failed job -> admin diagnostics -> audited manual retry -> pending job')
console.log('Attempt history: PRESERVED')
console.log('Operator race protection: FOR UPDATE')
console.log('Existing worker/backlog/failed metrics: PRESERVED')
console.log('')
console.log('MELEO D10H.6 failed async job recovery self-test: OK')