import fs from 'node:fs'

const read=p=>fs.readFileSync(p,'utf8')
const fail=m=>{console.error('RC3-D5-O patient care team i18n self-test: FAIL - '+m);process.exit(1)}

const x=read('src/features/patient/PatientDashboard.tsx')
const i=read('src/i18n.ts')
const p=JSON.parse(read('package.json'))

for(const q of [
  "t('patient.careTeam.kicker')",
  "t('patient.careTeam.title')",
  "t('patient.careTeam.count',{count:careTeam.length})",
  "t('patient.careTeam.intro')",
  "t('patient.careTeam.trustAria',{score:p.trust.score})",
  "t('patient.careTeam.newProfessional')",
  "t('patient.careTeam.newRating')",
  "t('patient.careTeam.lastVisit')",
  "t('patient.careTeam.requestAgain')",
  "t('patient.careTeam.profile')",
  "i18n.language==='en'?'en-US':'el-GR'"
]){
  if(!x.includes(q)) fail('dashboard '+q)
}

for(const q of [
  "careTeam:{kicker:",
  "count_one:",
  "count_other:",
  "requestAgain:",
  "lastVisit:"
]){
  const count=(i.match(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'))||[]).length
  if(count!==2) fail('i18n '+q+' expected twice, found '+count)
}

if(p.scripts?.['rc3-d5o-check']!=='node scripts/rc3-d5o-patient-care-team-i18n-selftest.mjs') fail('package script')
if(!p.scripts?.['ci:gate']?.endsWith('npm run rc3-d5n-check && npm run rc3-d5o-check')) fail('ci gate tail')

console.log('RC3-D5-O patient care team i18n self-test: PASS')