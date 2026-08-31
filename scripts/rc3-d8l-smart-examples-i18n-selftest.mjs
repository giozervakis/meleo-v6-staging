import fs from 'node:fs'

const home=fs.readFileSync(
  'src/features/home/HomeExperience.tsx',
  'utf8'
)

const pkg=JSON.parse(
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

function count(text,value){
  return text.split(value).length-1
}

need(
  count(
    home,
    "'homeExperience.smart.examples.hip'"
  )>=2,
  'hip translation key must drive display and click value'
)

need(
  count(
    home,
    "'homeExperience.smart.examples.treatment'"
  )>=2,
  'treatment translation key must drive display and click value'
)

need(
  count(
    home,
    "'homeExperience.smart.examples.weight'"
  )>=2,
  'weight translation key must drive display and click value'
)

need(
  !home.includes(
    'Η μητέρα μου έκανε επέμβαση ισχίου και χρειάζεται βοήθεια στην αποκατάσταση'
  ),
  'Greek hip example remains hardcoded'
)

need(
  !home.includes(
    'Χρειάζομαι νοσηλευτή για αντιβίωση πρωί και βράδυ για μία εβδομάδα'
  ),
  'Greek treatment example remains hardcoded'
)

need(
  !home.includes(
    'Θέλω να χάσω κιλά και χρειάζομαι πρόγραμμα διατροφής'
  ),
  'Greek weight example remains hardcoded'
)

need(
  pkg.scripts?.['rc3-d8l-check']===
  'node scripts/rc3-d8l-smart-examples-i18n-selftest.mjs',
  'D8L package script missing'
)

need(
  pkg.scripts?.['ci:gate']?.includes(
    'npm run rc3-d8k-check && npm run rc3-d8l-check'
  ),
  'D8L missing after D8K in CI gate'
)

if(failures.length){
  console.error(
    'RC3-D8-L Smart examples i18n self-test: FAIL'
  )

  for(const failure of failures){
    console.error(
      '- '+failure
    )
  }

  process.exit(1)
}

console.log(
  'RC3-D8-L Smart examples i18n self-test: PASS'
)
