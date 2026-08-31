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

function stripeKeyMode(value) {
  const key = String(value || '').trim()
  if (key.startsWith('sk_live_')) return 'live'
  if (key.startsWith('sk_test_')) return 'test'
  return key ? 'unknown' : 'missing'
}

const nodeEnv = normalized(process.env.NODE_ENV)
const paymentsMode = normalized(process.env.PAYMENTS_MODE)
const stripeMode = stripeKeyMode(process.env.STRIPE_SECRET_KEY)

if (nodeEnv === 'production') {
  const requiredProduction = [
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

  for (const key of requiredProduction) {
    if (!String(process.env[key] || '').trim()) {
      failures.push(key + ' is required in production')
    }
  }

  const appUrl =
    String(process.env.APP_URL || '').trim()

  if (
    appUrl &&
    !appUrl.toLowerCase().startsWith('https://')
  ) {
    failures.push(
      'APP_URL must use https:// in production'
    )
  }

  if (
    normalized(process.env.STORAGE_DRIVER) !== 's3'
  ) {
    failures.push(
      'STORAGE_DRIVER must be s3 in production'
    )
  }

  if (
    normalized(process.env.REDIS_REQUIRED) !== '1'
  ) {
    failures.push(
      'REDIS_REQUIRED must be 1 in production'
    )
  }

  const databaseUrl =
    String(process.env.DATABASE_URL || '').trim()

  if (
    databaseUrl &&
    /sslmode=(?:disable|allow|prefer)/i.test(databaseUrl)
  ) {
    failures.push(
      'DATABASE_URL must not disable or weaken TLS in production'
    )
  }

  if (
    normalized(
      process.env.DATABASE_SSL_REJECT_UNAUTHORIZED
    ) === 'false'
  ) {
    failures.push(
      'DATABASE_SSL_REJECT_UNAUTHORIZED=false is forbidden in production'
    )
  }

  const sensitiveDataKey =
    String(
      process.env.SENSITIVE_DATA_KEY || ''
    ).trim()

  if (
    sensitiveDataKey &&
    sensitiveDataKey.length < 32
  ) {
    failures.push(
      'SENSITIVE_DATA_KEY must be at least 32 characters in production'
    )
  }

  const adminPassword =
    String(
      process.env.ADMIN_PASSWORD || ''
    )

  if (
    adminPassword &&
    adminPassword.length < 12
  ) {
    failures.push(
      'ADMIN_PASSWORD must be at least 12 characters in production'
    )
  }

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

  if (stripeMode !== 'live') failures.push('STRIPE_SECRET_KEY must use sk_live_ in production')
  if (!String(process.env.STRIPE_WEBHOOK_SECRET || '').trim()) failures.push('STRIPE_WEBHOOK_SECRET is required in production')
  if (!String(process.env.STRIPE_PRICE_BASIC || '').trim()) failures.push('STRIPE_PRICE_BASIC is required in production')
  if (!String(process.env.STRIPE_PRICE_PREMIUM || '').trim()) failures.push('STRIPE_PRICE_PREMIUM is required in production')
}

if (nodeEnv === 'staging' && paymentsMode === 'stripe') {
  if (stripeMode !== 'test') failures.push('STRIPE_SECRET_KEY must use sk_test_ in staging Stripe mode')
  if (!String(process.env.STRIPE_WEBHOOK_SECRET || '').trim()) failures.push('STRIPE_WEBHOOK_SECRET is required in staging Stripe mode')
  if (!String(process.env.STRIPE_PRICE_BASIC || '').trim()) failures.push('STRIPE_PRICE_BASIC is required in staging Stripe mode')
  if (!String(process.env.STRIPE_PRICE_PREMIUM || '').trim()) failures.push('STRIPE_PRICE_PREMIUM is required in staging Stripe mode')
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
