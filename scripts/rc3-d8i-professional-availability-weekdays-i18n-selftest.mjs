import fs from 'node:fs'

const availability=fs.readFileSync(
  'src/features/professional/availability/ProfessionalAvailability.tsx',
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
  availability.includes(
    "{day:1,key:'monday'}"
  ),
  'weekday keys missing'
)

need(
  availability.includes(
    "t('proAvailability.weekdays.'+item.key+'.short')"
  ),
  'translated short weekday render missing'
)

need(
  availability.includes(
    "'proAvailability.weekdays.'+"
  ),
  'translated full weekday render missing'
)

const forbidden=[
  "'Δευτέρα'",
  "'Δευ'",
  "'Τρίτη'",
  "'Τρι'",
  "'Τετάρτη'",
  "'Τετ'",
  "'Πέμπτη'",
  "'Πεμ'",
  "'Παρασκευή'",
  "'Παρ'",
  "'Σάββατο'",
  "'Σαβ'",
  "'Κυριακή'",
  "'Κυρ'"
]

for(const value of forbidden){
  need(
    !availability.includes(value),
    'hardcoded weekday remains: '+value
  )
}

need(
  i18n.split(
    'weekdays:{\nmonday:{'
  ).length-1===2,
  'expected two weekday i18n blocks'
)

need(
  pkg.scripts?.['rc3-d8i-check']===
  'node scripts/rc3-d8i-professional-availability-weekdays-i18n-selftest.mjs',
  'D8I package script missing'
)

need(
  pkg.scripts?.['ci:gate']?.includes(
    'npm run rc3-d8h-check && npm run rc3-d8i-check'
  ),
  'D8I missing after D8H in CI gate'
)

if(failures.length){
  console.error(
    'RC3-D8-I professional availability weekdays i18n self-test: FAIL'
  )

  for(const failure of failures){
    console.error('- '+failure)
  }

  process.exit(1)
}

console.log(
  'RC3-D8-I professional availability weekdays i18n self-test: PASS'
)
