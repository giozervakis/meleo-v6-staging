import fs from 'node:fs'

const app=
  fs.readFileSync(
    'src/features/professional/support/ProfessionalSupport.tsx',
    'utf8'
  )

const i18n=
  fs.readFileSync(
    'src/i18n.ts',
    'utf8'
  )

const pkg=
  JSON.parse(
    fs.readFileSync(
      'package.json',
      'utf8'
    )
  )

const failures=[]

function need(value,message){
  if(!value){
    failures.push(message)
  }
}

[
  'proSupport.errors.load',
  'proSupport.toast.created',
  'proSupport.status.closed',
  'proSupport.hero.title',
  'proSupport.compose.title',
  'proSupport.categories.general',
  'proSupport.actions.create',
  'proSupport.history.title',
  'proSupport.thread.back',
  'proSupport.thread.closedText'
].forEach(
  key=>
    need(
      app.includes(key),
      'missing '+key
    )
)

need(
  app.includes(
    "const {t,i18n}=useTranslation()"
  ),
  'translator missing'
)

need(
  app.includes(
    "i18n.resolvedLanguage==='en'"
  ),
  'locale-aware dates missing'
)

need(
  i18n.match(/proSupport:{/g)?.length===2,
  'expected exactly two proSupport namespaces'
)

need(
  pkg.scripts?.['rc3-d7w-check']===
    'node scripts/rc3-d7w-professional-support-i18n-selftest.mjs',
  'rc3-d7w-check script missing'
)

need(
  pkg.scripts?.['ci:gate']?.includes(
    'npm run rc3-d7v-check && npm run rc3-d7w-check'
  ),
  'D7W not chained into ci:gate'
)

if(failures.length){
  console.error(
    'RC3-D7-W professional support i18n self-test: FAIL'
  )

  failures.forEach(
    item=>console.error('- '+item)
  )

  process.exit(1)
}

console.log(
  'RC3-D7-W professional support i18n self-test: PASS'
)
