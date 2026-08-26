import fs from 'node:fs'
import crypto from 'node:crypto'

const appFile =
  'server/relational/app.js'

const authFile =
  'server/routes/auth-account.routes.js'


const source =
  fs
    .readFileSync(
      appFile,
      'utf8'
    )
    .replace(
      /^\uFEFF/,
      ''
    )


const authStartMarker =
  "app.post('/api/auth/register'"

const authEndMarker =
  'const PROFILE_AVATARS=['


const start =
  source.indexOf(
    authStartMarker
  )

const end =
  source.indexOf(
    authEndMarker,
    start
  )


if (
  start === -1
) {
  throw new Error(
    'Could not locate /api/auth/register'
  )
}


if (
  end === -1
) {
  throw new Error(
    'Could not locate PROFILE_AVATARS boundary'
  )
}


if (
  end <= start
) {
  throw new Error(
    'Invalid auth extraction boundaries'
  )
}


const before =
  source.slice(
    0,
    start
  )

const authBlock =
  source.slice(
    start,
    end
  )

const after =
  source.slice(
    end
  )


const expectedRoutes = [
  ['post', '/api/auth/register'],
  ['post', '/api/auth/login'],
  ['post', '/api/auth/logout'],
  ['post', '/api/auth/social-demo'],
  ['post', '/api/auth/forgot-password'],
  ['post', '/api/auth/reset-password'],
  ['post', '/api/auth/verify-email'],
  ['post', '/api/auth/verify-email/resend'],
  ['get', '/api/me'],
  ['post', '/api/me/enable-professional'],
  ['get', '/api/me/sessions'],
  ['delete', '/api/me/sessions/others'],
  ['put', '/api/me']
]


for (
  const [
    method,
    route
  ] of expectedRoutes
) {
  const needle =
    `app.${method}('${route}'`

  if (
    !authBlock.includes(
      needle
    )
  ) {
    throw new Error(
      `Auth extraction block missing ${method.toUpperCase()} ${route}`
    )
  }
}


const routeRegex =
  /app\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g

const extracted = []

let match

while (
  (
    match =
      routeRegex.exec(
        authBlock
      )
  ) !== null
) {
  extracted.push(
    `${match[1].toUpperCase()} ${match[2]}`
  )
}


if (
  extracted.length !==
  expectedRoutes.length
) {
  throw new Error(
    `Expected ${expectedRoutes.length} routes in auth block; found ${extracted.length}`
  )
}


const hash =
  value =>
    crypto
      .createHash('sha256')
      .update(value)
      .digest('hex')


const immutableAfterHash =
  hash(after)


const moduleSource =
`/*
 * MELEO v6.3.0
 *
 * Authentication, session and core account routes.
 *
 * Route handlers are intentionally dependency-injected.
 * Authentication primitives and application services remain
 * owned by the relational application composition root.
 */

export function registerAuthAccountRoutes(
  app,
  deps
) {
  const {
    config,
    limits,
    auth,
    requireVerifiedEmail,

    str,
    isEmail,
    passwordPolicy,
    passwordPolicyError,

    Users,
    Sessions,
    Professionals,

    hashPassword,
    verifyPassword,
    matchTotpStep,

    createToken,
    consumeToken,
    issueSession,
    clearSessionCookie,

    mail,
    audit,
    publicUser,

    id,
    now,
    sha256
  } = deps


  if (!app) {
    throw new Error(
      'registerAuthAccountRoutes requires an Express app'
    )
  }


  const required = {
    config,
    limits,
    auth,
    requireVerifiedEmail,

    str,
    isEmail,
    passwordPolicy,
    passwordPolicyError,

    Users,
    Sessions,
    Professionals,

    hashPassword,
    verifyPassword,
    matchTotpStep,

    createToken,
    consumeToken,
    issueSession,
    clearSessionCookie,

    mail,
    audit,
    publicUser,

    id,
    now,
    sha256
  }


  for (
    const [
      name,
      value
    ] of Object.entries(
      required
    )
  ) {
    if (
      value === undefined ||
      value === null
    ) {
      throw new Error(
        \`registerAuthAccountRoutes missing dependency: \${name}\`
      )
    }
  }


${authBlock
  .split('\n')
  .map(
    line =>
      line.length
        ? '  ' + line
        : ''
  )
  .join('\n')
}
}
`


fs.writeFileSync(
  authFile,
  moduleSource,
  'utf8'
)


let next =
  before +
  `registerAuthAccountRoutes(
  app,
  {
    config,
    limits,
    auth,
    requireVerifiedEmail,

    str,
    isEmail,
    passwordPolicy,
    passwordPolicyError,

    Users,
    Sessions,
    Professionals,

    hashPassword,
    verifyPassword,
    matchTotpStep,

    createToken,
    consumeToken,
    issueSession,
    clearSessionCookie,

    mail,
    audit,
    publicUser,

    id,
    now,
    sha256
  }
)

` +
  after


const importLine =
  "import { registerAuthAccountRoutes } from '../routes/auth-account.routes.js'"


if (
  !next.includes(
    importLine
  )
) {
  const lifecycleImport =
    "import { registerLifecycleRoutes } from '../routes/lifecycle.routes.js'"

  const systemImport =
    "import { registerSystemRoutes } from '../routes/system.routes.js'"


  if (
    next.includes(
      lifecycleImport
    )
  ) {
    next =
      next.replace(
        lifecycleImport,
        lifecycleImport +
        '\n' +
        importLine
      )
  }
  else if (
    next.includes(
      systemImport
    )
  ) {
    next =
      next.replace(
        systemImport,
        systemImport +
        '\n' +
        importLine
      )
  }
  else {
    throw new Error(
      'Could not locate modular route import region'
    )
  }
}


if (
  next.includes(
    authStartMarker
  )
) {
  throw new Error(
    'Direct /api/auth/register route still remains in app.js'
  )
}


if (
  !next.includes(
    'registerAuthAccountRoutes('
  )
) {
  throw new Error(
    'Auth route registration missing from app.js'
  )
}


const nextAfter =
  next.slice(
    next.indexOf(
      authEndMarker
    )
  )


if (
  hash(nextAfter) !==
  immutableAfterHash
) {
  throw new Error(
    'Source after PROFILE_AVATARS boundary changed unexpectedly'
  )
}


fs.writeFileSync(
  appFile,
  next,
  'utf8'
)


console.log(
  '[PASS] 13 core auth/account routes extracted'
)

console.log(
  '[PASS] auth-account.routes.js created'
)

console.log(
  '[PASS] post-auth application region byte-identical'
)

console.log(
  '[PASS] registration inserted at original route position'
)
