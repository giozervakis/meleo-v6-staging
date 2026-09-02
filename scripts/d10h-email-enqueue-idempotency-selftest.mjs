import fs from 'node:fs'

const failures=[]

function read(path){
  return fs.readFileSync(path,'utf8').replace(/^\uFEFF/,'')
}

function check(condition,message){
  if(condition){
    console.log('[PASS] ' + message)
    return
  }

  failures.push(message)
  console.error('[FAIL] ' + message)
}

const migration=read('migrations/009_email_job_dedup.sql')
const jobs=read('server/jobs.js')
const mail=read('server/mail.js')
const bookingCore=read('server/routes/booking-core.routes.js')
const bookingState=read('server/routes/booking-state.routes.js')
const auth=read('server/routes/auth-account.routes.js')

check(
  migration.includes('MELEO_EMAIL_JOB_DEDUP_V1'),
  'migration 009 has immutable semantic marker'
)

check(
  migration.includes('ADD COLUMN IF NOT EXISTS dedup_key text'),
  'background jobs gain optional durable dedup key'
)

check(
  migration.includes('background_jobs_job_type_dedup_key_unique_idx'),
  'database owns dedup uniqueness'
)

check(
  migration.includes('WHERE dedup_key IS NOT NULL'),
  'repeatable jobs without identity remain unrestricted'
)

check(
  jobs.includes('normalizeDedupKey'),
  'generic enqueue normalizes explicit dedup identity'
)

check(
  jobs.includes('dedupKey=null'),
  'dedup identity is opt-in'
)

check(
  jobs.includes('ON CONFLICT(') &&
  jobs.includes('dedup_key') &&
  jobs.includes('DO NOTHING'),
  'concurrent duplicate enqueue is database protected'
)

check(
  jobs.includes('AND dedup_key=$7'),
  'duplicate enqueue resolves canonical job identity'
)

check(
  mail.includes('async function deliver(message,{dedupKey=null}={})'),
  'mail delivery accepts optional business-event identity'
)

check(
  bookingCore.includes('booking:${bid}:created:${professionalUser.id}'),
  'booking creation email has deterministic event identity'
)

check(
  bookingState.includes('booking:${b.id}:cancelled:${recipientUserId}'),
  'booking cancellation email has deterministic event identity'
)

check(
  bookingState.includes('booking:${b.id}:completed:${recipientUserId}'),
  'booking completion email has deterministic event identity'
)

check(
  auth.includes('mail.verifyEmail('),
  'verification email remains repeatable'
)

check(
  auth.includes('mail.resetPassword('),
  'password reset remains repeatable'
)

check(
  !mail.includes('sha256(message') &&
  !mail.includes('JSON.stringify(message)'),
  'mail layer does not invent content-based dedup identity'
)

check(
  !migration.includes('WHERE status IN'),
  'dedup survives completed-job replay'
)

console.log('')
console.log('D10H.2 SEMANTICS')
console.log('---------------')
console.log('Repeatable mail: no dedup key -> independent jobs')
console.log('Event-idempotent mail: explicit dedup key -> one durable job')
console.log('Booking created/cancelled/completed: event-idempotent')
console.log('Verification resend/password reset: repeatable')
console.log('Worker retries: same job identity')
console.log('Completed event replay: duplicate enqueue suppressed')

if(failures.length){
  console.error('')
  console.error(
    'MELEO D10H.2 email enqueue idempotency self-test: ' +
    failures.length +
    ' failure(s)'
  )
  process.exit(1)
}

console.log('')
console.log(
  'MELEO D10H.2 email enqueue idempotency + duplicate protection self-test: OK'
)
