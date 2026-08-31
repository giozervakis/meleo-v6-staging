import fs from 'node:fs'

const api=fs.readFileSync(
  'src/lib/api.ts',
  'utf8'
)

const i18n=fs.readFileSync(
  'src/i18n.ts',
  'utf8'
)

const pkg=JSON.parse(
  fs.readFileSync(
    'package.json',
    'utf8'
  )
)

const failures=[]

function need(v,m){
  if(!v){
    failures.push(m)
  }
}

need(
  api.includes(
    "import i18n from '../i18n'"
  ),
  'i18n import missing'
)

need(
  api.includes(
    "i18n.t('apiErrors.generic')"
  ),
  'translated API fallback missing'
)

need(
  !api.includes(
    'Κάτι πήγε στραβά'
  ),
  'hardcoded Greek fallback remains'
)

need(
  (i18n.match(
    /apiErrors:\{/g
  )||[]).length===2,
  'expected two apiErrors namespaces'
)

need(
  pkg.scripts?.['rc3-d8f-check']===
  'node scripts/rc3-d8f-api-error-i18n-selftest.mjs',
  'D8F package script missing'
)

need(
  pkg.scripts?.['ci:gate']?.includes(
    'npm run rc3-d8e-check && npm run rc3-d8f-check'
  ),
  'D8F missing after D8E in CI gate'
)

if(failures.length){
  console.error(
    'RC3-D8-F API error i18n self-test: FAIL'
  )

  for(const failure of failures){
    console.error('- '+failure)
  }

  process.exit(1)
}

console.log(
  'RC3-D8-F API error i18n self-test: PASS'
)
