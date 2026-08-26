import fs from 'node:fs'

function read(file) {
  return fs.readFileSync(
    file,
    'utf8'
  )
}

function assert(
  condition,
  message
) {
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

const lifecycle =
  read(
    'server/routes/lifecycle.routes.js'
  )


assert(
  app.includes(
    "registerLifecycleRoutes"
  ),
  'relational app does not register lifecycle routes'
)


assert(
  lifecycle.includes(
    '/api/ready'
  ),
  '/api/ready missing from lifecycle module'
)


assert(
  !app.includes(
    "app.get('/api/ready'"
  ),
  'legacy /api/ready ownership remains in relational app'
)


assert(
  app.includes(
    "app.get('/api/live'"
  ),
  '/api/live must remain in relational app during Part 4A-3'
)


assert(
  lifecycle.includes(
    'redisPing'
  ),
  'readiness Redis dependency missing'
)


assert(
  lifecycle.includes(
    'storageReady'
  ),
  'readiness object-storage dependency missing'
)


assert(
  lifecycle.includes(
    'SELECT 1'
  ),
  'readiness PostgreSQL probe missing'
)


assert(
  app.includes(
    'LISTEN meleo_live'
  ),
  'Postgres realtime listener moved unexpectedly'
)


assert(
  app.includes(
    'UNLISTEN meleo_live'
  ),
  'Postgres realtime shutdown lifecycle moved unexpectedly'
)


assert(
  app.includes(
    'liveClients'
  ),
  'SSE client lifecycle moved unexpectedly'
)


console.log(
  'MELEO v6.3.0 lifecycle routes architecture check: OK'
)
