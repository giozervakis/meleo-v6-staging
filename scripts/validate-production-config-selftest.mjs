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
  'PAYMENTS_MODE'
]

function cleanEnv() {
  const env = { ...process.env }

  for (const key of forbiddenKeys) {
    delete env[key]
  }

  env.NODE_ENV = 'production'

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
  'PAYMENTS_MODE'
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
console.log('')
console.log('MELEO production configuration self-test: ALL TESTS PASSED')
console.log('')
