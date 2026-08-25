import {
  test,
  expect,
  type APIRequestContext
} from '@playwright/test'

const API =
  process.env.E2E_API_URL ||
  'http://localhost:8787'

const PATIENT = {
  email: 'patient@meleo.gr',
  password: 'demo123'
}

const PROFESSIONAL = {
  email: 'maria@meleo.gr',
  password: 'demo123'
}

const OTHER_PROFESSIONAL = {
  email: 'nikos@meleo.gr',
  password: 'demo123'
}

async function login(
  request: APIRequestContext,
  email: string,
  password: string
) {
  const response = await request.post(
    `${API}/api/auth/login`,
    {
      data: {
        email,
        password
      }
    }
  )

  expect(
    response.ok(),
    `Login failed for ${email}: ${await response.text()}`
  ).toBeTruthy()
}

async function createContext(
  playwright: any,
  account: {
    email: string
    password: string
  }
) {
  const context =
    await playwright.request.newContext({
      baseURL: API
    })

  await login(
    context,
    account.email,
    account.password
  )

  return context
}

async function getBooking(
  context: APIRequestContext,
  bookingId: string
) {
  const response =
    await context.get('/api/bookings')

  expect(response.ok()).toBeTruthy()

const body =
  await response.json()

const bookings =
  Array.isArray(body)
    ? body
    : body.items || []

return bookings.find(
  (booking: any) =>
    booking.id === bookingId
)
}
test.describe('MELEO booking chat', () => {

  test(
    'patient and assigned professional can exchange messages securely',
    async ({ playwright }) => {

      const patient =
        await createContext(
          playwright,
          PATIENT
        )

      const professional =
        await createContext(
          playwright,
          PROFESSIONAL
        )

      const outsider =
        await createContext(
          playwright,
          OTHER_PROFESSIONAL
        )

      try {

        /*
         * --------------------------------------------------
         * 1. CREATE A FRESH BOOKING
         * --------------------------------------------------
         */

        const tomorrow =
          new Date(
            Date.now() + 24 * 60 * 60 * 1000
          )
            .toISOString()
            .slice(0, 10)

        const bookingResponse =
          await patient.post(
            '/api/bookings',
            {
              data: {
                professionalId: 'p1',
                service:
                  'Απλή νοσηλευτική επίσκεψη',
                date: tomorrow,
                time: '11:30',
                address:
                  'E2E Chat Test Address',
                notes:
                  'Playwright chat integration test',
                repeat: 'once',
                contactConsent: true
              }
            }
          )

        expect(
          bookingResponse.ok(),
          `Booking creation failed: ${
            await bookingResponse.text()
          }`
        ).toBeTruthy()

const bookingBody =
  await bookingResponse.json()

const booking =
  bookingBody.booking ||
  bookingBody

expect(booking.id).toBeTruthy()
expect(booking.status).toBe('pending')

const bookingId = booking.id

        /*
         * --------------------------------------------------
         * 2. PATIENT SENDS MESSAGE
         * --------------------------------------------------
         */

        const patientMessage =
          `PATIENT-E2E-${Date.now()}`

        const patientMessageResponse =
          await patient.post(
            `/api/bookings/${bookingId}/message`,
            {
              data: {
                text: patientMessage
              }
            }
          )

        expect(
          patientMessageResponse.ok(),
          `Patient message failed: ${
            await patientMessageResponse.text()
          }`
        ).toBeTruthy()

const afterPatientMessageBody =
  await patientMessageResponse.json()

const afterPatientMessage =
  afterPatientMessageBody.booking ||
  afterPatientMessageBody

expect(
  afterPatientMessage.messages.some(
    (message: any) =>
      message.text === patientMessage &&
      message.fromRole === 'patient'
  )
).toBe(true)

        /*
         * --------------------------------------------------
         * 3. PROFESSIONAL CAN SEE PATIENT MESSAGE
         * --------------------------------------------------
         */

        const professionalBooking =
          await getBooking(
            professional,
            bookingId
          )

        expect(professionalBooking).toBeTruthy()

        expect(
          professionalBooking.messages.some(
            (message: any) =>
              message.text === patientMessage &&
              message.fromRole === 'patient'
          )
        ).toBe(true)

        /*
         * --------------------------------------------------
         * 4. ASSIGNED PROFESSIONAL REPLIES
         * --------------------------------------------------
         */

        const professionalReply =
          `PRO-E2E-${Date.now()}`

        const replyResponse =
          await professional.post(
            `/api/bookings/${bookingId}/message`,
            {
              data: {
                text: professionalReply
              }
            }
          )

        expect(
          replyResponse.ok(),
          `Professional reply failed: ${
            await replyResponse.text()
          }`
        ).toBeTruthy()

const afterReplyBody =
  await replyResponse.json()

const afterReply =
  afterReplyBody.booking ||
  afterReplyBody

expect(
  afterReply.messages.some(
    (message: any) =>
      message.text === professionalReply &&
      message.fromRole ===
        'professional'
  )
).toBe(true)

        /*
         * --------------------------------------------------
         * 5. PATIENT CAN SEE PROFESSIONAL REPLY
         * --------------------------------------------------
         */

        const patientBooking =
          await getBooking(
            patient,
            bookingId
          )

        expect(patientBooking).toBeTruthy()

        expect(
          patientBooking.messages.some(
            (message: any) =>
              message.text === professionalReply &&
              message.fromRole ===
                'professional'
          )
        ).toBe(true)

        /*
         * --------------------------------------------------
         * 6. UNRELATED PROFESSIONAL CANNOT WRITE
         * --------------------------------------------------
         */

        const outsiderWrite =
          await outsider.post(
            `/api/bookings/${bookingId}/message`,
            {
              data: {
                text:
                  'THIS MESSAGE MUST NEVER BE STORED'
              }
            }
          )

        expect(
          outsiderWrite.status()
        ).toBe(403)

        /*
         * --------------------------------------------------
         * 7. UNRELATED PROFESSIONAL CANNOT SEE BOOKING
         * --------------------------------------------------
         */

        const outsiderBookingsResponse =
          await outsider.get(
            '/api/bookings'
          )

        expect(
          outsiderBookingsResponse.ok()
        ).toBeTruthy()

const outsiderBookingsBody =
  await outsiderBookingsResponse.json()

const outsiderBookings =
  Array.isArray(outsiderBookingsBody)
    ? outsiderBookingsBody
    : outsiderBookingsBody.items || []

expect(
  outsiderBookings.some(
    (item: any) =>
      item.id === bookingId
  )
).toBe(false)

        /*
         * --------------------------------------------------
         * 8. VERIFY OUTSIDER MESSAGE WAS NOT STORED
         * --------------------------------------------------
         */

        const finalBooking =
          await getBooking(
            patient,
            bookingId
          )

        expect(
          finalBooking.messages.some(
            (message: any) =>
              message.text ===
              'THIS MESSAGE MUST NEVER BE STORED'
          )
        ).toBe(false)

        /*
         * --------------------------------------------------
         * 9. BOTH LEGITIMATE MESSAGES PERSIST
         * --------------------------------------------------
         */

        expect(
          finalBooking.messages.some(
            (message: any) =>
              message.text === patientMessage
          )
        ).toBe(true)

        expect(
          finalBooking.messages.some(
            (message: any) =>
              message.text === professionalReply
          )
        ).toBe(true)
      }
      finally {
        await patient.dispose()
        await professional.dispose()
        await outsider.dispose()
      }
    }
  )


  test(
    'anonymous user cannot post booking messages',
    async ({ request }) => {

      const response =
        await request.post(
          `${API}/api/bookings/non-existent/message`,
          {
            data: {
              text: 'anonymous attack'
            }
          }
        )

      expect(
        response.status()
      ).toBe(401)
    }
  )


  test(
    'empty messages are rejected',
    async ({ playwright }) => {

      const patient =
        await createContext(
          playwright,
          PATIENT
        )

      try {
        const bookingsResponse =
          await patient.get(
            '/api/bookings'
          )

        expect(
          bookingsResponse.ok()
        ).toBeTruthy()

const bookingsBody =
  await bookingsResponse.json()

const bookings =
  Array.isArray(bookingsBody)
    ? bookingsBody
    : bookingsBody.items || []

const openBooking =
  bookings.find(
            (booking: any) =>
              ![
                'cancelled',
                'completed'
              ].includes(
                booking.status
              )
          )

        expect(
          openBooking,
          'No open booking available for empty-message test'
        ).toBeTruthy()

        const response =
          await patient.post(
            `/api/bookings/${openBooking.id}/message`,
            {
              data: {
                text: '   '
              }
            }
          )

        expect(
          response.status()
        ).toBe(400)
      }
      finally {
        await patient.dispose()
      }
    }
  )

})