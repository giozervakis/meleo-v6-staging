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

const careTeamChunks=i.split('careTeam:{kicker:').slice(1).map(v=>v.split('},bookings:{tablistAria:')[0])
if(careTeamChunks.length!==2) fail('i18n careTeam blocks expected twice, found '+careTeamChunks.length)

for(const q of [
  "count_one:",
  "count_other:",
  "requestAgain:",
  "lastVisit:"
]){
  if(careTeamChunks.some(c=>!c.includes(q))) fail('i18n careTeam '+q)
}

if(p.scripts?.['rc3-d5o-check']!=='node scripts/rc3-d5o-patient-care-team-i18n-selftest.mjs') fail('package script')
if(!p.scripts?.['ci:gate']?.includes('npm run rc3-d5n-check && npm run rc3-d5o-check')) fail('ci gate sequence')

console.log('RC3-D5-O patient care team i18n self-test: PASS')