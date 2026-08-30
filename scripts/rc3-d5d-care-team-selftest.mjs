import fs from 'node:fs'
const r=p=>fs.readFileSync(p,'utf8'),f=m=>{console.error('RC3-D5-D FAIL - '+m);process.exit(1)}
const x=r('src/features/patient/PatientDashboard.tsx'),c=r('src/features/patient/patient-rc3d.css'),p=JSON.parse(r('package.json'))
for(const q of ['aria-labelledby="rc3d-care-team-title"','id="rc3d-care-team-title"','role="list"','role="listitem"',"t('patient.careTeam.trustAria',{score:p.trust.score})","t('patient.careTeam.newProfessional')"])if(!x.includes(q))f(q)
for(const q of ['/* RC3-D5-D care team */','.patient-care-team-actions .btn{min-height:44px}','@media(max-width:600px)','@media(max-width:390px)'])if(!c.includes(q))f(q)
if(p.scripts?.['rc3-d5d-check']!=='node scripts/rc3-d5d-care-team-selftest.mjs')f('package script')
console.log('RC3-D5-D care team mobile/a11y self-test: PASS')