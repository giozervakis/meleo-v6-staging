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
  env.APP_URL = 'https://meleo.example.test'
  env.DATABASE_URL =
    'postgresql://user:pass@db.example.test:5432/meleo?sslmode=require'
  env.REDIS_URL =
    'rediss://default:pass@redis.example.test:6379'
  env.REDIS_REQUIRED = '1'
  env.STORAGE_DRIVER = 's3'
  env.S3_ENDPOINT = 'https://s3.example.test'
  env.S3_BUCKET = 'meleo-ci-test'
  env.S3_ACCESS_KEY_ID = 'MELEO_CI_TEST_ACCESS'
  env.S3_SECRET_ACCESS_KEY = ['MELEO','CI','TEST','S3','SECRET'].join('_')
  env.ADMIN_PASSWORD = ['MELEO','CI','TEST','ADMIN','PASSWORD','2026'].join('_')
  env.SENSITIVE_DATA_KEY =
    ['MELEO','CI','TEST','SENSITIVE','DATA','KEY','2026'].join('_')
  env.OBSERVABILITY_TOKEN =
    'MELEO_CI_TEST_OBSERVABILITY_TOKEN'
  env.RESEND_API_KEY =
    're_MELEO_CI_TEST_ONLY'

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

// TEST 6 - missing production infrastructure MUST fail
for (const key of [
  'APP_URL',
  'DATABASE_URL',
  'REDIS_URL',
  'SENSITIVE_DATA_KEY',
  'OBSERVABILITY_TOKEN',
  'RESEND_API_KEY',
  'S3_ENDPOINT',
  'S3_BUCKET',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY'
]) {
  const env = cleanEnv()
  delete env[key]

  const result = runValidator(env)

  if (result.status === 0) {
    console.error(
      '[FAIL] Production accepted missing '+key+'.'
    )
    process.exit(1)
  }

  const text =
    `${result.stdout || ''}\n${result.stderr || ''}`

  if (!text.includes(key)) {
    console.error(
      '[FAIL] Missing '+key+' rejection lacks diagnostic.'
    )
    console.error(text)
    process.exit(1)
  }
}

console.log(
  '[PASS] Missing production infrastructure is rejected.'
)

// TEST 7 - production requires HTTPS
const insecureAppEnv = cleanEnv()
insecureAppEnv.APP_URL = 'http://meleo.example.test'
const insecureApp = runValidator(insecureAppEnv)

if (insecureApp.status === 0) {
  console.error(
    '[FAIL] Production accepted non-HTTPS APP_URL.'
  )
  process.exit(1)
}

console.log(
  '[PASS] Production requires HTTPS APP_URL.'
)

// TEST 8 - production requires Redis hard mode
const redisRequiredEnv = cleanEnv()
redisRequiredEnv.REDIS_REQUIRED = '0'
const redisRequired = runValidator(redisRequiredEnv)

if (redisRequired.status === 0) {
  console.error(
    '[FAIL] Production accepted REDIS_REQUIRED=0.'
  )
  process.exit(1)
}

console.log(
  '[PASS] Production requires REDIS_REQUIRED=1.'
)

// TEST 9 - production requires S3 storage
const localStorageEnv = cleanEnv()
localStorageEnv.STORAGE_DRIVER = 'local'
const localStorage = runValidator(localStorageEnv)

if (localStorage.status === 0) {
  console.error(
    '[FAIL] Production accepted local storage.'
  )
  process.exit(1)
}

console.log(
  '[PASS] Production requires S3 storage.'
)

// TEST 10 - weak sensitive-data key MUST fail
const weakSensitiveEnv = cleanEnv()
weakSensitiveEnv.SENSITIVE_DATA_KEY = ['short','key'].join('-')
const weakSensitive = runValidator(weakSensitiveEnv)

if (weakSensitive.status === 0) {
  console.error(
    '[FAIL] Production accepted weak SENSITIVE_DATA_KEY.'
  )
  process.exit(1)
}

console.log(
  '[PASS] Production rejects weak sensitive-data keys.'
)

// TEST 11 - weak admin password MUST fail
const weakAdminEnv = cleanEnv()
weakAdminEnv.ADMIN_PASSWORD = 'short'
const weakAdmin = runValidator(weakAdminEnv)

if (weakAdmin.status === 0) {
  console.error(
    '[FAIL] Production accepted weak ADMIN_PASSWORD.'
  )
  process.exit(1)
}

console.log(
  '[PASS] Production rejects weak admin passwords.'
)

console.log('')
console.log('MELEO production configuration self-test: ALL TESTS PASSED')
console.log('')
