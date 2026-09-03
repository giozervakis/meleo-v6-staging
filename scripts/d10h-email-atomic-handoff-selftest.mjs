import assert from 'node:assert/strict'
import fs from 'node:fs'

const jobs =
  fs.readFileSync(
    'server/jobs.js',
    'utf8'
  )

const mail =
  fs.readFileSync(
    'server/mail.js',
    'utf8'
  )

const repositories =
  fs.readFileSync(
    'server/relational/repositories.js',
    'utf8'
  )

const bookingCore =
  fs.readFileSync(
    'server/routes/booking-core.routes.js',
    'utf8'
  )

const bookingState =
  fs.readFileSync(
    'server/routes/booking-state.routes.js',
    'utf8'
  )

function pass(label){
  console.log('[PASS] ' + label)
}

assert.ok(
  jobs.includes('client=null'),
  'enqueue must accept an optional transaction client'
)
pass('generic enqueue accepts transaction client')

assert.ok(
  jobs.includes('client.query.bind(client)'),
  'non-deduplicated enqueue must use transaction client'
)
pass('repeatable jobs can enqueue inside caller transaction')

assert.ok(
  jobs.includes('await client.query(') &&
  jobs.includes('idempotentQuery'),
  'idempotent enqueue must use transaction client'
)
pass('deduplicated jobs can enqueue inside caller transaction')

assert.ok(
  mail.includes('client=null'),
  'mail delivery must accept transaction client'
)
pass('mail layer accepts transaction client')

assert.ok(
  mail.includes('dedupKey,') &&
  mail.includes('client'),
  'mail must forward dedup identity and transaction client'
)
pass('mail forwards durable identity into transaction-aware enqueue')

assert.ok(
  mail.includes('if(client){') &&
  mail.includes('throw err'),
  'transactional queue failure must abort caller transaction'
)
pass('transactional queue failure propagates')

assert.ok(
  mail.includes('return deliverEmail(message)'),
  'non-transactional queue failure fallback must remain'
)
pass('direct fallback remains outside transaction')

assert.ok(
  mail.includes('transactional:Boolean(client)'),
  'transactional enqueue observability must remain explicit'
)
pass('transaction-aware enqueue is observable')

assert.ok(
  repositories.includes('transactionalEffect=null'),
  'booking repositories must accept transactional effect'
)
pass('booking repositories expose transactional effect boundary')

assert.ok(
  repositories.includes('await transactionalEffect(') &&
  repositories.includes('client'),
  'booking repositories must execute effect with active client'
)
pass('booking repositories execute atomic effect with transaction client')

assert.ok(
  bookingCore.includes('await mail.newBooking(') &&
  bookingCore.includes('booking:${bid}:created:${professionalUser.id}') &&
  bookingCore.includes('client'),
  'booking creation email must use active transaction client'
)
pass('booking creation email joins booking transaction')

assert.ok(
  bookingState.includes('await mail.bookingCancelled(') &&
  bookingState.includes('booking:${b.id}:cancelled:${recipientUserId}') &&
  bookingState.includes('client'),
  'booking cancellation email must use active transition client'
)
pass('booking cancellation email joins lifecycle transaction')

assert.ok(
  bookingState.includes('await mail.bookingCompleted(') &&
  bookingState.includes('booking:${b.id}:completed:${recipientUserId}') &&
  bookingState.includes('client'),
  'booking completion email must use active transition client'
)
pass('booking completion email joins lifecycle transaction')

assert.ok(
  !bookingCore.includes('.newBooking(\n            professionalUser.email'),
  'legacy post-commit booking creation email must be absent'
)
pass('legacy booking creation fire-and-forget path removed')

assert.ok(
  !bookingState.includes('const recipient=\n          await Users.byId('),
  'legacy post-commit terminal email recipient block must be absent'
)
pass('legacy terminal booking fire-and-forget path removed')

console.log('')
console.log('D10H.4A SEMANTICS')
console.log('-----------------')
console.log('Business transaction + client -> email job uses same DB transaction')
console.log('Transactional enqueue failure -> error propagates -> caller can rollback')
console.log('No transaction client -> existing queue/direct fallback semantics preserved')
console.log('No provider call is introduced inside DB transaction')
console.log('Booking create -> notification -> email job -> one commit')
console.log('Booking cancel/complete -> notification -> email job -> one commit')
console.log('Email enqueue failure -> booking transaction rollback')
console.log('')
console.log(
  'MELEO D10H.4B business-event email atomic handoff self-test: OK'
)
