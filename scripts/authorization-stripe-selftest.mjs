import fs from 'node:fs'
import assert from 'node:assert/strict'
import {
  canViewBooking,canEditBooking,canViewPatientContact,canReviewBooking
} from '../server/relational/authorization.js'

const pa={id:'pa',role:'patient'}
const pb={id:'pb',role:'patient'}
const ua={id:'ua',role:'professional'}
const ub={id:'ub',role:'professional'}
const admin={id:'admin',role:'admin'}
const pro={id:'pro',userId:'ua'}
const b={id:'b',patientId:'pa',professionalId:'pro',status:'completed'}

assert.equal(canViewBooking(pa,b,pro),true)
assert.equal(canViewBooking(pb,b,pro),false)
assert.equal(canViewBooking(ua,b,pro),true)
assert.equal(canViewBooking(ub,b,pro),false)
assert.equal(canViewBooking(admin,b,pro),true)
assert.equal(canEditBooking(pb,b,pro),false)
assert.equal(canViewPatientContact(pa,b,pro),false)
assert.equal(canViewPatientContact(ua,b,pro),true)
assert.equal(canViewPatientContact(ub,b,pro),false)
assert.equal(canReviewBooking(pa,b),true)
assert.equal(canReviewBooking(pb,b),false)
assert.equal(canReviewBooking(pa,{...b,status:'accepted'}),false)

const app=fs.readFileSync('server/relational/app.js','utf8')
const billing=fs.readFileSync('server/services/billing.service.js','utf8')
const migration=fs.readFileSync('migrations/009_stripe_webhook_ordering.sql','utf8')
const routes=fs.readFileSync('server/routes/professional-billing.routes.js','utf8')

for(const token of [
  "ON CONFLICT(id) DO NOTHING",
  "status='failed'",
  "interval '5 minutes'",
  "return res.json({received:true,duplicate:true})",
  "s.subscriptions.retrieve(String(obj.id))",
  "eventContext={eventId:event.id,eventCreated:event.created}",
  "applyStripeSubscription(canonical,false,eventContext)"
])assert.ok(app.includes(token),`Missing webhook invariant: ${token}`)

for(const token of [
  'last_stripe_event_created',
  'last_stripe_event_id',
  'incomingEventCreated<lastEventCreated',
  'existingLedger?.lastStripeEventId===incomingEventId',
  'COALESCE($10,subscriptions.last_stripe_event_created)'
])assert.ok(billing.includes(token),`Missing ordering invariant: ${token}`)

assert.ok(migration.includes('ADD COLUMN IF NOT EXISTS last_stripe_event_created bigint'))
assert.ok(migration.includes('ADD COLUMN IF NOT EXISTS last_stripe_event_id text'))
assert.ok(routes.includes("auth,requireRole('professional')"))

console.log('MELEO authorization + Stripe webhook self-test: OK')
