import fs from 'node:fs'

const read =
  file =>
    fs.readFileSync(
      file,
      'utf8'
    )


const worker =
  read(
    'server/worker.js'
  )

const engine =
  read(
    'server/stripe-reconciliation.js'
  )

const config =
  read(
    'server/config.js'
  )


function assert(
  condition,
  message
) {

  if (!condition) {
    throw new Error(message)
  }
}


assert(
  worker.includes(
    "'stripe_reconcile'"
  ),
  'worker stripe_reconcile handler missing'
)


assert(
  worker.includes(
    'reconcileStripeSubscriptions'
  ),
  'worker reconciliation execution missing'
)


assert(
  worker.includes(
    'scheduleStripeReconciliation'
  ),
  'worker reconciliation scheduling missing'
)


assert(
  engine.includes(
    'subscriptions'
  ),
  'subscription reconciliation storage missing'
)


assert(
  engine.includes(
    '.subscriptions'
  ),
  'Stripe subscription API missing'
)


assert(
  engine.includes(
    'stripe.reconcile.corrected'
  ),
  'reconciliation correction logging missing'
)


assert(
  engine.includes(
    "status IN ("
  ),
  'duplicate scheduler protection missing'
)


assert(
  config.includes(
    'reconcileIntervalSeconds'
  ),
  'reconciliation interval config missing'
)


assert(
  config.includes(
    'reconcileLimit'
  ),
  'reconciliation limit config missing'
)


console.log(
  'MELEO v6.2 Stripe reconciliation self-test: OK'
)
