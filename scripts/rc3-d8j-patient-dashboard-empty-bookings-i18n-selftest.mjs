import fs from 'node:fs'

const dashboard=fs.readFileSync(
  'src/features/patient/PatientDashboard.tsx',
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
  if(!v){
    failures.push(m)
  }
}

need(
  dashboard.includes(
    "title={t('patient.emptyBookings.title')}"
  ),
  'translated title missing'
)

need(
  dashboard.includes(
    "text={t('patient.emptyBookings.text')}"
  ),
  'translated text missing'
)

need(
  !dashboard.includes(
    'Δεν έχεις ακόμη κρατήσεις'
  ),
  'hardcoded title remains'
)

need(
  !dashboard.includes(
    'Η επόμενη φροντίδα σου απέχει λίγα clicks.'
  ),
  'hardcoded text remains'
)

need(
  i18n.split(
    'emptyBookings:{'
  ).length-1===2,
  'expected two emptyBookings blocks'
)

need(
  i18n.includes(
    "title:'Δεν έχεις ακόμη κρατήσεις'"
  ),
  'Greek translation missing'
)

need(
  i18n.includes(
    "title:'You do not have any bookings yet'"
  ),
  'English translation missing'
)

need(
  pkg.scripts?.['rc3-d8j-check']===
  'node scripts/rc3-d8j-patient-dashboard-empty-bookings-i18n-selftest.mjs',
  'D8J package script missing'
)

need(
  pkg.scripts?.['ci:gate']?.includes(
    'npm run rc3-d8i-check && npm run rc3-d8j-check'
  ),
  'D8J missing after D8I in CI gate'
)

if(failures.length){
  console.error(
    'RC3-D8-J Patient Dashboard empty bookings i18n self-test: FAIL'
  )

  for(const failure of failures){
    console.error('- '+failure)
  }

  process.exit(1)
}

console.log(
  'RC3-D8-J Patient Dashboard empty bookings i18n self-test: PASS'
)
