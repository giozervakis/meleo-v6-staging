import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
)

const poolPath = path.join(
  root,
  'server',
  'relational',
  'pool.js'
)

const text = fs.readFileSync(poolPath,'utf8')

const required = [
  "CREATE TABLE IF NOT EXISTS schema_migrations",
  "SELECT pg_advisory_lock($1)",
  "SELECT pg_advisory_unlock($1)",
  "Migration checksum mismatch for",
  "INSERT INTO schema_migrations(name, checksum)",
  "await client.query('BEGIN')",
  "await client.query('COMMIT')",
  "await client.query('ROLLBACK')"
]

for(const token of required){
  assert.ok(
    text.includes(token),
    `Missing migration safety token: ${token}`
  )
}

assert.equal(
  (text.match(/pg_advisory_lock/g)||[]).length,
  1,
  'Expected exactly one advisory lock call'
)

assert.equal(
  (text.match(/pg_advisory_unlock/g)||[]).length,
  1,
  'Expected exactly one advisory unlock call'
)

const migrationDir = path.join(root,'migrations')
const files = fs.readdirSync(migrationDir)
  .filter(name=>/^\d+.*\.sql$/.test(name))
  .sort()

assert.ok(files.length >= 7,'Expected at least 7 migrations')
assert.ok(
  files.includes('008_booking_duplicate_preflight.sql'),
  'Migration 008 duplicate-booking preflight is missing'
)

const bookingPreflightMigration = fs.readFileSync(
  path.join(migrationDir,'008_booking_duplicate_preflight.sql'),
  'utf8'
)

const bookingPreflightRequired = [
  'MELEO_BOOKING_DUPLICATE_PREFLIGHT_V2',
  'DO $$',
  'duplicate_groups integer',
  'HAVING count(*) > 1',
  'MELEO migration 008 preflight failed:',
  'CREATE UNIQUE INDEX IF NOT EXISTS',
  'bookings_professional_active_slot_unique_idx'
]

for(const token of bookingPreflightRequired){
  assert.ok(
    bookingPreflightMigration.includes(token),
    `Migration 008 missing duplicate-preflight token: ${token}`
  )
}

const bookingPreflightPosition = bookingPreflightMigration.indexOf(
  'MELEO migration 008 preflight failed:'
)

const bookingIndexPosition = bookingPreflightMigration.indexOf(
  'CREATE UNIQUE INDEX IF NOT EXISTS'
)

assert.ok(
  bookingPreflightPosition >= 0 &&
  bookingIndexPosition >= 0 &&
  bookingPreflightPosition < bookingIndexPosition,
  'Migration 008 duplicate preflight must execute before unique index creation'
)

assert.ok(
  !bookingPreflightMigration.includes('DELETE FROM bookings') &&
  !bookingPreflightMigration.includes('UPDATE bookings'),
  'Migration 008 must not auto-delete or auto-update conflicting bookings'
)


const checksums = files.map(name=>{
  const ddl=fs.readFileSync(
    path.join(migrationDir,name),
    'utf8'
  )
  return {
    name,
    checksum:crypto
      .createHash('sha256')
      .update(ddl,'utf8')
      .digest('hex')
  }
})

for(const entry of checksums){
  assert.match(entry.checksum,/^[a-f0-9]{64}$/)
}

console.log(
  `MELEO migration runner self-test: OK (${files.length} migrations)`
)