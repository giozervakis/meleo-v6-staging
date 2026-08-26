import fs from 'node:fs'

const file = 'package.json'
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'))

pkg.scripts ||= {}

pkg.scripts['start:production'] =
  'node scripts/start-production.mjs'

fs.writeFileSync(
  file,
  JSON.stringify(pkg, null, 2) + '\n',
  'utf8'
)

console.log(
  '[PASS] package.json start:production installed'
)
