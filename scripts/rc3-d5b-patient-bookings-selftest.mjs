import fs from 'node:fs'
const r=p=>fs.readFileSync(p,'utf8'),f=m=>{console.error('RC3-D5-B patient bookings self-test: FAIL - '+m);process.exit(1)}
const x=r('src/features/patient/PatientDashboard.tsx'),c=r('src/features/patient/patient-rc3d.css'),p=JSON.parse(r('package.json'))
for(const q of ['role="button"','tabIndex={0}','aria-expanded={open===b.id}',"e.key==='Enter'||e.key===' '",'aria-label="Απάντηση ή διευκρίνιση για το αίτημα"','aria-busy={recoveryBusy===b.id}'])if(!x.includes(q))f(q)
for(const q of ['.patient-request-wrap','.booking-row[role="button"]','.reply-box textarea','@media(max-width:600px)','@media(max-width:390px)'])if(!c.includes(q))f('CSS '+q)
if(p.scripts?.['rc3-d5b-check']!=='node scripts/rc3-d5b-patient-bookings-selftest.mjs')f('package script')
if(!p.scripts?.['ci:gate']?.includes('rc3-d5b-check'))f('ci gate')
console.log('RC3-D5-B patient bookings mobile/a11y self-test: PASS')
