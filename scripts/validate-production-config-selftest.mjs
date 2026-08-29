import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const validator = fileURLToPath(
  new URL('./validate-production-config.mjs', import.meta.url)
)

const forbiddenKeys = [
  'E2E_MODE',
  'SEED_DEMO',
  'DEMO_AUTH',
  'DEMO_CHECKOUT',
  'PAYMENTS_MODE',
  'GEOCODING_PROVIDER',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_BASIC',
  'STRIPE_PRICE_PREMIUM'
]

function cleanEnv() {
  const env = { ...process.env }

  for (const key of forbiddenKeys) {
    delete env[key]
  }

  env.NODE_ENV = 'production'

  // Test-only value. This is not a real production secret.
  env.ADMIN_TOTP_SECRET =
    'MELEO_CI_TEST_ONLY_TOTP_SECRET_2026'
  env.STRIPE_SECRET_KEY = 'sk_live_MELEO_CI_TEST_ONLY'
  env.STRIPE_WEBHOOK_SECRET = 'whsec_MELEO_CI_TEST_ONLY'
  env.STRIPE_PRICE_BASIC = 'price_MELEO_CI_BASIC'
  env.STRIPE_PRICE_PREMIUM = 'price_MELEO_CI_PREMIUM'

  return env
}

function runValidator(env) {
  return spawnSync(
    process.execPath,
    [validator],
    {
      env,
      encoding: 'utf8'
    }
  )
}

console.log('')
console.log('MELEO production configuration self-test')
console.log('=========================================')
console.log('')


// ----------------------------------------------------------
// TEST 1
// Safe production configuration MUST pass.
// ----------------------------------------------------------

const safeEnv = cleanEnv()
const safe = runValidator(safeEnv)

if (safe.status !== 0) {
  console.error('[FAIL] Safe production configuration was rejected.')
  console.error(safe.stdout || '')
  console.error(safe.stderr || '')
  process.exit(1)
}

console.log('[PASS] Safe production configuration accepted.')


// ----------------------------------------------------------
// TEST 2
// Dangerous production configuration MUST fail.
// ----------------------------------------------------------

const unsafeEnv = cleanEnv()

unsafeEnv.E2E_MODE = '1'
unsafeEnv.SEED_DEMO = '1'
unsafeEnv.DEMO_AUTH = '1'
unsafeEnv.DEMO_CHECKOUT = '1'
unsafeEnv.PAYMENTS_MODE = 'demo'
unsafeEnv.GEOCODING_PROVIDER = 'fixture'

const unsafe = runValidator(unsafeEnv)

if (unsafe.status === 0) {
  console.error('[FAIL] Dangerous production configuration was accepted.')
  process.exit(1)
}

const output = `${unsafe.stdout || ''}\n${unsafe.stderr || ''}`

const expected = [
  'E2E_MODE',
  'SEED_DEMO',
  'DEMO_AUTH',
  'DEMO_CHECKOUT',
  'PAYMENTS_MODE',
  'GEOCODING_PROVIDER'
]

const missing = expected.filter(key => !output.includes(key))

if (missing.length) {
  console.error(
    `[FAIL] Validator rejected production but did not report: ${missing.join(', ')}`
  )
  console.error(output)
  process.exit(1)
}

console.log('[PASS] Dangerous production configuration correctly rejected.')


// ----------------------------------------------------------
// TEST 3
// Missing admin TOTP secret MUST fail in production.
// ----------------------------------------------------------

const missingTotpEnv = cleanEnv()
delete missingTotpEnv.ADMIN_TOTP_SECRET

const missingTotp = runValidator(missingTotpEnv)

if (missingTotp.status === 0) {
  console.error(
    '[FAIL] Production configuration without ADMIN_TOTP_SECRET was accepted.'
  )
  process.exit(1)
}

const missingTotpOutput =
  `${missingTotp.stdout || ''}\n${missingTotp.stderr || ''}`

if (!missingTotpOutput.includes('ADMIN_TOTP_SECRET')) {
  console.error(
    '[FAIL] Missing ADMIN_TOTP_SECRET was rejected without the expected diagnostic.'
  )
  console.error(missingTotpOutput)
  process.exit(1)
}

console.log(
  '[PASS] Missing ADMIN_TOTP_SECRET correctly rejected.'
)

// TEST 4 - production rejects Stripe test key
const prodTestStripeEnv = cleanEnv()
prodTestStripeEnv.STRIPE_SECRET_KEY = 'sk_test_MELEO_CI_TEST_ONLY'
const prodTestStripe = runValidator(prodTestStripeEnv)
if (prodTestStripe.status === 0) {
  console.error('[FAIL] Production accepted a Stripe test key.')
  process.exit(1)
}
if (!`${prodTestStripe.stdout || ''}\n${prodTestStripe.stderr || ''}`.includes('sk_live_')) {
  console.error('[FAIL] Production Stripe rejection missing sk_live_ diagnostic.')
  process.exit(1)
}
console.log('[PASS] Production rejects Stripe test keys.')

// TEST 5 - staging Stripe mode accepts test and rejects live
const stagingTestEnv = cleanEnv()
stagingTestEnv.NODE_ENV = 'staging'
stagingTestEnv.PAYMENTS_MODE = 'stripe'
stagingTestEnv.STRIPE_SECRET_KEY = 'sk_test_MELEO_CI_TEST_ONLY'
const stagingTest = runValidator(stagingTestEnv)
if (stagingTest.status !== 0) {
  console.error('[FAIL] Staging rejected a Stripe test key.')
  console.error(stagingTest.stdout || '')
  console.error(stagingTest.stderr || '')
  process.exit(1)
}
console.log('[PASS] Staging accepts Stripe test keys.')

const stagingLiveEnv = { ...stagingTestEnv, STRIPE_SECRET_KEY: 'sk_live_MELEO_CI_TEST_ONLY' }
const stagingLive = runValidator(stagingLiveEnv)
if (stagingLive.status === 0) {
  console.error('[FAIL] Staging accepted a Stripe live key.')
  process.exit(1)
}
if (!`${stagingLive.stdout || ''}\n${stagingLive.stderr || ''}`.includes('sk_test_')) {
  console.error('[FAIL] Staging Stripe rejection missing sk_test_ diagnostic.')
  process.exit(1)
}
console.log('[PASS] Staging rejects Stripe live keys.')

console.log('')
console.log('MELEO production configuration self-test: ALL TESTS PASSED')
console.log('')
