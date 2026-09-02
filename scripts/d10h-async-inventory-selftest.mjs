import fs from 'node:fs'


const failures=[]


function check(
  condition,
  message
){
  if(condition){
    console.log(
      `[PASS] ${message}`
    )
    return
  }

  failures.push(message)

  console.error(
    `[FAIL] ${message}`
  )
}


function read(path){
  return fs
    .readFileSync(
      path,
      'utf8'
    )
    .replace(/^\uFEFF/, '')
}


const mail =
  read(
    'server/mail.js'
  )

const jobs =
  read(
    'server/jobs.js'
  )

const worker =
  read(
    'server/worker.js'
  )

const runtime =
  read(
    'server/services/job-runtime.service.js'
  )

const deletion =
  read(
    'server/services/account-deletion.service.js'
  )

const stripe =
  read(
    'server/stripe-reconciliation.js'
  )

const metrics =
  read(
    'server/operational-metrics.js'
  )

const compactDeletion =
  deletion.replace(/\s+/g, ' ')

const compactStripe =
  stripe.replace(/\s+/g, ' ')



/*
 * ==========================================================
 * A. CANONICAL ASYNC JOB INVENTORY
 * ==========================================================
 */

check(
  worker.includes(
    "job.job_type==='email'"
  ),
  'email is a canonical worker job type'
)


check(
  worker.includes(
    "'account_deletion_retry'"
  ),
  'account deletion recovery is a canonical worker job type'
)


check(
  worker.includes(
    "'stripe_reconcile'"
  ),
  'Stripe reconciliation is a canonical worker job type'
)


check(
  worker.includes(
    'Unknown job type:'
  ),
  'unknown async job types fail explicitly'
)


/*
 * ==========================================================
 * B. TRANSACTIONAL MAIL INVENTORY
 * ==========================================================
 */

const mailOperations = [
  'verifyEmail',
  'resetPassword',
  'subscriptionActive',
  'subscriptionUpgradeCharged',
  'subscriptionDowngradeScheduled',
  'subscriptionDowngradeCancelled',
  'paymentFailed',
  'verificationDecision',
  'newBooking',
  'bookingCancelled',
  'bookingCompleted',
  'accountDeleted'
]


for(
  const operation of mailOperations
){
  check(
    mail.includes(
      `${operation}:`
    ),
    `transactional mail operation exists: ${operation}`
  )
}


/*
 * ==========================================================
 * C. MAIL DELIVERY ARCHITECTURE
 * ==========================================================
 */

check(
  mail.includes(
    'export async function deliverEmail'
  ),
  'direct provider delivery has one canonical function'
)


check(
  mail.includes(
    "await enqueue("
  ) &&
  mail.includes(
    "'email'"
  ) &&
  mail.includes(
    "maxAttempts:5"
  ),
  'database-backed mail is queued with five maximum attempts'
)


check(
  mail.includes(
    "return deliverEmail(message)"
  ),
  'queue failure has explicit direct-delivery fallback'
)


check(
  mail.includes(
    "mail.queue_failed"
  ),
  'mail queue insertion failure is observable'
)


check(
  mail.includes(
    "mail.queued"
  ),
  'successful mail enqueue is observable'
)


check(
  mail.includes(
    "mail.delivery_failed"
  ),
  'provider delivery failure is observable'
)


check(
  mail.includes(
    "mail_not_configured"
  ),
  'disabled mail state has explicit reason'
)


check(
  mail.includes(
    'AbortSignal.timeout'
  ),
  'mail provider HTTP request is timeout bounded'
)


check(
  mail.includes(
    "replace(/[\\r\\n]/g,'')"
  ),
  'mail subject header injection is sanitized'
)


/*
 * ==========================================================
 * D. GENERIC JOB ENQUEUE SEMANTICS
 * ==========================================================
 */

check(
  jobs.includes(
    'export async function enqueue('
  ),
  'generic async enqueue primitive exists'
)


check(
  jobs.includes(
    'INSERT INTO background_jobs'
  ),
  'generic enqueue persists jobs durably in PostgreSQL'
)


check(
  jobs.includes(
    "const jid="
  ) &&
  jobs.includes(
    "id('job')"
  ),
  'generic enqueue assigns independent job identity'
)


check(
  jobs.includes(
    'priority'
  ),
  'generic enqueue supports priority'
)


check(
  jobs.includes(
    'maxAttempts'
  ),
  'generic enqueue supports maximum attempts'
)


check(
  jobs.includes(
    'runAt'
  ),
  'generic enqueue supports scheduled execution'
)


/*
 * Inventory fact, not a correctness assertion:
 *
 * D10H.2 will decide whether generic mail enqueue requires
 * an idempotency / deduplication key.
 */
check(
  jobs.includes(
    'dedupKey'
  ) &&
  jobs.includes(
    'dedup_key'
  ),
  'generic enqueue supports explicit idempotency/deduplication identity'
)


/*
 * ==========================================================
 * E. WORKER EMAIL SEMANTICS
 * ==========================================================
 */

check(
  worker.includes(
    'await deliverEmail('
  ),
  'worker uses canonical provider delivery function for email jobs'
)


check(
  worker.includes(
    "!out.delivered"
  ),
  'worker inspects provider delivery result'
)


check(
  worker.includes(
    "out.reason!=='mail_not_configured'"
  ),
  'mail-not-configured has distinct worker semantics'
)


check(
  worker.includes(
    "throw new Error("
  ),
  'worker converts delivery failures into runtime failures'
)


/*
 * ==========================================================
 * F. GENERIC JOB RUNTIME SEMANTICS
 * ==========================================================
 */

check(
  runtime.includes(
    'FOR UPDATE SKIP LOCKED'
  ),
  'async jobs use concurrency-safe claiming'
)


check(
  runtime.includes(
    'attempts=attempts+1'
  ),
  'job attempts increment atomically when claimed'
)


check(
  runtime.includes(
    'retryDelaySeconds'
  ),
  'failed jobs use bounded retry backoff'
)


check(
  runtime.includes(
    "'job.retry'"
  ),
  'job retry lifecycle is observable'
)


check(
  runtime.includes(
    "'job.dead_letter'"
  ),
  'terminal async failure is observable'
)


check(
  runtime.includes(
    'recoverStale'
  ),
  'stuck processing jobs have stale-lock recovery'
)


check(
  runtime.includes(
    "'job.stale_recovered'"
  ),
  'stale async recovery is observable'
)


/*
 * ==========================================================
 * G. ACCOUNT-DELETION RECOVERY SEMANTICS
 * ==========================================================
 */

check(
  deletion.includes(
    "'account_deletion_retry'"
  ),
  'account deletion has durable recovery job'
)


check(
  deletion.includes(
    "job_type='account_deletion_retry'"
  ),
  'account deletion checks existing recovery jobs'
)


check(
  compactDeletion.includes(
    "status IN ( 'pending', 'processing' )"
  ) &&
  compactDeletion.includes(
    "WHERE NOT EXISTS"
  ),
  'account deletion protects pending/processing recovery duplication'
)


check(
  deletion.includes(
    'alreadyDeleted'
  ),
  'account deletion retry recognizes already-completed state'
)


check(
  worker.includes(
    '!result.alreadyDeleted'
  ),
  'account deletion completion email avoids already-deleted replay'
)


/*
 * ==========================================================
 * H. STRIPE RECONCILIATION ASYNC SEMANTICS
 * ==========================================================
 */

check(
  worker.includes(
    'scheduleStripeReconciliation'
  ),
  'worker self-schedules Stripe reconciliation'
)


check(
  worker.includes(
    'stripeReconcileIntervalSeconds'
  ),
  'Stripe reconciliation uses bounded scheduling interval'
)


check(
  stripe.includes(
    'stripe_reconcile'
  ),
  'Stripe reconciliation owns durable job type'
)


check(
  compactStripe.includes(
    "WHERE job_type='stripe_reconcile'"
  ) &&
  compactStripe.includes(
    "status IN ( 'pending', 'processing' )"
  ),
  'Stripe reconciliation checks pending/processing job state'
)


/*
 * ==========================================================
 * I. ASYNC OBSERVABILITY
 * ==========================================================
 */

check(
  metrics.includes(
    'worker_oldest_pending_seconds'
  ),
  'oldest pending async job age is observable'
)


check(
  metrics.includes(
    'worker_active_jobs'
  ),
  'active async job count is observable'
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
  'terminal queue failures are alertable'
)


check(
  metrics.includes(
    'alert_queue_backlog'
  ),
  'async backlog is alertable'
)


check(
  metrics.includes(
    'stripe_reconcile_failed'
  ),
  'Stripe reconciliation failures are measurable'
)


/*
 * ==========================================================
 * J. INVENTORY SUMMARY
 * ==========================================================
 */

console.log('')
console.log(
  'D10H.1 INVENTORY'
)

console.log(
  '--------------'
)

console.log(
  'Canonical job types: email, account_deletion_retry, stripe_reconcile'
)

console.log(
  `Transactional mail operations: ${mailOperations.length}`
)

console.log(
  'Mail path with DATABASE_URL: business event -> enqueue(email) -> worker -> deliverEmail -> provider'
)

console.log(
  'Mail path without DATABASE_URL: business event -> deliverEmail -> provider'
)

console.log(
  'Queue insertion failure path: enqueue failure -> direct deliverEmail fallback'
)

console.log(
  'Generic enqueue dedup key: EXPLICIT / OPTIONAL'
)

console.log(
  'Account deletion recovery dedup: SPECIALIZED'
)

console.log(
  'Stripe reconciliation dedup: SPECIALIZED'
)

console.log(
  'Worker retry/backoff/dead-letter: PRESENT'
)

console.log(
  'Stale job recovery: PRESENT'
)


if(
  failures.length
){
  console.error('')

  console.error(
    `MELEO D10H.1 async inventory self-test: ${failures.length} failure(s)`
  )

  process.exit(1)
}


console.log('')

console.log(
  'MELEO D10H.1 async job inventory + delivery semantics self-test: OK'
)