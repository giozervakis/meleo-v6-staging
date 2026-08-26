import { spawnSync } from 'node:child_process'

function fatal(message) {
  console.error('')
  console.error('================================================')
  console.error(' MELEO PRODUCTION BOOT REFUSED')
  console.error('================================================')
  console.error(message)
  console.error('')
  process.exit(1)
}

if (process.env.NODE_ENV !== 'production') {
  fatal(
    `Production launcher requires NODE_ENV=production. ` +
    `Received: ${JSON.stringify(process.env.NODE_ENV || '')}`
  )
}

const deploymentEnvironment =
  String(process.env.MELEO_DEPLOYMENT_ENV || '')
    .trim()
    .toLowerCase()

if (deploymentEnvironment !== 'production') {
  fatal(
    'Production launcher requires ' +
    'MELEO_DEPLOYMENT_ENV=production. ' +
    'This second guard prevents a staging blueprint from ' +
    'being promoted accidentally.'
  )
}

if (
  String(process.env.E2E_MODE || '')
    .trim()
    .toLowerCase()
    .match(/^(1|true|yes|on)$/)
) {
  fatal('E2E_MODE is forbidden in production.')
}

for (const key of [
  'SEED_DEMO',
  'DEMO_AUTH',
  'DEMO_CHECKOUT'
]) {
  if (
    String(process.env[key] || '')
      .trim()
      .toLowerCase()
      .match(/^(1|true|yes|on)$/)
  ) {
    fatal(`${key} is forbidden in production.`)
  }
}

if (
  String(process.env.PAYMENTS_MODE || '')
    .trim()
    .toLowerCase() === 'demo'
) {
  fatal('PAYMENTS_MODE=demo is forbidden in production.')
}

console.log(
  '[MELEO production] running production configuration validator'
)

const validation = spawnSync(
  process.execPath,
  ['scripts/validate-production-config.mjs'],
  {
    stdio: 'inherit',
    env: process.env
  }
)

if (
  validation.error ||
  validation.status !== 0
) {
  fatal(
    'Production configuration validation failed. ' +
    'Application boot has been blocked.'
  )
}

console.log(
  '[MELEO production] validation passed — booting application'
)

// Dynamic import is intentional:
// server/index.js cannot execute before all production gates pass.
await import('../server/index.js')
