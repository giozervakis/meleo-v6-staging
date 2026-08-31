import fs from 'node:fs'
const file=fs.readFileSync('src/features/professional/ProfessionalDashboard.tsx','utf8')
const i18n=fs.readFileSync('src/i18n.ts','utf8')
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
const start=file.indexOf('function ProfessionalLocationEditor(')
const end=file.indexOf('function CompactBooking(',start)
const block=file.slice(start,end)
const failures=[]
const need=(ok,msg)=>{if(!ok)failures.push(msg)}
need(start>=0&&end>start,'ProfessionalLocationEditor block missing')
need(block.includes('const {t}=useTranslation()'),'translator missing')
for(const key of ['professionalLocation.errors.notFound','professionalLocation.toast.saved','professionalLocation.fields.city','professionalLocation.actions.useGps','professionalLocation.status.radius']) need(block.includes(`t('${key}'`),`missing ${key}`)
need(!/[\u0370-\u03ff\u1f00-\u1fff]/.test(block),'Greek residue remains inside ProfessionalLocationEditor block')
need(file.includes("t('professionalOnboarding.footFlow')"),'onboarding footFlow key not used')
need(i18n.includes("professionalLocation:{errors:{notFound:'Location not found'"),'English professionalLocation namespace missing')
need(i18n.includes("footFlow:'Account \u2192 Plan \u2192 Checkout \u2192 Profile \u2192 Verification \u2192 Admin approval \u2192 Public profile.'"),'English footFlow missing')
need(pkg.scripts?.['rc3-d7h-check']==='node scripts/rc3-d7h-professional-location-i18n-selftest.mjs','rc3-d7h-check missing')
need(pkg.scripts?.['ci:gate']?.includes('npm run rc3-d7g-check && npm run rc3-d7h-check'),'CI tail missing D7H')
if(failures.length){console.error('RC3-D7-H professional location i18n self-test: FAIL');for(const f of failures)console.error('- '+f);process.exit(1)}
console.log('RC3-D7-H professional location i18n self-test: PASS')