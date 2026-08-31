import fs from 'node:fs'

const read=p=>fs.readFileSync(p,'utf8')
const fail=m=>{console.error('RC3-D5-R smart recovery i18n self-test: FAIL - '+m);process.exit(1)}

const x=read('src/features/patient/PatientDashboard.tsx')
const i=read('src/i18n.ts')
const p=JSON.parse(read('package.json'))

for(const q of [
  "t('patient.recovery.kicker')",
  "t('patient.recovery.title')",
  "t('patient.recovery.text')",
  "t('patient.recovery.searching')",
  "t('patient.recovery.findProfessionals')",
  "t('patient.recovery.empty')",
  "t('patient.recovery.newRating')",
  "t('patient.recovery.sendSameRequest')"
]){
  if(!x.includes(q)) fail('dashboard '+q)
}

if((i.match(/recovery:\{kicker:/g)||[]).length!==2) fail('i18n recovery object count')
const chunks=i.split('recovery:{kicker:').slice(1).map(v=>v.split('},bookings:{tablistAria:')[0])
if(chunks.length!==2) fail('i18n chunks')
for(const q of ['title:','text:','searching:','findProfessionals:','empty:','newRating:','sendSameRequest:']){
  if(chunks.some(c=>!c.includes(q))) fail('i18n '+q)
}

if(p.scripts?.['rc3-d5r-check']!=='node scripts/rc3-d5r-smart-recovery-i18n-selftest.mjs') fail('package script')
if(!p.scripts?.['ci:gate']?.includes('npm run rc3-d5q-check && npm run rc3-d5r-check')) fail('ci gate sequence')

console.log('RC3-D5-R smart recovery i18n self-test: PASS')