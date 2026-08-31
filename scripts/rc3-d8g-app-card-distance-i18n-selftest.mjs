import fs from 'node:fs'

const app=fs.readFileSync(
  'src/App.tsx',
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
  app.includes(
    "p.rating || t('appCard.new')"
  ),
  'translated rating fallback missing'
)

need(
  (
    app.match(
      /t\('common\.distanceKm'\)/g
    )||[]
  ).length===2,
  'expected two translated distance unit uses'
)

need(
  !app.includes("'Νέο'"),
  'hardcoded New remains'
)

need(
  !app.includes('} χλμ'),
  'rendered hardcoded km remains'
)

need(
  !app.includes("'km':'χλμ'"),
  'distance language ternary remains'
)

need(
  app.includes("'όχι'"),
  'availability parsing token must remain'
)

need(
  app.includes("'μη διαθέσιμος'"),
  'availability masculine token must remain'
)

need(
  app.includes("'μη διαθέσιμη'"),
  'availability feminine token must remain'
)

need(
  app.includes(
    '/[a-zα-ωάέήίόύώϊϋΐΰ]/u'
  ),
  'password lowercase regex must remain'
)

need(
  (i18n.match(
    /appCard:\{/g
  )||[]).length===2,
  'expected two appCard namespaces'
)

need(
  pkg.scripts?.['rc3-d8g-check']===
  'node scripts/rc3-d8g-app-card-distance-i18n-selftest.mjs',
  'D8G package script missing'
)

need(
  pkg.scripts?.['ci:gate']?.includes(
    'npm run rc3-d8f-check && npm run rc3-d8g-check'
  ),
  'D8G missing after D8F in CI gate'
)

if(failures.length){
  console.error(
    'RC3-D8-G App card/distance i18n self-test: FAIL'
  )

  for(const failure of failures){
    console.error('- '+failure)
  }

  process.exit(1)
}

console.log(
  'RC3-D8-G App card/distance i18n self-test: PASS'
)
