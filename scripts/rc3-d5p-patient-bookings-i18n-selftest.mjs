import fs from 'node:fs'

const read=p=>fs.readFileSync(p,'utf8')
const fail=m=>{console.error('RC3-D5-P patient bookings i18n self-test: FAIL - '+m);process.exit(1)}

const x=read('src/features/patient/PatientDashboard.tsx')
const i=read('src/i18n.ts')
const p=JSON.parse(read('package.json'))

for(const q of [
  "aria-label={t('patient.bookings.tablistAria')}",
  "t('patient.bookings.kicker')",
  "t('patient.bookings.title')",
  "t('patient.bookings.count',{count:bookings.length})",
  "t('patient.bookings.from')",
  "t('patient.bookings.close')",
  "t('patient.bookings.details')",
  "t('patient.bookings.professional')",
  "t('patient.bookings.request')",
  "t('patient.bookings.needDescription')"
]){
  if(!x.includes(q)) fail('dashboard '+q)
}

if((i.match(/bookings:\{tablistAria:/g)||[]).length!==2) fail('i18n bookings object count')
const chunks=i.split('bookings:{tablistAria:').slice(1).map(v=>v.split('},tabs:{bookings:')[0])
if(chunks.length!==2) fail('i18n chunks')
for(const q of ['count_one:','count_other:','needDescription:']){
  if(chunks.some(c=>!c.includes(q))) fail('i18n '+q)
}

if(p.scripts?.['rc3-d5p-check']!=='node scripts/rc3-d5p-patient-bookings-i18n-selftest.mjs') fail('package script')
if(!p.scripts?.['ci:gate']?.includes('npm run rc3-d5o-check && npm run rc3-d5p-check')) fail('ci gate sequence')

console.log('RC3-D5-P patient bookings i18n self-test: PASS')