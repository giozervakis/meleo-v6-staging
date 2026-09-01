import fs from 'node:fs'
import assert from 'node:assert/strict'

const repo =
  fs.readFileSync(
    'server/relational/repositories.js',
    'utf8'
  )

const core =
  fs.readFileSync(
    'server/routes/booking-core.routes.js',
    'utf8'
  )

const recovery =
  fs.readFileSync(
    'server/routes/booking-recovery.routes.js',
    'utf8'
  )

const pkg =
  JSON.parse(
    fs.readFileSync(
      'package.json',
      'utf8'
    ).replace(/^\uFEFF/,'')
  )

function section(text,startMarker,endMarker){
  const start = text.indexOf(startMarker)
  const end = text.indexOf(endMarker,start)

  assert.ok(
    start >= 0 && end > start,
    'Could not isolate '+startMarker
  )

  return text.slice(start,end)
}

const create =
  section(
    repo,
    '  async create(',
    'async addMessage('
  )

const checks = [
  [
    'booking creation uses database transaction',
    create.includes(
      'await tx(async client=>'
    )
  ],

  [
    'booking insert uses transaction client',
    create.includes(
      'await client.query('
    ) &&
    create.includes(
      'INSERT INTO bookings'
    )
  ],

  [
    'booking creation accepts notification payload',
    create.includes(
      'notification=null'
    )
  ],

  [
    'notification is created inside booking transaction',
    create.includes(
      'await Notifications.create('
    )
  ],

  [
    'notification receives same transaction client',
    create.includes(
      'notification.options || {},\n          client'
    )
  ],

  [
    'normal booking delegates notification to create',
    core.includes(
      'userId:p.userId'
    ) &&
    core.includes(
      "title:'Νέο αίτημα επίσκεψης'"
    )
  ],

  [
    'normal booking has no standalone Notifications.create',
    !core.includes(
      'Notifications.create('
    )
  ],

  [
    'normal booking removed Notifications dependency',
    !core.includes(
      '    Notifications,'
    )
  ],

  [
    'recovery delegates notification to create',
    recovery.includes(
      'userId:p.userId'
    ) &&
    recovery.includes(
      "priority:'high'"
    ) &&
    recovery.includes(
      "actionType:'booking'"
    ) &&
    recovery.includes(
      "actionUrl:'/professional'"
    )
  ],

  [
    'recovery preserves recovery parent',
    recovery.includes(
      'recoveryParentId:b.id'
    )
  ],

  [
    'recovery has no standalone Notifications.create',
    !recovery.includes(
      'Notifications.create('
    )
  ],

  [
    'recovery removed Notifications dependency',
    !recovery.includes(
      '    Notifications,'
    )
  ],

  [
    'D10D.8 package script exists',
    pkg.scripts?.[
      'booking-creation-integrity-check'
    ] ===
      'node scripts/d10d-booking-creation-integrity-selftest.mjs'
  ],

  [
    'D10D.8 is part of ci gate',
    String(
      pkg.scripts?.['ci:gate'] || ''
    ).includes(
      'npm run booking-creation-integrity-check'
    )
  ]
]

for(const [name,ok] of checks){
  console.log(
    (ok ? '[PASS] ' : '[FAIL] ') + name
  )
}

assert.ok(
  checks.every(([,ok])=>ok),
  'D10D.8 booking creation integrity contract failed'
)

console.log('')
console.log(
  'MELEO D10D.8 booking creation integrity self-test: OK'
)
