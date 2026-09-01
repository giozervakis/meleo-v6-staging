import fs from 'node:fs'
import assert from 'node:assert/strict'

const repo=
  fs.readFileSync(
    'server/relational/repositories.js',
    'utf8'
  )

const routes=
  fs.readFileSync(
    'server/routes/booking-state.routes.js',
    'utf8'
  )

const pkg=
  JSON.parse(
    fs.readFileSync(
      'package.json',
      'utf8'
    ).replace(/^\uFEFF/,'')
  )

const transitionMatch=
  repo.match(
    /async transition\([\s\S]*?\n  }\n}\n\nexport const Analytics=/
  )

assert.ok(
  transitionMatch,
  'Could not isolate Bookings.transition'
)

const transition=
  transitionMatch[0]

const checks=[
  [
    'generic transition is transactional',
    /await\s+tx\s*\(\s*async\s+client\s*=>/.test(
      transition
    )
  ],
  [
    'notification uses same transaction client',
    /await\s+Notifications\.create\([\s\S]*?client\s*\)/m.test(
      transition
    )
  ],
  [
    'CAS includes expected status',
    /WHERE\s+status=\$\{expectedPlaceholder\}/m.test(
      transition
    )
  ],
  [
    'CAS includes booking id',
    /AND\s+id=\$\{idPlaceholder\}/m.test(
      transition
    )
  ],
  [
    'exactly one updated row wins',
    /result\.rowCount\s*===\s*1/.test(
      transition
    )
  ],
  [
    'generic clarification is blocked',
    routes.includes(
      "status==='clarification'"
    )
  ],
  [
    'generic quote transition is blocked',
    routes.includes(
      "status==='quoted'"
    )
  ],
  [
    'quoted acceptance uses dedicated workflow',
    routes.includes(
      "b.status==='quoted'"
    ) &&
    routes.includes(
      "status==='accepted'"
    )
  ],
  [
    'specialized transition code exists',
    routes.includes(
      'BOOKING_SPECIALIZED_TRANSITION_REQUIRED'
    )
  ],
  [
    'route passes notification payload into CAS transaction',
    /Bookings\.transition\([\s\S]*?userId:recipientUserId/m.test(
      routes
    )
  ],
  [
    'route has no standalone notification write',
    !/await\s+Notifications\.create\(/m.test(
      routes
    )
  ],
  [
    'D10D.6 package script exists',
    pkg.scripts?.[
      'booking-state-integrity-check'
    ]===
      'node scripts/d10d-booking-state-integrity-selftest.mjs'
  ],
  [
    'D10D.6 is part of ci gate',
    String(
      pkg.scripts?.['ci:gate'] || ''
    ).includes(
      'npm run booking-state-integrity-check'
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
  'D10D.6 booking-state integrity contract failed'
)

console.log('')
console.log(
  'MELEO D10D.6 booking-state integrity self-test: OK'
)
