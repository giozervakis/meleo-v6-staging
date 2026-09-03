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

const accountDeletion =
  fs.readFileSync(
    'server/services/account-deletion.service.js',
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
  'emailRecipient.email',
  'emailRecipient.name',
  'async client=>',
  'client'
]) {
  assert.ok(
    bookingState.includes(token),
    `Booking-state mail invariant missing: ${token}`
  )
}

assert.ok(
  bookingState.indexOf('await Bookings.transition(') <
    bookingState.indexOf('.bookingCancelled('),
  'Cancellation email handoff must be owned by booking transition'
)

assert.ok(
  bookingState.indexOf('await Bookings.transition(') <
    bookingState.indexOf('.bookingCompleted('),
  'Completion email handoff must be owned by booking transition'
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

/*
 * D10E.10D moved account deletion persistence into the canonical
 * account-deletion service.
 *
 * The HTTP route sends confirmation mail only after the service has
 * completed deletion successfully and returned the original address/name.
 */
for (const token of [
  'mail,',
  '.accountDeleted(',
  'result.email',
  'result.name',
  'await accountDeletion.request('
]) {
  assert.ok(
    privacy.includes(token),
    `Account deletion route mail invariant missing: ${token}`
  )
}

for (const token of [
  "'privacy.account_deleted'",
  'email:user.email',
  'name:user.name',
  'await finalizeDeletion('
]) {
  assert.ok(
    accountDeletion.includes(token),
    `Account deletion service mail invariant missing: ${token}`
  )
}

const finalDeletionCall =
  accountDeletion.indexOf(
    'await finalizeDeletion('
  )

const resultEmail =
  accountDeletion.indexOf(
    'email:user.email',
    finalDeletionCall
  )

assert.ok(
  finalDeletionCall >= 0 &&
  resultEmail > finalDeletionCall,
  'Account deletion service exposes mail identity only after final deletion'
)

assert.ok(
  privacy.indexOf(
    'await accountDeletion.request('
  ) <
  privacy.indexOf(
    '.accountDeleted('
  ),
  'Account deletion confirmation mail must follow canonical deletion completion'
)

assert.ok(
  privacy.indexOf(
    'result.email'
  ) <
  privacy.indexOf(
    '.accountDeleted('
  ),
  'Account deletion confirmation uses identity returned after deletion completion'
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
    'registerLocationRoutes({'
  )

assert.ok(
  privacyRegistration.includes('mail,'),
  'Account-privacy registration must pass mail'
)

console.log(
  'MELEO transactional mail lifecycle self-test: OK'
)