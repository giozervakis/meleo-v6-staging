import fs from 'node:fs'
const r=p=>fs.readFileSync(p,'utf8'),f=m=>{console.error('RC3-D5-H FAIL - '+m);process.exit(1)}
const x=r('src/features/patient/PatientDashboard.tsx'),c=r('src/features/patient/patient-rc3d.css'),p=JSON.parse(r('package.json'))
for(const q of ['aria-labelledby="rc3d-attention-title"','id="rc3d-attention-title"','aria-orientation="horizontal"','aria-controls="rc3d-patient-bookings-panel"','id="rc3d-patient-bookings-tab"','aria-controls="rc3d-patient-messages-panel"','id="rc3d-patient-messages-tab"','id="rc3d-patient-bookings-panel" role="tabpanel" aria-labelledby="rc3d-patient-bookings-tab"','id="rc3d-patient-messages-panel" role="tabpanel" aria-labelledby="rc3d-patient-messages-tab"'])if(!x.includes(q))f(q)
for(const q of ['/* RC3-D5-H attention and patient workspace navigation */','.patient-section-tabs button{min-height:44px}','@media(max-width:600px)','@media(max-width:390px)'])if(!c.includes(q))f(q)
if(p.scripts?.['rc3-d5h-check']!=='node scripts/rc3-d5h-attention-tabs-selftest.mjs')f('package script')
console.log('RC3-D5-H attention/tabs mobile/a11y self-test: PASS')