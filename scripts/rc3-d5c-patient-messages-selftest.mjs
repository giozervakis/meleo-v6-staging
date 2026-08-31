import fs from 'node:fs'
const r=p=>fs.readFileSync(p,'utf8'),f=m=>{console.error('RC3-D5-C FAIL - '+m);process.exit(1)}
const x=r('src/features/patient/messages/PatientMessages.tsx'),c=r('src/features/patient/messages/patient-messages.css'),p=JSON.parse(r('package.json'))
for(const q of ['aria-pressed={filter===','role="log"','aria-relevant="additions text"','aria-busy={sending}'])if(!x.includes(q))f(q)
for(const q of ["aria-label={t('patientMessages.filters.aria')}","aria-label={t('patientMessages.composer.aria')}"])if(!x.includes(q))f(q)
for(const q of ['/* RC3-D5-C */','focus-visible','min-height:44px','font-size:16px','@media(max-width:700px)','@media(max-width:390px)'])if(!c.includes(q))f(q)
if(p.scripts?.['rc3-d5c-check']!=='node scripts/rc3-d5c-patient-messages-selftest.mjs')f('package script')
console.log('RC3-D5-C patient messages mobile/a11y self-test: PASS')
