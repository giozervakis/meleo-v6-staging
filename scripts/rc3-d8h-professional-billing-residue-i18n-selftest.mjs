import fs from 'node:fs'

const billing=fs.readFileSync(
  'src/features/professional/billing/ProfessionalBilling.tsx',
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
  billing.includes(
    'function fallbackPlans(t:any):BillingPlan[]'
  ),
  'translated fallback plan factory missing'
)

need(
  billing.includes(
    ': fallbackPlans(t)'
  ),
  'fallback plan factory not consumed'
)

need(
  billing.includes(
    '[cfg,t]'
  ),
  'fallback plan memo dependencies incomplete'
)

need(
  billing.split(
    'statusLabel(status,t)'
  ).length-1===2,
  'expected two translated subscription status calls'
)

need(
  billing.includes(
    'invoiceStatus(invoice.status,t)'
  ),
  'translated invoice status call missing'
)

need(
  billing.includes(
    "t('proBilling.residue.until')"
  ),
  'translated Until label missing'
)

need(
  billing.includes(
    "t('proBilling.residue.recommended')"
  ),
  'translated recommended label missing'
)

const forbidden=[
  'Δημόσιο επαγγελματικό προφίλ',
  'Αιτήματα και διαχείριση κρατήσεων',
  'Περιοχή & ακτίνα εξυπηρέτησης',
  'Βασικά στατιστικά',
  'Όλα τα BASIC',
  'Προτεραιότητα στην κατάταξη αποτελεσμάτων',
  'Σήμανση «Προτεινόμενος»',
  "'Ενεργή'",
  "'Εκκρεμεί πληρωμή'",
  "'Ακυρωμένη'",
  "'Σε εκκρεμότητα'",
  "'Χωρίς συνδρομή'",
  "'Απαιτείται πληρωμή'",
  "'Δοκιμαστική'",
  "return 'Πληρωμένο'",
  "return 'Ακυρωμένο'",
  "return 'Απέτυχε'",
  "'ΠΡΟΤΕΙΝΟΜΕΝΟ'"
]

for(const value of forbidden){
  need(
    !billing.includes(value),
    'hardcoded billing residue remains: '+value
  )
}

need(
  i18n.split(
    'residue:{\nfeatures:{'
  ).length-1===2,
  'expected two billing residue i18n blocks'
)

need(
  pkg.scripts?.['rc3-d8h-check']===
  'node scripts/rc3-d8h-professional-billing-residue-i18n-selftest.mjs',
  'D8H package script missing'
)

need(
  pkg.scripts?.['ci:gate']?.includes(
    'npm run rc3-d8g-check && npm run rc3-d8h-check'
  ),
  'D8H missing after D8G in CI gate'
)

if(failures.length){
  console.error(
    'RC3-D8-H Professional Billing residue i18n self-test: FAIL'
  )

  for(const failure of failures){
    console.error('- '+failure)
  }

  process.exit(1)
}

console.log(
  'RC3-D8-H Professional Billing residue i18n self-test: PASS'
)
