import fs from 'node:fs'
import path from 'node:path'

const appFile =
  'server/relational/app.js'

const routeFile =
  'server/routes/admin-reports.routes.js'

const app =
  fs.readFileSync(
    appFile,
    'utf8'
  )

const route =
  fs.readFileSync(
    routeFile,
    'utf8'
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
  route.includes(
    '/api/admin/reports'
  ),
  'Admin reports list route missing from module'
)

assert(
  route.includes(
    '/api/admin/reports/:id'
  ),
  'Admin reports patch route missing from module'
)

assert(
  !app.includes(
    "app.get('/api/admin/reports'"
  ) &&
  !app.includes(
    'app.get("/api/admin/reports"'
  ),
  'Admin reports GET still application-owned'
)

assert(
  !app.includes(
    "app.patch('/api/admin/reports/:id'"
  ) &&
  !app.includes(
    'app.patch("/api/admin/reports/:id"'
  ),
  'Admin reports PATCH still application-owned'
)

assert(
  app.includes(
    "app.use('/api/admin',auth,requireRole('admin'),adminIpGuard,limits.admin)"
  ),
  'Admin authorization middleware changed'
)

assert(
  app.includes(
    "app.use('/api/admin',(req,res,next)=>['GET','HEAD','OPTIONS'].includes(req.method)?next():limits.adminWrite(req,res,next))"
  ),
  'Admin write limiter changed'
)

assert(
  app.indexOf(
    "app.use('/api/admin',auth,requireRole('admin'),adminIpGuard,limits.admin)"
  ) <
  app.indexOf(
    'registerAdminReportsRoutes({'
  ),
  'Admin Reports registrar must follow admin auth middleware'
)

assert(
  app.indexOf(
    "app.use('/api/admin',(req,res,next)=>['GET','HEAD','OPTIONS'].includes(req.method)?next():limits.adminWrite(req,res,next))"
  ) <
  app.indexOf(
    'registerAdminReportsRoutes({'
  ),
  'Admin Reports registrar must follow admin write limiter'
)

for (
  const dep of [
    'pagination',
    'many',
    'sql',
    'id',
    'str',
    'now'
  ]
) {
  assert(
    new RegExp(
      `\\b${dep}\\b`
    ).test(route),
    `Dependency missing from Admin Reports module: ${dep}`
  )
}

assert(
  route.includes(
    'registerAdminReportsRoutes'
  ),
  'Admin Reports registrar export missing'
)

const files = [
  appFile,

  ...fs
    .readdirSync(
      'server/routes'
    )
    .filter(
      file =>
        file.endsWith('.routes.js')
    )
    .map(
      file =>
        path.join(
          'server/routes',
          file
        )
    )
]

const targets = [
  {
    method: 'GET',
    path: '/api/admin/reports'
  },
  {
    method: 'PATCH',
    path: '/api/admin/reports/:id'
  }
]

const routeRe =
  /\bapp\s*\.\s*(get|post|put|patch|delete)\s*\(\s*(['"`])([^'"`]+)\2/g

for (
  const target of targets
) {
  const owners = []

  for (
    const file of files
  ) {
    const source =
      fs.readFileSync(
        file,
        'utf8'
      )

    for (
      const match of source.matchAll(
        routeRe
      )
    ) {
      if (
        match[1].toUpperCase() ===
          target.method &&
        match[3] ===
          target.path
      ) {
        owners.push(file)
      }
    }
  }

  assert(
    owners.length === 1 &&
    owners[0]
      .replace(/\\/g,'/') ===
      'server/routes/admin-reports.routes.js',
    `Invalid owner for ${target.method} ${target.path}: ${owners.join(', ')}`
  )
}

console.log(
  'MELEO v6.3.0 Admin Reports architecture check: OK'
)

console.log(
  '[PASS] admin reports routes modular'
)

console.log(
  '[PASS] GET /api/admin/reports preserved'
)

console.log(
  '[PASS] PATCH /api/admin/reports/:id preserved'
)

console.log(
  '[PASS] admin authorization remains path-scoped'
)

console.log(
  '[PASS] admin write rate limit preserved'
)

console.log(
  '[PASS] reports dependencies injected'
)

console.log(
  '[PASS] Admin Reports sole ownership'
)
