import fs from 'node:fs'
import assert from 'node:assert/strict'

const repo=
  fs.readFileSync(
    'server/relational/repositories.js',
    'utf8'
  )

const communication=
  fs.readFileSync(
    'server/routes/booking-communication.routes.js',
    'utf8'
  )

const methodStart=
  repo.indexOf(
    '  async clarifyWithMessage('
  )

const methodEnd=
  repo.indexOf(
    '  /*\n   * Atomic booking lifecycle compare-and-set.',
    methodStart
  )

assert.ok(
  methodStart>=0 &&
  methodEnd>methodStart,
  'clarifyWithMessage boundary not found'
)

const method=
  repo.slice(
    methodStart,
    methodEnd
  )

const routeStart=
  communication.indexOf(
    "'/api/bookings/:id/clarification'"
  )

const routeEnd=
  communication.indexOf(
    "'/api/bookings/:id/message'",
    routeStart
  )

assert.ok(
  routeStart>=0 &&
  routeEnd>routeStart,
  'clarification route boundary not found'
)

const route=
  communication.slice(
    routeStart,
    routeEnd
  )

const checks=[
  [
    'clarification transaction method exists',
    /async\s+clarifyWithMessage\s*\(/.test(
      method
    )
  ],
  [
    'clarification uses database transaction',
    method.includes(
      'await tx(async client=>'
    )
  ],
  [
    'status update occurs inside transaction',
    method.includes(
      "status='clarification'"
    )
  ],
  [
    'status transition is compare-and-set',
    method.includes(
      'status=$1'
    ) &&
    method.includes(
      'id=$2'
    )
  ],
  [
    'CAS winner is checked',
    method.includes(
      'changed.rowCount!==1'
    )
  ],
  [
    'message insert is transactional',
    method.includes(
      'INSERT INTO booking_messages'
    ) &&
    method.indexOf(
      'INSERT INTO booking_messages'
    ) >
    method.indexOf(
      'changed.rowCount!==1'
    )
  ],
  [
    'live event insert is transactional',
    method.includes(
      'INSERT INTO live_events'
    )
  ],
  [
    'transaction publishes PostgreSQL live notification',
    method.includes(
      'SELECT pg_notify('
    )
  ],
  [
    'clarification route uses atomic method',
    route.includes(
      'Bookings.clarifyWithMessage('
    )
  ],
  [
    'clarification route no longer performs split transition',
    !route.includes(
      'Bookings.transition('
    )
  ],
  [
    'clarification route no longer separately inserts message',
    !route.includes(
      'Bookings.addMessage('
    )
  ],
  [
    'conflict response remains explicit',
    route.includes(
      'BOOKING_STATE_CONFLICT'
    )
  ]
]

for(const [name,ok] of checks){
  console.log(
    (ok ? '[PASS] ' : '[FAIL] ') +
    name
  )
}

assert.ok(
  checks.every(([,ok])=>ok),
  'D10D.4 clarification transaction contract failed'
)

console.log('')
console.log(
  'MELEO D10D.4 clarification transaction self-test: OK'
)
