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


for (
  const route of [
    "app.post('/api/me/change-password'",
    "app.get('/api/me/export'",
    "app.delete('/api/me'"
  ]
) {
  assert(
    privacy.includes(
      route
    ),
    `privacy route missing: ${route}`
  )

  assert(
    !app.includes(
      route
    ),
    `privacy route still directly owned by app.js: ${route}`
  )
}


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


for (
  const marker of [
    'verifyPassword',
    'hashPassword',
    'Sessions.revokeUser',
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
  '[PASS] GDPR export modular'
)

console.log(
  '[PASS] account deletion modular'
)

console.log(
  '[PASS] realtime SSE remains in app.js'
)
