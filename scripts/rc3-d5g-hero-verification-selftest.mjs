import fs from 'node:fs'
const r=p=>fs.readFileSync(p,'utf8'),f=m=>{console.error('RC3-D5-G FAIL - '+m);process.exit(1)}
const x=r('src/features/patient/PatientDashboard.tsx'),c=r('src/features/patient/patient-rc3d.css'),p=JSON.parse(r('package.json'))
for(const q of ['className="verify-email-banner" role="status" aria-live="polite"','aria-busy={busy}','aria-labelledby="rc3d-patient-hero-title"','id="rc3d-patient-hero-title"','className="patient-care-hero-status" role="status" aria-live="polite"','aria-label="Στοιχεία μέλους MELEO"'])if(!x.includes(q))f(q)
for(const q of ['/* RC3-D5-G patient hero and verification */','.verify-email-banner button{min-height:44px}','@media(max-width:600px)','@media(max-width:390px)'])if(!c.includes(q))f(q)
if(p.scripts?.['rc3-d5g-check']!=='node scripts/rc3-d5g-hero-verification-selftest.mjs')f('package script')
console.log('RC3-D5-G patient hero/verification mobile/a11y self-test: PASS')