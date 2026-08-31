import fs from 'node:fs'
import assert from 'node:assert/strict'

const validator=
  fs.readFileSync(
    'scripts/validate-production-config.mjs',
    'utf8'
  )

const selftest=
  fs.readFileSync(
    'scripts/validate-production-config-selftest.mjs',
    'utf8'
  )

const required = [
  'APP_URL',
  'DATABASE_URL',
  'REDIS_URL',
  'ADMIN_PASSWORD',
  'ADMIN_TOTP_SECRET',
  'SENSITIVE_DATA_KEY',
  'OBSERVABILITY_TOKEN',
  'RESEND_API_KEY',
  'S3_ENDPOINT',
  'S3_BUCKET',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY'
]

for (const key of required) {
  assert.ok(
    validator.includes(
      "'" + key + "'"
    ),
    'validator missing production key: '+key
  )
}

assert.ok(
  validator.includes(
    'APP_URL must use https:// in production'
  )
)

assert.ok(
  validator.includes(
    'REDIS_REQUIRED must be 1 in production'
  )
)

assert.ok(
  validator.includes(
    'STORAGE_DRIVER must be s3 in production'
  )
)

assert.ok(
  validator.includes(
    'SENSITIVE_DATA_KEY must be at least 32 characters in production'
  )
)

assert.ok(
  validator.includes(
    'ADMIN_PASSWORD must be at least 12 characters in production'
  )
)

assert.ok(
  validator.includes(
    'DATABASE_SSL_REJECT_UNAUTHORIZED=false is forbidden in production'
  )
)

assert.ok(
  selftest.includes(
    'Missing production infrastructure is rejected.'
  )
)

assert.ok(
  selftest.includes(
    'Production requires HTTPS APP_URL.'
  )
)

assert.ok(
  selftest.includes(
    'Production requires REDIS_REQUIRED=1.'
  )
)

assert.ok(
  selftest.includes(
    'Production requires S3 storage.'
  )
)

console.log(
  'RC3-D9-C production configuration completeness self-test: PASS'
)
