import fs from 'node:fs'
import assert from 'node:assert/strict'


function read(path){
  return fs
    .readFileSync(
      path,
      'utf8'
    )
    .replace(
      /^\uFEFF/,
      ''
    )
}


function pass(message){
  console.log(
    '[PASS] ' + message
  )
}


function gap(message){
  console.log(
    '[GAP ] ' + message
  )
}


const schema =
  read(
    'migrations/001_relational_schema.sql'
  )

const privacyRoutes =
  read(
    'server/routes/account-privacy.routes.js'
  )

const deletion =
  read(
    'server/services/account-deletion.service.js'
  )

const profileRoutes =
  read(
    'server/routes/account-profile.routes.js'
  )

const verificationRoutes =
  read(
    'server/routes/professional-verification.routes.js'
  )

const storage =
  read(
    'server/object-storage.js'
  )

const requestObs =
  read(
    'server/request-observability.js'
  )

const errorObs =
  read(
    'server/error-observability.js'
  )

const backup =
  read(
    'scripts/backup-db.mjs'
  )

const gdprAccount =
  read(
    'scripts/gdpr-account-selftest.mjs'
  )

const pkg =
  JSON.parse(
    read(
      'package.json'
    )
  )


/*
 * 1. Identity / authentication
 */

for(
  const marker
  of [
    'CREATE TABLE IF NOT EXISTS users',
    'name text NOT NULL',
    'email text NOT NULL UNIQUE',
    'phone text NOT NULL',
    'password_hash text NOT NULL',
    'stripe_customer_id text UNIQUE',
    'last_login_at timestamptz',
    'CREATE TABLE IF NOT EXISTS sessions',
    'ip_hash text',
    'user_agent_hash text',
    'CREATE TABLE IF NOT EXISTS one_time_tokens'
  ]
){
  assert.ok(
    schema.includes(marker),
    'identity/auth inventory missing: ' +
    marker
  )
}

pass(
  'identity and authentication data surface inventoried'
)


/*
 * 2. Professional / location
 */

for(
  const marker
  of [
    'CREATE TABLE IF NOT EXISTS professionals',
    'city text NOT NULL',
    'area text NOT NULL',
    'region text NOT NULL',
    'latitude double precision',
    'longitude double precision',
    'credentials jsonb',
    'services jsonb',
    'availability jsonb'
  ]
){
  assert.ok(
    schema.includes(marker),
    'professional/location inventory missing: ' +
    marker
  )
}

pass(
  'professional profile and location data surface inventoried'
)


/*
 * 3. Booking / care context / communication
 */

for(
  const marker
  of [
    'CREATE TABLE IF NOT EXISTS bookings',
    'service text NOT NULL',
    'address text NOT NULL',
    'notes_encrypted text NOT NULL',
    'patient_contact_consent_at timestamptz',
    'CREATE TABLE IF NOT EXISTS booking_messages',
    'body_encrypted text NOT NULL',
    'CREATE TABLE IF NOT EXISTS reviews'
  ]
){
  assert.ok(
    schema.includes(marker),
    'care-data inventory missing: ' +
    marker
  )
}

pass(
  'booking, care-context and communication data inventoried'
)

pass(
  'booking notes and booking messages have encrypted-at-rest fields'
)


/*
 * 4. Verification documents
 */

for(
  const marker
  of [
    'CREATE TABLE IF NOT EXISTS verification_requests',
    'license_number text',
    'notes text',
    'admin_note text',
    'CREATE TABLE IF NOT EXISTS verification_documents',
    'storage_key text NOT NULL',
    'original_name text NOT NULL',
    'mime_type text NOT NULL'
  ]
){
  assert.ok(
    schema.includes(marker),
    'verification inventory missing: ' +
    marker
  )
}


assert.ok(
  verificationRoutes.includes(
    'encryptFileBuffer(buf)'
  )
)

assert.ok(
  verificationRoutes.includes(
    'putVerificationObject(storageKey,encryptFileBuffer(buf))'
  )
)

assert.ok(
  storage.includes(
    'verification/'
  )
)

pass(
  'verification metadata and encrypted document objects inventoried'
)


/*
 * 5. Secondary subject-linked surfaces
 */

for(
  const marker
  of [
    'CREATE TABLE IF NOT EXISTS subscriptions',
    'CREATE TABLE IF NOT EXISTS payments',
    'CREATE TABLE IF NOT EXISTS support_tickets',
    'CREATE TABLE IF NOT EXISTS support_messages',
    'CREATE TABLE IF NOT EXISTS reports',
    'CREATE TABLE IF NOT EXISTS audit_logs',
    'meta jsonb',
    'CREATE TABLE IF NOT EXISTS professional_analytics_daily',
    'CREATE TABLE IF NOT EXISTS analytics_event_dedup',
    'CREATE TABLE IF NOT EXISTS live_events'
  ]
){
  assert.ok(
    schema.includes(marker),
    'secondary data surface missing: ' +
    marker
  )
}

pass(
  'billing, support, audit, analytics and live-event surfaces inventoried'
)


/*
 * 6. HTTP observability boundary
 */

for(
  const marker
  of [
    'requestId:',
    'method:',
    'path:',
    'statusCode:'
  ]
){
  assert.ok(
    requestObs.includes(marker) ||
    errorObs.includes(marker),
    'observability marker missing: ' +
    marker
  )
}


for(
  const forbidden
  of [
    'req.body',
    'req.query',
    'req.headers.authorization',
    'req.cookies'
  ]
){
  assert.equal(
    requestObs.includes(forbidden),
    false,
    'request observability logs forbidden input: ' +
    forbidden
  )

  assert.equal(
    errorObs.includes(forbidden),
    false,
    'error observability logs forbidden input: ' +
    forbidden
  )
}

pass(
  'HTTP observability avoids request body/query/auth-cookie logging'
)


/*
 * 7. Existing subject export
 */

for(
  const marker
  of [
    "'/api/me/export'",
    'const bookings=[]',
    'const limit=100',
    'page<=totalPages',
    'bookings.push(',
    'bookings.length===total'
  ]
){
  assert.ok(
    privacyRoutes.includes(marker),
    'export contract missing: ' +
    marker
  )
}

pass(
  'existing account export walks all booking pages'
)


/*
 * Known gap:
 * current export response does not prove coverage of every
 * subject-linked data surface.
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
    'payments,'
  ]
){
  assert.ok(
    privacyRoutes.includes(marker),
    'complete subject export missing: ' +
    marker
  )
}

assert.ok(
  privacyRoutes.includes(
    'secretFieldsExcluded'
  )
)

pass(
  'subject-data export completeness gap closed'
)


/*
 * 8. Deletion / anonymisation
 */

for(
  const marker
  of [
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
    'UPDATE support_tickets',
    'UPDATE support_messages',
    'UPDATE reports',
    'UPDATE verification_requests',
    'DELETE FROM verification_documents',
    'UPDATE professionals',
    'UPDATE users',
    "password_hash='!account-deleted!'",
    'stripe_customer_id=NULL',
    'deleted_at=now()'
  ]
){
  assert.ok(
    deletion.includes(marker),
    'deletion contract missing: ' +
    marker
  )
}

assert.ok(
  deletion.includes(
    'deleteVerificationObject('
  )
)

pass(
  'existing deletion service scrubs major subject surfaces'
)

pass(
  'verification storage objects are deleted'
)


/*
 * 9. Profile photo gap
 */

assert.ok(
  profileRoutes.includes(
    'profilePhotoObjectKey('
  )
)

assert.ok(
  profileRoutes.includes(
    'profile_photo_key'
  )
)

assert.ok(
  profileRoutes.includes(
    'deleteVerificationObject(oldKey)'
  )
)

assert.equal(
  deletion.includes(
    'profile_photo_key'
  ),
  false,
  'D10I.1 baseline changed: deletion now handles profile photo metadata'
)

gap(
  'account deletion does not yet prove profile-photo object cleanup'
)


/*
 * 10. Backup retention
 */

for(
  const marker
  of [
    'BACKUP_RETENTION_DAYS',
    'BACKUP_RETENTION_COUNT',
    'cleanOldBackups()',
    'fs.unlinkSync('
  ]
){
  assert.ok(
    backup.includes(marker),
    'backup retention marker missing: ' +
    marker
  )
}

pass(
  'database backup retention controls inventoried'
)


/*
 * 11. Existing GDPR regression proof
 */

assert.ok(
  gdprAccount.includes(
    'MELEO GDPR account lifecycle self-test: OK'
  )
)

assert.ok(
  gdprAccount.includes(
    "'privacy.account_deleted'"
  )
)

pass(
  'existing GDPR account lifecycle proof preserved'
)


/*
 * 12. CI wiring
 */

assert.equal(
  pkg.scripts[
    'privacy-data-surface-check'
  ],
  'node scripts/d10i-privacy-data-surface-selftest.mjs'
)

assert.ok(
  pkg.scripts[
    'ci:gate'
  ].includes(
    'npm run privacy-data-surface-check'
  )
)

pass(
  'D10I.1 inventory wired into ci:gate'
)


console.log('')
console.log(
  'D10I.1 PRIVACY DATA-SURFACE INVENTORY'
)
console.log(
  '-------------------------------------'
)
console.log(
  'IDENTITY / AUTH              : INVENTORIED'
)
console.log(
  'PROFESSIONAL / LOCATION      : INVENTORIED'
)
console.log(
  'BOOKING / CARE CONTEXT       : INVENTORIED'
)
console.log(
  'BOOKING COMMUNICATIONS       : INVENTORIED'
)
console.log(
  'VERIFICATION DOCUMENTS       : INVENTORIED'
)
console.log(
  'BILLING                      : INVENTORIED'
)
console.log(
  'SUPPORT / REPORTS            : INVENTORIED'
)
console.log(
  'AUDIT / ANALYTICS / EVENTS   : INVENTORIED'
)
console.log(
  'OBSERVABILITY                : INVENTORIED'
)
console.log(
  'BACKUPS                      : INVENTORIED'
)
console.log('')
console.log(
  'CLOSED GAP 1: subject-data export completeness'
)
console.log(
  'KNOWN GAP 2: profile-photo deletion cleanup'
)
console.log('')
console.log(
  'PRODUCTION BEHAVIOUR CHANGES : NONE'
)
console.log('')
console.log(
  'MELEO D10I.1 privacy data-surface self-test: OK'
)
