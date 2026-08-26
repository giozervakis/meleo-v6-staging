import fs from 'node:fs'

const files = [
  '.env.example',
  'scripts/launch-guard.mjs',
  'scripts/release-go-no-go.mjs',
  'scripts/release-manifest.mjs',
  'scripts/v60-check.mjs'
]

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.log(`[INFO] ${file} not present - skipped`)
    continue
  }

  let source = fs
    .readFileSync(file, 'utf8')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')

  source = source
    .replace(/v6\.1\.2/g, 'v6.2.0')
    .replace(/'6\.1\.2'/g, "'6.2.0'")
    .replace(/"6\.1\.2"/g, '"6.2.0"')
    .replace(/\n*$/, '\n')

  fs.writeFileSync(
    file,
    source,
    'utf8'
  )

  console.log(`[PASS] ${file}`)
}
