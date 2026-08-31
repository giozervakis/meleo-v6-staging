import fs from 'node:fs'

const admin=fs.readFileSync(
  'src/features/admin/AdminPage.tsx',
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
  admin.includes(
    "pending:t('adminStatus.booking.pending')"
  ),
  'booking status translation helper missing'
)

need(
  admin.includes(
    "awaiting_subscription:t('adminStatus.professionalLifecycle.awaitingSubscription')"
  ),
  'professional lifecycle translation helper missing'
)

need(
  !admin.includes('Σε αναμονή'),
  'hardcoded pending label remains'
)

need(
  !admin.includes('Χρειάζονται διευκρινίσεις'),
  'hardcoded clarification label remains'
)

need(
  !admin.includes('Πρόταση κόστους'),
  'hardcoded quoted label remains'
)

need(
  !admin.includes('Επιβεβαιωμένη'),
  'hardcoded accepted label remains'
)

need(
  !admin.includes('Ολοκληρώθηκε'),
  'hardcoded completed label remains'
)

need(
  !admin.includes('Ακυρώθηκε'),
  'hardcoded cancelled label remains'
)

need(
  !admin.includes('Αναμονή συνδρομής'),
  'hardcoded subscription lifecycle label remains'
)

need(
  !admin.includes('Ελλιπές προφίλ'),
  'hardcoded incomplete profile label remains'
)

need(
  !admin.includes(
    'Αναμονή υποβολής verification'
  ),
  'hardcoded verification-required label remains'
)

need(
  !admin.includes('Διαγραφή σε αναμονή'),
  'hardcoded deletion label remains'
)

need(
  i18n.split(
    'adminStatus:{'
  ).length-1===2,
  'expected two adminStatus blocks'
)

need(
  i18n.includes(
    "pending:'Σε αναμονή'"
  ),
  'Greek admin status translations missing'
)

need(
  i18n.includes(
    "pending:'Pending'"
  ),
  'English admin status translations missing'
)

need(
  pkg.scripts?.['rc3-d8k-check']===
  'node scripts/rc3-d8k-admin-status-labels-i18n-selftest.mjs',
  'D8K package script missing'
)

need(
  pkg.scripts?.['ci:gate']?.includes(
    'npm run rc3-d8j-check && npm run rc3-d8k-check'
  ),
  'D8K missing after D8J in CI gate'
)

if(failures.length){
  console.error(
    'RC3-D8-K Admin status labels i18n self-test: FAIL'
  )

  for(const failure of failures){
    console.error('- '+failure)
  }

  process.exit(1)
}

console.log(
  'RC3-D8-K Admin status labels i18n self-test: PASS'
)
