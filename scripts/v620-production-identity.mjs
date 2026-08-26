import fs from 'node:fs'

const file = 'scripts/start-production.mjs'

let source = fs.readFileSync(file, 'utf8')
  .replace(/^\uFEFF/, '')

const anchor =
`if (process.env.NODE_ENV !== 'production') {
  fatal(
    \`Production launcher requires NODE_ENV=production. \` +
    \`Received: \${JSON.stringify(process.env.NODE_ENV || '')}\`
  )
}
`

const replacement =
`${anchor}
const deploymentEnvironment =
  String(process.env.MELEO_DEPLOYMENT_ENV || '')
    .trim()
    .toLowerCase()

if (deploymentEnvironment !== 'production') {
  fatal(
    'Production launcher requires ' +
    'MELEO_DEPLOYMENT_ENV=production. ' +
    'This second guard prevents a staging blueprint from ' +
    'being promoted accidentally.'
  )
}
`

if (!source.includes('MELEO_DEPLOYMENT_ENV')) {
  if (!source.includes(anchor)) {
    console.error(
      '[FAIL] Could not locate NODE_ENV guard.'
    )
    process.exit(1)
  }

  source = source.replace(
    anchor,
    replacement
  )
}

fs.writeFileSync(
  file,
  source.replace(/\n+$/, '\n'),
  'utf8'
)

console.log(
  '[PASS] Independent production identity guard installed'
)
