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

const route=
  read(
    'server/routes/admin-subscriptions.routes.js'
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


check(
  billing.includes(
    'localMutation=null'
  ),
  'billing sync supports optional local mutation callback'
)

check(
  billing.includes(
    "typeof localMutation==='function'"
  ),
  'local mutation callback is guarded'
)

check(
  /await\s+localMutation\s*\(\s*client/.test(
    billing
  ),
  'local mutation receives transaction client'
)

check(
  /professionalId:p\.id/.test(
    billing
  ),
  'local mutation receives professional identity'
)

check(
  /stripeStatus:sub\.status/.test(
    billing
  ),
  'local mutation receives Stripe status context'
)


const syncRouteStart=
  route.indexOf(
    "app.post("
  )

const retrievePos=
  route.indexOf(
    'stripe.subscriptions.retrieve',
    syncRouteStart
  )

const applyPos=
  route.indexOf(
    'await applyStripeSubscription(',
    retrievePos
  )

check(
  syncRouteStart>=0 &&
  retrievePos>syncRouteStart &&
  applyPos>retrievePos,
  'Stripe retrieve remains before local DB synchronization'
)

check(
  /applyStripeSubscription\([\s\S]*?async\s+client\s*=>/.test(
    route
  ),
  'admin sync supplies transactional local callback'
)

check(
  /audit\([\s\S]*?'admin\.subscription\.sync'[\s\S]*?client\s*\)/.test(
    route
  ),
  'admin subscription audit uses transaction client'
)

const applyCallStart=
  route.indexOf(
    'await applyStripeSubscription(',
    retrievePos
  )

const responseStart=
  route.indexOf(
    'res.json({',
    applyCallStart
  )

const afterApplySegment=
  applyCallStart>=0 &&
  responseStart>applyCallStart
    ? route.slice(
        applyCallStart,
        responseStart
      )
    : ''

const callbackStart=
  afterApplySegment.indexOf(
    'async client=>'
  )

const auditStart=
  afterApplySegment.indexOf(
    "await audit("
  )

check(
  callbackStart>=0 &&
  auditStart>callbackStart,
  'admin audit is inside applyStripeSubscription transactional callback'
)

const trailingAfterCallback=
  afterApplySegment.slice(
    auditStart+
    'await audit('.length
  )

check(
  !/\n\s*await\s+audit\s*\(/.test(
    trailingAfterCallback
  ),
  'split post-sync admin audit removed'
)

check(
  !/getStripe\s*\(/.test(
    billing.slice(
      billing.indexOf(
        'async function applyStripeSubscription('
      ),
      billing.indexOf(
        'async function recordInvoice('
      )
    )
  ),
  'billing transaction still owns no Stripe client acquisition'
)

check(
  pkg.scripts?.[
    'billing-admin-sync-integrity-check'
  ] ===
    'node scripts/d10e-billing-admin-sync-integrity-selftest.mjs',
  'D10E.7B package script exists'
)

check(
  (
    pkg.scripts?.['ci:gate'] ||
    ''
  ).includes(
    'npm run billing-side-effect-integrity-check && npm run billing-admin-sync-integrity-check'
  ),
  'D10E.7B chained after D10E.7A'
)


if(!process.exitCode){
  console.log('')
  console.log(
    'MELEO D10E.7B billing admin sync integrity self-test: OK'
  )
}
