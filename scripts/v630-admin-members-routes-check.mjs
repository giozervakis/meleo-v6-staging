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
  read('server/relational/app.js')

const route =
  read('server/routes/admin-members.routes.js')

assert(
  route.includes(
    "app.get('/api/admin/members'"
  ),
  'GET /api/admin/members missing'
)

assert(
  route.includes(
    "app.patch('/api/admin/members/:id/action'"
  ),
  'PATCH /api/admin/members/:id/action missing'
)

assert(
  !app.includes(
    "app.get('/api/admin/members'"
  ),
  'GET /api/admin/members still application-owned'
)

assert(
  !app.includes(
    "app.patch('/api/admin/members/:id/action'"
  ),
  'PATCH /api/admin/members/:id/action still application-owned'
)

assert(
  app.includes(
    "app.use('/api/admin',auth,requireRole('admin'),adminIpGuard,limits.admin)"
  ),
  'Admin authentication boundary changed'
)

assert(
  app.includes(
    "app.use('/api/admin',(req,res,next)=>['GET','HEAD','OPTIONS'].includes(req.method)?next():limits.adminWrite(req,res,next))"
  ),
  'Admin write limiter boundary changed'
)

for (
  const dependency of [
    'one',
    'many',
    'pagination',
    'id',
    'str',
    'now',
    'audit',
    'Users',
    'Professionals'
  ]
) {
  assert(
    route.includes(dependency),
    `Admin Members dependency missing: ${dependency}`
  )
}

assert(
  app.includes(
    'registerAdminMembersRoutes({'
  ),
  'Admin Members registrar missing'
)

console.log(
  'MELEO v6.3.0 Admin Members architecture check: OK'
)

console.log(
  '[PASS] 2 Admin Members routes modular'
)

console.log(
  '[PASS] GET /api/admin/members preserved'
)

console.log(
  '[PASS] PATCH /api/admin/members/:id/action preserved'
)

console.log(
  '[PASS] admin authentication remains path-scoped'
)

console.log(
  '[PASS] admin write rate limit preserved'
)

console.log(
  '[PASS] member dependencies injected'
)


const adminMembersAppSource =
  fs.readFileSync(
    'server/relational/app.js',
    'utf8'
  )

const adminMembersRouteSource =
  fs.readFileSync(
    'server/routes/admin-members.routes.js',
    'utf8'
  )

assert(
  adminMembersRouteSource.includes(
    'limits.write'
  ),
  'Admin Members limits.write dependency lost'
)

assert(
  adminMembersRouteSource.includes(
    'Sessions.revokeUser'
  ),
  'Admin Members Sessions revocation dependency lost'
)

const adminMembersRegistrationIndex =
  adminMembersAppSource.indexOf(
    'registerAdminMembersRoutes('
  )

assert(
  adminMembersRegistrationIndex >= 0,
  'Admin Members registrar missing'
)

const adminMembersRegistrationRegion =
  adminMembersAppSource.slice(
    adminMembersRegistrationIndex,
    adminMembersRegistrationIndex + 3000
  )

assert(
  /\blimits\b/.test(
    adminMembersRegistrationRegion
  ),
  'Admin Members limits dependency not injected'
)

assert(
  /\bSessions\b/.test(
    adminMembersRegistrationRegion
  ),
  'Admin Members Sessions dependency not injected'
)

console.log(
  '[PASS] Admin Members runtime dependency injection preserved'
)

console.log(
  '[PASS] audit integration preserved'
)
