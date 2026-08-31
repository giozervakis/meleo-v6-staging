import fs from 'node:fs'
const file=fs.readFileSync('src/features/admin/AdminPage.tsx','utf8')
const i18n=fs.readFileSync('src/i18n.ts','utf8')
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
const failures=[]
const need=(ok,msg)=>{if(!ok)failures.push(msg)}
need(file.includes("import { useTranslation } from 'react-i18next'"),'useTranslation import missing')
need(file.includes("function AdminSubscriptions({token,setToast}:any){\n const {t,i18n}=useTranslation()"),'AdminSubscriptions translator missing')
for(const key of [
'adminSubscriptions.toast.loadError',
'adminSubscriptions.toast.synced',
'adminSubscriptions.loading',
'adminSubscriptions.status.active',
'adminSubscriptions.subscriptions.title',
'adminSubscriptions.subscriptions.columns.professional',
'adminSubscriptions.subscriptions.empty',
'adminSubscriptions.payments.title',
'adminSubscriptions.payments.columns.date',
'adminSubscriptions.payments.paid',
'adminSubscriptions.payments.view',
'adminSubscriptions.payments.empty'
]) need(file.includes(key),`missing usage ${key}`)
need(i18n.includes("adminSubscriptions:{"),'namespace missing')
need(i18n.includes("title:'Professional subscriptions'"),'English translations missing')
need(pkg.scripts?.['rc3-d7l-check']==='node scripts/rc3-d7l-admin-subscriptions-i18n-selftest.mjs','rc3-d7l-check missing')
need(pkg.scripts?.['ci:gate']?.includes('npm run rc3-d7k-check && npm run rc3-d7l-check'),'CI tail missing D7L')
if(failures.length){console.error('RC3-D7-L admin subscriptions i18n self-test: FAIL');for(const f of failures)console.error('- '+f);process.exit(1)}
console.log('RC3-D7-L admin subscriptions i18n self-test: PASS')
