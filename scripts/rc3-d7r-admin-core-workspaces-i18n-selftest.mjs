import fs from 'node:fs'
const file=fs.readFileSync('src/features/admin/AdminPage.tsx','utf8')
const i18n=fs.readFileSync('src/i18n.ts','utf8')
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
const failures=[]
const need=(ok,msg)=>{if(!ok)failures.push(msg)}
for(const key of [
'adminMarketIntel.specialties.title','adminMarketIntel.cities.title','adminMarketIntel.footer.lastGenerated',
'adminInsights.window','adminInsights.newMembers7','adminInsights.newMembers30','adminInsights.newRequests7','adminInsights.newRequests30','adminInsights.topProsSubtitle','adminInsights.professional','adminInsights.specialty',
'adminMembers.title','adminMembers.subtitle','adminMembers.searchPlaceholder','adminMembers.filters.allRoles','adminMembers.filters.patients','adminMembers.filters.professionals','adminMembers.filters.allPlans','adminMembers.filters.allStatuses','adminMembers.columns.member','adminMembers.columns.role','adminMembers.columns.area','adminMembers.columns.registered','adminMembers.columns.actions','adminMembers.role.professional','adminMembers.role.patient','adminMembers.lastLogin','adminMembers.actions.reactivate','adminMembers.actions.suspend',
'adminBookings.title','adminBookings.subtitle','adminBookings.columns.idDate','adminBookings.columns.customer','adminBookings.columns.professional','adminBookings.columns.service','adminBookings.columns.value',
'adminRevenue.gmvNote'
]) need(file.includes(key),`missing usage ${key}`)
for(const ns of ['adminMarketIntel:{','adminInsights:{','adminMembers:{','adminBookings:{','adminRevenue:{']) need(i18n.includes(ns),`missing namespace ${ns}`)
need(file.includes("i18n.resolvedLanguage==='en'?'en-GB':'el-GR'"),'locale-aware admin dates missing')
need(pkg.scripts?.['rc3-d7r-check']==='node scripts/rc3-d7r-admin-core-workspaces-i18n-selftest.mjs','rc3-d7r-check missing')
need(pkg.scripts?.['ci:gate']?.includes('npm run rc3-d7q-check && npm run rc3-d7r-check'),'CI tail missing D7R')
if(failures.length){console.error('RC3-D7-R admin core workspaces i18n self-test: FAIL');for(const f of failures)console.error('- '+f);process.exit(1)}
console.log('RC3-D7-R admin core workspaces i18n self-test: PASS')
