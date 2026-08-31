import fs from 'node:fs'
const app=fs.readFileSync('src/App.tsx','utf8')
const i18n=fs.readFileSync('src/i18n.ts','utf8')
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
const failures=[]
const need=(ok,msg)=>{if(!ok)failures.push(msg)}

for(const token of [
  "t('accountFlow.checkout.confirming')",
  "t('accountFlow.checkout.activated')",
  "t('accountFlow.checkout.cancelled')",
  "t('accountFlow.email.verified')",
  "t('accountFlow.welcome'",
  "t('accountFlow.email.resendSuccess')",
  "t('accountFlow.email.unverified')",
  "t('accountFlow.email.sent')",
  "t('accountFlow.email.resend')"
]) need(app.includes(token),`missing App token: ${token}`)

need(i18n.includes("accountFlow:{checkout:{confirming:"),'accountFlow namespace missing')
need(i18n.includes("confirming:'Confirming payment...'"),'English accountFlow translations missing')
need(pkg.scripts?.['rc3-d6b-check']==='node scripts/rc3-d6b-account-lifecycle-i18n-selftest.mjs','rc3-d6b-check package script missing')
need(pkg.scripts?.['ci:gate']?.includes('npm run rc3-d6a-check && npm run rc3-d6b-check'),'ci:gate must append D6B after D6A')

if(failures.length){
  console.error('RC3-D6-B account lifecycle i18n self-test: FAIL')
  for(const f of failures)console.error(`- ${f}`)
  process.exit(1)
}
console.log('RC3-D6-B account lifecycle i18n self-test: PASS')