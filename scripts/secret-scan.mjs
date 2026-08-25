import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

const ignored = new Set([
  'node_modules',
  'dist',
  '.git',
  'reports',
  'secure_uploads',
  'test-results',
  'playwright-report'
])

const fixtures = new Set([
  'scripts/security-selftest.mjs',
  'scripts/storage-check.mjs',
  'scripts/secret-scan.mjs'
])

const findings = []

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue

    const file = path.join(dir, entry.name)
    const relative = path
      .relative(root, file)
      .replaceAll('\\', '/')

    if (entry.isDirectory()) {
      walk(file)
    } else {
      inspect(file, relative)
    }
  }
}

function inspect(file, relative) {
  if (relative === '.env') {
    findings.push(
      `${relative}: runtime .env must not be committed`
    )
  }

  if (/\.(pem|p12|pfx|key)$/i.test(relative)) {
    findings.push(
      `${relative}: private key material`
    )
  }

  let text = ''

  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    return
  }

  if (
    relative === '.env.example' ||
    fixtures.has(relative)
  ) {
    return
  }

  const patterns = [
    {
      re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
      label: 'private key'
    },

    {
      re: /\bsk_live_[A-Za-z0-9]{20,}\b/,
      label: 'Stripe live secret'
    },

    {
      re: /\bwhsec_[A-Za-z0-9]{20,}\b/,
      label: 'Stripe webhook secret'
    },

    /*
     * Direct literal assignment.
     *
     * BAD:
     * ADMIN_PASSWORD = 'actual-password'
     *
     * GOOD:
     * ADMIN_PASSWORD =
     *   requiredEnv('E2E_ADMIN_PASSWORD')
     *
     * GOOD:
     * ADMIN_PASSWORD =
     *   process.env.ADMIN_PASSWORD
     */
    {
      re: /(?:S3_SECRET_ACCESS_KEY|ADMIN_PASSWORD|SENSITIVE_DATA_KEY)\s*=\s*['"`][^'"`\r\n]{8,}['"`]/,
      label: 'hard-coded secret candidate'
    },

    /*
     * Detect unsafe environment fallback.
     *
     * BAD:
     * ADMIN_PASSWORD =
     *   process.env.ADMIN_PASSWORD || 'admin123'
     *
     * GOOD:
     * ADMIN_PASSWORD =
     *   requiredEnv('ADMIN_PASSWORD')
     */
    {
      re: /(?:S3_SECRET_ACCESS_KEY|ADMIN_PASSWORD|SENSITIVE_DATA_KEY)\s*=\s*process\.env\.[A-Z0-9_]+\s*\|\|\s*['"`][^'"`\r\n]{6,}['"`]/,
      label: 'hard-coded secret fallback'
    }
  ]

  for (const { re, label } of patterns) {
    if (re.test(text)) {
      findings.push(
        `${relative}: ${label}`
      )
    }
  }
}

walk(root)

if (findings.length) {
  console.error('MELEO secret scan FAILED')

  for (const finding of findings) {
    console.error(` - ${finding}`)
  }

  process.exit(1)
}

console.log('MELEO secret scan: OK')
