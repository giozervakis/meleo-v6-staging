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

const moduleSource =
  fs.readFileSync(
    'server/routes/smart-request.routes.js',
    'utf8'
  )


assert(
  app.includes(
    "import { registerSmartRequestRoutes } from '../routes/smart-request.routes.js'"
  ),
  'Smart Request registrar import missing'
)

assert(
  app.includes(
    'registerSmartRequestRoutes('
  ),
  'Smart Request registrar invocation missing'
)


for (
  const route of [
    '/api/smart-request/unmatched',
    '/api/smart-request/learned-match',
    '/api/admin/smart-requests',
    '/api/admin/smart-requests/:id'
  ]
) {
  assert(
    moduleSource.includes(route),
    `Smart Request route missing: ${route}`
  )
}


assert(
  !app.includes(
    "app.post('/api/smart-request/unmatched'"
  ) &&
  !app.includes(
    "app.post(\n  '/api/smart-request/unmatched'"
  ),
  'Unmatched route still application-owned'
)

assert(
  !app.includes(
    "app.post('/api/smart-request/learned-match'"
  ) &&
  !app.includes(
    "app.post(\n  '/api/smart-request/learned-match'"
  ),
  'Learned-match route still application-owned'
)

assert(
  !app.includes(
    "app.get('/api/admin/smart-requests'"
  ) &&
  !app.includes(
    "app.get(\n  '/api/admin/smart-requests'"
  ),
  'Admin Smart Request list still application-owned'
)

assert(
  !app.includes(
    "app.patch('/api/admin/smart-requests/:id'"
  ) &&
  !app.includes(
    "app.patch(\n  '/api/admin/smart-requests/:id'"
  ),
  'Admin Smart Request patch still application-owned'
)


assert(
  moduleSource.includes(
    'ensureSmartLearningSchema'
  ),
  'Schema helper injection lost'
)

assert(
  moduleSource.includes(
    'normalizeSmartRequest'
  ),
  'Normalizer injection lost'
)

assert(
  moduleSource.includes(
    'smart_request_learning'
  ),
  'Smart Learning persistence lost'
)

assert(
  moduleSource.includes(
    'limits.write'
  ),
  'Public write rate limiting changed'
)

assert(
  moduleSource.includes(
    "'new','learned','ignored'"
  ),
  'Admin lifecycle status contract changed'
)

assert(
  moduleSource.includes(
    'audit('
  ),
  'Admin Smart Request audit integration lost'
)

assert(
  app.includes(
    'async function ensureSmartLearningSchema()'
  ),
  'Smart Learning schema helper moved prematurely'
)

assert(
  app.includes(
    'function normalizeSmartRequest(value)'
  ),
  'Smart Request normalizer moved prematurely'
)


console.log(
  'MELEO v6.3.0 Smart Request architecture check: OK'
)

console.log(
  '[PASS] 4 Smart Request routes modular'
)

console.log(
  '[PASS] public/admin route paths preserved'
)

console.log(
  '[PASS] Smart Learning persistence preserved'
)

console.log(
  '[PASS] schema helper shared + injected'
)

console.log(
  '[PASS] normalizer shared + injected'
)

console.log(
  '[PASS] admin audit preserved'
)
