import fs from 'node:fs'

const file = '.env.example'

let source = fs
  .readFileSync(file, 'utf8')
  .replace(/^\uFEFF/, '')
  .replace(/\r\n/g, '\n')

const keys = [
  'DR_OFFSITE_REQUIRED',
  'DR_OFFSITE_PROVIDER',
  'DR_OFFSITE_ENDPOINT',
  'DR_OFFSITE_REGION',
  'DR_OFFSITE_BUCKET',
  'DR_OFFSITE_ACCESS_KEY_ID',
  'DR_OFFSITE_SECRET_ACCESS_KEY',
  'DR_OFFSITE_PREFIX',
  'DR_OFFSITE_FORCE_PATH_STYLE',
  'DR_OFFSITE_TIMEOUT_MS'
]

// Remove every existing assignment of the canonical B2 variables.
// We will re-add exactly one authoritative block.
for (const key of keys) {
  const re = new RegExp(
    `^${key}=.*$`,
    'gm'
  )

  source =
    source.replace(
      re,
      ''
    )
}

// Remove previous B2 block header if present.
source =
  source.replace(
    /^# ---------- MELEO v6\.2\.0 DR off-site storage ----------\s*$/gm,
    ''
  )

// Remove excess blank lines.
source =
  source
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n*$/, '')

const block = `
# ---------- MELEO v6.2.0 DR off-site storage ----------

# Production MUST set this to true.
DR_OFFSITE_REQUIRED=false

# s3 | r2 | b2 | other-s3-compatible
DR_OFFSITE_PROVIDER=

# Dedicated backup object-storage endpoint.
DR_OFFSITE_ENDPOINT=
DR_OFFSITE_REGION=eu-central-1
DR_OFFSITE_BUCKET=

# Dedicated least-privilege backup credentials.
DR_OFFSITE_ACCESS_KEY_ID=
DR_OFFSITE_SECRET_ACCESS_KEY=

# Remote object namespace.
DR_OFFSITE_PREFIX=database-backups

# Use true for path-style S3-compatible providers when required.
DR_OFFSITE_FORCE_PATH_STYLE=true

DR_OFFSITE_TIMEOUT_MS=30000
`

source =
  source +
  '\n\n' +
  block.trim() +
  '\n'

fs.writeFileSync(
  file,
  source,
  'utf8'
)

for (const key of keys) {
  const matches =
    source.match(
      new RegExp(
        `^${key}=.*$`,
        'gm'
      )
    ) || []

  if (matches.length !== 1) {
    console.error(
      `[FAIL] ${key} occurs ${matches.length} times`
    )

    process.exit(1)
  }

  console.log(
    `[PASS] ${key} exactly once`
  )
}

console.log('')
console.log(
  'MELEO DR configuration normalized.'
)
