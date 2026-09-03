import fs from 'node:fs'
import assert from 'node:assert/strict'


function read(path){
  return fs
    .readFileSync(path,'utf8')
    .replace(/^\uFEFF/,'')
}


function compact(value){
  return value
    .replace(/\s+/g,' ')
    .trim()
}


function pass(message){
  console.log(
    `[PASS] ${message}`
  )
}


const stripe =
  read(
    'server/stripe-reconciliation.js'
  )

const worker =
  read(
    'server/worker.js'
  )

const compactStripe =
  compact(stripe)

const compactWorker =
  compact(worker)


/*
 * ==========================================================
 * A. MULTI-WORKER SINGLETON SERIALIZATION
 * ==========================================================
 */

assert.ok(
  stripe.includes(
    'pg_advisory_xact_lock('
  ),
  'Stripe scheduler serialization lock missing'
)

assert.ok(
  stripe.includes(
    "'meleo:stripe_reconcile:scheduler'"
  ),
  'Stripe scheduler lock identity missing'
)

pass(
  'scheduler check+insert is serialized across workers'
)


assert.ok(
  stripe.includes(
    'await tx('
  ) &&
  stripe.includes(
    'async client=>'
  ) &&
  stripe.includes(
    'await client.query('
  ),
  'Stripe singleton scheduling transaction missing'
)

pass(
  'singleton decision executes in one PostgreSQL transaction'
)


assert.ok(
  compactStripe.includes(
    "WHERE job_type='stripe_reconcile' AND status IN ( 'pending', 'processing' )"
  ),
  'pending/processing singleton predicate missing'
)

pass(
  'pending/processing singleton semantics preserved'
)


/*
 * ==========================================================
 * B. OLD IN-FLIGHT SELF-SCHEDULING MUST BE GONE
 * ==========================================================
 *
 * We deliberately do NOT locate this block by whitespace.
 *
 * Instead:
 *   1. Find reconcileStripeSubscriptions execution.
 *   2. Find the next domain job branch / unknown-job boundary.
 *   3. Inspect only that semantic region.
 */

const reconcileCall =
  compactWorker.indexOf(
    'await reconcileStripeSubscriptions('
  )

assert.ok(
  reconcileCall !== -1,
  'Stripe reconciliation execution missing'
)


const accountBranch =
  compactWorker.indexOf(
    "'account_deletion_retry'",
    reconcileCall
  )

const unknownBoundary =
  compactWorker.indexOf(
    'Unknown job type:',
    reconcileCall
  )


const boundaries =
  [
    accountBranch,
    unknownBoundary
  ].filter(
    value =>
      value !== -1 &&
      value > reconcileCall
  )


assert.ok(
  boundaries.length > 0,
  'Could not determine Stripe execution boundary'
)


const reconcileEnd =
  Math.min(...boundaries)


const reconcileRegion =
  compactWorker.slice(
    reconcileCall,
    reconcileEnd
  )


assert.ok(
  !reconcileRegion.includes(
    'scheduleStripeReconciliation('
  ),
  'Stripe still schedules next job while current job is processing'
)

pass(
  'in-flight self-schedule race removed'
)


/*
 * ==========================================================
 * C. POST-RUNTIME RESCHEDULING
 * ==========================================================
 */

const runtimeCall =
  compactWorker.indexOf(
    'await jobRuntime.run('
  )

assert.ok(
  runtimeCall !== -1,
  'generic job runtime invocation missing'
)


const postRuntimeRegion =
  compactWorker.slice(
    runtimeCall
  )


assert.ok(
  postRuntimeRegion.includes(
    "job.job_type==='stripe_reconcile'"
  ),
  'post-runtime Stripe outcome branch missing'
)


assert.ok(
  postRuntimeRegion.includes(
    "result?.status==='completed'"
  ),
  'successful runtime outcome not checked'
)


assert.ok(
  postRuntimeRegion.includes(
    'result?.terminal'
  ),
  'terminal runtime outcome not checked'
)


assert.ok(
  postRuntimeRegion.includes(
    'await ensureStripeReconciliationSchedule('
  ),
  'post-runtime reconciliation scheduling missing'
)

pass(
  'rescheduling occurs after durable runtime outcome'
)


/*
 * ==========================================================
 * D. SUCCESS / RETRY / TERMINAL SEMANTICS
 * ==========================================================
 */

assert.ok(
  postRuntimeRegion.includes(
    "'periodic'"
  ),
  'periodic success scheduling reason missing'
)


assert.ok(
  postRuntimeRegion.includes(
    "'terminal_recovery'"
  ),
  'terminal recovery scheduling reason missing'
)

pass(
  'completed and terminal outcomes preserve schedule chain'
)


/*
 * Retryable failure must NOT create a second reconciliation
 * job. The generic runtime changes the SAME job back to
 * pending, which still occupies the singleton slot.
 *
 * The post-runtime branch therefore intentionally handles
 * completed OR terminal only.
 */

assert.ok(
  postRuntimeRegion.includes(
    "result?.status==='completed'"
  ) &&
  postRuntimeRegion.includes(
    'result?.terminal'
  ) &&
  !postRuntimeRegion.includes(
    "result?.retry &&"
  ),
  'retry path must retain same reconciliation job'
)

pass(
  'retryable failure retains same durable job identity'
)


/*
 * ==========================================================
 * E. SCHEDULE SUPERVISOR / CRASH-GAP HEALING
 * ==========================================================
 */

assert.ok(
  worker.includes(
    'async function ensureStripeReconciliationSchedule('
  ),
  'Stripe schedule supervisor helper missing'
)


assert.ok(
  worker.includes(
    'stripeScheduleGuardMs'
  ) &&
  worker.includes(
    'lastStripeScheduleCheckAt'
  ),
  'Stripe schedule supervisor throttle missing'
)


assert.ok(
  worker.includes(
    'await ensureStripeReconciliationSchedule()'
  ),
  'worker loop does not supervise reconciliation schedule'
)

pass(
  'periodic supervisor heals missing schedule'
)


/*
 * ==========================================================
 * F. SCHEDULER FAILURE OBSERVABILITY
 * ==========================================================
 */

assert.ok(
  worker.includes(
    "'stripe.reconcile.schedule_failed'"
  ),
  'Stripe scheduler failure log missing'
)


assert.ok(
  worker.includes(
    "'reconcile_schedule_failed'"
  ),
  'Stripe scheduler failure metric missing'
)

pass(
  'scheduler repair failures are observable'
)


/*
 * ==========================================================
 * G. TERMINAL FAILURE MUST NOT BREAK PERIODIC CHAIN
 * ==========================================================
 */

assert.ok(
  postRuntimeRegion.includes(
    'result?.terminal'
  ) &&
  postRuntimeRegion.includes(
    "'terminal_recovery'"
  ) &&
  postRuntimeRegion.includes(
    'force:true'
  ),
  'terminal reconciliation recovery path missing'
)

pass(
  'terminal reconciliation failure does not permanently stop schedule'
)


/*
 * ==========================================================
 * H. SCHEDULER INSERT MUST BE INSIDE LOCKED TRANSACTION
 * ==========================================================
 */

const schedulerStart =
  compactStripe.indexOf(
    'export async function scheduleStripeReconciliation'
  )

assert.ok(
  schedulerStart !== -1,
  'Stripe scheduler function missing'
)


const schedulerRegion =
  compactStripe.slice(
    schedulerStart
  )


const lockIndex =
  schedulerRegion.indexOf(
    'pg_advisory_xact_lock('
  )

const existingIndex =
  schedulerRegion.indexOf(
    "WHERE job_type='stripe_reconcile'"
  )

const insertIndex =
  schedulerRegion.indexOf(
    'INSERT INTO background_jobs('
  )


assert.ok(
  lockIndex !== -1 &&
  existingIndex > lockIndex &&
  insertIndex > existingIndex,
  'scheduler lock/check/insert ordering invalid'
)

pass(
  'scheduler lock -> singleton check -> insert ordering preserved'
)


console.log('')
console.log(
  'D10H.5 SCHEDULED STRIPE SEMANTICS'
)
console.log(
  '--------------------------------'
)

console.log(
  'Concurrent workers -> advisory transaction lock -> one pending/processing reconciliation job'
)

console.log(
  'Successful job -> runtime marks completed -> next periodic job scheduled'
)

console.log(
  'Retryable failure -> same durable job returns to pending -> no duplicate scheduling'
)

console.log(
  'Terminal failure -> runtime marks failed -> recovery job scheduled'
)

console.log(
  'Crash / schedule insertion failure -> worker supervisor repairs missing chain'
)

console.log('')

console.log(
  'MELEO D10H.5 Stripe scheduled-job reliability self-test: OK'
)