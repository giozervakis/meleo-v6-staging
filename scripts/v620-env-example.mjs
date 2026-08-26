import fs from 'node:fs'

const file = '.env.example'

if (!fs.existsSync(file)) {
  process.exit(0)
}

let source = fs.readFileSync(file, 'utf8')
  .replace(/^\uFEFF/, '')
  .replace(/\r\n/g, '\n')

const marker =
  '# ---------- MELEO v6.2 production deployment identity ----------'

if (!source.includes(marker)) {
  source =
    source.replace(/\n+$/, '') +
    `

${marker}
# Required by npm run start:production.
# This guard is intentionally independent of NODE_ENV.
MELEO_DEPLOYMENT_ENV=staging
`
}

fs.writeFileSync(
  file,
  source.replace(/\n+$/, '\n'),
  'utf8'
)

console.log('[PASS] .env.example updated')
