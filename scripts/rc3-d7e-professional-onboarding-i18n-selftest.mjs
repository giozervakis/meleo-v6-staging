import fs from 'node:fs'
const file=fs.readFileSync('src/features/professional/ProfessionalDashboard.tsx','utf8')
const i18n=fs.readFileSync('src/i18n.ts','utf8')
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
const start=file.indexOf('function ProfessionalOnboarding(')
const end=file.indexOf('function ProfessionalLocationEditor(',start)
const block=file.slice(start,end)
const failures=[]
const need=(ok,msg)=>{if(!ok)failures.push(msg)}
need(start>=0&&end>start,'ProfessionalOnboarding block missing')
need(block.includes('const {t}=useTranslation()'),'onboarding translator missing')
for(const key of ['professionalOnboarding.step1.title','professionalOnboarding.step1.continue','professionalOnboarding.step2.fact1','professionalOnboarding.step2.pay','professionalOnboarding.step3.professionalTitle','professionalOnboarding.step3.specialty','professionalOnboarding.step4.license','professionalOnboarding.step4.submit','professionalOnboarding.toast.profileSaved']) need(block.includes(`t('${key}'`),`missing ${key}`)
need(!/[Α-Ωα-ωΆΈΉΊΌΎΏάέήίόύώϊϋΐΰ]/.test(block.replace(/Λογαριασμός → Πακέτο → Checkout → Προφίλ → Verification → Admin approval → Public profile\./g,'')),'unexpected Greek residue remains inside onboarding block')
need(i18n.includes("professionalOnboarding:{progress:{plan:'Plan'"),'English onboarding namespace missing')
need(pkg.scripts?.['rc3-d7e-check']==='node scripts/rc3-d7e-professional-onboarding-i18n-selftest.mjs','rc3-d7e-check missing')
need(pkg.scripts?.['ci:gate']?.includes('npm run rc3-d7d-check && npm run rc3-d7e-check'),'ci gate must append D7E')
if(failures.length){console.error('RC3-D7-E professional onboarding i18n self-test: FAIL');for(const f of failures)console.error('- '+f);process.exit(1)}
console.log('RC3-D7-E professional onboarding i18n self-test: PASS')
