import fs from 'node:fs'


const app =
  fs.readFileSync(
    'server/relational/app.js',
    'utf8'
  )


const recovery =
  fs.readFileSync(
    'server/routes/booking-recovery.routes.js',
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


const routes = [
  "app.get('/api/bookings/:id/recovery-candidates'",
  "app.post('/api/bookings/:id/recover'"
]


for (
  const route of routes
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
    `recovery route still owned by app.js: ${route}`
  )
}


for (
  const marker of [
    'Bookings.byId',
    'Bookings.create',
    'Professionals.byId',
    'Professionals.search',
    'allowsVisibility',
    'Notifications.create',
    'requireConsumer',
    'requireVerifiedEmail',
    'audit('
  ]
) {

  assert(
    recovery.includes(
      marker
    ),
    `recovery behavior missing: ${marker}`
  )
}


for (
  const route of [
  ]
) {

  assert(
    app.includes(
      route
    ),
    `deferred booking route moved prematurely: ${route}`
  )
}


assert(
  app.includes(
    "import { registerBookingRecoveryRoutes } from '../routes/booking-recovery.routes.js'"
  ),
  'recovery route import missing'
)


assert(
  app.includes(
    'registerBookingRecoveryRoutes('
  ),
  'recovery route registration missing'
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
  'MELEO v6.3.0 booking recovery architecture check: OK'
)

console.log(
  '[PASS] recovery candidate selection modular'
)

console.log(
  '[PASS] recovery booking creation modular'
)

console.log(
  '[PASS] availability / visibility guard preserved'
)

console.log(
  '[PASS] recovery notification + audit preserved'
)

console.log(
  '[PASS] review + calendar independently modular'
)
