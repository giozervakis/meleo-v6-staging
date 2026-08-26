import fs from 'node:fs'

const appFile =
  'server/relational/app.js'

const moduleFile =
  'server/routes/account-profile.routes.js'

let source =
  fs.readFileSync(
    appFile,
    'utf8'
  )

const original = source

const startMarker =
  'const PROFILE_AVATARS=['

const endMarker =
  "app.post('/api/me/change-password'"

const start =
  source.indexOf(startMarker)

const end =
  source.indexOf(endMarker)

if (
  start < 0 ||
  end < 0 ||
  end <= start
) {
  throw new Error(
    'Could not locate exact profile/media region'
  )
}

const block =
  source.slice(
    start,
    end
  )

const expectedRoutes = [
  "app.put('/api/me/avatar'",
  "app.post('/api/me/profile-photo'",
  "app.delete('/api/me/profile-photo'",
  "app.get('/api/profile-photo/:userId'"
]

for (
  const route of expectedRoutes
) {
  if (!block.includes(route)) {
    throw new Error(
      `Profile route missing from extraction block: ${route}`
    )
  }
}

if (
  block.includes(
    "app.post('/api/me/change-password'"
  ) ||
  block.includes(
    "app.get('/api/me/export'"
  ) ||
  block.includes(
    "app.delete('/api/me'"
  )
) {
  throw new Error(
    'Privacy/account route leaked into profile extraction'
  )
}

const moduleSource = `/*
 * MELEO v6.3.0
 *
 * Account profile and profile-media routes.
 *
 * Profile persistence, object storage and authentication
 * dependencies are injected by the application composition root.
 */

export function registerAccountProfileRoutes(
  app,
  deps
) {
  const {
    limits,
    auth,
    str,
    Users,
    audit,
    publicUser,
    profilePhotoObjectKey,
    putVerificationObject,
    getVerificationObject,
    deleteVerificationObject
  } = deps

  if (!app) {
    throw new Error(
      'registerAccountProfileRoutes requires an Express app'
    )
  }

  const required = {
    limits,
    auth,
    str,
    Users,
    audit,
    publicUser,
    profilePhotoObjectKey,
    putVerificationObject,
    getVerificationObject,
    deleteVerificationObject
  }

  for (
    const [name,value]
    of Object.entries(required)
  ) {
    if (
      value === undefined ||
      value === null
    ) {
      throw new Error(
        \`registerAccountProfileRoutes missing dependency: \${name}\`
      )
    }
  }

${block
  .split('\n')
  .map(line => `  ${line}`)
  .join('\n')}
}
`

fs.writeFileSync(
  moduleFile,
  moduleSource,
  'utf8'
)

source =
  source.slice(0,start) +
  source.slice(end)

const importAnchor =
  "import { registerAuthAccountRoutes } from '../routes/auth-account.routes.js'"

if (!source.includes(importAnchor)) {
  throw new Error(
    'Auth route import anchor not found'
  )
}

source =
  source.replace(
    importAnchor,
    `${importAnchor}
import { registerAccountProfileRoutes } from '../routes/account-profile.routes.js'`
  )

const registrationAnchor =
  'registerAuthAccountRoutes('

const registrationStart =
  source.indexOf(registrationAnchor)

if (registrationStart < 0) {
  throw new Error(
    'Auth route registration not found'
  )
}

function findMatchingParen(
  text,
  openIndex
) {
  let depth = 0
  let quote = null
  let escape = false

  for (
    let i = openIndex;
    i < text.length;
    i++
  ) {
    const ch = text[i]

    if (quote) {
      if (escape) {
        escape = false
        continue
      }

      if (ch === '\\') {
        escape = true
        continue
      }

      if (ch === quote) {
        quote = null
      }

      continue
    }

    if (
      ch === "'" ||
      ch === '"' ||
      ch === '`'
    ) {
      quote = ch
      continue
    }

    if (ch === '(') {
      depth++
    }
    else if (ch === ')') {
      depth--

      if (depth === 0) {
        return i
      }
    }
  }

  return -1
}

const openParen =
  source.indexOf(
    '(',
    registrationStart
  )

const closeParen =
  findMatchingParen(
    source,
    openParen
  )

if (closeParen < 0) {
  throw new Error(
    'Could not locate end of auth route registration'
  )
}

let insertAt =
  closeParen + 1

while (
  insertAt < source.length &&
  (
    source[insertAt] === ';' ||
    source[insertAt] === '\r' ||
    source[insertAt] === '\n'
  )
) {
  insertAt++
}

const registration = `

registerAccountProfileRoutes(
  app,
  {
    limits,
    auth,
    str,
    Users,
    audit,
    publicUser,
    profilePhotoObjectKey,
    putVerificationObject,
    getVerificationObject,
    deleteVerificationObject
  }
)

`

source =
  source.slice(0,insertAt) +
  registration +
  source.slice(insertAt)

fs.writeFileSync(
  appFile,
  source,
  'utf8'
)

const after =
  fs.readFileSync(
    appFile,
    'utf8'
  )

for (
  const route of expectedRoutes
) {
  if (after.includes(route)) {
    throw new Error(
      `Extracted route remains in app.js: ${route}`
    )
  }
}

if (
  !after.includes(
    'registerAccountProfileRoutes('
  )
) {
  throw new Error(
    'Profile route registration missing'
  )
}

console.log(
  '[PASS] 4 profile/media routes extracted'
)

console.log(
  '[PASS] account-profile.routes.js created'
)

console.log(
  '[PASS] privacy routes left in app.js'
)
