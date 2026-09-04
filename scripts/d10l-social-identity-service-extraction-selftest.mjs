import fs from 'node:fs'
import assert from 'node:assert/strict'

const app =
  fs.readFileSync(
    'server/relational/app.js',
    'utf8'
  )

const service =
  fs.readFileSync(
    'server/services/social-identity.service.js',
    'utf8'
  )

function pass(message) {
  console.log(
    '[PASS]',
    message
  )
}

assert.match(
  app,
  /social-identity\.service\.js/
)

assert.match(
  app,
  /createSocialIdentityService/
)

assert.match(
  app,
  /resolveGoogleAccount/
)

pass(
  'app composes social identity domain service'
)

for (const signal of [
  'const SOCIAL_IDENTITY_PROVIDER_GOOGLE',
  'function normalizeSocialEmail',
  'async function socialIdentityBySubject',
  'async function insertSocialIdentity',
  'async function touchSocialIdentity',
  'async function linkSocialIdentity',
  'async function resolveGoogleAccount'
]) {
  assert.equal(
    app.includes(signal),
    false,
    'app still owns social identity implementation: ' +
      signal
  )
}

pass(
  'social identity implementation removed from app'
)

assert.match(
  service,
  /export function createSocialIdentityService/
)

assert.match(
  service,
  /async function resolveGoogleAccount/
)

pass(
  'service owns Google-to-MELEO account resolution'
)

for (const helper of [
  'normalizeSocialEmail',
  'socialIdentityBySubject',
  'insertSocialIdentity',
  'touchSocialIdentity',
  'linkSocialIdentity'
]) {
  assert.match(
    service,
    new RegExp(
      '\\b' +
      helper +
      '\\b'
    )
  )

  assert.equal(
    app.includes(helper),
    false
  )
}

pass(
  'identity persistence helpers remain private to service'
)

for (const dependency of [
  'Users',
  'one',
  'id',
  'now',
  'audit',
  'config'
]) {
  assert.match(
    service,
    new RegExp(
      '\\b' +
      dependency +
      '\\b'
    )
  )
}

pass(
  'minimal dependency-injection contract preserved'
)

assert.match(
  service,
  /user_identities/
)

assert.match(
  service,
  /provider_subject/
)

assert.match(
  service,
  /provider_email/
)

pass(
  'social identity persistence contract preserved'
)

for (const semantic of [
  'GOOGLE_VERIFIED_EMAIL_REQUIRED',
  'ACCOUNT_UNAVAILABLE',
  'ACCOUNT_SUSPENDED',
  'auth.social_account_created'
]) {
  assert.ok(
    service.includes(semantic),
    'missing social identity semantic: ' +
      semantic
  )
}

pass(
  'account safety and audit semantics preserved'
)

assert.match(
  service,
  /emailVerified/
)

assert.match(
  service,
  /email_verified/
)

assert.match(
  service,
  /linkedByEmail/
)

pass(
  'verified-email linking semantics preserved'
)

assert.match(
  service,
  /passwordHash:\s*null/
)

assert.match(
  service,
  /role:\s*'patient'/
)

assert.match(
  service,
  /termsVersion/
)

pass(
  'new social-only account semantics preserved'
)

assert.match(
  app,
  /registerAuthAccountRoutes/
)

assert.match(
  app,
  /resolveGoogleAccount,/
)

pass(
  'auth route DI contract preserved'
)

console.log('')
console.log(
  'MELEO D10L.18 social identity service extraction self-test: OK'
)
