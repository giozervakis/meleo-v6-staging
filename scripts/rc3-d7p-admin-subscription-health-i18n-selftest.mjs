import fs from 'node:fs'
const file=fs.readFileSync('src/features/admin/AdminPage.tsx','utf8')
const i18n=fs.readFileSync('src/i18n.ts','utf8')
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
const failures=[]
const need=(ok,msg)=>{if(!ok)failures.push(msg)}
for(const key of [
'adminSubscriptionHealth.kicker',
'adminSubscriptionHealth.title',
'adminSubscriptionHealth.active',
'adminSubscriptionHealth.basic',
'adminSubscriptionHealth.premium',
'adminSubscriptionHealth.pastDue',
'adminSubscriptionHealth.cancelled'
]) need(file.includes(key),`missing usage ${key}`)
need(i18n.includes("adminSubscriptionHealth:{"),'adminSubscriptionHealth namespace missing')
need(i18n.includes("title:'Subscription health'"),'English subscription health translation missing')
need(pkg.scripts?.['rc3-d7p-check']==='node scripts/rc3-d7p-admin-subscription-health-i18n-selftest.mjs','rc3-d7p-check missing')
need(pkg.scripts?.['ci:gate']?.includes('npm run rc3-d7o-check && npm run rc3-d7p-check'),'CI tail missing D7P')
if(failures.length){console.error('RC3-D7-P admin subscription health i18n self-test: FAIL');for(const f of failures)console.error('- '+f);process.exit(1)}
console.log('RC3-D7-P admin subscription health i18n self-test: PASS')
