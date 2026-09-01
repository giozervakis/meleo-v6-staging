import fs from 'node:fs'


const app =
  fs.readFileSync(
    'server/relational/app.js',
    'utf8'
  )


const privacy =
  fs.readFileSync(
    'server/routes/account-privacy.routes.js',
    'utf8'
  )


const assert =
  (
    condition,
    message
  ) => {
    if (!condition) {
      throw new Error(
        message
      )
    }
  }


// ----------------------------------------------------------
// Extracted route ownership
// Formatting is intentionally whitespace-tolerant.
// ----------------------------------------------------------

const routes = [
  {
    pattern:
      /app\.post\(\s*['"]\/api\/me\/change-password['"]/,
    label:
      'POST /api/me/change-password'
  },
  {
    pattern:
      /app\.get\(\s*['"]\/api\/me\/export['"]/,
    label:
      'GET /api/me/export'
  },
  {
    pattern:
      /app\.delete\(\s*['"]\/api\/me['"]/,
    label:
      'DELETE /api/me'
  }
]


for (
  const {
    pattern,
    label
  } of routes
) {
  assert(
    pattern.test(
      privacy
    ),
    `privacy route missing: ${label}`
  )

  assert(
    !pattern.test(
      app
    ),
    `privacy route still directly owned by app.js: ${label}`
  )
}


// ----------------------------------------------------------
// Module registration
// ----------------------------------------------------------

assert(
  app.includes(
    "import { registerAccountPrivacyRoutes } from '../routes/account-privacy.routes.js'"
  ),
  'privacy route import missing'
)


assert(
  app.includes(
    'registerAccountPrivacyRoutes('
  ),
  'privacy route registration missing'
)


// ----------------------------------------------------------
// Security / privacy behavior
// ----------------------------------------------------------

for (
  const marker of [
    'verifyPassword',
    'hashPassword',
    'clearSessionCookie'
  ]
) {
  assert(
    privacy.includes(
      marker
    ),
    `privacy/security behavior missing: ${marker}`
  )
}


// D10E.5A:
// Password mutation and session revocation now belong to
// one PostgreSQL transaction rather than split repository calls.

assert(
  privacy.includes(
    'await tx(async client=>{'
  ),
  'privacy transaction boundary missing'
)


assert(
  privacy.includes(
    'DELETE FROM sessions'
  ),
  'transactional session revocation missing'
)


assert(
  !privacy.includes(
    'Sessions.revokeUser('
  ),
  'privacy route still contains split Sessions.revokeUser call'
)


// ----------------------------------------------------------
// Existing architectural boundary
// ----------------------------------------------------------

assert(
  app.includes(
    "app.get('/api/live'"
  ),
  '/api/live moved prematurely'
)


console.log(
  'MELEO v6.3.0 account privacy routes architecture check: OK'
)

console.log(
  '[PASS] password lifecycle modular'
)

console.log(
  '[PASS] password/session lifecycle transactional'
)

console.log(
  '[PASS] GDPR export modular'
)

console.log(
  '[PASS] account deletion modular'
)

console.log(
  '[PASS] realtime SSE remains in app.js'
)
