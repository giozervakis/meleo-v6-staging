import assert from 'node:assert/strict'
import fs from 'node:fs'

const route =
  fs.readFileSync(
    new URL(
      '../server/routes/account-privacy.routes.js',
      import.meta.url
    ),
    'utf8'
  )

const app =
  fs.readFileSync(
    new URL(
      '../server/relational/app.js',
      import.meta.url
    ),
    'utf8'
  )

const deletionService =
  fs.readFileSync(
    new URL(
      '../server/services/account-deletion.service.js',
      import.meta.url
    ),
    'utf8'
  )

/*
 * Export remains owned by the HTTP route.
 *
 * Account deletion was moved in D10E.10D into the canonical deletion
 * service so HTTP requests and durable worker retries share the same
 * implementation.
 */
const requiredRouteTokens = [
  "'/api/me/export'",
  'const limit=100',
  'do{',
  'page<=totalPages',
  "? {scope:'all'}",
  'bookingTotal:',
  'bookings.length===total',
  'const counts={',
  'counts,',
  'bookings:bookings.length',
  'secretFieldsExcluded:[',
  'await accountDeletion.request(',
  'result.pending',
  '.status(202)',
  '.accountDeleted(',
  'clearSessionCookie(res)'
]

for(const token of requiredRouteTokens){
  assert.ok(
    route.includes(token),
    `RC2-A8 route missing token: ${token}`
  )
}


const requiredDeletionServiceTokens = [
  'deleted.invalid',
  'email=$2',
  "password_hash='!account-deleted!'",
  'stripe_customer_id=NULL',
  'DELETE FROM sessions',
  'DELETE FROM one_time_tokens',
  'DELETE FROM user_identities',
  'DELETE FROM favorites',
  'DELETE FROM notifications',
  'UPDATE bookings',
  "notes_encrypted=''",
  'UPDATE booking_messages',
  "body_encrypted=''",
  'UPDATE reviews',
  "comment=''",
  'deleteVerificationObject(',
  "'privacy.verification_storage_delete_failed'",
  'DELETE FROM verification_documents',
  'UPDATE verification_requests',
  "license_number=''",
  'UPDATE professionals',
  "credentials='[]'::jsonb",
  "services='[]'::jsonb",
  "subscription_status='cancelled'",
  'deleted_at=now()',
  "'privacy.account_deleted'",
  "'account_deletion_retry'",
  'deletion_pending=true'
]

for(
  const token
  of requiredDeletionServiceTokens
){
  assert.ok(
    deletionService.includes(token),
    `RC2-A8 deletion service missing token: ${token}`
  )
}


assert.ok(
  route.includes(
    "import { createAccountDeletionService } from '../services/account-deletion.service.js'"
  ),
  'RC2-A8 canonical deletion service import missing'
)

assert.ok(
  route.includes(
    'createAccountDeletionService({'
  ),
  'RC2-A8 canonical deletion service construction missing'
)

assert.ok(
  route.includes(
    'await accountDeletion.request('
  ),
  'RC2-A8 HTTP deletion route does not delegate to canonical service'
)

assert.equal(
  route.includes(
    "Bookings.listForUser(publicUser(u),{limit:100})"
  ),
  false,
  'RC2-A8 regression: export silently capped at 100 bookings'
)

for(
  const token
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
    'FROM payments',
    'secretFieldsExcluded:['
  ]
){
  assert.ok(
    route.includes(token),
    `D10I.2 subject export missing token: ${token}`
  )
}


for(
  const forbiddenToken
  of [
    'SELECT\n              token_hash',
    'FROM one_time_tokens',
    'storage_key,\n                  original_name'
  ]
){
  assert.equal(
    route.includes(forbiddenToken),
    false,
    `D10I.2 export leaks protected token: ${forbiddenToken}`
  )
}


assert.equal(
  route.includes(
    "name:'Deleted User',phone:'',account_status:'suspended'"
  ),
  false,
  'RC2-A8 regression: legacy partial deletion returned'
)

assert.equal(
  deletionService.includes(
    "SET original_name='deleted-document'"
  ),
  false,
  'RC2-A8 regression: verification documents must be deleted from storage'
)

const registrationStart =
  app.indexOf(
    'registerAccountPrivacyRoutes('
  )

const registrationEnd =
  app.indexOf(
    '// Geocoding',
    registrationStart
  )

assert.ok(
  registrationStart >= 0 &&
  registrationEnd > registrationStart,
  'Account privacy registration missing'
)

const registration =
  app.slice(
    registrationStart,
    registrationEnd
  )

for(const token of [
  'clearSessionCookie',
  'deleteVerificationObject',
  'getStripe',
  'now'
]){
  assert.ok(
    registration.includes(token),
    `RC2-A8 dependency injection missing: ${token}`
  )
}

console.log(
  'MELEO GDPR account lifecycle self-test: OK'
)