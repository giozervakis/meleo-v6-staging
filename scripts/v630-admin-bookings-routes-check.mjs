import fs from 'node:fs'

const appFile =
  'server/relational/app.js'

const routeFile =
  'server/routes/admin-bookings.routes.js'

const assert =
  (ok,msg) => {
    if (!ok) {
      throw new Error(msg)
    }
  }

const read =
  file =>
    fs.readFileSync(
      file,
      'utf8'
    )

assert(
  fs.existsSync(routeFile),
  'Admin Bookings route module missing'
)

const app =
  read(appFile)

const route =
  read(routeFile)

assert(
  app.includes(
    "import { registerAdminBookingsRoutes } from '../routes/admin-bookings.routes.js'"
  ),
  'Admin Bookings import missing'
)

assert(
  app.includes(
    'registerAdminBookingsRoutes({'
  ),
  'Admin Bookings registration missing'
)

assert(
  /registerAdminBookingsRoutes\s*\(\s*\{[\s\S]*?\bapp\b[\s\S]*?\bBookings\b[\s\S]*?\}\s*\)/m.test(
    app
  ),
  'Admin Bookings dependencies not injected'
)

assert(
  !/\bapp\s*\.\s*get\s*\(\s*(['"`])\/api\/admin\/bookings\1/.test(
    app
  ),
  'Admin Bookings route still application-owned'
)

assert(
  /\bapp\s*\.\s*get\s*\(\s*(['"`])\/api\/admin\/bookings\1/.test(
    route
  ),
  'GET /api/admin/bookings missing from modular owner'
)

assert(
  route.includes(
    'Bookings.listForUser'
  ),
  'Bookings.listForUser contract changed'
)

assert(
  route.includes(
    'req.user.id'
  ),
  'Admin booking user identity contract changed'
)

assert(
  /role\s*:\s*['"]admin['"]/.test(
    route
  ),
  'Admin role contract changed'
)

assert(
  route.includes(
    'req.query'
  ),
  'Admin booking query contract changed'
)

const adminAuth =
  "app.use('/api/admin',auth,requireRole('admin'),adminIpGuard,limits.admin)"

assert(
  app.includes(adminAuth),
  'Admin path-scoped authentication changed'
)

const adminWrite =
  "app.use('/api/admin',(req,res,next)=>['GET','HEAD','OPTIONS'].includes(req.method)?next():limits.adminWrite(req,res,next))"

assert(
  app.includes(adminWrite),
  'Admin path-scoped write limiter changed'
)

const adminSubscriptions =
  fs.readFileSync(
    'server/routes/admin-subscriptions.routes.js',
    'utf8'
  )

for (
  const token of [
    '/api/admin/subscriptions',
    '/api/admin/professionals/:id/sync-subscription'
  ]
) {
  assert(
    adminSubscriptions.includes(token),
    `Protected Admin Subscription boundary changed: ${token}`
  )
}

for (
  const token of [
    '/api/webhooks/stripe',
    '/api/live'
  ]
) {
  assert(
    app.includes(token),
    `Protected application boundary changed: ${token}`
  )
}

console.log(
  'MELEO v6.3.0 Admin Bookings architecture check: OK'
)

console.log(
  '[PASS] 1 Admin Bookings route modular'
)

console.log(
  '[PASS] GET /api/admin/bookings preserved'
)

console.log(
  '[PASS] Bookings.listForUser preserved'
)

console.log(
  '[PASS] admin identity + role contract preserved'
)

console.log(
  '[PASS] booking query forwarding preserved'
)

console.log(
  '[PASS] admin authentication remains path-scoped'
)

console.log(
  '[PASS] admin subscription routes remain independently modular'
)

console.log(
  '[PASS] Stripe webhook remains application-owned'
)

console.log(
  '[PASS] realtime SSE remains application-owned'
)
