import fs from 'node:fs'

const read=p=>fs.readFileSync(p,'utf8')
const fail=m=>{console.error('RC3-D5-S repeat-care i18n self-test: FAIL - '+m);process.exit(1)}

const x=read('src/features/patient/PatientDashboard.tsx')
const i=read('src/i18n.ts')
const p=JSON.parse(read('package.json'))

for(const q of [
  "t('patient.repeatCare.kicker')",
  "t('patient.repeatCare.title')",
  "t('patient.repeatCare.text')",
  "t('patient.repeatCare.cta')"
]){
  if(!x.includes(q)) fail('dashboard '+q)
}

if((i.match(/repeatCare:\{kicker:/g)||[]).length!==2) fail('i18n repeatCare object count')
const chunks=i.split('repeatCare:{kicker:').slice(1).map(v=>v.split('},bookings:{tablistAria:')[0])
if(chunks.length!==2) fail('i18n chunks')
for(const q of ['title:','text:','cta:']){
  if(chunks.some(c=>!c.includes(q))) fail('i18n '+q)
}

if(p.scripts?.['rc3-d5s-check']!=='node scripts/rc3-d5s-repeat-care-i18n-selftest.mjs') fail('package script')
if(!p.scripts?.['ci:gate']?.includes('npm run rc3-d5r-check && npm run rc3-d5s-check')) fail('ci gate sequence')

console.log('RC3-D5-S repeat-care i18n self-test: PASS')