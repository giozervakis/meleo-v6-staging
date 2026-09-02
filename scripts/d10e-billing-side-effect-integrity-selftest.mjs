import fs from 'node:fs'

const read=
  path=>
    fs.readFileSync(path,'utf8')
      .replace(/^\uFEFF/,'')
      .replace(/\r\n/g,'\n')

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
    read('package.json')
  )

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

function section(
  source,
  start,
  end
){
  const a=
    source.indexOf(start)

  const b=
    source.indexOf(
      end,
      a+start.length
    )

  return (
    a>=0 &&
    b>a
  )
    ? source.slice(a,b)
    : ''
}


const apply=
  section(
    billing,
    'async function applyStripeSubscription(',
    'async function recordInvoice('
  )

const invoice=
  section(
    billing,
    'async function recordInvoice(',
    'return {\n    ensureStripeCustomer,'
  )


check(
  /await\s+tx\s*\(\s*async\s+client\s*=>/.test(
    apply
  ),
  'subscription local state uses transaction'
)

check(
  /SELECT[\s\S]*?FROM\s+professionals[\s\S]*?FOR\s+UPDATE/.test(
    apply
  ),
  'subscription mutation serializes professional row'
)

check(
  /UPDATE\s+professionals/.test(
    apply
  ),
  'professional subscription state uses tx client'
)

check(
  /INSERT\s+INTO\s+subscriptions/.test(
    apply
  ),
  'subscription ledger uses tx client'
)

check(
  !/Professionals\.update\s*\(/.test(
    apply
  ),
  'split Professionals.update removed from subscription sync'
)

check(
  !/await\s+sql\s*\(/.test(
    apply
  ),
  'split global sql subscription write removed'
)

check(
  /Notifications\.create\([\s\S]*?client\s*\)/.test(
    apply
  ),
  'activation notification receives same transaction client'
)

const txEnd=
  apply.lastIndexOf(
    'await Professionals.byId'
  )

const mailPos=
  apply.indexOf(
    'mail'
  )

check(
  txEnd>=0 &&
  mailPos>txEnd,
  'subscription activation mail remains post-commit'
)

check(
  !/getStripe\s*\(/.test(
    apply
  ),
  'subscription DB transaction contains no Stripe client acquisition'
)


check(
  /await\s+tx\s*\(\s*async\s+client\s*=>/.test(
    invoice
  ),
  'invoice local writes use transaction'
)

check(
  /SELECT\s+1\s+ok[\s\S]*?FROM\s+payments/.test(
    invoice
  ),
  'failed invoice paid-state check is transactional'
)

check(
  /DELETE\s+FROM\s+payments/.test(
    invoice
  ),
  'paid invoice stale-failure cleanup is transactional'
)

check(
  /INSERT\s+INTO\s+payments/.test(
    invoice
  ),
  'payment ledger UPSERT is transactional'
)

check(
  /Notifications\.create\([\s\S]*?client\s*\)/.test(
    invoice
  ),
  'payment-failure notification uses same transaction client'
)

check(
  !/await\s+sql\s*\(/.test(
    invoice
  ),
  'split global payment SQL writes removed'
)

check(
  /if\(sendPaymentFailureMail\)[\s\S]*?mail/.test(
    invoice
  ),
  'payment failure mail remains post-commit'
)

check(
  !/getStripe\s*\(/.test(
    invoice
  ),
  'invoice DB transaction contains no Stripe client acquisition'
)


check(
  /s\.subscriptions\.retrieve/.test(
    routes
  ) ||
  /s\.subscriptions\.update/.test(
    routes
  ),
  'Stripe network operations remain owned by HTTP billing route'
)

check(
  /await\s+applyStripeSubscription\s*\(/.test(
    routes
  ),
  'HTTP route applies local subscription state after Stripe operation'
)

check(
  pkg.scripts?.[
    'billing-side-effect-integrity-check'
  ] ===
    'node scripts/d10e-billing-side-effect-integrity-selftest.mjs',
  'D10E.7A package script exists'
)

check(
  (
    pkg.scripts?.['ci:gate'] ||
    ''
  ).includes(
    'npm run admin-member-integrity-check && npm run billing-side-effect-integrity-check'
  ),
  'D10E.7A chained after D10E.6A'
)


if(!process.exitCode){
  console.log('')

  console.log(
    'MELEO D10E.7A billing side-effect integrity self-test: OK'
  )
}
