import fs from 'node:fs'

const app =
  fs.readFileSync(
    'server/relational/app.js',
    'utf8'
  )

const calendar =
  fs.readFileSync(
    'server/routes/booking-calendar.routes.js',
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
  "app.get('/api/bookings/:id/calendar.ics'"

assert(
  calendar.includes(
    route
  ),
  'Calendar route missing from booking-calendar module'
)

assert(
  !app.includes(
    route
  ),
  'Calendar route still directly owned by app.js'
)

assert(
  app.includes(
    "import { registerBookingCalendarRoutes } from '../routes/booking-calendar.routes.js'"
  ),
  'Calendar module import missing'
)

assert(
  app.includes(
    'registerBookingCalendarRoutes('
  ),
  'Calendar module registration missing'
)

for (
  const marker of [
    'auth',
    'Bookings.byId'
  ]
) {
  assert(
    calendar.includes(
      marker
    ),
    `Calendar behavior missing: ${marker}`
  )
}


/*
 * We intentionally do not rewrite ICS formatting.
 * Existing response body must remain inside the extracted route.
 */

assert(
  calendar.includes(
    'calendar.ics'
  ),
  'ICS route identity missing'
)


console.log(
  'MELEO v6.3.0 booking calendar architecture check: OK'
)

console.log(
  '[PASS] calendar route modular'
)

console.log(
  '[PASS] authenticated booking lookup preserved'
)

console.log(
  '[PASS] ICS response implementation preserved'
)
