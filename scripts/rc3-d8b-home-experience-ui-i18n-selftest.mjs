import fs from 'node:fs'

const app=
  fs.readFileSync(
    'src/features/home/HomeExperience.tsx',
    'utf8'
  )

const i18n=
  fs.readFileSync(
    'src/i18n.ts',
    'utf8'
  )

const pkg=
  JSON.parse(
    fs.readFileSync(
      'package.json',
      'utf8'
    )
  )

const failures=[]

function need(value,message){
  if(!value){
    failures.push(message)
  }
}

for(const key of [
  'homeExperience.phone.nursing',
  'homeExperience.smart.titleLead',
  'homeExperience.smart.titleEmphasis',
  'homeExperience.smart.form.label',
  'homeExperience.smart.form.placeholder',
  'homeExperience.smart.emergency.title',
  'homeExperience.smart.unmatched.title',
  'homeExperience.smart.result.confidence',
  'homeExperience.smart.confidence.',
  'homeExperience.now.titleLead',
  'homeExperience.now.specialty',
  'homeExperience.now.errors.permission',
  'homeExperience.now.errors.https',
  'homeExperience.now.locating',
  'homeExperience.now.accuracy',
  'homeExperience.now.results.count'
]){
  need(
    app.includes(key),
    'missing '+key
  )
}

need(
  app.includes(
    "useState(search.specialty || 'Νοσηλευτική')"
  ),
  'domain specialty default changed'
)

need(
  app.includes(
    "specialty: 'Διαιτολογία / Διατροφή'"
  ),
  'Smart Request domain rules changed'
)

need(
  app.includes(
    "['θελω να χασω κιλα', 15]"
  ),
  'Smart Request phrase rules changed'
)

need(
  app.includes(
    "'δεν αναπνεω'"
  ),
  'Smart Request emergency terms changed'
)

need(
  app.includes(
    "'Η μητέρα μου έκανε επέμβαση ισχίου και χρειάζεται βοήθεια στην αποκατάσταση'"
  ),
  'Smart Request functional example query changed'
)

need(
  (
    i18n.match(
      /homeExperience:\{/g
    )||[]
  ).length===2,
  'expected two homeExperience namespaces'
)

need(
  pkg.scripts?.[
    'rc3-d8b-check'
  ]===
  'node scripts/rc3-d8b-home-experience-ui-i18n-selftest.mjs',
  'D8B package script missing'
)

need(
  pkg.scripts?.[
    'ci:gate'
  ]?.includes(
    'npm run rc3-d8a-check && npm run rc3-d8b-check'
  ),
  'D8B missing after D8A in CI gate'
)

if(failures.length){
  console.error(
    'RC3-D8-B HomeExperience UI i18n self-test: FAIL'
  )

  for(const failure of failures){
    console.error(
      '- '+failure
    )
  }

  process.exit(1)
}

console.log(
  'RC3-D8-B HomeExperience UI i18n self-test: PASS'
)
