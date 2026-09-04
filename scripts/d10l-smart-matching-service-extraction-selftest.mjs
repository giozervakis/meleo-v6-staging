import assert from 'node:assert/strict'
import fs from 'node:fs'

const app =
  fs.readFileSync(
    'server/relational/app.js',
    'utf8'
  )

const service =
  fs.readFileSync(
    'server/services/smart-matching.service.js',
    'utf8'
  )

function pass(message) {
  console.log('[PASS]', message)
}

assert.match(
  app,
  /createSmartMatchingService/
)

assert.match(
  app,
  /smartMatchDiagnosticsForProfessional/
)

pass(
  'app composes smart matching service'
)

assert.doesNotMatch(
  app,
  /async function smartMatchDiagnosticsForProfessional\s*\(/
)

pass(
  'matching implementation removed from app'
)

assert.match(
  service,
  /export function createSmartMatchingService/
)

assert.match(
  service,
  /async function smartMatchDiagnosticsForProfessional\s*\(/
)

pass(
  'service owns matching diagnostics implementation'
)

assert.match(
  service,
  /\bone\s*\(/
)

assert.match(
  service,
  /meleoTrustForProfessional/
)

pass(
  'minimal one + trust dependency contract preserved'
)

assert.doesNotMatch(
  service,
  /Professionals\./
)

assert.doesNotMatch(
  service,
  /Bookings\./
)

assert.doesNotMatch(
  service,
  /Users\./
)

assert.doesNotMatch(
  service,
  /Analytics\./
)

assert.doesNotMatch(
  service,
  /config\./
)

assert.doesNotMatch(
  service,
  /\bmany\s*\(/
)

assert.doesNotMatch(
  service,
  /\btx\s*\(/
)

pass(
  'service introduces no hidden infrastructure dependencies'
)

assert.match(
  app,
  /async function meleoTrustForProfessional\s*\(/
)

assert.doesNotMatch(
  service,
  /async function meleoTrustForProfessional\s*\(/
)

pass(
  'shared trust capability remains app-owned'
)

const composeIndex =
  app.indexOf(
    'createSmartMatchingService({'
  )

const routeIndex =
  app.indexOf(
    'registerProfessionalAnalyticsRoutes('
  )

assert.ok(
  composeIndex >= 0 &&
  routeIndex >= 0 &&
  composeIndex < routeIndex
)

pass(
  'matching service is composed before analytics route registration'
)

const routeWindow =
  app.slice(
    routeIndex,
    routeIndex + 700
  )

assert.match(
  routeWindow,
  /meleoTrustForProfessional/
)

assert.match(
  routeWindow,
  /smartMatchDiagnosticsForProfessional/
)

pass(
  'professional analytics route DI contract preserved'
)

assert.match(
  service,
  /trust\?\.eligible/
)

assert.match(
  service,
  /trustPoints/
)

assert.match(
  service,
  /profileScore/
)

pass(
  'trust and profile scoring semantics preserved'
)

console.log('')
console.log(
  'MELEO D10L.19 smart matching service extraction self-test: OK'
)
