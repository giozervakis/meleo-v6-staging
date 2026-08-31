import fs from 'node:fs'

const read=p=>fs.readFileSync(p,'utf8')
const fail=m=>{console.error('RC3-D5-Q patient booking actions i18n self-test: FAIL - '+m);process.exit(1)}

const x=read('src/features/patient/PatientDashboard.tsx')
const i=read('src/i18n.ts')
const p=JSON.parse(read('package.json'))

for(const q of [
  "t('patient.bookingActions.quoteTitle')",
  "t('patient.bookingActions.quoteHelp')",
  "t('patient.bookingActions.acceptQuote')",
  "t('patient.bookingActions.rejectQuote')",
  "aria-label={t('patient.bookingActions.replyAria')}",
  "placeholder={t('patient.bookingActions.replyPlaceholder')}",
  "t('patient.bookingActions.sendReply')",
  "t('patient.bookingActions.cancelRequest')"
]){
  if(!x.includes(q)) fail('dashboard '+q)
}

if((i.match(/bookingActions:\{quoteTitle:/g)||[]).length!==2) fail('i18n bookingActions object count')
const chunks=i.split('bookingActions:{quoteTitle:').slice(1).map(v=>v.split('},bookings:{tablistAria:')[0])
if(chunks.length!==2) fail('i18n chunks')
for(const q of ['quoteHelp:','acceptQuote:','rejectQuote:','replyAria:','replyPlaceholder:','sendReply:','cancelRequest:']){
  if(chunks.some(c=>!c.includes(q))) fail('i18n '+q)
}

if(p.scripts?.['rc3-d5q-check']!=='node scripts/rc3-d5q-patient-booking-actions-i18n-selftest.mjs') fail('package script')
if(!p.scripts?.['ci:gate']?.includes('npm run rc3-d5p-check && npm run rc3-d5q-check')) fail('ci gate sequence')

console.log('RC3-D5-Q patient booking actions i18n self-test: PASS')