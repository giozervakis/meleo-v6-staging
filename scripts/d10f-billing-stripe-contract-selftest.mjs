import fs from 'node:fs'

const failures=[]

function check(
  condition,
  message
){
  if(condition){
    console.log(
      '[PASS]',
      message
    )
  }
  else{
    console.error(
      '[FAIL]',
      message
    )

    failures.push(
      message
    )
  }
}


const runtime =
  fs.readFileSync(
    'tests/integration/billing-stripe-contract.integration.mjs',
    'utf8'
  )

const billing =
  fs.readFileSync(
    'server/services/billing.service.js',
    'utf8'
  )

const workflow =
  fs.readFileSync(
    '.github/workflows/quality-gate.yml',
    'utf8'
  )

const pkg =
  JSON.parse(
    fs.readFileSync(
      'package.json',
      'utf8'
    )
  )


check(
  runtime.includes(
    '../../server/services/billing.service.js'
  ),
  'runtime imports canonical production billing service'
)

check(
  runtime.includes(
    '../../server/relational/pool.js'
  ),
  'runtime imports production relational pool'
)

check(
  runtime.includes(
    '../../server/relational/repositories.js'
  ),
  'runtime imports production repositories'
)

check(
  runtime.includes(
    'await migrate()'
  ),
  'runtime executes production migrations'
)

check(
  runtime.includes(
    'CREATE DATABASE'
  ) &&
  runtime.includes(
    'DROP DATABASE IF EXISTS'
  ),
  'runtime owns isolated PostgreSQL lifecycle'
)

check(
  runtime.includes(
    'pg_terminate_backend'
  ),
  'runtime cleanup handles residual sessions'
)

check(
  runtime.includes(
    'allowedHosts'
  ) &&
  runtime.includes(
    "'127.0.0.1'"
  ) &&
  runtime.includes(
    "'localhost'"
  ) &&
  runtime.includes(
    "'db'"
  ),
  'runtime has explicit local PostgreSQL guard'
)

check(
  runtime.includes(
    'D10F.5 refuses NODE_ENV=production'
  ),
  'runtime refuses production mode'
)

check(
  runtime.includes(
    '.randomBytes(32)'
  ),
  'runtime generates ephemeral sensitive-data key'
)

check(
  runtime.includes(
    'const fakeStripe'
  ),
  'runtime uses deterministic fake Stripe boundary'
)

check(
  !runtime.includes(
    'STRIPE_SECRET_KEY'
  ) &&
  !runtime.includes(
    'sk_test_'
  ) &&
  !runtime.includes(
    'sk_live_'
  ),
  'runtime requires no Stripe credential'
)

check(
  runtime.includes(
    'billing.ensureStripeCustomer('
  ),
  'runtime exercises canonical customer provisioning'
)

check(
  runtime.includes(
    '`meleo.customer.${professionalUserId}`'
  ),
  'runtime verifies deterministic Stripe customer idempotency key'
)

check(
  runtime.includes(
    'repeat provisioning performs no second Stripe create'
  ),
  'runtime verifies customer reuse contract'
)

check(
  runtime.includes(
    'billing.applyStripeSubscription('
  ),
  'runtime exercises canonical subscription synchronization'
)

check(
  runtime.includes(
    "eventCreated:200"
  ) &&
  runtime.includes(
    "eventCreated:100"
  ),
  'runtime injects newer then stale Stripe events'
)

check(
  runtime.includes(
    'older Stripe event cannot overwrite newer subscription state'
  ),
  'runtime verifies webhook ordering'
)

check(
  runtime.includes(
    'duplicate Stripe event creates no second durable notification'
  ),
  'runtime verifies duplicate event durable-side-effect idempotency'
)

check(
  runtime.includes(
    'duplicate Stripe event sends no second activation mail'
  ),
  'runtime verifies duplicate event external-side-effect idempotency'
)

check(
  runtime.includes(
    'D10F5_INJECTED_LOCAL_MUTATION_FAILURE'
  ),
  'runtime injects local subscription transaction failure'
)

check(
  runtime.includes(
    'subscription state rolls back when caller local mutation fails'
  ),
  'runtime verifies professional rollback'
)

check(
  runtime.includes(
    'subscription ledger rolls back with professional state'
  ),
  'runtime verifies ledger rollback'
)

check(
  runtime.includes(
    'rolled-back subscription mutation leaves no durable notification'
  ),
  'runtime verifies notification rollback'
)

check(
  runtime.includes(
    'billing.recordInvoice('
  ),
  'runtime exercises canonical invoice recorder'
)

check(
  runtime.includes(
    'paid invoice atomically supersedes stale failed payment state'
  ),
  'runtime verifies paid authority'
)

check(
  runtime.includes(
    "'already_paid'"
  ),
  'runtime verifies failed-after-paid suppression'
)

check(
  runtime.includes(
    'ignored stale failure creates no duplicate notification'
  ),
  'runtime verifies stale failure notification suppression'
)

check(
  runtime.includes(
    'ignored stale failure sends no duplicate mail'
  ),
  'runtime verifies stale failure mail suppression'
)

check(
  runtime.includes(
    'duplicate paid invoice delivery is idempotent'
  ),
  'runtime verifies duplicate paid invoice idempotency'
)


/*
 * Production implementation invariants that the runtime is
 * specifically exercising.
 */
check(
  billing.includes(
    '`meleo.customer.${u.id}`'
  ),
  'production customer helper owns deterministic idempotency key'
)

check(
  billing.includes(
    'FOR UPDATE'
  ),
  'production subscription mutation serializes professional row'
)

check(
  billing.includes(
    'incomingEventCreated <'
  ),
  'production service contains stale-event ordering guard'
)

check(
  billing.includes(
    "reason:'already_paid'"
  ),
  'production invoice recorder contains paid-authority guard'
)


check(
  pkg.scripts?.[
    'test:integration:billing-stripe'
  ]===
  'node tests/integration/billing-stripe-contract.integration.mjs',
  'D10F.5 runtime package script exists'
)

check(
  pkg.scripts?.[
    'billing-stripe-contract-check'
  ]===
  'node scripts/d10f-billing-stripe-contract-selftest.mjs',
  'D10F.5 structural package script exists'
)


const gate =
  String(
    pkg.scripts?.['ci:gate'] ||
    ''
  )


check(
  gate.includes(
    'npm run booking-concurrency-runtime-check && npm run billing-stripe-contract-check'
  ),
  'D10F.5 static gate follows D10F.4'
)


check(
  workflow.includes(
    'name: Billing Stripe contract runtime'
  ) ||
  workflow.includes(
    'suite: billing-stripe'
  ),
  'CI contains D10F.5 runtime coverage'
)

check(
  workflow.includes(
    'run: npm run test:integration:billing-stripe'
  ) ||
  workflow.includes(
    'command: npm run test:integration:billing-stripe'
  ),
  'CI executes D10F.5 runtime'
)

const concurrencyIndex =
  Math.max(
    workflow.indexOf(
      'name: Booking concurrency transaction runtime'
    ),
    workflow.indexOf(
      'suite: booking-concurrency'
    )
  )

const billingIndex =
  Math.max(
    workflow.indexOf(
      'name: Billing Stripe contract runtime'
    ),
    workflow.indexOf(
      'suite: billing-stripe'
    )
  )

check(
  concurrencyIndex >= 0 &&
  billingIndex > concurrencyIndex,
  'CI definition preserves concurrency -> billing contract ordering'
)


if(failures.length){

  console.error('')
  console.error(
    `MELEO D10F.5 structural self-test: ${failures.length} failure(s)`
  )

  process.exit(1)
}


console.log('')
console.log(
  'MELEO D10F.5 billing / Stripe contract structural self-test: OK'
)