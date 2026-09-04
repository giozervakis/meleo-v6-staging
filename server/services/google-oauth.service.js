import crypto from 'node:crypto'
import {
  createRemoteJWKSet,
  jwtVerify
} from 'jose'

/**
 * MELEO Google OAuth / OpenID Connect
 * Phase 2A foundation.
 *
 * Secrets are supplied only through environment variables.
 */
export const GOOGLE_OAUTH_CONFIG = Object.freeze({
  enabled: ['1', 'true'].includes(
    String(process.env.GOOGLE_OAUTH_ENABLED || '')
      .trim()
      .toLowerCase()
  ),

  clientId:
    String(process.env.GOOGLE_CLIENT_ID || '').trim(),

  clientSecret:
    String(process.env.GOOGLE_CLIENT_SECRET || '').trim(),

  redirectUri:
    String(process.env.GOOGLE_REDIRECT_URI || '').trim(),

  authorizationEndpoint:
    'https://accounts.google.com/o/oauth2/v2/auth',

  tokenEndpoint:
    'https://oauth2.googleapis.com/token',

  issuer:
    'https://accounts.google.com',

  scope:
    'openid email profile'
})

export function assertGoogleOAuthConfiguration() {
  if (!GOOGLE_OAUTH_CONFIG.enabled) return

  const missing = []

  if (!GOOGLE_OAUTH_CONFIG.clientId) {
    missing.push('GOOGLE_CLIENT_ID')
  }

  if (!GOOGLE_OAUTH_CONFIG.clientSecret) {
    missing.push('GOOGLE_CLIENT_SECRET')
  }

  if (!GOOGLE_OAUTH_CONFIG.redirectUri) {
    missing.push('GOOGLE_REDIRECT_URI')
  }

  if (missing.length) {
    throw new Error(
      `Google OAuth enabled but missing environment variables: ${missing.join(', ')}`
    )
  }

  let redirect

  try {
    redirect = new URL(GOOGLE_OAUTH_CONFIG.redirectUri)
  } catch {
    throw new Error(
      'GOOGLE_REDIRECT_URI must be a valid absolute URL'
    )
  }

  const production =
    String(process.env.NODE_ENV || '').toLowerCase() ===
    'production'

  if (
    production &&
    redirect.protocol !== 'https:'
  ) {
    throw new Error(
      'Production Google OAuth requires HTTPS GOOGLE_REDIRECT_URI'
    )
  }

  if (
    !production &&
    redirect.protocol !== 'https:' &&
    redirect.hostname !== 'localhost' &&
    redirect.hostname !== '127.0.0.1'
  ) {
    throw new Error(
      'Non-HTTPS Google OAuth redirect is allowed only on localhost'
    )
  }
}



/**
 * MELEO Google OAuth transaction security.
 *
 * state:
 *   Protects against OAuth login CSRF.
 *
 * nonce:
 *   Binds the OpenID Connect ID token to this transaction.
 *
 * PKCE S256:
 *   Binds the authorization code to the browser that initiated login.
 *
 * Transaction metadata is integrity-protected with HMAC and stored only
 * in a short-lived HttpOnly cookie.
 */
export const GOOGLE_OAUTH_TRANSACTION_COOKIE =
  'meleo_google_oauth'

const GOOGLE_OAUTH_TRANSACTION_TTL_MS =
  10 * 60 * 1000

function oauthBase64Url(value) {
  return Buffer
    .from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function oauthRandomToken(bytes = 32) {
  return oauthBase64Url(
    crypto.randomBytes(bytes)
  )
}

function oauthPkceChallenge(codeVerifier) {
  return oauthBase64Url(
    crypto
      .createHash('sha256')
      .update(codeVerifier, 'ascii')
      .digest()
  )
}

function oauthTransactionSecret() {
  const secret =
    String(
      process.env.GOOGLE_OAUTH_TRANSACTION_SECRET ||
      process.env.SESSION_SECRET ||
      ''
    )

  if (secret.length < 32) {
    throw new Error(
      'Google OAuth transactions require GOOGLE_OAUTH_TRANSACTION_SECRET or SESSION_SECRET with at least 32 characters'
    )
  }

  return secret
}

function oauthSign(payload) {
  return oauthBase64Url(
    crypto
      .createHmac(
        'sha256',
        oauthTransactionSecret()
      )
      .update(payload, 'utf8')
      .digest()
  )
}

function oauthTimingSafeEqual(left, right) {
  const a =
    Buffer.from(
      String(left || ''),
      'utf8'
    )

  const b =
    Buffer.from(
      String(right || ''),
      'utf8'
    )

  if (
    a.length === 0 ||
    b.length === 0 ||
    a.length !== b.length
  ) {
    return false
  }

  return crypto.timingSafeEqual(a, b)
}

function oauthEncodeTransaction(transaction) {
  const payload =
    oauthBase64Url(
      Buffer.from(
        JSON.stringify(transaction),
        'utf8'
      )
    )

  const signature =
    oauthSign(payload)

  return `${payload}.${signature}`
}

function oauthDecodeBase64Url(value) {
  const normalized =
    String(value)
      .replace(/-/g, '+')
      .replace(/_/g, '/')

  const padding =
    normalized.length % 4
      ? '='.repeat(
          4 - normalized.length % 4
        )
      : ''

  return Buffer.from(
    normalized + padding,
    'base64'
  )
}

function oauthDecodeTransaction(rawValue) {
  const value =
    String(rawValue || '').trim()

  if (!value) {
    return null
  }

  const separator =
    value.lastIndexOf('.')

  if (separator <= 0) {
    return null
  }

  const payload =
    value.slice(
      0,
      separator
    )

  const signature =
    value.slice(
      separator + 1
    )

  const expectedSignature =
    oauthSign(payload)

  if (
    !oauthTimingSafeEqual(
      signature,
      expectedSignature
    )
  ) {
    return null
  }

  try {
    const transaction =
      JSON.parse(
        oauthDecodeBase64Url(
          payload
        ).toString('utf8')
      )

    if (
      !transaction ||
      typeof transaction !== 'object' ||
      Array.isArray(transaction)
    ) {
      return null
    }

    return transaction
  } catch {
    return null
  }
}

export function createGoogleOAuthTransaction() {
  const state =
    oauthRandomToken(32)

  const nonce =
    oauthRandomToken(32)

  const codeVerifier =
    oauthRandomToken(64)

  const codeChallenge =
    oauthPkceChallenge(
      codeVerifier
    )

  const createdAt =
    Date.now()

  const expiresAt =
    createdAt +
    GOOGLE_OAUTH_TRANSACTION_TTL_MS

  return {
    state,
    nonce,
    codeVerifier,
    codeChallenge,

    transaction: {
      version: 1,
      state,
      nonce,
      codeVerifier,
      createdAt,
      expiresAt
    }
  }
}

export function validateGoogleOAuthTransaction(
  rawCookie,
  returnedState
) {
  let transaction

  try {
    transaction =
      oauthDecodeTransaction(
        rawCookie
      )
  } catch {
    return {
      ok: false,
      reason: 'invalid_transaction'
    }
  }

  if (!transaction) {
    return {
      ok: false,
      reason: 'invalid_transaction'
    }
  }

  if (transaction.version !== 1) {
    return {
      ok: false,
      reason: 'unsupported_transaction'
    }
  }

  const currentTime =
    Date.now()

  const createdAt =
    Number(
      transaction.createdAt
    )

  const expiresAt =
    Number(
      transaction.expiresAt
    )

  if (
    !Number.isFinite(createdAt) ||
    !Number.isFinite(expiresAt) ||
    createdAt <= 0 ||
    expiresAt <= createdAt ||
    expiresAt - createdAt >
      GOOGLE_OAUTH_TRANSACTION_TTL_MS ||
    currentTime > expiresAt
  ) {
    return {
      ok: false,
      reason: 'expired_transaction'
    }
  }

  if (
    !oauthTimingSafeEqual(
      transaction.state,
      returnedState
    )
  ) {
    return {
      ok: false,
      reason: 'state_mismatch'
    }
  }

  if (
    typeof transaction.nonce !== 'string' ||
    transaction.nonce.length < 32
  ) {
    return {
      ok: false,
      reason: 'invalid_nonce'
    }
  }

  if (
    typeof transaction.codeVerifier !== 'string' ||
    transaction.codeVerifier.length < 43 ||
    transaction.codeVerifier.length > 128
  ) {
    return {
      ok: false,
      reason: 'invalid_pkce'
    }
  }

  return {
    ok: true,
    transaction
  }
}

function googleOAuthCookieOptions() {
  return {
    httpOnly: true,

    secure:
      String(
        process.env.NODE_ENV || ''
      ).toLowerCase() ===
      'production',

    sameSite: 'lax',

    path: '/',

    maxAge:
      GOOGLE_OAUTH_TRANSACTION_TTL_MS
  }
}

export function setGoogleOAuthTransactionCookie(
  res,
  transaction
) {
  res.cookie(
    GOOGLE_OAUTH_TRANSACTION_COOKIE,
    oauthEncodeTransaction(transaction),
    googleOAuthCookieOptions()
  )
}

export function clearGoogleOAuthTransactionCookie(
  res
) {
  const options =
    googleOAuthCookieOptions()

  delete options.maxAge

  res.clearCookie(
    GOOGLE_OAUTH_TRANSACTION_COOKIE,
    options
  )
}


/*
 * ============================================================
 * GOOGLE OIDC VERIFICATION FOUNDATION
 * ============================================================
 *
 * The authorization code is exchanged only by the MELEO
 * backend. ID tokens are cryptographically verified against
 * Google's published JWKS.
 *
 * Never trust claims from an unverified JWT.
 */

const GOOGLE_OAUTH_AUTHORIZATION_ENDPOINT =
  'https://accounts.google.com/o/oauth2/v2/auth'

const GOOGLE_OAUTH_TOKEN_ENDPOINT =
  'https://oauth2.googleapis.com/token'

const GOOGLE_OAUTH_JWKS_URI =
  new URL(
    'https://www.googleapis.com/oauth2/v3/certs'
  )

const GOOGLE_OAUTH_JWKS =
  createRemoteJWKSet(
    GOOGLE_OAUTH_JWKS_URI
  )

export function googleAuthorizationUrl({
  state,
  nonce,
  codeChallenge
}) {
  const url =
    new URL(
      GOOGLE_OAUTH_AUTHORIZATION_ENDPOINT
    )

  url.searchParams.set(
    'client_id',
    GOOGLE_OAUTH_CONFIG.clientId
  )

  url.searchParams.set(
    'redirect_uri',
    GOOGLE_OAUTH_CONFIG.redirectUri
  )

  url.searchParams.set(
    'response_type',
    'code'
  )

  url.searchParams.set(
    'scope',
    GOOGLE_OAUTH_CONFIG.scope
  )

  url.searchParams.set(
    'state',
    state
  )

  url.searchParams.set(
    'nonce',
    nonce
  )

  url.searchParams.set(
    'code_challenge',
    codeChallenge
  )

  url.searchParams.set(
    'code_challenge_method',
    'S256'
  )

  return url.toString()
}

export async function exchangeGoogleAuthorizationCode({
  code,
  codeVerifier
}) {
  if (
    !GOOGLE_OAUTH_CONFIG.enabled
  ) {
    throw new Error(
      'Google OAuth is disabled'
    )
  }

  if (
    typeof code !== 'string' ||
    !code ||
    code.length > 4096
  ) {
    throw new Error(
      'Invalid Google authorization code'
    )
  }

  if (
    typeof codeVerifier !== 'string' ||
    codeVerifier.length < 43 ||
    codeVerifier.length > 128
  ) {
    throw new Error(
      'Invalid Google PKCE verifier'
    )
  }

  const body =
    new URLSearchParams({
      client_id:
        GOOGLE_OAUTH_CONFIG.clientId,

      client_secret:
        GOOGLE_OAUTH_CONFIG.clientSecret,

      redirect_uri:
        GOOGLE_OAUTH_CONFIG.redirectUri,

      grant_type:
        'authorization_code',

      code,

      code_verifier:
        codeVerifier
    })

  const controller =
    new AbortController()

  const timeout =
    setTimeout(
      () => controller.abort(),
      10000
    )

  let response

  try {
    response =
      await fetch(
        GOOGLE_OAUTH_TOKEN_ENDPOINT,
        {
          method: 'POST',

          headers: {
            'content-type':
              'application/x-www-form-urlencoded',

            accept:
              'application/json'
          },

          body:
            body.toString(),

          signal:
            controller.signal
        }
      )
  }
  finally {
    clearTimeout(timeout)
  }

  let payload

  try {
    payload =
      await response.json()
  }
  catch {
    throw new Error(
      'Google OAuth token endpoint returned invalid JSON'
    )
  }

  if (!response.ok) {
    /*
     * Deliberately do not include Google's response body.
     * It may contain sensitive OAuth information.
     */
    throw new Error(
      `Google OAuth token exchange failed with status ${response.status}`
    )
  }

  if (
    !payload ||
    typeof payload.id_token !== 'string' ||
    !payload.id_token
  ) {
    throw new Error(
      'Google OAuth response did not contain an ID token'
    )
  }

  return {
    idToken:
      payload.id_token
  }
}

export async function verifyGoogleIdToken({
  idToken,
  expectedNonce
}) {
  if (
    typeof idToken !== 'string' ||
    !idToken
  ) {
    throw new Error(
      'Missing Google ID token'
    )
  }

  if (
    typeof expectedNonce !== 'string' ||
    expectedNonce.length < 32
  ) {
    throw new Error(
      'Missing expected Google OIDC nonce'
    )
  }

  const {
    payload,
    protectedHeader
  } =
    await jwtVerify(
      idToken,
      GOOGLE_OAUTH_JWKS,
      {
        issuer: [
          'https://accounts.google.com',
          'accounts.google.com'
        ],

        audience:
          GOOGLE_OAUTH_CONFIG.clientId,

        algorithms: [
          'RS256'
        ],

        clockTolerance:
          5
      }
    )

  if (
    !oauthSafeEqual(
      payload.nonce,
      expectedNonce
    )
  ) {
    throw new Error(
      'Google OIDC nonce mismatch'
    )
  }

  if (
    payload.email_verified !== true
  ) {
    throw new Error(
      'Google account email is not verified'
    )
  }

  if (
    typeof payload.sub !== 'string' ||
    !payload.sub ||
    payload.sub.length > 255
  ) {
    throw new Error(
      'Google OIDC subject is invalid'
    )
  }

  if (
    typeof payload.email !== 'string' ||
    !payload.email ||
    payload.email.length > 320
  ) {
    throw new Error(
      'Google OIDC email is invalid'
    )
  }

  if (
    protectedHeader.alg !== 'RS256'
  ) {
    throw new Error(
      'Unexpected Google ID token algorithm'
    )
  }

  return Object.freeze({
    provider:
      'google',

    subject:
      payload.sub,

    email:
      payload.email
        .trim()
        .toLowerCase(),

    emailVerified:
      true,

    name:
      typeof payload.name === 'string'
        ? payload.name.trim().slice(0, 120)
        : '',

    picture:
      typeof payload.picture === 'string'
        ? payload.picture.slice(0, 2048)
        : ''
  })
}
