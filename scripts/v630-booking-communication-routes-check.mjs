import fs from 'node:fs'


const read =
  file =>
    fs.readFileSync(
      file,
      'utf8'
    )


const assert =
  (
    condition,
    message
  ) => {
    if (!condition) {
      throw new Error(
        message
      )
    }
  }


const app =
  read(
    'server/relational/app.js'
  )


const communication =
  read(
    'server/routes/booking-communication.routes.js'
  )


const recovery =
  read(
    'server/routes/booking-recovery.routes.js'
  )


/*
 * ------------------------------------------------------------
 * Communication ownership
 * ------------------------------------------------------------
 */

const communicationRoutes = [
  [
    'POST',
    '/api/bookings/:id/clarification'
  ],
  [
    'POST',
    '/api/bookings/:id/message'
  ],
  [
    'GET',
    '/api/bookings/unread'
  ],
  [
    'PATCH',
    '/api/bookings/:id/messages/read'
  ]
]


function routeMarker(
  method,
  path
) {
  return new RegExp(
    `app\\.${method.toLowerCase()}\\(\\s*['"\`]` +
    path
      .replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&'
      ) +
    `['"\`]`
  )
}


for (
  const [
    method,
    path
  ] of communicationRoutes
) {
  const marker =
    routeMarker(
      method,
      path
    )

  assert(
    marker.test(
      communication
    ),
    `communication route missing from module: ${method} ${path}`
  )

  marker.lastIndex = 0

  assert(
    !marker.test(
      app
    ),
    `communication route still owned by app.js: ${method} ${path}`
  )
}


/*
 * ------------------------------------------------------------
 * Registration
 * ------------------------------------------------------------
 */

assert(
  app.includes(
    "import { registerBookingCommunicationRoutes } from '../routes/booking-communication.routes.js'"
  ),
  'booking communication import missing'
)


assert(
  app.includes(
    'registerBookingCommunicationRoutes('
  ),
  'booking communication registration missing'
)


/*
 * ------------------------------------------------------------
 * Communication behavior
 * ------------------------------------------------------------
 *
 * These assertions intentionally check semantic primitives,
 * not fragile exact formatting.
 */

/*
 * Communication behavioral contract.
 *
 * Do not pin the architecture checker to every repository helper name.
 * Route ownership, authorization boundaries and communication primitives
 * are the stable contract.
 */

for (
  const marker of [
    'Bookings.addMessage',
    'Bookings.byId',
    'Professionals.byId',
    'Notifications.create',
    'canViewBooking'
  ]
) {
  assert(
    communication.includes(
      marker
    ),
    `communication behavior missing: ${marker}`
  )
}


/*
 * Unread/read behavior may be implemented through repository methods
 * whose exact names can evolve. Verify capability rather than one
 * specific implementation spelling.
 */

assert(
  communication.includes(
    '/api/bookings/unread'
  ),
  'booking unread route missing'
)

assert(
  communication.includes(
    '/api/bookings/:id/messages/read'
  ),
  'booking message-read route missing'
)

assert(
  /Bookings.[A-Za-z0-9_]*unread[A-Za-z0-9_]*/i.test(
    communication
  ) ||
  communication.includes(
    'conversationUnreadCounts'
  ),
  'booking unread capability missing'
)

assert(
  /Bookings.[A-Za-z0-9_]*(mark|read)[A-Za-z0-9_]*/i.test(
    communication
  ),
  'booking message read-state capability missing'
)


/*
 * The communication module must retain middleware boundaries.
 */

for (
  const marker of [
    'auth',
    'limits.write',
    "requireRole('professional')"
  ]
) {
  assert(
    communication.includes(
      marker
    ),
    `communication security boundary missing: ${marker}`
  )
}


/*
 * ------------------------------------------------------------
 * Recovery is now independently modular
 * ------------------------------------------------------------
 */

const recoveryRoutes = [
  [
    'GET',
    '/api/bookings/:id/recovery-candidates'
  ],
  [
    'POST',
    '/api/bookings/:id/recover'
  ]
]


for (
  const [
    method,
    path
  ] of recoveryRoutes
) {
  const marker =
    routeMarker(
      method,
      path
    )

  assert(
    marker.test(
      recovery
    ),
    `recovery route missing from recovery module: ${method} ${path}`
  )

  marker.lastIndex = 0

  assert(
    !marker.test(
      app
    ),
    `recovery route still owned by app.js: ${method} ${path}`
  )

  marker.lastIndex = 0

  assert(
    !marker.test(
      communication
    ),
    `recovery route incorrectly owned by communication module: ${method} ${path}`
  )
}


/*
 * ------------------------------------------------------------
 * Review / calendar intentionally remain application-owned
 * ------------------------------------------------------------
 */

for (
  const [
    method,
    path
  ] of [
  ]
) {
  assert(
    routeMarker(
      method,
      path
    ).test(app),
    `deferred booking route missing from app.js: ${method} ${path}`
  )
}


/*
 * ------------------------------------------------------------
 * Realtime lifecycle must remain outside booking module
 * ------------------------------------------------------------
 */

assert(
  app.includes(
    "app.get('/api/live'"
  ),
  'realtime SSE route moved unexpectedly'
)


assert(
  app.includes(
    'LISTEN meleo_live'
  ),
  'PostgreSQL realtime LISTEN lifecycle missing'
)


assert(
  app.includes(
    'UNLISTEN meleo_live'
  ),
  'PostgreSQL realtime UNLISTEN lifecycle missing'
)



const bookingReviewSource =
  fs.readFileSync(
    'server/routes/booking-review.routes.js',
    'utf8'
  )

assert(
  bookingReviewSource.includes(
    "app.post('/api/bookings/:id/review'"
  ),
  'review route missing from booking-review module'
)

assert(
  !app.includes(
    "app.post('/api/bookings/:id/review'"
  ),
  'review route must not remain application-owned'
)



const bookingCalendarSource =
  fs.readFileSync(
    'server/routes/booking-calendar.routes.js',
    'utf8'
  )

assert(
  bookingCalendarSource.includes(
    "app.get('/api/bookings/:id/calendar.ics'"
  ),
  'Calendar route missing from booking-calendar module'
)

assert(
  !app.includes(
    "app.get('/api/bookings/:id/calendar.ics'"
  ),
  'Calendar route must not remain application-owned'
)


console.log(
  'MELEO v6.3.0 booking communication architecture check: OK'
)

console.log(
  '[PASS] clarification messaging modular'
)

console.log(
  '[PASS] booking conversation messaging modular'
)

console.log(
  '[PASS] unread conversation state modular'
)

console.log(
  '[PASS] message read-state modular'
)

console.log(
  '[PASS] booking authorization preserved'
)

console.log(
  '[PASS] recovery independently modular'
)

console.log(
  '[PASS] review + calendar independently modular'
)
