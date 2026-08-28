const failures = []

const productionForbidden = {
  E2E_MODE: ['1', 'true', 'yes', 'on'],
  SEED_DEMO: ['1', 'true', 'yes', 'on'],
  DEMO_AUTH: ['1', 'true', 'yes', 'on'],
  DEMO_CHECKOUT: ['1', 'true', 'yes', 'on'],
  PAYMENTS_MODE: ['demo']
}

function normalized(value) {
  return String(value ?? '').trim().toLowerCase()
}

if (normalized(process.env.NODE_ENV) === 'production') {
  const adminTotpSecret =
    String(process.env.ADMIN_TOTP_SECRET || '').trim()

  if (adminTotpSecret.length < 16) {
    failures.push(
      'ADMIN_TOTP_SECRET is required in production and must be at least 16 characters'
    )
  }

  for (const [key, forbidden] of Object.entries(productionForbidden)) {
    const value = normalized(process.env[key])

    if (forbidden.includes(value)) {
      failures.push(`${key}=${process.env[key]} is forbidden in production`)
    }
  }
}

if (
  String(process.env.GEOCODING_PROVIDER || '')
    .trim()
    .toLowerCase() === 'fixture'
) {
  failures.push(
    'GEOCODING_PROVIDER=fixture is forbidden in production'
  )
}

if (failures.length) {
  console.error('')
  console.error('MELEO production configuration validation FAILED')
  console.error('------------------------------------------------')
  failures.forEach(x => console.error(` - ${x}`))
  console.error('')
  process.exit(1)
}

console.log('MELEO production configuration validation: OK')
