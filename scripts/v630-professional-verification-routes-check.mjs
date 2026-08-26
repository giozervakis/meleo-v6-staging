import fs from 'node:fs'


const app =
  fs.readFileSync(
    'server/relational/app.js',
    'utf8'
  )


const verification =
  fs.readFileSync(
    'server/routes/professional-verification.routes.js',
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


const routes = [
  "app.post('/api/professional/verification-document'",
  "app.get('/api/professional/verification-documents'",
  "app.post('/api/professional/verification'"
]


for (
  const route of routes
) {

  assert(
    verification.includes(
      route
    ),
    `verification route missing: ${route}`
  )

  assert(
    !app.includes(
      route
    ),
    `verification route still owned by app.js: ${route}`
  )
}


assert(
  app.includes(
    "import { registerProfessionalVerificationRoutes } from '../routes/professional-verification.routes.js'"
  ),
  'verification module import missing'
)


assert(
  app.includes(
    'registerProfessionalVerificationRoutes('
  ),
  'verification module registration missing'
)


for (
  const marker of [
    'verificationObjectKey',
    'putVerificationObject',
    'deleteVerificationObject',
    'encryptFileBuffer',
    'Professionals.byUser',
    'requireVerifiedEmail',
    "requireRole('professional')",
    'limits.write',
    'audit('
  ]
) {

  assert(
    verification.includes(
      marker
    ),
    `verification security behavior missing: ${marker}`
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


console.log(
  'MELEO v6.3.0 professional verification routes architecture check: OK'
)

console.log(
  '[PASS] verification documents modular'
)

console.log(
  '[PASS] verification request modular'
)

console.log(
  '[PASS] verification storage/security behavior preserved'
)

console.log(
  '[PASS] professional billing independently modular'
)
