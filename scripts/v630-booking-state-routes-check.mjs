import fs from 'node:fs'

function assert(
  condition,
  message
) {
  if (
    !condition
  ) {
    throw new Error(
      message
    )
  }
}

const app =
  fs.readFileSync(
    'server/relational/app.js',
    'utf8'
  )

const route =
  fs.readFileSync(
    'server/routes/booking-state.routes.js',
    'utf8'
  )

const target =
  "app.patch('/api/bookings/:id/status'"

assert(
  route.includes(
    target
  ),
  'Booking status route missing from booking-state.routes.js'
)

assert(
  !app.includes(
    target
  ),
  'Booking status route still application-owned'
)

assert(
  app.includes(
    "import { registerBookingStateRoutes } from '../routes/booking-state.routes.js'"
  ),
  'Booking state import missing'
)

assert(
  app.includes(
    'registerBookingStateRoutes('
  ),
  'Booking state registration missing'
)

for (
  const dependency of [
    'auth',
    'limits',
    'str',
    'Bookings',
    'Professionals',
    'canEditBooking',
    'Notifications'
  ]
) {
  assert(
    route.includes(
      dependency
    ),
    `Booking state dependency missing: ${dependency}`
  )
}

/*
 * These routes must NOT move during 7B1.
 */
for (
  const deferred of [
  ]
) {
  assert(
    app.includes(
      deferred
    ),
    `Deferred booking route moved prematurely: ${deferred}`
  )
}


const bookingCommunication =
  fs.readFileSync(
    'server/routes/booking-communication.routes.js',
    'utf8'
  )

for (
  const route of [
    "/api/bookings/:id/clarification",
    "/api/bookings/:id/message",
    "/api/bookings/unread",
    "/api/bookings/:id/messages/read"
  ]
) {
  assert(
    bookingCommunication.includes(
      route
    ),
    `booking communication route missing from modular owner: ${route}`
  )
}


const recovery =
  fs.readFileSync(
    'server/routes/booking-recovery.routes.js',
    'utf8'
  )

for (
  const route of [
    "app.get('/api/bookings/:id/recovery-candidates'",
    "app.post('/api/bookings/:id/recover'"
  ]
) {
  assert(
    recovery.includes(
      route
    ),
    `recovery route missing: ${route}`
  )

  assert(
    !app.includes(
      route
    ),
    `recovery route still application-owned: ${route}`
  )
}



const bookingReviewSource =
  fs.readFileSync(
    'server/routes/booking-review.routes.js',
    'utf8'
  )

assert(
  bookingReviewSource.includes(
    "app.post('/api/bookings/:id/review'"
  ),
  'Review route missing from booking-review module'
)

assert(
  !app.includes(
    "app.post('/api/bookings/:id/review'"
  ),
  'Review route must not remain application-owned'
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
  'MELEO v6.3.0 booking state architecture check: OK'
)

console.log(
  '[PASS] booking status transition modular'
)

console.log(
  '[PASS] booking communication independently modular'
)

console.log(
  '[PASS] recovery + review + calendar independently modular'
)
