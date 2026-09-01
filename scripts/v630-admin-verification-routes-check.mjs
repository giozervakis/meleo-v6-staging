import fs from 'node:fs'

function assert(
  condition,
  message
){
  if(!condition){
    throw new Error(message)
  }
}

const app =
  fs.readFileSync(
    'server/relational/app.js',
    'utf8'
  )

const route =
  fs.readFileSync(
    'server/routes/admin-verification.routes.js',
    'utf8'
  )

const subscriptionRoute =
  fs.readFileSync(
    'server/routes/admin-subscriptions.routes.js',
    'utf8'
  )


const expectedRoutes = [
  '/api/admin/verifications',
  '/api/admin/verification-documents/:id',
  '/api/admin/verification-documents/:id/access',
  '/api/admin/verification-documents/:id/signed',
  '/api/admin/verifications/:id'
]


assert(
  app.includes(
    "import { registerAdminVerificationRoutes } from '../routes/admin-verification.routes.js'"
  ),
  'Admin Verification registrar import missing'
)


assert(
  app.includes(
    'registerAdminVerificationRoutes('
  ),
  'Admin Verification registrar invocation missing'
)


for (
  const path of expectedRoutes
) {
  assert(
    route.includes(path),
    `Admin Verification route missing: ${path}`
  )
}


assert(
  !app.includes(
    "app.get('/api/admin/verifications'"
  ) &&
  !app.includes(
    "app.patch('/api/admin/verifications/:id'"
  ) &&
  !app.includes(
    "app.get('/api/admin/verification-documents/:id'"
  ) &&
  !app.includes(
    "app.post('/api/admin/verification-documents/:id/access'"
  ) &&
  !app.includes(
    "app.get('/api/admin/verification-documents/:id/signed'"
  ),
  'Admin Verification route remains application-owned'
)


assert(
  app.includes(
    "app.use('/api/admin',auth,requireRole('admin'),adminIpGuard,limits.admin)"
  ),
  'Path-scoped admin authentication boundary changed'
)


assert(
  app.includes(
    "app.use('/api/admin',(req,res,next)=>['GET','HEAD','OPTIONS'].includes(req.method)?next():limits.adminWrite(req,res,next))"
  ),
  'Admin write middleware boundary changed'
)


assert(
  route.includes(
    'verification_requests'
  ) &&
  route.includes(
    'verification_documents'
  ),
  'Verification persistence contract changed'
)


assert(
  route.includes(
    'getVerificationObject'
  ) &&
  route.includes(
    'decryptFileBuffer'
  ),
  'Encrypted verification document access changed'
)


assert(
  route.includes(
    'createTemporaryDocumentSignature'
  ) &&
  route.includes(
    'verifyTemporaryDocumentSignature'
  ),
  'Signed document access contract changed'
)


assert(
  route.includes(
    "'no-store, private'"
  ),
  'Private document cache policy changed'
)


assert(
  route.includes(
    "['active','past_due']"
  ) ||
  (
    route.includes("'active'") &&
    route.includes("'past_due'")
  ),
  'Verification subscription gate changed'
)


assert(
  route.includes(
    'Notifications.create'
  ),
  'Verification notification integration changed'
)


assert(
  route.includes(
    'mail'
  ) &&
  route.includes(
    'verificationDecision'
  ),
  'Verification decision mail integration changed'
)


assert(
  route.includes(
    'audit('
  ) &&
  route.includes(
    'verification.${status}'
  ),
  'Verification audit integration changed'
)


/*
 * Billing synchronization is now intentionally owned by
 * the modular Admin Subscriptions route.
 */
assert(
  !app.includes(
    '/api/admin/professionals/:id/sync-subscription'
  ) &&
  subscriptionRoute.includes(
    '/api/admin/professionals/:id/sync-subscription'
  ),
  'Admin subscription synchronization ownership changed'
)


assert(
  app.includes(
    '/api/webhooks/stripe'
  ),
  'Stripe webhook moved prematurely'
)


assert(
  app.includes(
    '/api/live'
  ),
  'Realtime SSE moved prematurely'
)


console.log(
  'MELEO v6.3.0 Admin Verification architecture check: OK'
)

console.log(
  '[PASS] 5 Admin Verification routes modular'
)

console.log(
  '[PASS] admin authentication remains path-scoped'
)

console.log(
  '[PASS] verification SQL persistence preserved'
)

console.log(
  '[PASS] encrypted document delivery preserved'
)

console.log(
  '[PASS] temporary signed-access contract preserved'
)

console.log(
  '[PASS] verification decision workflow preserved'
)

console.log(
  '[PASS] notification/mail/audit integration preserved'
)

console.log(
  '[PASS] payment-provider boundaries remain correctly modular'
)
