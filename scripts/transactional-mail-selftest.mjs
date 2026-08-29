import fs from 'node:fs'
import assert from 'node:assert/strict'

const mail =
  fs.readFileSync(
    'server/mail.js',
    'utf8'
  )

const booking =
  fs.readFileSync(
    'server/routes/booking-core.routes.js',
    'utf8'
  )

const verification =
  fs.readFileSync(
    'server/routes/admin-verification.routes.js',
    'utf8'
  )

const app =
  fs.readFileSync(
    'server/relational/app.js',
    'utf8'
  )

assert.ok(
  mail.includes('newBooking:'),
  'mail.newBooking template is missing'
)

assert.ok(
  mail.includes('verificationDecision:'),
  'mail.verificationDecision template is missing'
)

for (const token of [
  'Users,',
  'mail,',
  'await Users.byId(',
  '.newBooking(',
  'professionalUser.email',
  'professionalUser.name',
  'service,',
  'date,',
  'time',
  '.catch('
]) {
  assert.ok(
    booking.includes(token),
    `Booking mail invariant missing: ${token}`
  )
}

assert.ok(
  booking.indexOf('await Bookings.create(') <
    booking.indexOf('.newBooking('),
  'Booking email must be triggered only after booking creation'
)

assert.ok(
  booking.indexOf('await Notifications.create(') <
    booking.indexOf('.newBooking('),
  'In-app booking notification must remain before email dispatch'
)

for (const token of [
  'mail,',
  '.verificationDecision(',
  'u.email',
  'u.name',
  'approved,',
  'note',
  '.catch('
]) {
  assert.ok(
    verification.includes(token),
    `Verification mail invariant missing: ${token}`
  )
}

const registrationStart =
  app.indexOf('registerBookingCoreRoutes(')

const registrationEnd =
  app.indexOf(
    'registerBookingStateRoutes(',
    registrationStart
  )

assert.ok(
  registrationStart >= 0 &&
  registrationEnd > registrationStart,
  'Could not isolate booking-core registration'
)

const registration =
  app.slice(
    registrationStart,
    registrationEnd
  )

assert.ok(
  registration.includes('Users,'),
  'Booking-core registration must pass Users'
)

assert.ok(
  registration.includes('mail,'),
  'Booking-core registration must pass mail'
)

console.log(
  'MELEO transactional mail wiring self-test: OK'
)