import assert from 'node:assert/strict'

import {
  canTransitionBooking,
  bookingTransitionResult,
  canUserTransitionBooking
} from '../server/relational/booking-state-machine.js'


const valid=[
  ['pending','clarification'],
  ['pending','accepted'],
  ['pending','cancelled'],

  ['clarification','quoted'],
  ['clarification','accepted'],
  ['clarification','cancelled'],

  ['quoted','accepted'],
  ['quoted','cancelled'],

  ['accepted','completed'],
  ['accepted','cancelled']
]

for(const [from,to] of valid){
  assert.equal(
    canTransitionBooking(from,to),
    true,
    from+' -> '+to+' should be valid'
  )
}


const invalid=[
  ['pending','completed'],
  ['pending','pending'],

  ['clarification','pending'],

  ['quoted','completed'],
  ['quoted','pending'],

  ['accepted','quoted'],
  ['accepted','pending'],

  ['completed','accepted'],
  ['completed','cancelled'],

  ['cancelled','pending'],
  ['cancelled','completed']
]

for(const [from,to] of invalid){
  assert.equal(
    canTransitionBooking(from,to),
    false,
    from+' -> '+to+' should be invalid'
  )
}


assert.equal(
  bookingTransitionResult(
    'completed',
    'accepted'
  ).code,
  'BOOKING_STATUS_TERMINAL'
)

assert.equal(
  bookingTransitionResult(
    'cancelled',
    'pending'
  ).code,
  'BOOKING_STATUS_TERMINAL'
)

assert.equal(
  bookingTransitionResult(
    'pending',
    'pending'
  ).code,
  'BOOKING_STATUS_NOOP'
)

assert.equal(
  bookingTransitionResult(
    'pending',
    'invalid'
  ).code,
  'BOOKING_TARGET_STATUS_INVALID'
)


const booking={
  id:'b1',
  patientId:'patient_1',
  professionalId:'professional_record_1',
  status:'pending'
}

const professional={
  id:'professional_record_1',
  userId:'professional_user_1'
}

const patient={
  id:'patient_1',
  role:'patient'
}

const provider={
  id:'professional_user_1',
  role:'professional'
}

const outsider={
  id:'professional_user_2',
  role:'professional'
}

const admin={
  id:'admin_1',
  role:'admin'
}


assert.equal(
  canUserTransitionBooking({
    user:patient,
    booking,
    professional,
    toStatus:'cancelled'
  }),
  true
)

assert.equal(
  canUserTransitionBooking({
    user:patient,
    booking,
    professional,
    toStatus:'accepted'
  }),
  false
)

assert.equal(
  canUserTransitionBooking({
    user:provider,
    booking,
    professional,
    toStatus:'clarification'
  }),
  true
)

assert.equal(
  canUserTransitionBooking({
    user:provider,
    booking,
    professional,
    toStatus:'accepted'
  }),
  true
)

assert.equal(
  canUserTransitionBooking({
    user:outsider,
    booking,
    professional,
    toStatus:'accepted'
  }),
  false
)

assert.equal(
  canUserTransitionBooking({
    user:admin,
    booking,
    professional,
    toStatus:'accepted'
  }),
  true
)

assert.equal(
  canUserTransitionBooking({
    user:admin,
    booking:{
      ...booking,
      status:'completed'
    },
    professional,
    toStatus:'accepted'
  }),
  false
)

console.log(
  'MELEO D10D booking FSM self-test: OK'
)
