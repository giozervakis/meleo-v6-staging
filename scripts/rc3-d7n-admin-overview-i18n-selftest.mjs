import fs from 'node:fs'
const file=fs.readFileSync('src/features/admin/AdminPage.tsx','utf8')
const i18n=fs.readFileSync('src/i18n.ts','utf8')
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
const failures=[]
const need=(ok,msg)=>{if(!ok)failures.push(msg)}
for(const key of [
'adminOverview.hero.kicker',
'adminOverview.hero.title',
'adminOverview.hero.subtitle',
'adminOverview.hero.platformStatus',
'adminOverview.hero.operational',
'adminOverview.hero.needsAttention',
'adminOverview.kpi.activeSubscriptions',
'adminOverview.kpi.vsPrevious30d',
'adminOverview.kpi.marketplaceVolume',
'adminOverview.attention.title',
'adminOverview.attention.total',
'adminOverview.attention.clearTitle',
'adminOverview.attention.clearText'
]) need(file.includes(key),`missing usage ${key}`)
need(i18n.includes("adminOverview:{"),'adminOverview namespace missing')
need(i18n.includes("title:'The platform at a glance'"),'English adminOverview translation missing')
need(pkg.scripts?.['rc3-d7n-check']==='node scripts/rc3-d7n-admin-overview-i18n-selftest.mjs','rc3-d7n-check missing')
need(pkg.scripts?.['ci:gate']?.includes('npm run rc3-d7m-check && npm run rc3-d7n-check'),'CI tail missing D7N')
if(failures.length){console.error('RC3-D7-N admin overview i18n self-test: FAIL');for(const f of failures)console.error('- '+f);process.exit(1)}
console.log('RC3-D7-N admin overview i18n self-test: PASS')
