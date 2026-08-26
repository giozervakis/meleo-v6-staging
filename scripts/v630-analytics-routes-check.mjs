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

const analytics =
  fs.readFileSync(
    'server/routes/analytics.routes.js',
    'utf8'
  )

assert(
  app.includes(
    "import { registerAnalyticsRoutes } from '../routes/analytics.routes.js'"
  ),
  'Analytics registrar import missing'
)

assert(
  app.includes(
    'registerAnalyticsRoutes({'
  ),
  'Analytics registrar invocation missing'
)

assert(
  app.includes(
    'const fingerprint='
  ) ||
  app.includes(
    'const fingerprint ='
  ),
  'shared fingerprint helper moved prematurely'
)

assert(
  !app.includes(
    "app.post('/api/analytics/professional-event'"
  ),
  'Analytics route remains application-owned'
)

assert(
  analytics.includes(
    "'/api/analytics/professional-event'"
  ),
  'Analytics route missing from module'
)

assert(
  analytics.includes(
    'limits.analytics'
  ),
  'Analytics rate limit changed'
)

for (
  const contract of [
    'professionalId',
    'sessionId',
    "'impression'",
    "'profile_view'",
    "'phone_click'",
    "'Invalid event'"
  ]
) {
  assert(
    analytics.includes(
      contract
    ),
    `Analytics contract missing: ${contract}`
  )
}

assert(
  analytics.includes(
    'type === \'impression\''
  ) &&
  analytics.includes(
    '? 60'
  ),
  'Analytics impression window changed'
)

assert(
  analytics.includes(
    "type === 'profile_view'"
  ) &&
  analytics.includes(
    '? 30'
  ),
  'Analytics profile-view window changed'
)

assert(
  analytics.includes(
    ': 5'
  ),
  'Analytics phone-click window changed'
)

assert(
  analytics.includes(
    'fingerprint('
  ),
  'Analytics fingerprinting changed'
)

assert(
  analytics.includes(
    "sha256("
  ) &&
  analytics.includes(
    "req.ip || ''"
  ),
  'Analytics IP hashing changed'
)

assert(
  analytics.includes(
    ".toISOString()"
  ) &&
  analytics.includes(
    '.slice(0,13)'
  ),
  'Analytics hourly attribution bucket changed'
)

assert(
  analytics.includes(
    'Analytics.event('
  ),
  'Analytics repository integration changed'
)

assert(
  analytics.includes(
    'accepted'
  ) &&
  analytics.includes(
    'ok: true'
  ),
  'Analytics response contract changed'
)

console.log(
  'MELEO v6.3.0 Analytics routes architecture check: OK'
)

console.log(
  '[PASS] professional-event route modular'
)

console.log(
  '[PASS] analytics rate limit preserved'
)

console.log(
  '[PASS] event-type validation preserved'
)

console.log(
  '[PASS] dedup windows preserved'
)

console.log(
  '[PASS] privacy-preserving IP hash preserved'
)

console.log(
  '[PASS] fingerprint helper remains shared'
)

console.log(
  '[PASS] Analytics repository remains injected'
)
