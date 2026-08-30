import fs from 'node:fs'
const r=p=>fs.readFileSync(p,'utf8'),f=m=>{console.error('RC3-D5-L FAIL - '+m);process.exit(1)}
const x=r('src/features/patient/PatientDashboard.tsx'),i=r('src/i18n.ts'),p=JSON.parse(r('package.json'))
for(const q of ["function VerifyEmailBanner({user,token,cfg,setToast}:any){","const {t}=useTranslation()","patient.verifyEmail.sent","patient.verifyEmail.title","patient.verifyEmail.text","patient.verifyEmail.sending","patient.verifyEmail.resend"])if(!x.includes(q))f(q)
for(const q of ["verifyEmail:{title:'Επιβεβαίωσε το email σου'","verifyEmail:{title:'Verify your email'","{{email}}","sending:'Sending…'"])if(!i.includes(q))f(q)
for(const q of ["'/auth/resend-verification'","method:'POST'","disabled={busy}","aria-busy={busy}","role=\"status\" aria-live=\"polite\"","cfg?.demoAuth","user.emailVerified"])if(!x.includes(q))f('preserved '+q)
if(p.scripts?.['rc3-d5l-check']!=='node scripts/rc3-d5l-verify-email-i18n-selftest.mjs')f('package script')
console.log('RC3-D5-L verify-email i18n self-test: PASS')