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

const requiredRouteTokens = [
  "'/api/me/export'",
  'const limit=100',
  'do{',
  'page<=totalPages',
  "? {scope:'all'}",
  'bookingCount:',
  'bookingTotal:',
  'complete:',
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
  "'privacy.account_deleted'"
]

for(const token of requiredRouteTokens){
  assert.ok(
    route.includes(token),
    `RC2-A8 route missing token: ${token}`
  )
}

assert.equal(
  route.includes(
    "Bookings.listForUser(publicUser(u),{limit:100})"
  ),
  false,
  'RC2-A8 regression: export silently capped at 100 bookings'
)

assert.equal(
  route.includes(
    "name:'Deleted User',phone:'',account_status:'suspended'"
  ),
  false,
  'RC2-A8 regression: legacy partial deletion returned'
)

assert.equal(
  route.includes(
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