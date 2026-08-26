import fs from 'node:fs'

const file = '.env.example'

let text =
  fs.readFileSync(
    file,
    'utf8'
  )
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')

const marker =
  '# ---------- MELEO v6.2.0 disaster recovery ----------'

const block =
`${marker}
DR_BACKUP_MAX_AGE_HOURS=24
DR_RESTORE_MAX_AGE_HOURS=168
DR_MAX_RTO_SECONDS=900

# Production must explicitly require remote/off-site backup.
DR_OFFSITE_REQUIRED=false

# Supported architecture examples:
# s3 | r2 | b2 | azure | gcs
DR_OFFSITE_PROVIDER=
DR_OFFSITE_BUCKET=

# Dedicated secret used only for signing DR evidence.
# Production: random secret >=32 characters.
DR_EVIDENCE_SIGNING_KEY=
`

const markerIndex =
  text.indexOf(marker)

if (markerIndex >= 0) {
  text =
    text.slice(
      0,
      markerIndex
    )
}

text =
  text.replace(
    /\n+$/,
    ''
  ) +
  '\n\n' +
  block

fs.writeFileSync(
  file,
  text,
  'utf8'
)

console.log(
  '[PASS] .env.example DR policy installed'
)
