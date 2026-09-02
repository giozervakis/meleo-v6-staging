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


const payments =
  read(
    'server/payments.js'
  )

const reconciliation =
  read(
    'server/stripe-reconciliation.js'
  )

const mail =
  read(
    'server/mail.js'
  )

const storage =
  read(
    'server/object-storage.js'
  )

const billingRuntime =
  read(
    'tests/integration/billing-stripe-contract.integration.mjs'
  )

const mailRuntime =
  read(
    'tests/integration/mail-failure.integration.mjs'
  )

const storageRuntime =
  read(
    'tests/integration/object-storage-failure.integration.mjs'
  )


/*
 * STRIPE
 */

check(
  payments.includes(
    'maxNetworkRetries: 2'
  ),
  'primary Stripe client has bounded SDK network retries'
)


check(
  payments.includes(
    'timeout: 20000'
  ),
  'primary Stripe client has bounded request timeout'
)


check(
  reconciliation.includes(
    'maxNetworkRetries: 2'
  ),
  'reconciliation Stripe client has bounded SDK network retries'
)


check(
  reconciliation.includes(
    'timeout: 20000'
  ),
  'reconciliation Stripe client has bounded request timeout'
)


check(
  billingRuntime.includes(
    'idempotencyKey==='
  ) &&
  billingRuntime.includes(
    'meleo.customer.'
  ),
  'Stripe customer creation has deterministic idempotency proof'
)


const forbiddenRetryPatterns=[
  /for\s*\([^)]*\)\s*\{[\s\S]{0,500}customers\.create/,
  /while\s*\([^)]*\)\s*\{[\s\S]{0,500}checkout\.sessions\.create/,
  /while\s*\([^)]*\)\s*\{[\s\S]{0,500}subscriptions\.update/,
  /setTimeout\s*\([^)]*customers\.create/
]


check(
  !forbiddenRetryPatterns.some(
    pattern =>
      pattern.test(
        payments
      )
  ),
  'application does not wrap Stripe mutations in custom generic retry loops'
)


/*
 * RESEND
 */

check(
  mail.includes(
    'AbortSignal.timeout('
  ),
  'Resend HTTP call has bounded AbortSignal timeout'
)


check(
  mail.includes(
    'config.mail.requestTimeoutMs'
  ),
  'Resend timeout is configuration-bound'
)


check(
  mailRuntime.includes(
    'errorRequests ==='
  ) &&
  mailRuntime.includes(
    'exactly once'
  ),
  'Resend HTTP 500 runtime proves one provider attempt'
)


check(
  mailRuntime.includes(
    'healthyRequests ==='
  ) &&
  mailRuntime.includes(
    'exactly one HTTP delivery request'
  ),
  'healthy Resend delivery performs one provider request'
)


check(
  !/\bwhile\s*\(/.test(
    mail
  ) &&
  !/\bfor\s*\([^)]*retry/i.test(
    mail
  ),
  'mail transport has no hidden generic retry loop'
)


/*
 * OBJECT STORAGE
 */

check(
  storage.includes(
    'AbortSignal.timeout('
  ),
  'S3 HTTP transport has bounded AbortSignal timeout'
)


check(
  storage.includes(
    'config.storage.requestTimeoutMs'
  ),
  'S3 timeout is configuration-bound'
)


check(
  storageRuntime.includes(
    'putCount ==='
  ) &&
  storageRuntime.includes(
    'exactly one S3 PUT'
  ),
  'S3 recovery runtime proves one PUT request'
)


check(
  storageRuntime.includes(
    'getCount ==='
  ) &&
  storageRuntime.includes(
    'exactly one S3 GET'
  ),
  'S3 recovery runtime proves one GET request'
)


check(
  storageRuntime.includes(
    'deleteCount ==='
  ) &&
  storageRuntime.includes(
    'exactly one S3 DELETE'
  ),
  'S3 recovery runtime proves one DELETE request'
)


check(
  !/\bwhile\s*\(/.test(
    storage
  ) &&
  !/\bfor\s*\([^)]*retry/i.test(
    storage
  ),
  'object-storage transport has no hidden generic retry loop'
)


/*
 * CROSS-BOUNDARY CONTRACT
 */

check(
  !payments.includes(
    "await client.query('BEGIN')"
  ),
  'Stripe transport module does not own a database transaction'
)


check(
  !mail.includes(
    "await client.query('BEGIN')"
  ),
  'mail transport does not own a database transaction'
)


check(
  !storage.includes(
    "await client.query('BEGIN')"
  ),
  'object-storage transport does not own a database transaction'
)


check(
  mail.includes(
    'return { delivered: false, reason:'
  ) ||
  mail.includes(
    'return {delivered:false'
  ),
  'mail failures become controlled delivery outcomes'
)


check(
  storage.includes(
    "timeoutError.code ="
  ) &&
  storage.includes(
    "'S3_REQUEST_TIMEOUT'"
  ),
  'S3 timeout exposes canonical failure code'
)


if(
  failures.length
){
  console.error('')

  console.error(
    `MELEO D10G.4 external HTTP boundary self-test: ${failures.length} failure(s)`
  )

  process.exit(1)
}


console.log('')

console.log(
  'MELEO D10G.4 external HTTP retry boundary self-test: OK'
)