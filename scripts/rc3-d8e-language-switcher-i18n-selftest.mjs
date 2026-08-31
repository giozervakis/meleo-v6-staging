import fs from 'node:fs'

const src=fs.readFileSync(
  'src/components/LanguageSwitcher.tsx',
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

for(const key of [
  'languageSwitcher.greek',
  'languageSwitcher.english',
  'languageSwitcher.greekEnglish',
  'languageSwitcher.englishGreek',
  'languageSwitcher.changeAria',
  'languageSwitcher.menuAria'
]){
  need(
    src.includes(key),
    'missing '+key
  )
}

for(const residue of [
  'Ελληνικά',
  'Αλλαγή γλώσσας',
  'Γλώσσα',
  'Αγγλικά'
]){
  need(
    !src.includes(residue),
    'remaining literal '+residue
  )
}

need(
  (i18n.match(
    /languageSwitcher:\{/g
  )||[]).length===2,
  'expected two languageSwitcher namespaces'
)

need(
  pkg.scripts?.['rc3-d8e-check']===
  'node scripts/rc3-d8e-language-switcher-i18n-selftest.mjs',
  'D8E package script missing'
)

need(
  pkg.scripts?.['ci:gate']?.includes(
    'npm run rc3-d8d-check && npm run rc3-d8e-check'
  ),
  'D8E missing after D8D in CI gate'
)

if(failures.length){
  console.error(
    'RC3-D8-E LanguageSwitcher i18n self-test: FAIL'
  )

  for(const failure of failures){
    console.error(
      '- '+failure
    )
  }

  process.exit(1)
}

console.log(
  'RC3-D8-E LanguageSwitcher i18n self-test: PASS'
)
