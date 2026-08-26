import fs from 'node:fs'

const file =
  '.env.example'

let source =
  fs.readFileSync(
    file,
    'utf8'
  )
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')


const marker =
  '# ---------- MELEO v6.2.0 DR off-site storage ----------'


const block =
`
${marker}

# Production must fail when the remote backup cannot be verified.
DR_OFFSITE_REQUIRED=false

# s3 | r2 | b2 | other-s3-compatible
DR_OFFSITE_PROVIDER=

# Separate backup endpoint/bucket are recommended.
# Endpoint may fall back to S3_ENDPOINT.
DR_OFFSITE_ENDPOINT=
DR_OFFSITE_REGION=eu-central-1
DR_OFFSITE_BUCKET=

# Dedicated credentials are recommended.
# If blank, the implementation can fall back to S3_ACCESS_KEY_ID /
# S3_SECRET_ACCESS_KEY.
DR_OFFSITE_ACCESS_KEY_ID=
DR_OFFSITE_SECRET_ACCESS_KEY=

# Remote layout example:
# database-backups/2026/meleo-....dump
DR_OFFSITE_PREFIX=database-backups

# true supports providers that use endpoint/bucket/object paths.
DR_OFFSITE_FORCE_PATH_STYLE=true

DR_OFFSITE_TIMEOUT_MS=30000
`


source =
  source.replace(
    /\n?# ---------- MELEO v6\.2\.0 DR off-site storage ----------[\s\S]*?(?=\n# ----------|\s*$)/,
    ''
  )


source =
  source
    .replace(/\n*$/, '') +
  '\n' +
  block
    .replace(/^\n/, '')
    .replace(/\n*$/, '') +
  '\n'


fs.writeFileSync(
  file,
  source,
  'utf8'
)

console.log(
  '[PASS] .env.example off-site contract installed'
)
