import fs from 'node:fs'

const app =
  fs.readFileSync(
    'server/relational/app.js',
    'utf8'
  )

const profile =
  fs.readFileSync(
    'server/routes/account-profile.routes.js',
    'utf8'
  )

const expected = [
  "app.put('/api/me/avatar'",
  "app.post('/api/me/profile-photo'",
  "app.delete('/api/me/profile-photo'",
  "app.get('/api/profile-photo/:userId'"
]

for (
  const route of expected
) {
  if (!profile.includes(route)) {
    console.error(
      'Profile module route missing:',
      route
    )
    process.exit(1)
  }

  if (app.includes(route)) {
    console.error(
      'Profile route still owned by app.js:',
      route
    )
    process.exit(1)
  }
}

const privacy =
  fs.readFileSync(
    'server/routes/account-privacy.routes.js',
    'utf8'
  )

for (
  const route of [
    "app.post('/api/me/change-password'",
    "app.get('/api/me/export'",
    "app.delete('/api/me'"
  ]
) {
  if (!privacy.includes(route)) {
    console.error(
      'Privacy route missing from account-privacy.routes.js:',
      route
    )
    process.exit(1)
  }

  if (app.includes(route)) {
    console.error(
      'Privacy route still owned by app.js:',
      route
    )
    process.exit(1)
  }
}

if (
  !app.includes(
    "registerAccountProfileRoutes"
  )
) {
  console.error(
    'Profile module not registered'
  )
  process.exit(1)
}

console.log(
  'MELEO v6.3.0 account profile routes architecture check: OK'
)

console.log(
  '[PASS] 4 profile/media routes modular'
)

console.log(
  '[PASS] privacy/account lifecycle routes modular'
)
