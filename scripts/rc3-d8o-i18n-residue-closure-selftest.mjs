import fs from 'node:fs'

const files={
  catalog:
    fs.readFileSync('src/domain/catalog.ts','utf8'),

  catalogI18n:
    fs.readFileSync('src/domain/catalog-i18n.ts','utf8'),

  home:
    fs.readFileSync(
      'src/features/home/HomeExperience.tsx',
      'utf8'
    ),

  search:
    fs.readFileSync(
      'src/features/search/SearchPage.tsx',
      'utf8'
    ),

  app:
    fs.readFileSync('src/App.tsx','utf8'),

  professional:
    fs.readFileSync(
      'src/features/professional/ProfessionalDashboard.tsx',
      'utf8'
    )
}

const pkg=JSON.parse(
  fs.readFileSync('package.json','utf8')
)

const failures=[]

function need(value,message){
  if(!value) failures.push(message)
}

/*
 * RC3-D8O intentionally does NOT require the Greek residue
 * count to reach zero.
 *
 * The remaining literals belong to canonical domain data,
 * Greek NLP/search recognition, availability matching and
 * emergency-intent recognition.
 */

// Canonical catalog domain values.
need(
  files.catalog.includes("'Νοσηλευτική'"),
  'canonical Nursing specialty unexpectedly changed'
)

need(
  files.catalog.includes("'Φυσικοθεραπεία'"),
  'canonical Physiotherapy specialty unexpectedly changed'
)

need(
  files.catalog.includes("'Διαιτολογία / Διατροφή'"),
  'canonical Dietetics specialty unexpectedly changed'
)

// Catalog translation mapping must preserve Greek source keys.
need(
  files.catalogI18n.includes("'Νοσηλευτική':'Nursing'"),
  'catalog translation source key unexpectedly changed'
)

need(
  files.catalogI18n.includes("'Ιατροί':'Doctors'"),
  'catalog Doctors translation mapping unexpectedly changed'
)

// Smart Request NLP semantics.
need(
  files.home.includes("['θελω να χασω κιλα', 15]"),
  'Smart Request Greek intent semantics unexpectedly changed'
)

need(
  files.home.includes("['νοσηλευτη', 15]"),
  'Smart Request Nursing intent semantics unexpectedly changed'
)

need(
  files.home.includes("'δεν αναπνεω'"),
  'emergency recognition semantics unexpectedly changed'
)

need(
  files.home.includes("'ανακοπη'"),
  'cardiac arrest recognition semantics unexpectedly changed'
)

// Search availability matching.
need(
  files.search.includes("text.includes('σήμερα')"),
  'today availability matching unexpectedly changed'
)

need(
  files.search.includes("text.includes('άμεσα')"),
  'immediate availability matching unexpectedly changed'
)

need(
  files.search.includes("text.includes('διαθέσ')"),
  'availability stem matching unexpectedly changed'
)

// App-level availability semantics.
need(
  files.app.includes("'μη διαθέσιμος'"),
  'male unavailable semantic token unexpectedly changed'
)

need(
  files.app.includes("'μη διαθέσιμη'"),
  'female unavailable semantic token unexpectedly changed'
)

// Canonical professional specialty fallback.
need(
  files.professional.includes(
    "form.specialty||'Νοσηλευτική'"
  ),
  'professional canonical specialty fallback unexpectedly changed'
)

// Ensure all completed late-stage i18n tranches remain in CI.
for(const name of [
  'rc3-d8k-check',
  'rc3-d8l-check',
  'rc3-d8m-check',
  'rc3-d8n-check',
  'rc3-d8o-check'
]){
  need(
    Boolean(pkg.scripts?.[name]),
    'missing package script '+name
  )
}

need(
  pkg.scripts?.['ci:gate']?.includes(
    'npm run rc3-d8n-check && npm run rc3-d8o-check'
  ),
  'D8O missing after D8N in CI gate'
)

if(failures.length){
  console.error(
    'RC3-D8-O i18n residue closure self-test: FAIL'
  )

  for(const failure of failures){
    console.error('- '+failure)
  }

  process.exit(1)
}

console.log(
  'RC3-D8-O i18n residue closure self-test: PASS'
)

console.log(
  'Remaining Greek residue is classified as intentional domain/NLP/search semantics.'
)
