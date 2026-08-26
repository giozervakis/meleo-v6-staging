import fs from 'node:fs'
import path from 'node:path'

const appFile =
  'server/relational/app.js'

const source =
  fs.readFileSync(
    appFile,
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

function contains(
  token
) {
  return source.includes(token)
}

const routeRe =
  /\bapp\s*\.\s*(get|post|put|patch|delete)\s*\(\s*(['"`])([^'"`]+)\2/g

const appRoutes =
  [...source.matchAll(routeRe)]
    .map(
      match =>
        `${match[1].toUpperCase()} ${match[3]}`
    )

assert(
  appRoutes.length === 2,
  `expected exactly 2 application-owned routes, detected ${appRoutes.length}`
)

assert(
  appRoutes.includes(
    'POST /api/webhooks/stripe'
  ),
  'Stripe webhook must remain application-owned'
)

assert(
  appRoutes.includes(
    'GET /api/live'
  ),
  'Realtime SSE route must remain application-owned'
)

assert(
  contains(
    "app.post('/api/webhooks/stripe'"
  ),
  'Stripe webhook registration missing'
)

assert(
  contains(
    'express.raw('
  ),
  'Stripe raw-body parser missing'
)

assert(
  contains(
    'webhookSecret'
  ),
  'Stripe webhook secret contract missing'
)

assert(
  contains(
    'applyStripeSubscription'
  ),
  'Stripe subscription application contract missing'
)

assert(
  contains(
    "app.get('/api/live'"
  ),
  'Realtime SSE route missing'
)

assert(
  contains(
    'text/event-stream'
  ),
  'SSE content type missing'
)

assert(
  contains(
    'liveClients'
  ),
  'SSE client registry missing'
)

assert(
  contains(
    'LISTEN meleo_live'
  ),
  'PostgreSQL realtime LISTEN missing'
)

assert(
  contains(
    'UNLISTEN meleo_live'
  ),
  'PostgreSQL realtime UNLISTEN missing'
)

assert(
  contains(
    'liveClients.clear()'
  ),
  'SSE shutdown cleanup missing'
)

assert(
  contains(
    'server.close('
  ),
  'HTTP graceful shutdown contract missing'
)

assert(
  contains(
    "'SIGTERM'"
  ),
  'SIGTERM shutdown contract missing'
)

assert(
  contains(
    "'SIGINT'"
  ),
  'SIGINT shutdown contract missing'
)

const routeFiles = [
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

const allRoutes = []

for (
  const file of routeFiles
) {
  const fileSource =
    fs.readFileSync(
      file,
      'utf8'
    )

  for (
    const match of fileSource.matchAll(
      routeRe
    )
  ) {
    allRoutes.push(
      `${match[1].toUpperCase()} ${match[3]}`
    )
  }
}

const unique =
  new Set(allRoutes)

const duplicates =
  [
    ...new Set(
      allRoutes.filter(
        (route,index) =>
          allRoutes.indexOf(route) !== index
      )
    )
  ]

assert(
  allRoutes.length === 93,
  `expected 93 API routes, detected ${allRoutes.length}`
)

assert(
  unique.size === 93,
  `expected 93 unique API routes, detected ${unique.size}`
)

assert(
  duplicates.length === 0,
  `duplicate API routes detected: ${duplicates.join(', ')}`
)

console.log(
  'MELEO v6.3.0 application boundary architecture check: OK'
)

console.log(
  '[PASS] exactly 2 intentional application-owned routes'
)

console.log(
  '[PASS] Stripe webhook remains composition-root owned'
)

console.log(
  '[PASS] Stripe raw-body contract preserved'
)

console.log(
  '[PASS] Stripe subscription application contract preserved'
)

console.log(
  '[PASS] realtime SSE remains composition-root owned'
)

console.log(
  '[PASS] PostgreSQL LISTEN/UNLISTEN lifecycle preserved'
)

console.log(
  '[PASS] SSE client shutdown contract preserved'
)

console.log(
  '[PASS] SIGTERM/SIGINT graceful shutdown preserved'
)

console.log(
  '[PASS] 93 unique API routes preserved'
)
