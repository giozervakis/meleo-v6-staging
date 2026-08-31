import fs from 'node:fs'
const file=fs.readFileSync('src/features/admin/AdminPage.tsx','utf8')
const i18n=fs.readFileSync('src/i18n.ts','utf8')
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
const failures=[]
const need=(ok,msg)=>{if(!ok)failures.push(msg)}
for(const key of [
'adminMarketplaceHealth.kicker',
'adminMarketplaceHealth.title',
'adminMarketplaceHealth.metrics.completion',
'adminMarketplaceHealth.metrics.fulfillment',
'adminMarketplaceHealth.metrics.repeatCare',
'adminMarketplaceHealth.metrics.trustCoverage',
'adminMarketplaceHealth.metrics.patientActivation',
'adminMarketplaceHealth.metrics.reviewCoverage'
]) need(file.includes(key),`missing usage ${key}`)
need(i18n.includes("adminMarketplaceHealth:{"),'adminMarketplaceHealth namespace missing')
need(i18n.includes("title:'Marketplace health'"),'English marketplace health translation missing')
need(pkg.scripts?.['rc3-d7o-check']==='node scripts/rc3-d7o-admin-marketplace-health-i18n-selftest.mjs','rc3-d7o-check missing')
need(pkg.scripts?.['ci:gate']?.includes('npm run rc3-d7n-check && npm run rc3-d7o-check'),'CI tail missing D7O')
if(failures.length){console.error('RC3-D7-O admin marketplace health i18n self-test: FAIL');for(const f of failures)console.error('- '+f);process.exit(1)}
console.log('RC3-D7-O admin marketplace health i18n self-test: PASS')
