import fs from 'node:fs'

const read=
  path=>
    fs.readFileSync(
      path,
      'utf8'
    )
      .replace(/^\\uFEFF/,'')
      .replace(/\\r\\n/g,'\\n')


function check(condition,message){

  if(!condition){

    console.error(
      '[FAIL]',
      message
    )

    process.exitCode=1
    return
  }

  console.log(
    '[PASS]',
    message
  )
}


const billing=
  read(
    'server/services/billing.service.js'
  )

const routes=
  read(
    'server/routes/professional-billing.routes.js'
  )

const pkg=
  JSON.parse(
    read(
      'package.json'
    )
  )


const ensureStart=
  billing.indexOf(
    'async function ensureStripeCustomer('
  )

const applyStart=
  billing.indexOf(
    'async function applyStripeSubscription(',
    ensureStart
  )

const ensure=
  (
    ensureStart>=0 &&
    applyStart>ensureStart
  )
    ? billing.slice(
        ensureStart,
        applyStart
      )
    : ''


check(
  ensure.length>0,
  'ensureStripeCustomer isolated'
)

check(
  ensure.includes(
    'if(u.stripe_customer_id)'
  ),
  'existing persisted customer remains authoritative'
)

check(
  ensure.includes(
    'getStripe()'
  ),
  'Stripe client acquisition preserved'
)

check(
  ensure.includes(
    's.customers.create('
  ),
  'Stripe customer creation preserved'
)

check(
  ensure.includes(
    'meleo.customer.' +
    '$' +
    '{u.id}'
  ),
  'deterministic per-user idempotency key exists'
)

check(
  ensure.includes(
    'idempotencyKey'
  ),
  'Stripe create receives idempotency key'
)

check(
  ensure.indexOf(
    's.customers.create('
  ) <
  ensure.indexOf(
    'Users.update('
  ),
  'Stripe creation remains before local persistence'
)

check(
  ensure.includes(
    'stripe_customer_id:'
  ),
  'Stripe customer id remains locally persisted'
)

check(
  !ensure.includes(
    'tx('
  ),
  'Stripe customer creation is not wrapped in database transaction'
)

check(
  (
    ensure.match(
      /s\.customers\.create\s*\(/g
    )||
    []
  ).length===1,
  'exactly one Stripe customer create call remains'
)

const helperCalls=
  routes.match(
    /ensureStripeCustomer\(u\)/g
  )||
  []

check(
  helperCalls.length>=2,
  'checkout and portal use canonical customer helper'
)

check(
  routes.includes(
    's.checkout.sessions.create('
  ),
  'checkout flow preserved'
)

check(
  routes.includes(
    's.billingPortal.sessions.create('
  ),
  'billing portal flow preserved'
)

check(
  pkg.scripts?.[
    'stripe-customer-idempotency-check'
  ] ===
    'node scripts/d10e-stripe-customer-idempotency-selftest.mjs',
  'D10E.10A package script exists'
)

const gate=
  pkg.scripts?.[
    'ci:gate'
  ]||
  ''

const directSql=
  gate.indexOf(
    'npm run direct-sql-integrity-check'
  )

const customerIdempotency=
  gate.indexOf(
    'npm run stripe-customer-idempotency-check'
  )

check(
  directSql>=0 &&
  customerIdempotency>directSql,
  'D10E.10A chained after D10E.9'
)


if(!process.exitCode){

  console.log('')

  console.log(
    'MELEO D10E.10A Stripe customer idempotency self-test: OK'
  )
}
