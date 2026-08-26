import fs from 'node:fs'


const read =
  file =>
    fs.readFileSync(
      file,
      'utf8'
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


const app =
  read(
    'server/relational/app.js'
  )


const professionalCore =
  read(
    'server/routes/professional-core.routes.js'
  )


const professionalVerification =
  read(
    'server/routes/professional-verification.routes.js'
  )


// ------------------------------------------------------------
// Professional core module
// ------------------------------------------------------------

const coreRoutes = [
  "app.get('/api/professionals'",
  "app.get('/api/professionals/:id'",
  "app.get('/api/professionals/:id/reviews'",
  "app.put('/api/professional/profile'"
]


for (
  const route of coreRoutes
) {

  assert(
    professionalCore.includes(
      route
    ),
    `professional core route missing: ${route}`
  )

  assert(
    !app.includes(
      route
    ),
    `professional core route still directly owned by app.js: ${route}`
  )
}


assert(
  app.includes(
    "import { registerProfessionalCoreRoutes } from '../routes/professional-core.routes.js'"
  ),
  'professional core import missing'
)


assert(
  app.includes(
    'registerProfessionalCoreRoutes('
  ),
  'professional core registration missing'
)


// ------------------------------------------------------------
// Verification is now its own module
// ------------------------------------------------------------

const verificationRoutes = [
  "app.post('/api/professional/verification-document'",
  "app.get('/api/professional/verification-documents'",
  "app.post('/api/professional/verification'"
]


for (
  const route of verificationRoutes
) {

  assert(
    professionalVerification.includes(
      route
    ),
    `professional verification route missing: ${route}`
  )

  assert(
    !app.includes(
      route
    ),
    `professional verification route still directly owned by app.js: ${route}`
  )

  assert(
    !professionalCore.includes(
      route
    ),
    `professional verification route incorrectly owned by professional-core: ${route}`
  )
}


assert(
  app.includes(
    "import { registerProfessionalVerificationRoutes } from '../routes/professional-verification.routes.js'"
  ),
  'professional verification import missing'
)


assert(
  app.includes(
    'registerProfessionalVerificationRoutes('
  ),
  'professional verification registration missing'
)


// ------------------------------------------------------------
// Subscription / Stripe lifecycle intentionally deferred
// ------------------------------------------------------------

for (
  const route of [
  ]
) {

  assert(
    app.includes(
      route
    ),
    `subscription route moved prematurely: ${route}`
  )
}


const billingService =
  fs.readFileSync(
    'server/services/billing.service.js',
    'utf8'
  )

for (
  const helper of [
    'ensureStripeCustomer',
    'applyStripeSubscription',
    'recordInvoice'
  ]
) {
  assert(
    billingService.includes(
      helper
    ),
    `billing service helper missing: ${helper}`
  )

  assert(
    !app.includes(
      `async function ${helper}`
    ),
    `billing helper still implemented in app.js: ${helper}`
  )
}


// ------------------------------------------------------------
// Core behavior dependencies
// ------------------------------------------------------------

for (
  const marker of [
    'Professionals.search',
    'Professionals.byId',
    'pagination',
    'allowsVisibility',
    'meleoTrustForProfessional',
    'sanitizeProfilePatch'
  ]
) {

  assert(
    professionalCore.includes(
      marker
    ),
    `professional core behavior missing: ${marker}`
  )
}


const billing =
  fs.readFileSync(
    'server/routes/professional-billing.routes.js',
    'utf8'
  )

for (
  const marker of [
    "app.get('/api/professional/subscription'",
    "app.post('/api/professional/subscription/checkout'",
    "app.post('/api/professional/subscription/sync'",
    "app.post('/api/professional/subscription/portal'",
    "app.post('/api/professional/subscription/cancel'",
    "app.post('/api/professional/subscription/resume'"
  ]
) {
  assert(
    billing.includes(
      marker
    ),
    `billing route missing from professional billing module: ${marker}`
  )

  assert(
    !app.includes(
      marker
    ),
    `billing route still directly owned by app.js: ${marker}`
  )
}

console.log(
  'MELEO v6.3.0 professional core routes architecture check: OK'
)

console.log(
  '[PASS] professional directory modular'
)

console.log(
  '[PASS] professional detail/reviews modular'
)

console.log(
  '[PASS] professional profile update modular'
)

console.log(
  '[PASS] verification domain independently modular'
)

console.log(
  '[PASS] professional billing independently modular'
)
