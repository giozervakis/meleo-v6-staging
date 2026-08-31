import fs from 'node:fs'
import assert from 'node:assert/strict'

const startProduction=
  fs.readFileSync(
    'scripts/start-production.mjs',
    'utf8'
  )

const staging=
  fs.readFileSync(
    'scripts/render-staging-start.mjs',
    'utf8'
  )

const validator=
  fs.readFileSync(
    'scripts/validate-production-config.mjs',
    'utf8'
  )

const config=
  fs.readFileSync(
    'server/config.js',
    'utf8'
  )

const pkg=
  JSON.parse(
    fs.readFileSync(
      'package.json',
      'utf8'
    )
  )

assert.ok(
  startProduction.includes(
    "process.env.NODE_ENV !== 'production'"
  )
)

assert.ok(
  startProduction.includes(
    "deploymentEnvironment !== 'production'"
  )
)

assert.ok(
  startProduction.includes(
    "'SEED_DEMO'"
  ) &&
  startProduction.includes(
    "'DEMO_AUTH'"
  ) &&
  startProduction.includes(
    "'DEMO_CHECKOUT'"
  )
)

assert.ok(
  startProduction.includes(
    "PAYMENTS_MODE=demo is forbidden in production."
  )
)

assert.ok(
  startProduction.includes(
    "['scripts/validate-production-config.mjs']"
  )
)

assert.ok(
  startProduction.includes(
    "await import('../server/index.js')"
  )
)

assert.ok(
  staging.includes(
    "staging launcher cannot run production"
  )
)

assert.ok(
  staging.includes(
    "NODE_ENV || ''"
  )
)

assert.ok(
  staging.includes(
    "MELEO_DEPLOYMENT_ENV || ''"
  )
)

assert.ok(
  validator.includes(
    "SEED_DEMO: ['1', 'true', 'yes', 'on']"
  )
)

assert.ok(
  validator.includes(
    "DEMO_AUTH: ['1', 'true', 'yes', 'on']"
  )
)

assert.ok(
  validator.includes(
    "DEMO_CHECKOUT: ['1', 'true', 'yes', 'on']"
  )
)

assert.ok(
  validator.includes(
    "PAYMENTS_MODE: ['demo']"
  )
)

assert.ok(
  validator.includes(
    "STRIPE_SECRET_KEY must use sk_live_ in production"
  )
)

assert.ok(
  config.includes(
    "databaseUrl: process.env.DATABASE_URL || ''"
  )
)

assert.ok(
  config.includes(
    "required: bool(process.env.REDIS_REQUIRED, isProd || isStaging)"
  )
)

assert.ok(
  config.includes(
    "driver: (process.env.STORAGE_DRIVER || (isProd ? 's3' : 'local')).toLowerCase()"
  )
)

assert.ok(
  config.includes(
    "seedDemo: bool(process.env.SEED_DEMO, !isProd)"
  )
)

assert.ok(
  config.includes(
    "demoAuth: bool(process.env.DEMO_AUTH, !isProd)"
  )
)

assert.ok(
  config.includes(
    "demoCheckout: bool(process.env.DEMO_CHECKOUT, !isProd)"
  )
)

assert.ok(
  pkg.scripts?.['start:production'] ===
    'node scripts/start-production.mjs'
)

assert.ok(
  pkg.scripts?.['start:render-staging'] ===
    'node scripts/render-staging-start.mjs'
)

console.log(
  'RC3-D9-B production environment isolation self-test: PASS'
)

console.log(
  'Production and staging launch paths are explicitly isolated.'
)
