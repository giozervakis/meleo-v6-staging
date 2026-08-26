import fs from 'node:fs'

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

const seo =
  fs.readFileSync(
    'server/routes/seo.routes.js',
    'utf8'
  )

assert(
  app.includes(
    "import { registerSeoRoutes } from '../routes/seo.routes.js'"
  ),
  'SEO registrar import missing'
)

assert(
  app.includes(
    'registerSeoRoutes({'
  ),
  'SEO registrar invocation missing'
)

assert(
  !app.includes(
    "app.get('/api/seo/resolve'"
  ),
  'SEO resolve remains application-owned'
)

assert(
  seo.includes(
    "'/api/seo/resolve'"
  ),
  'SEO resolve route missing'
)

assert(
  seo.includes(
    'req.query.specialty'
  ) &&
  seo.includes(
    'req.query.city'
  ),
  'SEO query contract changed'
)

assert(
  seo.includes(
    'str('
  ) &&
  seo.includes(
    '120'
  ),
  'SEO query normalization changed'
)

assert(
  seo.includes(
    'SELECT DISTINCT specialty,city'
  ),
  'SEO SQL projection changed'
)

for (
  const condition of [
    'verified=true',
    'admin_suspended=false',
    "subscription_status='active'",
    "specialty<>''",
    "city<>''",
    'LIMIT 3000'
  ]
) {
  assert(
    seo.includes(
      condition
    ),
    `SEO SQL filter changed: ${condition}`
  )
}

assert(
  seo.includes(
    'slugify('
  ),
  'SEO slug matching changed'
)

assert(
  seo.includes(
    "error: 'Not found'"
  ) ||
  seo.includes(
    "error:'Not found'"
  ),
  'SEO 404 contract changed'
)

assert(
  app.includes(
    'function slugify'
  ),
  'Shared slugify helper moved prematurely'
)

/*
 * Public SEO / SSR layer must stay in app.js.
 */
for (
  const marker of [
    '/robots.txt',
    '/sitemap.xml',
    '/professionals/:id',
    '/care/:specialty/:city',
    'function injectSeo'
  ]
) {
  assert(
    app.includes(
      marker
    ),
    `Public SEO layer changed: ${marker}`
  )
}

console.log(
  'MELEO v6.3.0 SEO routes architecture check: OK'
)

console.log(
  '[PASS] SEO resolve modular'
)

console.log(
  '[PASS] query normalization preserved'
)

console.log(
  '[PASS] directory SQL contract preserved'
)

console.log(
  '[PASS] slug matching preserved'
)

console.log(
  '[PASS] shared slugify helper remains application-owned'
)

console.log(
  '[PASS] public HTML SEO routes remain application-owned'
)
