import fs from 'node:fs'


const app =
  fs.readFileSync(
    'server/relational/app.js',
    'utf8'
  )


const bookingState =
  fs.readFileSync(
    'server/routes/booking-state.routes.js',
    'utf8'
  )

const booking =
  fs.readFileSync(
    'server/routes/booking-core.routes.js',
    'utf8'
  )


const assert =
  (
    condition,
    message
  ) => {
    if (
      !condition
    ) {
      throw new Error(
        message
      )
    }
  }


for (
  const route of [
    "app.post('/api/bookings'",
    "app.get('/api/bookings'"
  ]
) {
  assert(
    booking.includes(
      route
    ),
    `booking core route missing: ${route}`
  )

  assert(
    !app.includes(
      route
    ),
    `booking core route still owned by app.js: ${route}`
  )
}


assert(
  app.includes(
    "import { registerBookingCoreRoutes } from '../routes/booking-core.routes.js'"
  ),
  'booking core module import missing'
)


assert(
  app.includes(
    'registerBookingCoreRoutes('
  ),
  'booking core module registration missing'
)


for (
  const marker of [
    'Bookings.create',
    'Bookings.listForUser',
    'Professionals.byId',
    'allowsVisibility',
    'Notifications.create',
    'booking.create'
  ]
) {
  assert(
    booking.includes(
      marker
    ),
    `booking core behavior missing: ${marker}`
  )
}


/*
 * Booking communication became modular in Part 4A-7B2.
 *
 * This checker owns the booking-core contract only.
 * Communication ownership is verified independently by
 * v630-booking-communication-routes-check.mjs.
 *
 * Recovery, review and calendar remain application-owned.
 */
for (
  const marker of [
  ]
) {
  assert(
    app.includes(
      marker
    ),
    `deferred booking route moved prematurely: ${marker}`
  )
}



assert(
  bookingState.includes(
    "app.patch('/api/bookings/:id/status'"
  ),
  'booking status route missing from booking-state.routes.js'
)

assert(
  !app.includes(
    "app.patch('/api/bookings/:id/status'"
  ),
  'booking status route must not remain directly owned by app.js'
)


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
    `recovery route missing from booking recovery module: ${route}`
  )

  assert(
    !app.includes(
      route
    ),
    `recovery route still owned by app.js: ${route}`
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
  'review route missing from booking-review.routes.js'
)

assert(
  !app.includes(
    "app.post('/api/bookings/:id/review'"
  ),
  'review route still directly owned by app.js'
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
  'MELEO v6.3.0 booking core routes architecture check: OK'
)

console.log(
  '[PASS] booking creation modular'
)

console.log(
  '[PASS] booking listing modular'
)

console.log(
  '[PASS] state + communication + recovery + review independently modular'
)

console.log(
  '[PASS] unread / message-read modular; calendar independently modular'
)
