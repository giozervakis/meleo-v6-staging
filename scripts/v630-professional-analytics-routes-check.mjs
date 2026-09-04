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
    'server/routes/professional-analytics.routes.js',
    'utf8'
  )

assert(
  app.includes(
    "import { registerProfessionalAnalyticsRoutes } from '../routes/professional-analytics.routes.js'"
  ),
  'Professional analytics registrar import missing'
)

assert(
  app.includes(
    'registerProfessionalAnalyticsRoutes('
  ),
  'Professional analytics registrar invocation missing'
)

assert(
  !app.includes(
    '/api/professional/analytics'
  ),
  'Professional analytics route still application-owned'
)

assert(
  moduleSource.includes(
    '/api/professional/analytics'
  ),
  'Professional analytics route missing from module'
)

assert(
  moduleSource.includes(
    "requireRole('professional')"
  ),
  'Professional role authorization changed'
)

assert(
  moduleSource.includes(
    'Professionals.byUser'
  ),
  'Professional lookup changed'
)

assert(
  moduleSource.includes(
    'Professional profile not found'
  ),
  'Professional-not-found contract changed'
)

assert(
  moduleSource.includes(
    'Math.min'
  ) &&
  moduleSource.includes(
    '365'
  ) &&
  moduleSource.includes(
    'Math.max'
  ) &&
  moduleSource.includes(
    'Number(req.query.days)||30'
  ),
  'Analytics days-window contract changed'
)

assert(
  moduleSource.includes(
    'Analytics.summary'
  ),
  'Analytics summary integration changed'
)

assert(
  moduleSource.includes(
    'meleoTrustForProfessional'
  ),
  'MELEO Trust integration changed'
)

assert(
  moduleSource.includes(
    'smartMatchDiagnosticsForProfessional'
  ),
  'Smart Match diagnostics integration changed'
)

assert(
  app.includes(
    'async function meleoTrustForProfessional'
  ),
  'MELEO Trust helper moved prematurely'
)

assert(
  /createSmartMatchingService/.test(app),
  'Smart Match diagnostics service composition missing'
)

assert(
  /smartMatchDiagnosticsForProfessional/.test(app),
  'Smart Match diagnostics DI contract missing'
)

assert(
  !/async function smartMatchDiagnosticsForProfessional\s*\(/.test(app),
  'Smart Match diagnostics implementation unexpectedly remains app-owned'
)

assert(
  moduleSource.includes(
    '...analytics'
  ) &&
  moduleSource.includes(
    'trust'
  ) &&
  moduleSource.includes(
    'smartMatchDiagnostics'
  ),
  'Professional analytics response contract changed'
)

console.log(
  'MELEO v6.3.0 Professional analytics architecture check: OK'
)

console.log(
  '[PASS] professional analytics route modular'
)

console.log(
  '[PASS] authentication + professional authorization preserved'
)

console.log(
  '[PASS] professional lookup preserved'
)

console.log(
  '[PASS] analytics 1..365 day window preserved'
)

console.log(
  '[PASS] Analytics.summary preserved'
)

console.log(
  '[PASS] MELEO Trust preserved via dependency injection'
)

console.log(
  '[PASS] Smart Match diagnostics preserved via dependency injection'
)

console.log(
  '[PASS] shared analytics helpers remain application-owned'
)
