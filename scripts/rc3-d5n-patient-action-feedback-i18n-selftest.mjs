import fs from 'node:fs'

const read=p=>fs.readFileSync(p,'utf8')
const fail=m=>{console.error('RC3-D5-N patient action feedback i18n self-test: FAIL - '+m);process.exit(1)}

const dashboard=read('src/features/patient/PatientDashboard.tsx')
const i18n=read('src/i18n.ts')
const pkg=JSON.parse(read('package.json'))

for(const token of [
  "setToast(t('patient.feedback.recoverySent'))",
  "t('patient.feedback.messageSendFailed')",
  "setToast(t('patient.feedback.bookAgainReady'))"
]){
  if(!dashboard.includes(token)) fail('dashboard '+token)
}

for(const key of [
  "feedback:{recoverySent:",
  "messageSendFailed:",
  "bookAgainReady:"
]){
  const count=(i18n.match(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'))||[]).length
  if(count!==2) fail('i18n '+key+' expected twice, found '+count)
}

if(pkg.scripts?.['rc3-d5n-check']!=='node scripts/rc3-d5n-patient-action-feedback-i18n-selftest.mjs'){
  fail('package script')
}

if(!pkg.scripts?.['ci:gate']?.endsWith('npm run rc3-d5m-check && npm run rc3-d5n-check')){
  fail('ci gate tail')
}

console.log('RC3-D5-N patient action feedback i18n self-test: PASS')