import fs from 'node:fs'
import path from 'node:path'

function assert(
  condition,
  message
) {
  if (!condition) {
    throw new Error(message)
  }
}

const app =
  fs.readFileSync(
    'server/relational/app.js',
    'utf8'
  )

const moduleSource =
  fs.readFileSync(
    'server/routes/admin-observability.routes.js',
    'utf8'
  )

assert(
  app.includes(
    "import { registerAdminObservabilityRoutes } from '../routes/admin-observability.routes.js'"
  ),
  'Admin Observability import missing'
)

assert(
  app.includes(
    'registerAdminObservabilityRoutes('
  ),
  'Admin Observability registrar missing'
)

const targets = [
  '/api/admin/stats',
  '/api/admin/command-center',
  '/api/admin/audit',
  '/api/admin/insights'
]

for (
  const route of targets
) {
  assert(
    moduleSource.includes(route),
    `Admin Observability route missing: ${route}`
  )
}

/*
 * app.js must no longer directly own them.
 */
const appRouteRe =
  /\bapp\s*\.\s*(get|post|put|patch|delete)\s*\(\s*(['"`])([^'"`]+)\2/g

for (
  const match of app.matchAll(
    appRouteRe
  )
) {
  assert(
    !targets.includes(
      match[3]
    ),
    `Admin Observability route still app-owned: ${match[3]}`
  )
}

assert(
  app.includes(
    "app.use('/api/admin',auth,requireRole('admin'),adminIpGuard,limits.admin)"
  ),
  'Admin auth middleware changed'
)

assert(
  app.includes(
    "app.use('/api/admin',(req,res,next)=>['GET','HEAD','OPTIONS'].includes(req.method)?next():limits.adminWrite(req,res,next))"
  ),
  'Admin write limiter changed'
)

assert(
  moduleSource.includes(
    'Admin.stats()'
  ),
  'Admin.stats integration changed'
)

assert(
  moduleSource.includes(
    'Admin.commandCenter()'
  ),
  'Admin.commandCenter integration changed'
)

assert(
  moduleSource.includes(
    'pagination(req.query'
  ),
  'Audit pagination changed'
)

assert(
  moduleSource.includes(
    'audit_logs'
  ),
  'Audit log SQL changed'
)

for (
  const table of [
    'professional_analytics_daily',
    'professionals',
    'bookings',
    'users',
    'reviews',
    'generate_series'
  ]
) {
  assert(
    moduleSource.includes(table),
    `Insights SQL coupling missing: ${table}`
  )
}

/*
 * Protected boundaries.
 */
assert(
  app.includes(
    '/api/webhooks/stripe'
  ),
  'Stripe webhook moved'
)

assert(
  app.includes(
    '/api/live'
  ),
  'Realtime SSE route moved'
)

assert(
  app.includes(
    '/api/admin/subscriptions'
  ),
  'Admin subscriptions moved prematurely'
)

assert(
  app.includes(
    '/api/admin/professionals/:id/sync-subscription'
  ),
  'Admin subscription sync moved prematurely'
)

console.log(
  'MELEO v6.3.0 Admin Observability architecture check: OK'
)

console.log(
  '[PASS] 4 Admin Observability routes modular'
)

console.log(
  '[PASS] Admin.stats preserved'
)

console.log(
  '[PASS] Admin.commandCenter preserved'
)

console.log(
  '[PASS] audit pagination + SQL preserved'
)

console.log(
  '[PASS] insights SQL contract preserved'
)

console.log(
  '[PASS] admin auth remains path-scoped'
)

console.log(
  '[PASS] Stripe/SSE/subscription boundaries untouched'
)
