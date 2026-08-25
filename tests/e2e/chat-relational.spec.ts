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

  return response
}

async function createAuthenticatedContext(
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

async function unreadForBooking(
  context: APIRequestContext,
  bookingId: string
) {
  const response =
    await context.get('/api/bookings/unread')

  expect(
    response.ok(),
    `Unread endpoint failed: ${await response.text()}`
  ).toBeTruthy()

  const body = await response.json()

  const item =
    (body.items || []).find(
      (x: any) =>
        x.bookingId === bookingId
    )

  return {
    total: Number(body.total || 0),
    bookingUnread: Number(item?.unread || 0)
  }
}

async function waitForSseMessageCreated(
  context: APIRequestContext,
  bookingId: string,
  expectedText: string
) {
  /*
   * Παίρνουμε το session cookie από το
   * authenticated Playwright API context.
   */
  const state =
    await context.storageState()

  const apiHost = new URL(API).hostname

const cookieHeader =
  state.cookies
    .filter(cookie => {
      const domain =
        cookie.domain.startsWith('.')
          ? cookie.domain.slice(1)
          : cookie.domain

      return (
        domain === apiHost ||
        apiHost.endsWith(`.${domain}`)
      )
    })
    .map(
      cookie =>
        `${cookie.name}=${cookie.value}`
    )
    .join('; ')

  expect(
    cookieHeader.length,
    'Authenticated session cookie was not found'
  ).toBeGreaterThan(0)

  const controller =
    new AbortController()

  const timeout =
    setTimeout(
      () => controller.abort(),
      10_000
    )

  try {
    const response =
      await fetch(
        `${API}/api/live`,
        {
          headers: {
            cookie: cookieHeader
          },
          signal: controller.signal
        }
      )

    expect(response.ok).toBeTruthy()
    expect(response.body).toBeTruthy()

    const reader =
      response.body!.getReader()

    const decoder =
      new TextDecoder()

    let buffer = ''

    while (true) {
      const { value, done } =
        await reader.read()

      if (done) break

      buffer += decoder.decode(
        value,
        {
          stream: true
        }
      )

      const events =
        buffer.split('\n\n')

      buffer =
        events.pop() || ''

      for (const rawEvent of events) {

        const dataLine =
          rawEvent
            .split('\n')
            .find(
              line =>
                line.startsWith('data:')
            )

        if (!dataLine) continue

        const rawData =
          dataLine
            .slice(5)
            .trim()

        if (!rawData) continue

        let payload: any

        try {
          payload =
            JSON.parse(rawData)
        }
        catch {
          continue
        }

        if (
          payload?.kind ===
            'message.created' &&
          payload?.message?.bookingId ===
            bookingId &&
          payload?.message?.text ===
            expectedText
        ) {
          return payload
        }
      }
    }

    throw new Error(
      'SSE stream ended before expected message.created event'
    )
  }
  finally {
    clearTimeout(timeout)
    controller.abort()
  }
}

test.describe(
  'MELEO relational realtime messaging',
  () => {

    test.beforeEach(async ({ request }) => {

      /*
       * Αποτρέπουμε αυτό το test από το να
       * περάσει κατά λάθος πάνω στο legacy JSON backend.
       */
      const health =
        await request.get(
          `${API}/api/health`
        )

      expect(
        health.ok(),
        'Relational API is not running'
      ).toBeTruthy()

      const body =
        await health.json()

      expect(
        body?.storage?.database
      ).toBe('postgres-relational')
    })


    test(
      'unread counters and read acknowledgements work end-to-end',
      async ({ playwright }) => {

        const patient =
          await createAuthenticatedContext(
            playwright,
            PATIENT
          )

        const professional =
          await createAuthenticatedContext(
            playwright,
            PROFESSIONAL
          )

        try {

          /*
           * -------------------------------
           * 1. CREATE FRESH BOOKING
           * -------------------------------
           */

          const tomorrow =
            new Date(
              Date.now() +
              24 * 60 * 60 * 1000
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
                    'Relational E2E Test Address',
                  notes:
                    'Relational unread/read test',
                  repeat: 'once',
                  contactConsent: true
                }
              }
            )

          expect(
            bookingResponse.ok(),
            `Booking failed: ${
              await bookingResponse.text()
            }`
          ).toBeTruthy()

          const bookingBody =
            await bookingResponse.json()

          const booking =
            bookingBody.booking ||
            bookingBody

          expect(booking.id).toBeTruthy()

          const bookingId =
            booking.id


          /*
           * -------------------------------
           * 2. CLEAN INITIAL STATE
           * -------------------------------
           */

          const initialProUnread =
            await unreadForBooking(
              professional,
              bookingId
            )

          expect(
            initialProUnread.bookingUnread
          ).toBe(0)


          /*
           * -------------------------------
           * 3. PATIENT SENDS MESSAGE
           * -------------------------------
           */

          const patientText =
            `REL-PATIENT-${Date.now()}`

          const messageResponse =
            await patient.post(
              `/api/bookings/${bookingId}/message`,
              {
                data: {
                  text: patientText
                }
              }
            )

          expect(
            messageResponse.ok(),
            `Patient message failed: ${
              await messageResponse.text()
            }`
          ).toBeTruthy()


          /*
           * -------------------------------
           * 4. PROFESSIONAL UNREAD = 1
           * -------------------------------
           */

          const proUnread =
            await unreadForBooking(
              professional,
              bookingId
            )

          expect(
            proUnread.bookingUnread
          ).toBe(1)


          /*
           * -------------------------------
           * 5. PROFESSIONAL MARKS READ
           * -------------------------------
           */

          const readResponse =
            await professional.patch(
              `/api/bookings/${bookingId}/messages/read`
            )

          expect(
            readResponse.ok(),
            `Mark read failed: ${
              await readResponse.text()
            }`
          ).toBeTruthy()


          /*
           * -------------------------------
           * 6. PROFESSIONAL UNREAD = 0
           * -------------------------------
           */

          const proAfterRead =
            await unreadForBooking(
              professional,
              bookingId
            )

          expect(
            proAfterRead.bookingUnread
          ).toBe(0)


          /*
           * -------------------------------
           * 7. PROFESSIONAL REPLIES
           * -------------------------------
           */

          const replyText =
            `REL-PRO-${Date.now()}`

          const replyResponse =
            await professional.post(
              `/api/bookings/${bookingId}/message`,
              {
                data: {
                  text: replyText
                }
              }
            )

          expect(
            replyResponse.ok(),
            `Professional reply failed: ${
              await replyResponse.text()
            }`
          ).toBeTruthy()


          /*
           * -------------------------------
           * 8. PATIENT UNREAD = 1
           * -------------------------------
           */

          const patientUnread =
            await unreadForBooking(
              patient,
              bookingId
            )

          expect(
            patientUnread.bookingUnread
          ).toBe(1)


          /*
           * -------------------------------
           * 9. PATIENT MARKS READ
           * -------------------------------
           */

          const patientRead =
            await patient.patch(
              `/api/bookings/${bookingId}/messages/read`
            )

          expect(
            patientRead.ok()
          ).toBeTruthy()


          /*
           * -------------------------------
           * 10. PATIENT UNREAD = 0
           * -------------------------------
           */

          const patientAfterRead =
            await unreadForBooking(
              patient,
              bookingId
            )

          expect(
            patientAfterRead.bookingUnread
          ).toBe(0)

        }
        finally {
          await patient.dispose()
          await professional.dispose()
        }
      }
    )


    test(
      'professional receives patient message through PostgreSQL SSE',
      async ({ playwright }) => {

        const patient =
          await createAuthenticatedContext(
            playwright,
            PATIENT
          )

        const professional =
          await createAuthenticatedContext(
            playwright,
            PROFESSIONAL
          )

        try {

          const tomorrow =
            new Date(
              Date.now() +
              24 * 60 * 60 * 1000
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
                  time: '09:00',
                  address:
                    'SSE E2E Address',
                  notes:
                    'Postgres LISTEN NOTIFY test',
                  repeat: 'once',
                  contactConsent: true
                }
              }
            )

          expect(
            bookingResponse.ok()
          ).toBeTruthy()

          const body =
            await bookingResponse.json()

          const booking =
            body.booking || body

          const bookingId =
            booking.id

          expect(bookingId).toBeTruthy()

          const text =
            `SSE-E2E-${Date.now()}`


          /*
           * Σημαντικό:
           * ανοίγουμε πρώτα το SSE listener
           * και ΜΕΤΑ στέλνουμε το μήνυμα.
           */

          const ssePromise =
            waitForSseMessageCreated(
              professional,
              bookingId,
              text
            )

          /*
           * Δίνουμε ένα πολύ μικρό περιθώριο
           * ώστε το /api/live να έχει κάνει subscribe.
           */
          await new Promise(
            resolve =>
              setTimeout(resolve, 250)
          )

          const send =
            await patient.post(
              `/api/bookings/${bookingId}/message`,
              {
                data: {
                  text
                }
              }
            )

          expect(
            send.ok(),
            `Message send failed: ${
              await send.text()
            }`
          ).toBeTruthy()

          const event =
            await ssePromise

          expect(
            event.kind
          ).toBe('message.created')

          expect(
            event.message.bookingId
          ).toBe(bookingId)

          expect(
            event.message.text
          ).toBe(text)

          expect(
            event.message.senderRole
          ).toBe('patient')

          expect(
            event.message.recipientUserId
          ).toBe('u_nurse1')

          expect(
            event.message.delivered
          ).toBe(true)

          expect(
            event.message.read
          ).toBe(false)
        }
        finally {
          await patient.dispose()
          await professional.dispose()
        }
      }
    )

  }
)