import fs from 'node:fs'

const app=fs.readFileSync('src/App.tsx','utf8')
const i18n=fs.readFileSync('src/i18n.ts','utf8')
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
const failures=[]
const need=(ok,msg)=>{if(!ok)failures.push(msg)}

for(const token of [
  "t('auth.password.checklistTitle')",
  "t('auth.password.strength')",
  "t('auth.password.policy')",
  "t('auth.googleContinue')",
  "t('auth.patientRole')",
  "t('auth.professionalRole')",
  "t('auth.twoFactor')",
  "t('auth.forgotPassword')",
  "t('auth.reset.kicker')",
  "t('auth.reset.changed')",
  "t('auth.reset.sessions')"
]) need(app.includes(token),`missing App token: ${token}`)

const a=app.indexOf('function PasswordChecklist(')
const b=app.indexOf('function ReviewComposer(',a)
need(a>=0&&b>a,'Auth/password scope boundaries missing')
if(a>=0&&b>a){
  const scope=app.slice(a,b)
  need(!/[\u0370-\u03FF\u1F00-\u1FFF]/u.test(scope),'Greek hard-coded UI text remains in Auth/password scope')
}
need(i18n.includes('auth:{password:{'),'auth i18n namespace missing')
need(i18n.includes("googleFailed:'Could not start Google sign-in.'"),'English auth translations missing')
need(pkg.scripts?.['rc3-d6a-check']==='node scripts/rc3-d6a-auth-password-i18n-selftest.mjs','rc3-d6a-check package script missing')
need(pkg.scripts?.['ci:gate']?.includes('npm run rc3-d5z-check && npm run rc3-d6a-check'),'ci:gate must append D6A after D5Z')

if(failures.length){
  console.error('RC3-D6-A auth/password i18n self-test: FAIL')
  for(const f of failures)console.error(`- ${f}`)
  process.exit(1)
}
console.log('RC3-D6-A auth/password i18n self-test: PASS')
