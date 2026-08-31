import fs from 'node:fs'
const file=fs.readFileSync('src/features/professional/ProfessionalDashboard.tsx','utf8')
const i18n=fs.readFileSync('src/i18n.ts','utf8')
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
const failures=[]
const need=(ok,msg)=>{if(!ok)failures.push(msg)}
for(const key of [
'professionalGrowth.factors.verifiedActive',
'professionalGrowth.insights.impressions',
'professionalGrowth.hero.title',
'professionalGrowth.metrics.impressions',
'professionalGrowth.attention.title',
'professionalGrowth.profile.title',
'professionalGrowth.trust.title',
'professionalGrowth.smart.title',
'professionalGrowth.value.title'
]) need(file.includes(`t('${key}'`),`missing ${key}`)
need(i18n.includes("professionalGrowth:{"),'professionalGrowth namespace missing')
need(i18n.includes("title:'See how your presence'"),'English growth translations missing')
need(pkg.scripts?.['rc3-d7i-check']==='node scripts/rc3-d7i-professional-growth-i18n-selftest.mjs','rc3-d7i-check missing')
need(pkg.scripts?.['ci:gate']?.includes('npm run rc3-d7h-check && npm run rc3-d7i-check'),'CI tail missing D7I')
if(failures.length){console.error('RC3-D7-I professional growth i18n self-test: FAIL');for(const f of failures)console.error('- '+f);process.exit(1)}
console.log('RC3-D7-I professional growth i18n self-test: PASS')
