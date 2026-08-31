import fs from 'node:fs'
const file=fs.readFileSync('src/features/professional/ProfessionalDashboard.tsx','utf8')
const i18n=fs.readFileSync('src/i18n.ts','utf8')
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
const start=file.indexOf('function ProfessionalRequestsWorkspace(')
const end=file.indexOf('function ProfessionalOnboarding(',start)
const block=file.slice(start,end)
const failures=[]
const need=(ok,msg)=>{if(!ok)failures.push(msg)}
need(start>=0&&end>start,'workspace block missing')
need(block.includes('const {t}=useTranslation()'),'translator missing')
for(const key of [
'professionalRequests.filters.action',
'professionalRequests.hero.title',
'professionalRequests.kpi.attention',
'professionalRequests.tabs.action',
'professionalRequests.empty.actionTitle'
]) need(block.includes(`t('${key}'`),`missing ${key}`)
need(!/[Α-Ωα-ωΆΈΉΊΌΎΏάέήίόύώϊϋΐΰ]/.test(block),'Greek residue remains inside ProfessionalRequestsWorkspace')
need(i18n.includes("professionalRequests:{filters:{action:'Requests that need action'"),'English namespace missing')
need(pkg.scripts?.['rc3-d7f-check']==='node scripts/rc3-d7f-professional-requests-i18n-selftest.mjs','rc3-d7f-check missing')
need(pkg.scripts?.['ci:gate']?.includes('npm run rc3-d7e-check && npm run rc3-d7f-check'),'CI tail missing D7F')
if(failures.length){console.error('RC3-D7-F professional requests i18n self-test: FAIL');for(const f of failures)console.error('- '+f);process.exit(1)}
console.log('RC3-D7-F professional requests i18n self-test: PASS')
