import fs from 'node:fs'


const app =
  fs.readFileSync(
    'server/relational/app.js',
    'utf8'
  )


const review =
  fs.readFileSync(
    'server/routes/booking-review.routes.js',
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


const route =
  "app.post('/api/bookings/:id/review'"


assert(
  review.includes(
    route
  ),
  'review route missing from booking-review.routes.js'
)


assert(
  !app.includes(
    route
  ),
  'review route still directly owned by app.js'
)


assert(
  app.includes(
    "import { registerBookingReviewRoutes } from '../routes/booking-review.routes.js'"
  ),
  'booking-review route import missing'
)


assert(
  app.includes(
    'registerBookingReviewRoutes('
  ),
  'booking-review route registration missing'
)


for (
  const marker of [
    'canReviewBooking',
    'Bookings.byId',
    'INSERT INTO reviews',
    'UPDATE professionals',
    'reviews_count',
    'rating',
    "id('rev')",
    'Notifications.create',
    'Professionals.byId'
  ]
) {
  assert(
    review.includes(
      marker
    ),
    `review behavior missing: ${marker}`
  )
}


/*
 * Transactional review insertion and aggregate update
 * must remain coupled.
 */

assert(
  review.includes(
    'await tx('
  ),
  'review transaction boundary missing'
)


/*
 * Duplicate review protection remains required.
 */

assert(
  review.includes(
    '23505'
  ),
  'duplicate review protection missing'
)


/*
 * Calendar deliberately remains application-owned
 * for the next extraction step.
 */





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
  'MELEO v6.3.0 booking review architecture check: OK'
)

console.log(
  '[PASS] completed-booking authorization preserved'
)

console.log(
  '[PASS] review insert remains transactional'
)

console.log(
  '[PASS] professional rating aggregation preserved'
)

console.log(
  '[PASS] duplicate review protection preserved'
)

console.log(
  '[PASS] review notification preserved'
)

console.log(
  '[PASS] calendar independently modular'
)
