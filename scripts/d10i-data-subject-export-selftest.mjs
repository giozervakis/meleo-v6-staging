import fs from 'node:fs'
import assert from 'node:assert/strict'


function read(path){
  return fs
    .readFileSync(path,'utf8')
    .replace(/^\uFEFF/,'')
}


function pass(message){
  console.log(
    '[PASS] ' + message
  )
}


const route =
  read(
    'server/routes/account-privacy.routes.js'
  )

const inventory =
  read(
    'scripts/d10i-privacy-data-surface-selftest.mjs'
  )

const pkg =
  JSON.parse(
    read('package.json')
  )


/*
 * Export route remains authenticated.
 */

assert.ok(
  route.includes(
    "'/api/me/export'"
  )
)

assert.ok(
  route.includes(
    "'/api/me/export',\n    auth,"
  )
)

pass(
  'data-subject export remains authenticated'
)


/*
 * Existing complete booking pagination preserved.
 */

for(
  const marker
  of [
    'const bookings=[]',
    'const limit=100',
    'page<=totalPages',
    'bookings.push(',
    'bookings.length===total'
  ]
){
  assert.ok(
    route.includes(marker),
    'booking pagination regression: ' +
    marker
  )
}

pass(
  'complete paginated booking export preserved'
)


/*
 * Required subject-linked datasets.
 */

for(
  const marker
  of [
    'FROM sessions',
    'FROM user_identities',
    'FROM favorites',
    'FROM notifications',
    'FROM booking_messages',
    'FROM reviews',
    'FROM support_tickets',
    'FROM support_messages',
    'FROM reports',
    'FROM verification_requests',
    'FROM verification_documents',
    'FROM subscriptions',
    'FROM payments'
  ]
){
  assert.ok(
    route.includes(marker),
    'missing subject export surface: ' +
    marker
  )
}

pass(
  'subject-linked relational surfaces exported'
)


/*
 * Ownership predicates.
 */

for(
  const marker
  of [
    'WHERE user_id=$1',
    'WHERE patient_id=$1',
    'OR professional_id=$2',
    'WHERE reporter_user_id=$1',
    'WHERE professional_id=$1',
    'WHERE booking_id = ANY($1::text[])',
    'WHERE ticket_id = ANY($1::text[])'
  ]
){
  assert.ok(
    route.includes(marker),
    'missing ownership boundary: ' +
    marker
  )
}

pass(
  'export queries remain scoped to authenticated subject relationships'
)


/*
 * Empty relation arrays avoid unbounded ANY queries.
 */

assert.ok(
  route.includes(
    'bookingIds.length'
  )
)

assert.ok(
  route.includes(
    'supportTicketIds.length'
  )
)

pass(
  'empty booking/support relationships handled safely'
)


/*
 * Reusable secrets / internal object storage keys are excluded.
 */

for(
  const forbiddenSelect
  of [
    'SELECT\n              token_hash',
    'token_hash,\n              expires_at',
    'FROM one_time_tokens',
    'storage_key,\n                  original_name'
  ]
){
  assert.equal(
    route.includes(forbiddenSelect),
    false,
    'secret/internal field leaked: ' +
    forbiddenSelect
  )
}


for(
  const marker
  of [
    "'password_hash'",
    "'session.token_hash'",
    "'one_time_tokens'",
    "'verification_documents.storage_key'"
  ]
){
  assert.ok(
    route.includes(marker),
    'missing explicit exclusion marker: ' +
    marker
  )
}

pass(
  'reusable secrets and verification storage keys excluded'
)


/*
 * Verification metadata remains exportable.
 */

for(
  const marker
  of [
    'original_name',
    'mime_type',
    'size_bytes'
  ]
){
  assert.ok(
    route.includes(marker),
    'verification metadata missing: ' +
    marker
  )
}

pass(
  'verification document metadata exported without binary/storage key'
)


/*
 * Export response contract.
 */

for(
  const marker
  of [
    'sessions,',
    'identities,',
    'favorites,',
    'notifications,',
    'bookingMessages,',
    'reviews,',
    'supportTickets,',
    'supportMessages,',
    'reports,',
    'verificationRequests,',
    'verificationDocuments,',
    'subscriptions,',
    'payments,',
    'counts,',
    'secretFieldsExcluded:['
  ]
){
  assert.ok(
    route.includes(marker),
    'response contract missing: ' +
    marker
  )
}

pass(
  'expanded export response contract present'
)


/*
 * D10I.1 executable inventory evolved:
 * export gap closed, photo deletion gap still open.
 */

assert.ok(
  inventory.includes(
    'subject-data export completeness gap closed'
  )
)

assert.ok(
  inventory.includes(
    'profile-photo deletion cleanup'
  )
)

pass(
  'D10I.1 privacy inventory evolved without losing remaining gap'
)


/*
 * CI contract.
 */

assert.equal(
  pkg.scripts[
    'data-subject-export-check'
  ],
  'node scripts/d10i-data-subject-export-selftest.mjs'
)

assert.ok(
  pkg.scripts[
    'ci:gate'
  ].includes(
    'npm run data-subject-export-check'
  )
)

pass(
  'D10I.2 proof wired into ci:gate'
)


console.log('')
console.log(
  'D10I.2 COMPLETE DATA-SUBJECT EXPORT'
)
console.log(
  '-----------------------------------'
)
console.log(
  'BOOKINGS / CARE CONTEXT       : COMPLETE'
)
console.log(
  'BOOKING MESSAGES              : INCLUDED'
)
console.log(
  'SESSIONS METADATA             : INCLUDED'
)
console.log(
  'SOCIAL IDENTITIES             : INCLUDED'
)
console.log(
  'FAVORITES / NOTIFICATIONS     : INCLUDED'
)
console.log(
  'REVIEWS                       : INCLUDED'
)
console.log(
  'SUPPORT                       : INCLUDED'
)
console.log(
  'REPORTS                       : INCLUDED'
)
console.log(
  'VERIFICATION METADATA         : INCLUDED'
)
console.log(
  'SUBSCRIPTIONS / PAYMENTS      : INCLUDED'
)
console.log(
  'REUSABLE AUTH SECRETS         : EXCLUDED'
)
console.log(
  'STORAGE OBJECT KEYS           : EXCLUDED'
)
console.log('')
console.log(
  'MELEO D10I.2 data-subject export self-test: OK'
)
