import fs from 'node:fs'
const r=p=>fs.readFileSync(p,'utf8'),f=m=>{console.error('RC3-D5-I FAIL - '+m);process.exit(1)}
const x=r('src/features/patient/PatientDashboard.tsx'),i=r('src/i18n.ts'),p=JSON.parse(r('package.json'))
for(const q of ["useTranslation","patient.hero.greeting","patient.hero.intro","patient.metrics.active","patient.metrics.continuity","patient.tabs.bookings","patient.tabs.messages","i18n.language==='en'?'en-US':'el-GR'"])if(!x.includes(q))f(q)
for(const q of ["greeting:'Καλησπέρα, {{name}}'","greeting:'Good evening, {{name}}'","active:'Active requests'","bookings:'My bookings'","messages:'Messages'"])if(!i.includes(q))f(q)
for(const q of ["`${nextBooking.date}T00:00:00`","`status premium-status ${nextBooking.status}`","`booking-row booking-card-premium clickable booking-${b.status}`","`${b.agreedPrice}€`","`activity-dot ${b.status}`"])if(!x.includes(q))f('template literal preserved: '+q)
if(p.scripts?.['rc3-d5i-check']!=='node scripts/rc3-d5i-patient-chrome-i18n-selftest.mjs')f('package script')
console.log('RC3-D5-I patient chrome i18n self-test: PASS')