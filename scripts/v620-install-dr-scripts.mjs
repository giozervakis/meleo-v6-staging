import fs from 'node:fs'

const file =
  'package.json'

const pkg =
  JSON.parse(
    fs.readFileSync(
      file,
      'utf8'
    )
  )

pkg.scripts ||= {}

pkg.scripts[
  'dr:evidence'
] =
  'node scripts/v620-dr-evidence-gate.mjs'

pkg.scripts[
  'dr:evidence:sign'
] =
  'node scripts/v620-dr-evidence-sign.mjs'

pkg.scripts[
  'dr:policy'
] =
  'node scripts/v620-dr-policy-check.mjs'

pkg.scripts[
  'dr:policy:selftest'
] =
  'node scripts/v620-dr-policy-selftest.mjs'

pkg.scripts[
  'dr:verify'
] =
  'npm run dr:policy && npm run dr:evidence && npm run dr:evidence:sign'

fs.writeFileSync(
  file,
  JSON.stringify(
    pkg,
    null,
    2
  ) + '\n'
)

console.log(
  '[PASS] package.json DR scripts installed'
)
