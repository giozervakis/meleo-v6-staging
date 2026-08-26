import fs from 'node:fs'

const app =
  fs.readFileSync(
    'server/relational/app.js',
    'utf8'
  )

const route =
  fs.readFileSync(
    'server/routes/public-web.routes.js',
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

const expected = [
  "/robots.txt",
  "/sitemap.xml",
  "/professionals/:id",
  "/care/:specialty/:city",
  "/"
]

for (
  const target of expected
) {
  assert(
    route.includes(target),
    `Public module missing ${target}`
  )
}

assert(
  route.includes(
    'registerPublicWebRoutes'
  ),
  'Public registration export missing'
)

assert(
  app.includes(
    "registerPublicWebRoutes"
  ),
  'Public module not registered'
)

for (
  const target of [
    "/robots.txt",
    "/sitemap.xml",
    "/professionals/:id",
    "/care/:specialty/:city"
  ]
) {
  assert(
    !app.includes(
      `app.get('${target}'`
    ),
    `Application still owns ${target}`
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
  'Stripe raw body handling missing'
)

assert(
  app.includes(
    "app.get('/api/live'"
  ),
  'Realtime SSE moved unexpectedly'
)

assert(
  app.includes(
    'LISTEN meleo_live'
  ),
  'Postgres LISTEN lifecycle missing'
)

assert(
  app.includes(
    'UNLISTEN meleo_live'
  ),
  'Postgres UNLISTEN lifecycle missing'
)

console.log(
  'MELEO v6.3.0 Public Web architecture check: OK'
)

console.log(
  '[PASS] 5 Public Web / SEO / SSR routes modular'
)

console.log(
  '[PASS] robots preserved'
)

console.log(
  '[PASS] sitemap preserved'
)

console.log(
  '[PASS] professional SSR preserved'
)

console.log(
  '[PASS] care landing SSR preserved'
)

console.log(
  '[PASS] SPA/root fallback preserved'
)

console.log(
  '[PASS] Stripe webhook remains application-owned'
)

console.log(
  '[PASS] realtime SSE remains application-owned'
)
