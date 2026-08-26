import fs from 'node:fs'

const read =
  file =>
    fs.readFileSync(
      file,
      'utf8'
    )

const app =
  read(
    'server/relational/app.js'
  )

const routes =
  read(
    'server/routes/professional-billing.routes.js'
  )

const service =
  read(
    'server/services/billing.service.js'
  )

const assert =
  (
    condition,
    message
  ) => {
    if (!condition) {
      throw new Error(
        message
      )
    }
  }


const routeMarkers = [
  "app.get('/api/professional/subscription'",
  "app.post('/api/professional/subscription/checkout'",
  "app.post('/api/professional/subscription/sync'",
  "app.post('/api/professional/subscription/portal'",
  "app.post('/api/professional/subscription/cancel'",
  "app.post('/api/professional/subscription/resume'"
]

for (
  const marker of routeMarkers
) {
  assert(
    routes.includes(
      marker
    ),
    `billing route missing from module: ${marker}`
  )

  assert(
    !app.includes(
      marker
    ),
    `billing route still owned by app.js: ${marker}`
  )
}


for (
  const marker of [
    'async function ensureStripeCustomer',
    'async function applyStripeSubscription',
    'async function recordInvoice'
  ]
) {
  assert(
    service.includes(
      marker
    ),
    `billing service function missing: ${marker}`
  )

  assert(
    !app.includes(
      marker
    ),
    `billing helper still declared in app.js: ${marker}`
  )
}


assert(
  app.includes(
    "import { createBillingService } from '../services/billing.service.js'"
  ),
  'billing service import missing'
)

assert(
  app.includes(
    "import { registerProfessionalBillingRoutes } from '../routes/professional-billing.routes.js'"
  ),
  'professional billing route import missing'
)

assert(
  app.includes(
    'createBillingService('
  ),
  'billing service instantiation missing'
)

assert(
  app.includes(
    'registerProfessionalBillingRoutes('
  ),
  'professional billing route registration missing'
)


// Webhook deliberately remains application/lifecycle owned.
assert(
  app.includes(
    "app.post('/api/webhooks/stripe'"
  ),
  'Stripe webhook missing from app.js'
)

assert(
  app.includes(
    'applyStripeSubscription(obj)'
  ),
  'Stripe webhook no longer uses canonical subscription service'
)

assert(
  app.includes(
    'recordInvoice(obj'
  ),
  'Stripe webhook no longer uses canonical invoice service'
)


// Security / idempotency invariants.
for (
  const marker of [
    'constructEvent',
    'webhook_events',
    "status='completed'",
    "status='failed'"
  ]
) {
  assert(
    app.includes(
      marker
    ),
    `Stripe webhook invariant missing: ${marker}`
  )
}


// Billing service persistence invariants.
for (
  const marker of [
    'INSERT INTO subscriptions',
    'INSERT INTO payments',
    'stripe_subscription_id',
    'pastDueSince'
  ]
) {
  assert(
    service.includes(
      marker
    ),
    `billing persistence behavior missing: ${marker}`
  )
}


console.log(
  'MELEO v6.3.0 professional billing architecture check: OK'
)

console.log(
  '[PASS] 6 subscription routes modular'
)

console.log(
  '[PASS] Stripe mutation logic centralized'
)

console.log(
  '[PASS] webhook shares canonical billing service'
)

console.log(
  '[PASS] webhook idempotency preserved'
)
