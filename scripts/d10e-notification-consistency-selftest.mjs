import fs from 'node:fs'

const read=
  path=>
    fs.readFileSync(
      path,
      'utf8'
    )
      .replace(/^\uFEFF/,'')
      .replace(/\r\n/g,'\n')


function check(
  condition,
  message
){
  if(!condition){
    console.error(
      '[FAIL]',
      message
    )

    process.exitCode=1
    return
  }

  console.log(
    '[PASS]',
    message
  )
}


const repositories=
  read(
    'server/relational/repositories.js'
  )

const billingRoute=
  read(
    'server/routes/professional-billing.routes.js'
  )

const bookingReview=
  read(
    'server/routes/booking-review.routes.js'
  )

const support=
  read(
    'server/routes/support.routes.js'
  )

const verification=
  read(
    'server/routes/admin-verification.routes.js'
  )

const pkg=
  JSON.parse(
    read(
      'package.json'
    )
  )


// ==========================================================
// Notifications.create isolation
// ==========================================================

const notificationsStart=
  repositories.indexOf(
    'export const Notifications={'
  )

check(
  notificationsStart>=0,
  'Notifications repository located'
)


const createStart=
  repositories.indexOf(
    'async create(',
    notificationsStart
  )

check(
  createStart>notificationsStart,
  'Notifications.create located'
)


const listStart=
  repositories.indexOf(
    'async list(',
    createStart
  )

check(
  listStart>createStart,
  'Notifications.create end boundary located'
)


const create=
  (
    createStart>=0 &&
    listStart>createStart
  )
    ? repositories.slice(
        createStart,
        listStart
      )
    : ''


check(
  create.length>0,
  'Notifications.create isolated'
)


// ==========================================================
// Standalone atomic transaction semantics
// ==========================================================

check(
  create.includes(
    'const write='
  ),
  'atomic notification write unit exists'
)


check(
  create.includes(
    'client?.query'
  ),
  'caller transaction client is detected'
)


const clientBranch=
  create.indexOf(
    'client?.query'
  )

const clientWrite=
  create.indexOf(
    'return write(',
    clientBranch
  )

const clientArgument=
  create.indexOf(
    'client',
    clientWrite
  )

check(
  clientBranch>=0 &&
  clientWrite>clientBranch &&
  clientArgument>clientWrite,
  'caller transaction client is reused'
)


const fallbackTx=
  create.indexOf(
    'return tx('
  )

check(
  fallbackTx>=0,
  'standalone notification owns local transaction'
)


const durablePos=
  create.indexOf(
    'INSERT INTO notifications('
  )

const eventPos=
  create.indexOf(
    'INSERT INTO live_events('
  )

const publishPos=
  create.indexOf(
    'SELECT pg_notify('
  )


check(
  durablePos>=0,
  'durable notification write is atomic'
)

check(
  eventPos>durablePos,
  'live-event write follows durable notification'
)

check(
  publishPos>eventPos,
  'pg_notify follows live-event creation'
)


check(
  !create.includes(
    'query:(q,p)=>sql(q,p)'
  ),
  'split standalone SQL fallback removed'
)


check(
  !create.includes(
    'getStripe('
  ) &&
  !create.includes(
    'mail.'
  ),
  'notification transaction contains no external side effect'
)


// ==========================================================
// Existing caller-owned transaction paths
// ==========================================================

// Booking creation

const bookingCreationNotification=
  repositories.indexOf(
    'if(notification){'
  )

const bookingCreationReturn=
  repositories.indexOf(
    'return this.byId(',
    bookingCreationNotification
  )

const bookingCreationSegment=
  (
    bookingCreationNotification>=0 &&
    bookingCreationReturn>
      bookingCreationNotification
  )
    ? repositories.slice(
        bookingCreationNotification,
        bookingCreationReturn
      )
    : ''


check(
  bookingCreationSegment.includes(
    'Notifications.create('
  ) &&
  bookingCreationSegment.includes(
    'notification.options || {}'
  ) &&
  bookingCreationSegment.includes(
    'client'
  ),
  'booking creation notification still uses caller tx client'
)


// Booking communication

const addMessageStart=
  repositories.indexOf(
    'async addMessage('
  )

const unreadMessageStart=
  repositories.indexOf(
    'async unreadMessageCount(',
    addMessageStart
  )

const addMessageSegment=
  (
    addMessageStart>=0 &&
    unreadMessageStart>addMessageStart
  )
    ? repositories.slice(
        addMessageStart,
        unreadMessageStart
      )
    : ''


check(
  addMessageSegment.includes(
    'Notifications.create('
  ) &&
  addMessageSegment.includes(
    "'message'"
  ) &&
  addMessageSegment.includes(
    'client'
  ),
  'booking message notification tx-client path preserved'
)


// Booking review

check(
  bookingReview.includes(
    "Notifications.create(p.userId,'review'"
  ) &&
  bookingReview.includes(
    '{},c)'
  ),
  'booking review notification still uses caller tx client'
)


// Support

check(
  support.includes(
    "Notifications.create(req.user.role==='admin'"
  ) &&
  support.includes(
    '{},c)'
  ),
  'support notification still uses caller tx client'
)


// Verification

const verificationNotification=
  verification.indexOf(
    'await Notifications.create('
  )

const verificationAudit=
  verification.indexOf(
    'await audit(',
    verificationNotification
  )

const verificationSegment=
  (
    verificationNotification>=0 &&
    verificationAudit>
      verificationNotification
  )
    ? verification.slice(
        verificationNotification,
        verificationAudit
      )
    : ''


check(
  verificationSegment.includes(
    'Notifications.create('
  ) &&
  verificationSegment.includes(
    'c'
  ),
  'verification notification still uses caller tx client'
)


// ==========================================================
// Billing external-boundary protection
// ==========================================================

const billingNotificationCount=
  (
    billingRoute.match(
      /Notifications\.create\s*\(/g
    ) ||
    []
  ).length


check(
  billingNotificationCount>=5,
  'standalone billing notification sites remain present'
)


check(
  billingRoute.includes(
    'createDowngradeSchedule(s,sub,p,u)'
  ),
  'Stripe downgrade remains route-owned'
)


check(
  billingRoute.includes(
    's.invoices.pay('
  ),
  'Stripe invoice payment remains route-owned'
)


check(
  !billingRoute.includes(
    'await tx('
  ),
  'billing HTTP route is not wrapped around Stripe operations'
)


// ==========================================================
// Package / CI registration
// ==========================================================

check(
  pkg.scripts?.[
    'notification-consistency-check'
  ] ===
    'node scripts/d10e-notification-consistency-selftest.mjs',
  'D10E.8A package script exists'
)


const ciGate=
  pkg.scripts?.[
    'ci:gate'
  ] ||
  ''


const previousGate=
  'npm run billing-admin-sync-integrity-check'

const notificationGate=
  'npm run notification-consistency-check'

const previousGatePos=
  ciGate.indexOf(
    previousGate
  )

const notificationGatePos=
  ciGate.indexOf(
    notificationGate
  )


check(
  previousGatePos>=0 &&
  notificationGatePos>previousGatePos,
  'D10E.8A chained after D10E.7B'
)


// ==========================================================
// FINAL
// ==========================================================

if(!process.exitCode){

  console.log('')

  console.log(
    'MELEO D10E.8A notification consistency self-test: OK'
  )
}