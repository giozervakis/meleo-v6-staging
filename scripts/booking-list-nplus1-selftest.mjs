import assert from 'node:assert/strict'
import fs from 'node:fs'

const repositoryPath =
  new URL(
    '../server/relational/repositories.js',
    import.meta.url
  )

const source =
  fs.readFileSync(
    repositoryPath,
    'utf8'
  )

const bookingsStart =
  source.indexOf(
    'export const Bookings={'
  )

const addMessageStart =
  source.indexOf(
    'async addMessage(',
    bookingsStart
  )

assert.ok(
  bookingsStart >= 0 &&
  addMessageStart > bookingsStart,
  'Could not isolate Bookings list implementation'
)

const bookingListSource =
  source.slice(
    bookingsStart,
    addMessageStart
  )

const required = [
  'function bookingFromJoinedRow(',
  'const bookingRows=',
  'JOIN users pu',
  'JOIN professionals p',
  'JOIN users pru',
  'const bookingIds=',
  'WHERE booking_id = ANY($1::text[])',
  'const messagesByBooking=',
  'const reviewsByBooking=',
  'body_encrypted:m.body_encrypted',
  'bookingRows.map('
]

for(const token of required){
  assert.ok(
    source.includes(token),
    `RC2-A7 missing batching token: ${token}`
  )
}

assert.equal(
  bookingListSource.includes(
    'items.push(await this.byId'
  ),
  false,
  'RC2-A7 regression: listForUser must not call byId per booking'
)

assert.equal(
  bookingListSource.includes(
    'for(const r of rows)'
  ),
  false,
  'RC2-A7 regression: legacy per-row booking hydration returned'
)

const batchLookupCount =
  (
    bookingListSource.match(
      /booking_id = ANY\(\$1::text\[\]\)/g
    )||[]
  ).length

assert.equal(
  batchLookupCount,
  2,
  'RC2-A7 requires exactly two page-level batch lookups: messages + reviews'
)

assert.ok(
  bookingListSource.includes(
    'await Promise.all(['
  ),
  'RC2-A7 messages and reviews must be fetched concurrently'
)

console.log(
  'MELEO booking list N+1 self-test: OK'
)