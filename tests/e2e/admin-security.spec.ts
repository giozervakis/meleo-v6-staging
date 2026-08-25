import { test, expect, type APIRequestContext } from '@playwright/test'
import { generateTotp } from './totp-helper'

const API =
  process.env.E2E_API_URL ||
  'http://localhost:8787'

const PATIENT_EMAIL = 'patient@meleo.gr'
const PATIENT_PASSWORD = 'demo123'

const PROFESSIONAL_EMAIL = 'maria@meleo.gr'
const PROFESSIONAL_PASSWORD = 'demo123'

const ADMIN_EMAIL = 'admin@meleo.gr'
const ADMIN_PASSWORD =
  process.env.E2E_ADMIN_PASSWORD || 'admin123'

const ADMIN_TOTP_SECRET =
  process.env.E2E_ADMIN_TOTP_SECRET || ''

async function login(
  request: APIRequestContext,
  email: string,
  password: string
) {
  const response = await request.post(`${API}/api/auth/login`, {
    data: {
  email,
  password,
  ...(email === ADMIN_EMAIL &&
  ADMIN_TOTP_SECRET
    ? {
        totp: generateTotp(
          ADMIN_TOTP_SECRET
        )
      }
    : {})
}
  })

  expect(
    response.ok(),
    `Login failed for ${email}: ${await response.text()}`
  ).toBeTruthy()

  return response
}

test.describe('MELEO Admin Security', () => {

  test('anonymous user cannot access admin endpoints', async ({
    request
  }) => {
    const endpoints = [
      '/api/admin/stats',
      '/api/admin/members',
      '/api/admin/audit',
      '/api/admin/insights',
      '/api/admin/bookings',
      '/api/admin/subscriptions',
      '/api/admin/verifications',
      '/api/admin/reports'
    ]

    for (const endpoint of endpoints) {
      const response = await request.get(`${API}${endpoint}`)

      expect(
        response.status(),
        `Anonymous access unexpectedly allowed: ${endpoint}`
      ).toBe(401)
    }
  })


  test('patient cannot access admin endpoints', async ({
    playwright
  }) => {
    const context = await playwright.request.newContext({
      baseURL: API
    })

await login(
  context,
  PATIENT_EMAIL,
  PATIENT_PASSWORD
)

    const endpoints = [
      '/api/admin/stats',
      '/api/admin/members',
      '/api/admin/audit',
      '/api/admin/insights',
      '/api/admin/bookings',
      '/api/admin/subscriptions',
      '/api/admin/verifications',
      '/api/admin/reports'
    ]

    for (const endpoint of endpoints) {
      const response = await context.get(endpoint)

      expect(
        response.status(),
        `Patient accessed admin endpoint: ${endpoint}`
      ).toBe(403)
    }

    await context.dispose()
  })


  test('professional cannot access admin endpoints', async ({
    playwright
  }) => {
    const context = await playwright.request.newContext({
      baseURL: API
    })

    await login(
  context,
  PROFESSIONAL_EMAIL,
  PROFESSIONAL_PASSWORD
)

    const endpoints = [
      '/api/admin/stats',
      '/api/admin/members',
      '/api/admin/audit',
      '/api/admin/insights',
      '/api/admin/bookings',
      '/api/admin/subscriptions',
      '/api/admin/verifications',
      '/api/admin/reports'
    ]

    for (const endpoint of endpoints) {
      const response = await context.get(endpoint)

      expect(
        response.status(),
        `Professional accessed admin endpoint: ${endpoint}`
      ).toBe(403)
    }

    await context.dispose()
  })


  test('admin can access protected admin endpoints', async ({
    playwright
  }) => {
    const context = await playwright.request.newContext({
      baseURL: API
    })

    await login(
  context,
  ADMIN_EMAIL,
  ADMIN_PASSWORD
)

    /*
     * Χρησιμοποιούμε read-only endpoints.
     * Δεν θέλουμε το security test να μεταβάλλει δεδομένα.
     */
    const endpoints = [
      '/api/admin/stats',
      '/api/admin/members',
      '/api/admin/audit',
      '/api/admin/insights',
      '/api/admin/bookings',
      '/api/admin/subscriptions',
      '/api/admin/verifications',
      '/api/admin/reports'
    ]

    for (const endpoint of endpoints) {
      const response = await context.get(endpoint)

      expect(
        response.ok(),
        `Admin denied from ${endpoint}: ${await response.text()}`
      ).toBeTruthy()
    }

    await context.dispose()
  })


  test('professional cannot perform admin member actions', async ({
    playwright
  }) => {
    const context = await playwright.request.newContext({
      baseURL: API
    })

    await login(
  context,
  PROFESSIONAL_EMAIL,
  PROFESSIONAL_PASSWORD
)

    /*
     * Ακόμη και αν γνωρίζει το user ID ενός άλλου χρήστη,
     * δεν πρέπει να μπορεί να εκτελέσει admin action.
     */
    const response = await context.patch(
      '/api/admin/members/u_patient/action',
      {
        data: {
          action: 'suspend',
          reason: 'security-e2e-test'
        }
      }
    )

    expect(response.status()).toBe(403)

    await context.dispose()
  })


  test('professional cannot self-verify through admin endpoint', async ({
    playwright
  }) => {
    const context = await playwright.request.newContext({
      baseURL: API
    })

    await login(
  context,
  PROFESSIONAL_EMAIL,
  PROFESSIONAL_PASSWORD
)

    /*
     * p1 είναι ο demo professional.
     *
     * Το endpoint είναι admin-only και επομένως
     * η προσπάθεια πρέπει να απορριφθεί ΠΡΙΝ γίνει
     * οποιαδήποτε μεταβολή.
     */
    const response = await context.patch(
      '/api/admin/members/u_nurse1/action',
      {
        data: {
          action: 'verify'
        }
      }
    )

    expect(response.status()).toBe(403)

    await context.dispose()
  })


  test('patient cannot perform admin member actions', async ({
    playwright
  }) => {
    const context = await playwright.request.newContext({
      baseURL: API
    })

    await login(
  context,
  PATIENT_EMAIL,
  PATIENT_PASSWORD
)

    const response = await context.patch(
      '/api/admin/members/u_nurse1/action',
      {
        data: {
          action: 'verify'
        }
      }
    )

    expect(response.status()).toBe(403)

    await context.dispose()
  })


  test('anonymous user cannot perform admin member actions', async ({
    request
  }) => {
    const response = await request.patch(
      `${API}/api/admin/members/u_nurse1/action`,
      {
        data: {
          action: 'verify'
        }
      }
    )

    expect(response.status()).toBe(401)
  })

})

