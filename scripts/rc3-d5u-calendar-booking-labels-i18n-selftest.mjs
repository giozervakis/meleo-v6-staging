import fs from 'node:fs'

const read=p=>fs.readFileSync(p,'utf8')
const fail=m=>{console.error('RC3-D5-U calendar/booking labels i18n self-test: FAIL - '+m);process.exit(1)}

const x=read('src/App.tsx')
const i=read('src/i18n.ts')
const p=JSON.parse(read('package.json'))

for(const q of [
  "import i18n from './i18n'",
  "function i18nGlobal(){return {t:i18n.t.bind(i18n)}}",
  "t('patient.calendar.visit')",
  "t('patient.calendar.add')",
  "patient.bookingLabels.status.",
  "patient.bookingLabels.repeat."
]){
  if(!x.includes(q)) fail('App.tsx '+q)
}

if((i.match(/calendar:\{visit:/g)||[]).length<2) fail('patient calendar objects missing')
if((i.match(/bookingLabels:\{status:/g)||[]).length!==2) fail('bookingLabels object count')

if(p.scripts?.['rc3-d5u-check']!=='node scripts/rc3-d5u-calendar-booking-labels-i18n-selftest.mjs') fail('package script')
if(!p.scripts?.['ci:gate']?.includes('npm run rc3-d5t-check && npm run rc3-d5u-check')) fail('ci gate sequence')

console.log('RC3-D5-U calendar/booking labels i18n self-test: PASS')