import fs from 'node:fs'
const file=fs.readFileSync('src/features/admin/AdminPage.tsx','utf8')
const i18n=fs.readFileSync('src/i18n.ts','utf8')
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
const failures=[]
const need=(ok,msg)=>{if(!ok)failures.push(msg)}
for(const key of [
'adminGrowth.registrationKicker',
'adminGrowth.newRegistrations',
'adminGrowth.marketplaceKicker',
'adminGrowth.newRequests',
'adminGrowth.revenueKicker',
'adminGrowth.payments'
]) need(file.includes(key),`missing usage ${key}`)
need(i18n.includes("adminGrowth:{"),'adminGrowth namespace missing')
need(i18n.includes("newRegistrations:'New registrations'"),'English adminGrowth translation missing')
need(pkg.scripts?.['rc3-d7q-check']==='node scripts/rc3-d7q-admin-growth-i18n-selftest.mjs','rc3-d7q-check missing')
need(pkg.scripts?.['ci:gate']?.includes('npm run rc3-d7p-check && npm run rc3-d7q-check'),'CI tail missing D7Q')
if(failures.length){console.error('RC3-D7-Q admin growth i18n self-test: FAIL');for(const f of failures)console.error('- '+f);process.exit(1)}
console.log('RC3-D7-Q admin growth i18n self-test: PASS')
