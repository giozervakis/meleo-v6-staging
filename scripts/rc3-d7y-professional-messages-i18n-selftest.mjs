import fs from 'node:fs'

const app=fs.readFileSync(
  'src/features/professional/messages/ProfessionalMessages.tsx',
  'utf8'
)

const i18n=fs.readFileSync('src/i18n.ts','utf8')
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))

const fail=[]
const need=(v,m)=>{if(!v)fail.push(m)}

for(const key of [
  'proMessages.errors.send',
  'proMessages.status.pending',
  'proMessages.header.title',
  'proMessages.search.placeholder',
  'proMessages.filters.unread',
  'proMessages.empty.none',
  'proMessages.fallback.patient',
  'proMessages.preview.youPrefix',
  'proMessages.thread.backAria',
  'proMessages.context.service',
  'proMessages.composer.placeholder',
  'proMessages.placeholder.title'
]){
  need(app.includes(key),'missing '+key)
}

need(
  app.includes("const {t,i18n}=useTranslation()"),
  'translator missing'
)

need(
  app.includes("i18n.resolvedLanguage==='en'"),
  'locale switch missing'
)

need(
  (i18n.match(/proMessages:\{/g)||[]).length===2,
  'expected two proMessages namespaces'
)

need(
  pkg.scripts?.['rc3-d7y-check']===
  'node scripts/rc3-d7y-professional-messages-i18n-selftest.mjs',
  'package script missing'
)

need(
  pkg.scripts?.['ci:gate']?.includes(
    'npm run rc3-d7x-check && npm run rc3-d7y-check'
  ),
  'CI chain missing'
)

if(fail.length){
  console.error(
    'RC3-D7-Y professional messages i18n self-test: FAIL'
  )
  fail.forEach(x=>console.error('- '+x))
  process.exit(1)
}

console.log(
  'RC3-D7-Y professional messages i18n self-test: PASS'
)
