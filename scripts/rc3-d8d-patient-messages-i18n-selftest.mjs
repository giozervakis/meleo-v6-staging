import fs from 'node:fs'

const src=fs.readFileSync(
 'src/features/patient/messages/PatientMessages.tsx',
 'utf8'
)

const i18n=fs.readFileSync(
 'src/i18n.ts',
 'utf8'
)

const pkg=JSON.parse(
 fs.readFileSync(
  'package.json',
  'utf8'
 )
)

const failures=[]

function need(v,m){
 if(!v)failures.push(m)
}

for(const key of [
 'patientMessages.title',
 'patientMessages.search.placeholder',
 'patientMessages.filters.unread',
 'patientMessages.empty.noConversations',
 'patientMessages.fallback.professional',
 'patientMessages.context.fromPrice',
 'patientMessages.thread.emptyTitle',
 'patientMessages.composer.placeholder',
 'patientMessages.noSelection.title'
]){
 need(
  src.includes(key),
  'missing '+key
 )
}

need(
 src.includes('booking.service'),
 'booking service changed'
)

need(
 src.includes('booking.specialty'),
 'booking specialty changed'
)

need(
 src.includes('message.text'),
 'message text changed'
)

need(
 src.includes('message.body'),
 'message body changed'
)

need(
 src.includes(
  'statusLabel(activeConversation.status)'
 ),
 'status handling changed'
)

need(
 (i18n.match(
  /patientMessages:\{/g
 )||[]).length===2,
 'expected two namespaces'
)

need(
 pkg.scripts?.['rc3-d8d-check']===
 'node scripts/rc3-d8d-patient-messages-i18n-selftest.mjs',
 'package script missing'
)

need(
 pkg.scripts?.['ci:gate']?.includes(
  'npm run rc3-d8c-check && npm run rc3-d8d-check'
 ),
 'CI gate missing D8D'
)

if(failures.length){
 console.error(
  'RC3-D8-D patient messages i18n self-test: FAIL'
 )

 for(const failure of failures){
  console.error('- '+failure)
 }

 process.exit(1)
}

console.log(
 'RC3-D8-D patient messages i18n self-test: PASS'
)
