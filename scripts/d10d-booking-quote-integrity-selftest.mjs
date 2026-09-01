import fs from 'node:fs'
import assert from 'node:assert/strict'

const repo=
  fs.readFileSync(
    'server/relational/repositories.js',
    'utf8'
  )

const routes=
  fs.readFileSync(
    'server/routes/booking-quote.routes.js',
    'utf8'
  )

const app=
  fs.readFileSync(
    'server/relational/app.js',
    'utf8'
  )

const fsm=
  fs.readFileSync(
    'server/relational/booking-state-machine.js',
    'utf8'
  )

const checks=[
  [
    'active app imports quote module',
    app.includes(
      "registerBookingQuoteRoutes"
    )
  ],
  [
    'professional quote route exists',
    routes.includes(
      "'/api/bookings/:id/quote'"
    )
  ],
  [
    'patient quote decision route exists',
    routes.includes(
      "'/api/bookings/:id/quote-decision'"
    )
  ],
  [
    'quote amount has upper bound',
    routes.includes(
      'amount>5000'
    )
  ],
  [
    'quote write is transactional',
    repo.includes(
      'async quoteWithMessage('
    ) &&
    repo.includes(
      'await tx(async client=>'
    )
  ],
  [
    'quote uses CAS expected state',
    /WHERE\s+status=\$2\s+AND id=\$3/m.test(
      repo
    )
  ],
  [
    'quote writes proposed price',
    repo.includes(
      "status='quoted'"
    ) &&
    repo.includes(
      'proposed_price=$1'
    )
  ],
  [
    'quote clears stale agreed price',
    repo.includes(
      'agreed_price=NULL'
    )
  ],
  [
    'quote message is transactional',
    repo.includes(
      "'quote',$7,now()"
    )
  ],
  [
    'quote notification uses same client',
    /Notifications\.create\([\s\S]*?client\s*\)/m.test(
      repo
    )
  ],
  [
    'decision method exists',
    repo.includes(
      'async decideQuoteWithMessage('
    )
  ],
  [
    'accept copies proposed price',
    repo.includes(
      "nextStatus="
    ) &&
    repo.includes(
      "'accepted'"
    ) &&
    repo.includes(
      'agreedPrice'
    )
  ],
  [
    'decline clears stale proposed price',
    repo.includes(
      "WHEN $1='accepted'"
    ) &&
    repo.includes(
      'ELSE NULL'
    )
  ],
  [
    'decision CAS requires quoted state',
    repo.includes(
      "status='quoted'"
    )
  ],
  [
    'FSM allows pending to quoted',
    /pending:[\s\S]*?'quoted'/m.test(
      fsm
    )
  ],
  [
    'FSM allows quote decline back to pending',
    /quoted:[\s\S]*?'pending'/m.test(
      fsm
    )
  ],
  [
    'generic patient status permissions remain restricted',
    /if\(isPatient\)\{[\s\S]*?return toStatus==='cancelled'/m.test(
      fsm
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
  'D10D.5 quote integrity contract failed'
)

console.log('')
console.log(
  'MELEO D10D.5 quote integrity self-test: OK'
)
