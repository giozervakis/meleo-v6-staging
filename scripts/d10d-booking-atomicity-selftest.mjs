import fs from 'node:fs'
import assert from 'node:assert/strict'

const repo=
  fs.readFileSync(
    'server/relational/repositories.js',
    'utf8'
  )

const state=
  fs.readFileSync(
    'server/routes/booking-state.routes.js',
    'utf8'
  )

const communication=
  fs.readFileSync(
    'server/routes/booking-communication.routes.js',
    'utf8'
  )

const updateStart=
  repo.indexOf(
    '  async update(id,patch){'
  )

const updateEnd=
  repo.indexOf(
    '  async transition(',
    updateStart
  )

assert.ok(
  updateStart>=0 &&
  updateEnd>updateStart,
  'Bookings.update boundary not found'
)

const update=
  repo.slice(
    updateStart,
    updateEnd
  )

const start=
  repo.indexOf(
    '  async transition('
  )

const end=
  repo.indexOf(
    '\n}\n\nexport const Analytics=',
    start
  )

assert.ok(
  start>=0 && end>start,
  'Bookings.transition boundary not found'
)

const transition=
  repo.slice(
    start,
    end
  )

const checks=[
  [
    'Bookings.update SET remains parameterized',
    update.includes(
      'sets.push(`${map[k]}=${i++}`)'
    )
  ],
  [
    'Bookings.update id predicate remains parameterized',
    update.includes(
      'WHERE id=${i}'
    )
  ],
  [
    'Bookings.transition exists',
    /async\s+transition\s*\(/.test(
      transition
    )
  ],
  [
    'dynamic PostgreSQL SET placeholder created',
    transition.includes(
      "const placeholder='$'+i++"
    )
  ],
  [
    'SET uses parameter placeholder',
    transition.includes(
      "map[k]+'='+placeholder"
    )
  ],
  [
    'expected-status placeholder created',
    transition.includes(
      "const expectedPlaceholder='$'+i++"
    )
  ],
  [
    'booking-id placeholder created',
    transition.includes(
      "const idPlaceholder='$'+i++"
    )
  ],
  [
    'expected status participates in CAS predicate',
    transition.includes(
      'WHERE status=${expectedPlaceholder}'
    )
  ],
  [
    'booking id participates in CAS predicate',
    transition.includes(
      'AND id=${idPlaceholder}'
    )
  ],
  [
    'exactly one affected row wins',
    /result\.rowCount\s*===\s*1/.test(
      transition
    )
  ],
  [
    'repository exposes state conflict',
    /BOOKING_STATE_CONFLICT/.test(
      transition
    )
  ],
  [
    'state route uses atomic transition',
    /await\s+Bookings\.transition\s*\(/m.test(
      state
    )
  ],
  [
    'clarification route uses atomic transition',
    /await\s+Bookings\.transition\s*\(/m.test(
      communication
    )
  ],
  [
    'state route handles concurrent conflict',
    /BOOKING_STATE_CONFLICT/.test(
      state
    )
  ],
  [
    'clarification route handles concurrent conflict',
    /BOOKING_STATE_CONFLICT/.test(
      communication
    )
  ]
]

for(const [name,ok] of checks){
  console.log(
    `${ok ? '[PASS]' : '[FAIL]'} ${name}`
  )
}

assert.ok(
  checks.every(([,ok])=>ok),
  'Booking atomic transition contract incomplete'
)

console.log('')
console.log(
  'MELEO D10D booking atomicity self-test: OK'
)
