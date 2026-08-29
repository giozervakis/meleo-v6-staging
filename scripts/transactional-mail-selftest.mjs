import fs from 'node:fs'
import assert from 'node:assert/strict'

const mail =
  fs.readFileSync(
    'server/mail.js',
    'utf8'
  )

const bookingCore =
  fs.readFileSync(
    'server/routes/booking-core.routes.js',
    'utf8'
  )

const bookingState =
  fs.readFileSync(
    'server/routes/booking-state.routes.js',
    'utf8'
  )

const verification =
  fs.readFileSync(
    'server/routes/admin-verification.routes.js',
    'utf8'
  )

const privacy =
  fs.readFileSync(
    'server/routes/account-privacy.routes.js',
    'utf8'
  )

const app =
  fs.readFileSync(
    'server/relational/app.js',
    'utf8'
  )

for (const template of [
  'verifyEmail:',
  'resetPassword:',
  'subscriptionActive:',
  'paymentFailed:',
  'verificationDecision:',
  'newBooking:',
  'bookingCancelled:',
  'bookingCompleted:',
  'accountDeleted:'
]) {
  assert.ok(
    mail.includes(template),
    `Transactional mail template missing: ${template}`
  )
}

for (const token of [
  'Users,',
  'mail,',
  'await Users.byId(',
  '.newBooking(',
  'professionalUser.email',
  'professionalUser.name'
]) {
  assert.ok(
    bookingCore.includes(token),
    `Booking-core mail invariant missing: ${token}`
  )
}

assert.ok(
  bookingCore.indexOf('await Bookings.create(') <
    bookingCore.indexOf('.newBooking('),
  'New-booking email must follow successful booking creation'
)

for (const token of [
  'Users,',
  'mail',
  "status==='cancelled'",
  "status==='completed'",
  '.bookingCancelled(',
  '.bookingCompleted(',
  'recipient.email',
  'recipient.name'
]) {
  assert.ok(
    bookingState.includes(token),
    `Booking-state mail invariant missing: ${token}`
  )
}

assert.ok(
  bookingState.indexOf('await Bookings.update(') <
    bookingState.indexOf('.bookingCancelled('),
  'Cancellation email must follow booking state persistence'
)

assert.ok(
  bookingState.indexOf('await Bookings.update(') <
    bookingState.indexOf('.bookingCompleted('),
  'Completion email must follow booking state persistence'
)

for (const token of [
  'mail,',
  '.verificationDecision(',
  'u.email',
  'u.name',
  'approved,',
  'note'
]) {
  assert.ok(
    verification.includes(token),
    `Verification mail invariant missing: ${token}`
  )
}

for (const token of [
  'mail,',
  '.accountDeleted(',
  'u.email',
  'u.name',
  "'privacy.account_deleted'"
]) {
  assert.ok(
    privacy.includes(token),
    `Account deletion mail invariant missing: ${token}`
  )
}

assert.ok(
  privacy.indexOf("'privacy.account_deleted'") <
    privacy.indexOf('.accountDeleted('),
  'Account deletion confirmation must follow deletion audit'
)

function registrationBetween(startToken, endToken) {
  const start = app.indexOf(startToken)
  const end = app.indexOf(endToken, start)

  assert.ok(
    start >= 0 && end > start,
    `Could not isolate registration: ${startToken}`
  )

  return app.slice(start, end)
}

const bookingStateRegistration =
  registrationBetween(
    'registerBookingStateRoutes(',
    'registerBookingCommunicationRoutes('
  )

assert.ok(
  bookingStateRegistration.includes('Users,') &&
  bookingStateRegistration.includes('mail'),
  'Booking-state registration must pass Users + mail'
)

const privacyRegistration =
  registrationBetween(
    'registerAccountPrivacyRoutes(',
    '// Geocoding with persistent cache'
  )

assert.ok(
  privacyRegistration.includes('mail,'),
  'Account-privacy registration must pass mail'
)

console.log(
  'MELEO transactional mail lifecycle self-test: OK'
)