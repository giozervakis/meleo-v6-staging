import fs from 'node:fs'

const catalog=fs.readFileSync(
  'src/domain/catalog-i18n.ts',
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
  catalog.includes(
    "import i18n from '../i18n'"
  ),
  'catalog i18n import missing'
)

need(
  catalog.includes(
    "'catalogPricing.label.'+mode"
  ),
  'pricing label translation call missing'
)

need(
  catalog.includes(
    "'catalogPricing.note.'+mode"
  ),
  'pricing note translation call missing'
)

for(const value of [
  "'Κατόπιν επικοινωνίας'",
  "'Το κόστος συμφωνείται απευθείας με τον επαγγελματία.'",
  "'Βασικό κόστος απλής επίσκεψης · η τελική χρέωση διαμορφώνεται ανάλογα με τις ανάγκες και συμφωνείται πριν την επίσκεψη.'"
]){
  need(
    !catalog.includes(value),
    'hardcoded pricing presentation string remains: '+value
  )
}

need(
  !catalog.includes('professional?.price}€'),
  'hardcoded Greek price template remains'
)

need(
  count(i18n,'catalogPricing:{')===2,
  'expected two catalogPricing namespaces'
)

need(
  pkg.scripts?.['rc3-d8n-check']===
  'node scripts/rc3-d8n-catalog-pricing-i18n-selftest.mjs',
  'D8N package script missing'
)

need(
  pkg.scripts?.['ci:gate']?.includes(
    'npm run rc3-d8m-check && npm run rc3-d8n-check'
  ),
  'D8N missing after D8M in CI gate'
)

if(failures.length){
  console.error(
    'RC3-D8-N Catalog pricing i18n self-test: FAIL'
  )

  for(const failure of failures){
    console.error('- '+failure)
  }

  process.exit(1)
}

console.log(
  'RC3-D8-N Catalog pricing i18n self-test: PASS'
)
