import fs from 'node:fs'
const r=p=>fs.readFileSync(p,'utf8'),f=m=>{console.error('RC3-D5-A patient shell self-test: FAIL - '+m);process.exit(1)}
const x=r('src/features/patient/PatientDashboard.tsx'),c=r('src/features/patient/patient-rc3d.css'),p=JSON.parse(r('package.json'))
for(const q of ["patient-rc3d.css","rc3d-patient-page",'aria-label="Personal care overview"','aria-labelledby="rc3d-next-care-title"','role="status" aria-live="polite"','role="tablist"','role="tab"','aria-selected={patientSection'])if(!x.includes(q))f(q)
for(const q of ['overflow-x:clip','min-height:44px','font-size:16px','@media(max-width:900px)','@media(max-width:600px)','@media(max-width:390px)','prefers-reduced-motion'])if(!c.includes(q))f('CSS '+q)
if(p.scripts?.['rc3-d5a-check']!=='node scripts/rc3-d5a-patient-shell-selftest.mjs')f('package script')
if(!p.scripts?.['ci:gate']?.includes('rc3-d5a-check'))f('ci gate')
console.log('RC3-D5-A patient dashboard shell mobile/a11y self-test: PASS')
