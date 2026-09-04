import fs from 'node:fs'
import assert from 'node:assert/strict'

const app =
  fs.readFileSync(
    'server/relational/app.js',
    'utf8'
  )

const service =
  fs.readFileSync(
    'server/services/google-oauth.service.js',
    'utf8'
  )

const routes =
  fs.readFileSync(
    'server/routes/auth-account.routes.js',
    'utf8'
  )

function pass(message) {
  console.log('[PASS]', message)
}

assert.match(
  app,
  /google-oauth\.service\.js/
)

pass('app composes Google OAuth service')

for (const signal of [
  'export const GOOGLE_OAUTH_CONFIG',
  'export const GOOGLE_OAUTH_TRANSACTION_COOKIE',
  'export function createGoogleOAuthTransaction',
  'export function validateGoogleOAuthTransaction',
  'export function googleAuthorizationUrl',
  'export async function exchangeGoogleAuthorizationCode',
  'export async function verifyGoogleIdToken',
  'export function setGoogleOAuthTransactionCookie',
  'export function clearGoogleOAuthTransactionCookie'
]) {
  assert.ok(
    service.includes(signal),
    'missing service ownership: ' + signal
  )
}

pass('provider contract is service-owned')

for (const securitySignal of [
  'crypto.randomBytes',
  "createHash('sha256')",
  'timingSafeEqual',
  'code_challenge_method',
  'S256',
  'createRemoteJWKSet',
  'jwtVerify',
  'payload.email_verified',
  'protectedHeader.alg',
  'expectedNonce',
  'code_verifier'
]) {
  assert.ok(
    service.includes(securitySignal),
    'missing security control: ' +
      securitySignal
  )
}

pass('PKCE/state/nonce/JWKS/OIDC controls preserved')

assert.equal(
  app.includes(
    'async function verifyGoogleIdToken'
  ),
  false
)

assert.equal(
  app.includes(
    'function createGoogleOAuthTransaction()'
  ),
  false
)

pass('provider implementation removed from app')

assert.match(
  app,
  /async function resolveGoogleAccount\s*\(/
)

pass('MELEO account linking remains domain-owned')

assert.match(
  service,
  /httpOnly:\s*true/
)

assert.match(
  service,
  /sameSite:\s*'lax'/
)

pass('OAuth transaction cookie policy preserved')

for (const dependency of [
  'googleOAuthEnabled',
  'createGoogleOAuthTransaction',
  'validateGoogleOAuthTransaction',
  'googleAuthorizationUrl',
  'exchangeGoogleAuthorizationCode',
  'verifyGoogleIdToken',
  'resolveGoogleAccount',
  'getGoogleOAuthTransactionCookie',
  'setGoogleOAuthTransactionCookie',
  'clearGoogleOAuthTransactionCookie'
]) {
  assert.match(
    routes,
    new RegExp(
      '\\b' + dependency + '\\b'
    )
  )
}

pass('auth route DI contract preserved')

assert.match(
  routes,
  /\/api\/auth\/google\/start/
)

assert.match(
  routes,
  /\/api\/auth\/google\/callback/
)

pass('Google OAuth endpoints preserved')

const migration =
  app.indexOf('await migrate()')

const oauthAssertion =
  app.indexOf(
    'assertGoogleOAuthConfiguration()'
  )

assert.ok(
  migration >= 0 &&
  oauthAssertion > migration
)

pass('startup validation ordering preserved')

console.log('')
console.log(
  'MELEO D10L.16 Google OAuth service extraction self-test: OK'
)
