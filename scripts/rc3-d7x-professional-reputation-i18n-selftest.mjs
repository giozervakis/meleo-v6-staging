import fs from 'node:fs'

const app=fs.readFileSync(
  'src/features/professional/reputation/ProfessionalReputation.tsx',
  'utf8'
)

const i18n=fs.readFileSync('src/i18n.ts','utf8')
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))

const fail=[]
const need=(v,m)=>{if(!v)fail.push(m)}

for(const k of [
  'proReputation.starsAria',
  'proReputation.hero.title',
  'proReputation.metrics.rating',
  'proReputation.reviews.title',
  'proReputation.review.verifiedVisit',
  'proReputation.empty.noneTitle',
  'proReputation.trust.title',
  'proReputation.distribution.title',
  'proReputation.guidance.title'
]){
  need(app.includes(k),'missing '+k)
}

need(
  app.includes("const {t,i18n}=useTranslation()"),
  'translator missing'
)

need(
  app.includes("i18n.resolvedLanguage==='en'"),
  'locale-aware date missing'
)

need(
  (i18n.match(/proReputation:\{/g)||[]).length===2,
  'expected two namespaces'
)

need(
  pkg.scripts?.['rc3-d7x-check']===
  'node scripts/rc3-d7x-professional-reputation-i18n-selftest.mjs',
  'package script missing'
)

need(
  pkg.scripts?.['ci:gate']?.includes(
    'npm run rc3-d7w-check && npm run rc3-d7x-check'
  ),
  'CI chain missing'
)

if(fail.length){
  console.error('RC3-D7-X professional reputation i18n self-test: FAIL')
  fail.forEach(x=>console.error('- '+x))
  process.exit(1)
}

console.log(
  'RC3-D7-X professional reputation i18n self-test: PASS'
)
