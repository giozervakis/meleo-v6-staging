import fs from 'node:fs'
const r=p=>fs.readFileSync(p,'utf8'),f=m=>{console.error('RC3-D5-E FAIL - '+m);process.exit(1)}
const x=r('src/features/patient/PatientDashboard.tsx'),c=r('src/features/patient/patient-rc3d.css'),p=JSON.parse(r('package.json'))
for(const q of ['role="list" aria-label="Personal care overview"','className="patient-care-metric" role="listitem"','aria-labelledby="rc3d-next-care-title" aria-live="polite"'])if(!x.includes(q))f(q)
if((x.match(/className="patient-care-metric" role="listitem"/g)||[]).length!==6)f('six overview listitems')
for(const q of ['/* RC3-D5-E overview and next care */','.next-care-actions .btn','.patient-care-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}','@media(max-width:390px)'])if(!c.includes(q))f(q)
if(p.scripts?.['rc3-d5e-check']!=='node scripts/rc3-d5e-overview-next-care-selftest.mjs')f('package script')
console.log('RC3-D5-E overview/next-care mobile/a11y self-test: PASS')