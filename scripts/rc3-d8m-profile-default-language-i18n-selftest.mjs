import fs from 'node:fs'

const profile=fs.readFileSync(
  'src/features/profile/Profile.tsx',
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

function need(value,message){
  if(!value) failures.push(message)
}

function count(text,value){
  return text.split(value).length-1
}

need(
  profile.includes(
    "p.languages||[t('profile.about.defaultLanguage')]"
  ),
  'translated profile default language missing'
)

need(
  !profile.includes(
    "p.languages||['Ελληνικά']"
  ),
  'hardcoded Greek profile default language remains'
)

need(
  count(
    i18n,
    "defaultLanguage:'Ελληνικά'"
  )===1,
  'Greek defaultLanguage translation missing'
)

need(
  count(
    i18n,
    "defaultLanguage:'Greek'"
  )===1,
  'English defaultLanguage translation missing'
)

need(
  pkg.scripts?.['rc3-d8m-check']===
  'node scripts/rc3-d8m-profile-default-language-i18n-selftest.mjs',
  'D8M package script missing'
)

need(
  pkg.scripts?.['ci:gate']?.includes(
    'npm run rc3-d8l-check && npm run rc3-d8m-check'
  ),
  'D8M missing after D8L in CI gate'
)

if(failures.length){
  console.error(
    'RC3-D8-M Profile default language i18n self-test: FAIL'
  )

  for(const failure of failures){
    console.error('- '+failure)
  }

  process.exit(1)
}

console.log(
  'RC3-D8-M Profile default language i18n self-test: PASS'
)
