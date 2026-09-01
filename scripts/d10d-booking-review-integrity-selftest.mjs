import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename=fileURLToPath(import.meta.url)
const __dirname=path.dirname(__filename)
const root=path.resolve(__dirname,'..')

const read=relative=>
  fs.readFileSync(
    path.join(root,relative),
    'utf8'
  )

const pass=message=>
  console.log('[PASS] '+message)

const fail=message=>{
  console.error('[FAIL] '+message)
  process.exitCode=1
}

const check=(condition,message)=>{
  if(condition) pass(message)
  else fail(message)
}

const route=
  read('server/routes/booking-review.routes.js')

const pkg=
  JSON.parse(
    read('package.json')
  )

check(
  route.includes(
    "app.post('/api/bookings/:id/review'"
  ),
  'review endpoint exists'
)

check(
  route.includes(
    'try{await tx(async c=>{'
  ),
  'review write uses database transaction'
)

check(
  route.includes(
    'await c.query(`INSERT INTO reviews'
  ),
  'review insert uses transaction client'
)

check(
  route.includes(
    'await c.query(`UPDATE professionals SET reviews_count='
  ),
  'professional rating aggregate uses transaction client'
)

check(
  route.includes(
    'const p=await Professionals.byId(b.professionalId);try{await tx(async c=>{'
  ),
  'notification recipient is resolved before review transaction'
)

const txStart=
  route.indexOf(
    'try{await tx(async c=>{'
  )

const notificationPos=
  route.indexOf(
    'await Notifications.create('
  )

const catchPos=
  route.indexOf(
    '})}catch(err){'
  )

check(
  txStart>=0 &&
  notificationPos>txStart &&
  catchPos>notificationPos,
  'review notification executes inside review transaction'
)

check(
  /Notifications\.create\([^;]+,\{\},c\)/.test(
    route
  ),
  'review notification receives same transaction client'
)

check(
  (
    route.match(
      /Notifications\.create\(/g
    ) || []
  ).length===1,
  'review route contains exactly one notification write'
)

check(
  !/\}\)\}catch\(err\)\{[^]*Notifications\.create\(/.test(
    route
  ),
  'review route has no post-transaction notification write'
)

check(
  route.includes(
    "if(err.code==='23505')"
  ),
  'duplicate review conflict handling remains intact'
)

check(
  route.includes(
    "res.status(409)"
  ),
  'duplicate review still returns conflict'
)


// ============================================================
// Final booking notification sweep
// ============================================================

const routesDir=
  path.join(
    root,
    'server/routes'
  )

const bookingRoutes=
  fs.readdirSync(routesDir)
    .filter(
      name=>
        name.startsWith('booking-') &&
        name.endsWith('.routes.js')
    )

let bookingNotificationCalls=0
let notificationFiles=[]

for(const file of bookingRoutes){

  const source=
    fs.readFileSync(
      path.join(routesDir,file),
      'utf8'
    )

  const count=
    (
      source.match(
        /Notifications\.create\(/g
      ) || []
    ).length

  if(count){
    bookingNotificationCalls+=count
    notificationFiles.push(file)
  }
}

check(
  bookingNotificationCalls===1,
  'only one direct booking-route notification call remains'
)

check(
  notificationFiles.length===1 &&
  notificationFiles[0]==='booking-review.routes.js',
  'remaining direct booking-route notification is review transaction only'
)


// ============================================================
// Package gate
// ============================================================

check(
  pkg.scripts?.[
    'booking-review-integrity-check'
  ] ===
    'node scripts/d10d-booking-review-integrity-selftest.mjs',
  'D10D.9 package script exists'
)

check(
  pkg.scripts?.['ci:gate']?.includes(
    'npm run booking-creation-integrity-check && npm run booking-review-integrity-check'
  ),
  'D10D.9 is chained after D10D.8 in ci gate'
)

if(process.exitCode){
  console.error(
    '\nMELEO D10D.9 booking review integrity self-test: FAILED'
  )
  process.exit(
    process.exitCode
  )
}

console.log(
  '\nMELEO D10D.9 booking review integrity self-test: OK'
)
