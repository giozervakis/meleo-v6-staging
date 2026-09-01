import fs from 'node:fs'
import assert from 'node:assert/strict'

const repo=
  fs.readFileSync(
    'server/relational/repositories.js',
    'utf8'
  )

const routes=
  fs.readFileSync(
    'server/routes/booking-communication.routes.js',
    'utf8'
  )

const pkg=
  JSON.parse(
    fs.readFileSync(
      'package.json',
      'utf8'
    ).replace(/^\uFEFF/,'')
  )

function section(
  text,
  startMarker,
  endMarker
){
  const start=
    text.indexOf(
      startMarker
    )

  const end=
    text.indexOf(
      endMarker,
      start
    )

  assert.ok(
    start>=0 &&
    end>start,
    `Could not isolate ${startMarker}`
  )

  return text.slice(
    start,
    end
  )
}

function callWindow(
  text,
  marker,
  size=1400
){
  const start=
    text.indexOf(
      marker
    )

  assert.ok(
    start>=0,
    `Could not locate ${marker}`
  )

  return text.slice(
    start,
    start+size
  )
}

const addMessage=
  section(
    repo,
    'async addMessage(',
    'async unreadMessageCount('
  )

const clarify=
  section(
    repo,
    '  async clarifyWithMessage(',
    '  async transition('
  )

const addNotification=
  callWindow(
    addMessage,
    'await Notifications.create('
  )

const clarifyNotification=
  callWindow(
    clarify,
    'await Notifications.create('
  )

const checks=[
  [
    'ordinary message uses database transaction',
    addMessage.includes(
      'await tx(async client=>'
    )
  ],

  [
    'ordinary message insert uses transaction client',
    addMessage.includes(
      'await client.query('
    ) &&
    addMessage.includes(
      'INSERT INTO booking_messages'
    )
  ],

  [
    'ordinary message live event uses transaction client',
    addMessage.includes(
      'INSERT INTO live_events'
    ) &&
    addMessage.includes(
      'const event='
    )
  ],

  [
    'ordinary message pg notify uses transaction client',
    addMessage.includes(
      "SELECT pg_notify("
    ) &&
    addMessage.includes(
      "'meleo_live'"
    )
  ],

  [
    'ordinary message notification exists in repository transaction',
    addMessage.indexOf(
      'await Notifications.create('
    ) >
    addMessage.indexOf(
      'await tx(async client=>'
    )
  ],

  [
    'ordinary message notification receives transaction client',
    addNotification.includes(
      'client'
    )
  ],

  [
    'clarification notification exists in repository transaction',
    clarify.indexOf(
      'await Notifications.create('
    ) >
    clarify.indexOf(
      'await tx(async client=>'
    )
  ],

  [
    'clarification notification receives transaction client',
    clarifyNotification.includes(
      'client'
    )
  ],

  [
    'communication route has no standalone notification write',
    !routes.includes(
      'Notifications.create('
    )
  ],

  [
    'ordinary message route delegates persistence to addMessage',
    routes.includes(
      'await Bookings.addMessage('
    )
  ],

  [
    'clarification route delegates persistence to clarifyWithMessage',
    routes.includes(
      'await Bookings.clarifyWithMessage('
    )
  ],

  [
    'D10D.7 package script exists',
    pkg.scripts?.[
      'booking-communication-integrity-check'
    ]===
      'node scripts/d10d-booking-communication-integrity-selftest.mjs'
  ],

  [
    'D10D.7 is part of ci gate',
    String(
      pkg.scripts?.['ci:gate'] || ''
    ).includes(
      'npm run booking-communication-integrity-check'
    )
  ]
]

for(
  const [name,ok]
  of checks
){
  console.log(
    (ok ? '[PASS] ' : '[FAIL] ') +
    name
  )
}

assert.ok(
  checks.every(
    ([,ok])=>ok
  ),
  'D10D.7 booking communication integrity contract failed'
)

console.log('')
console.log(
  'MELEO D10D.7 booking communication integrity self-test: OK'
)