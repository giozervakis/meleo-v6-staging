import fs from 'node:fs'
const r=p=>fs.readFileSync(p,'utf8'),f=m=>{console.error('RC3-D5-F FAIL - '+m);process.exit(1)}
const x=r('src/features/patient/PatientDashboard.tsx'),c=r('src/features/patient/patient-rc3d.css'),p=JSON.parse(r('package.json'))
for(const q of ['aria-labelledby="rc3d-care-status-title"','id="rc3d-care-status-title"','role="list" aria-label="Στοιχεία κατάστασης φροντίδας"','aria-labelledby="rc3d-care-activity-title"','id="rc3d-care-activity-title"','className="patient-activity-list" role="list"','role="listitem"','aria-labelledby="rc3d-quick-actions-title"','id="rc3d-quick-actions-title"','aria-labelledby="rc3d-safety-title"'])if(!x.includes(q))f(q)
const activity=x.match(/\{careActivity\.length>0&&[\s\S]*?<section className="patient-command-panel" aria-labelledby="([^"]+)"/); if(!activity||activity[1]!=="rc3d-care-activity-title")f('stale duplicate care-team label on activity')
for(const q of ['/* RC3-D5-F patient side rail */','.patient-quick-actions button{min-height:44px}','@media(max-width:900px)','@media(max-width:390px)'])if(!c.includes(q))f(q)
if(p.scripts?.['rc3-d5f-check']!=='node scripts/rc3-d5f-side-rail-selftest.mjs')f('package script')
console.log('RC3-D5-F patient side-rail mobile/a11y self-test: PASS')