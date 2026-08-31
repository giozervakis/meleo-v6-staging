import fs from 'node:fs'
const account=fs.readFileSync('src/Account.tsx','utf8')
const i18n=fs.readFileSync('src/i18n.ts','utf8')
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
const failures=[]
const need=(ok,msg)=>{if(!ok)failures.push(msg)}

for(const token of [
  "useTranslation",
  "t('accountSettings.title')",
  "t('accountSettings.identity.help')",
  "t('accountSettings.password.currentRequired')",
  "t('auth.password.policy')",
  "t('accountSettings.password.changed')",
  "t('accountSettings.data.download')",
  "t('accountSettings.delete.warning')",
  "t('accountSettings.delete.final')"
]) need(account.includes(token),`missing Account token: ${token}`)

const start=account.indexOf('export function AccountSettings(')
const end=account.indexOf('export function Legal(',start)
need(start>=0&&end>start,'AccountSettings boundaries missing')
if(start>=0&&end>start){
  const scope=account.slice(start,end)
  need(!/[\u0370-\u03FF\u1F00-\u1FFF]/u.test(scope),'Greek hard-coded UI text remains in AccountSettings scope')
}

need(i18n.includes("accountSettings:{kicker:'SETTINGS'"),'English accountSettings translations missing')
need(pkg.scripts?.['rc3-d6c-check']==='node scripts/rc3-d6c-account-settings-i18n-selftest.mjs','rc3-d6c-check package script missing')
need(pkg.scripts?.['ci:gate']?.includes('npm run rc3-d6b-check && npm run rc3-d6c-check'),'ci:gate must append D6C after D6B')

if(failures.length){
  console.error('RC3-D6-C account settings i18n self-test: FAIL')
  for(const f of failures)console.error(`- ${f}`)
  process.exit(1)
}
console.log('RC3-D6-C account settings i18n self-test: PASS')