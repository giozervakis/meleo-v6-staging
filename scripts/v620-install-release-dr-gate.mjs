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


// Preserve the existing core go/no-go implementation.
pkg.scripts[
  'release:go-no-go:core'
] =
  'node scripts/release-go-no-go.mjs'


// New mandatory DR release gate.
pkg.scripts[
  'release:dr-gate'
] =
  'node scripts/v620-release-dr-gate.mjs'


// Every normal release go/no-go now passes through DR.
pkg.scripts[
  'release:go-no-go'
] =
  'npm run release:dr-gate && npm run release:go-no-go:core'


// Explicit production promotion command.
pkg.scripts[
  'release:production'
] =
  'npm run ci:production && npm run release:dr-gate && npm run release:go-no-go:core'


fs.writeFileSync(
  file,
  JSON.stringify(
    pkg,
    null,
    2
  ) + '\n',
  'utf8'
)

console.log(
  '[PASS] release:dr-gate installed'
)

console.log(
  '[PASS] release:go-no-go now DR enforced'
)

console.log(
  '[PASS] release:production installed'
)
