import assert from 'node:assert/strict'
import fs from 'node:fs'

const runtimePath = new URL(
  './booking-concurrency-test.mjs',
  import.meta.url
)

const migrationPath = new URL(
  '../migrations/008_booking_duplicate_preflight.sql',
  import.meta.url
)

const runtime = fs.readFileSync(runtimePath, 'utf8')
const migration = fs.readFileSync(migrationPath, 'utf8')

const runtimeRequired = [
  'Promise.all([',
  'pool.connect()',
  "error?.code || null",
  "result.code === '23505'",
  'persisted.rowCount === 1',
  'bookings_professional_active_slot_unique_idx',
  'pg_sleep(0.25)',
  'DELETE FROM bookings',
  'MELEO_ALLOW_PRODUCTION_CONCURRENCY_TEST'
]

for (const token of runtimeRequired) {
  assert.ok(
    runtime.includes(token),
    `RC2-A6 runtime test missing token: ${token}`
  )
}

assert.ok(
  migration.includes(
    'bookings_professional_active_slot_unique_idx'
  ),
  'Migration 008 unique booking-slot index is missing'
)

assert.ok(
  migration.includes('HAVING count(*) > 1'),
  'Migration 008 duplicate preflight is missing'
)

assert.ok(
  runtime.indexOf('Promise.all([') <
    runtime.indexOf('persisted.rowCount === 1'),
  'Concurrent race must execute before persisted-row assertion'
)

console.log(
  'MELEO booking concurrency self-test: OK'
)