import fs from 'node:fs'

const read =
  file =>
    fs.readFileSync(
      file,
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


const app =
  read(
    'server/relational/app.js'
  )

const authRoutes =
  read(
    'server/routes/auth-account.routes.js'
  )


assert(
  app.includes(
    "import { registerAuthAccountRoutes } from '../routes/auth-account.routes.js'"
  ),
  'auth/account routes import missing'
)


assert(
  app.includes(
    'registerAuthAccountRoutes('
  ),
  'auth/account route registration missing'
)


const expected = [
  'POST /api/auth/register',
  'POST /api/auth/login',
  'POST /api/auth/logout',
  'POST /api/auth/social-demo',
  'POST /api/auth/forgot-password',
  'POST /api/auth/reset-password',
  'POST /api/auth/verify-email',
  'POST /api/auth/verify-email/resend',
  'GET /api/me',
  'POST /api/me/enable-professional',
  'GET /api/me/sessions',
  'DELETE /api/me/sessions/others',
  'PUT /api/me'
]


const regex =
  /app\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g


function routesFrom(
  source
) {
  const routes = []

  let match

  while (
    (
      match =
        regex.exec(source)
    ) !== null
  ) {
    routes.push(
      `${match[1].toUpperCase()} ${match[2]}`
    )
  }

  return routes
}


const owned =
  routesFrom(
    authRoutes
  )


assert(
  owned.length ===
    expected.length,
  `expected ${expected.length} auth/account routes, found ${owned.length}`
)


for (
  const route of expected
) {
  assert(
    owned.includes(
      route
    ),
    `${route} missing from auth-account.routes.js`
  )
}


for (
  const route of expected
) {
  const [
    method,
    path
  ] =
    route.split(' ')

  const direct =
    `app.${method.toLowerCase()}('${path}'`

  assert(
    !app.includes(
      direct
    ),
    `${route} still directly owned by app.js`
  )
}


for (
  const dependency of [
    'limits',
    'auth',
    'requireVerifiedEmail',
    'passwordPolicy',
    'Users',
    'Sessions',
    'Professionals',
    'createToken',
    'consumeToken',
    'issueSession',
    'clearSessionCookie'
  ]
) {
  assert(
    authRoutes.includes(
      dependency
    ),
    `auth dependency missing: ${dependency}`
  )
}


console.log(
  'MELEO v6.3.0 auth/account routes architecture check: OK'
)

console.log(
  '[PASS] 13 core auth/account routes modular'
)

console.log(
  '[PASS] authentication primitives remain dependency-injected'
)
