import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const root = process.cwd()

const files = [
  'reports/backup-latest.json',
  'reports/restore-drill-latest.json',
  'reports/dr-evidence-gate-latest.json'
]

const key =
  String(
    process.env
      .DR_EVIDENCE_SIGNING_KEY ||
    ''
  )

const production =
  process.env.NODE_ENV ===
  'production'

if (
  production &&
  key.length < 32
) {
  console.error(
    '[FAIL] DR_EVIDENCE_SIGNING_KEY >=32 characters is required in production'
  )

  process.exit(1)
}

const manifest = {
  version: '6.2.0',
  generatedAt:
    new Date().toISOString(),

  algorithm:
    key
      ? 'HMAC-SHA256'
      : 'SHA256-development',

  files: []
}

for (const relative of files) {
  const file =
    path.join(
      root,
      relative
    )

  if (!fs.existsSync(file)) {
    console.error(
      `[FAIL] Missing evidence: ${relative}`
    )

    process.exit(1)
  }

  const data =
    fs.readFileSync(file)

  const sha256 =
    crypto
      .createHash('sha256')
      .update(data)
      .digest('hex')

  const signature =
    key
      ? crypto
          .createHmac(
            'sha256',
            key
          )
          .update(data)
          .digest('hex')
      : null

  manifest.files.push({
    file: relative,
    bytes: data.length,
    sha256,
    signature
  })
}

fs.writeFileSync(
  path.join(
    root,
    'reports',
    'dr-evidence-manifest.json'
  ),
  JSON.stringify(
    manifest,
    null,
    2
  )
)

console.log(
  JSON.stringify(
    manifest,
    null,
    2
  )
)

console.log('')
console.log(
  '[PASS] DR evidence manifest created'
)
