import fs from 'node:fs'

const read =
  file =>
    fs.readFileSync(
      file,
      'utf8'
    )

const assert =
  (condition,message) => {
    if (!condition) {
      throw new Error(message)
    }
  }

const app =
  read(
    'server/relational/app.js'
  )

const route =
  read(
    'server/routes/admin-subscriptions.routes.js'
  )

assert(
  app.includes(
    "registerAdminSubscriptionsRoutes"
  ),
  'Admin Subscriptions registration missing'
)

assert(
  !app.includes(
    "app.get('/api/admin/subscriptions'"
  ),
  'Admin subscriptions route still application-owned'
)

assert(
  !app.includes(
    "app.post('/api/admin/professionals/:id/sync-subscription'"
  ),
  'Admin sync-subscription route still application-owned'
)

assert(
  route.includes(
    "app.get('/api/admin/subscriptions'"
  ),
  'GET /api/admin/subscriptions missing'
)

assert(
  route.includes(
    "'/api/admin/professionals/:id/sync-subscription'"
  ),
  'POST sync-subscription missing'
)

for (
  const token of [
    'subscriptions',
    'payments',
    'stripe_subscription_id',
    'hosted_invoice_url',
    'LIMIT 200'
  ]
) {
  assert(
    route.includes(token),
    `Subscription/payment SQL contract changed: ${token}`
  )
}

for (
  const token of [
    'Professionals.byId',
    'getStripe',
    'stripe.subscriptions.retrieve',
    'applyStripeSubscription',
    'admin.subscription.sync',
    'audit'
  ]
) {
  assert(
    route.includes(token),
    `Manual Stripe sync contract changed: ${token}`
  )
}

assert(
  app.includes(
    "app.post('/api/webhooks/stripe'"
  ),
  'Stripe webhook moved unexpectedly'
)

assert(
  app.includes(
    'express.raw'
  ),
  'Stripe raw-body handling changed'
)

assert(
  app.includes(
    "app.get('/api/live'"
  ),
  'Realtime SSE moved unexpectedly'
)

console.log(
  'MELEO v6.3.0 Admin Subscriptions architecture check: OK'
)

console.log(
  '[PASS] 2 Admin Subscription routes modular'
)

console.log(
  '[PASS] subscription list preserved'
)

console.log(
  '[PASS] payment list preserved'
)

console.log(
  '[PASS] manual Stripe synchronization preserved'
)

console.log(
  '[PASS] audit integration preserved'
)

console.log(
  '[PASS] Stripe webhook remains application-owned'
)

console.log(
  '[PASS] raw-body handling remains application-owned'
)

console.log(
  '[PASS] realtime SSE remains application-owned'
)
