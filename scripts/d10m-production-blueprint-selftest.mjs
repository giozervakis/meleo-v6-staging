import fs from 'node:fs'
import assert from 'node:assert/strict'

const file =
  'render.production.yaml'

const text =
  fs.readFileSync(
    file,
    'utf8'
  )

function has(value,message){
  assert.ok(
    text.includes(value),
    message
  )

  console.log(
    '[PASS] ' + message
  )
}

has(
  'name: meleo-production',
  'production web service exists'
)

has(
  'name: meleo-production-worker',
  'separate production worker exists'
)

has(
  'name: meleo-production-db',
  'production PostgreSQL exists'
)

has(
  'name: meleo-production-redis',
  'production Key Value exists'
)

has(
  'startCommand: node server/index.js',
  'web uses production API entry point'
)

has(
  'startCommand: node server/worker.js',
  'worker uses production worker entry point'
)

has(
  'healthCheckPath: /api/ready',
  'production readiness endpoint configured'
)

has(
  'value: production',
  'production environment configured'
)

has(
  'value: stripe',
  'Stripe production mode configured'
)

has(
  'value: s3',
  'S3 production storage configured'
)

has(
  'value: "0"',
  'explicit disabled safety flags present'
)

for (
  const forbidden of [
    'render-staging-start.mjs',
    'value: staging',
    'value: demo',
    'plan: free'
  ]
) {
  assert.equal(
    text.includes(forbidden),
    false,
    `production blueprint contains forbidden token: ${forbidden}`
  )

  console.log(
    '[PASS] forbidden token absent: ' +
    forbidden
  )
}

for (
  const required of [
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
    'S3_SECRET_ACCESS_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_PRICE_BASIC',
    'STRIPE_PRICE_PREMIUM'
  ]
) {
  has(
    `key: ${required}`,
    `required env declared: ${required}`
  )
}

console.log('')
console.log(
  'MELEO D10M production blueprint self-test: OK'
)
