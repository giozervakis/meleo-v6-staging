import fs from 'node:fs'
const file=fs.readFileSync('src/features/admin/AdminPage.tsx','utf8')
const i18n=fs.readFileSync('src/i18n.ts','utf8')
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
const failures=[]
const need=(ok,msg)=>{if(!ok)failures.push(msg)}
need(file.includes("function Admin({token,setToast}:any){\n const {t,i18n}=useTranslation()"),'Admin translator missing')
for(const key of [
'adminCommand.toast.loadFailed',
'adminCommand.verification.approveNote',
'adminCommand.memberActions.confirm',
'adminCommand.header.subtitle',
'adminCommand.commandBar.lastRefresh',
'adminCommand.commandBar.refresh',
'adminCommand.kpi.totalMembers',
'adminCommand.tabs.overview',
'adminCommand.tabs.members',
'adminCommand.tabs.bookings',
'adminCommand.tabs.revenue',
'adminCommand.tabs.subscriptions'
]) need(file.includes(key),`missing usage ${key}`)
need(i18n.includes("adminCommand:{"),'adminCommand namespace missing')
need(i18n.includes("subtitle:'Unified view of growth"),'English adminCommand translation missing')
need(pkg.scripts?.['rc3-d7m-check']==='node scripts/rc3-d7m-admin-command-i18n-selftest.mjs','rc3-d7m-check missing')
need(pkg.scripts?.['ci:gate']?.includes('npm run rc3-d7l-check && npm run rc3-d7m-check'),'CI tail missing D7M')
if(failures.length){console.error('RC3-D7-M admin command i18n self-test: FAIL');for(const f of failures)console.error('- '+f);process.exit(1)}
console.log('RC3-D7-M admin command i18n self-test: PASS')
