import { test, expect, Page } from '@playwright/test'

async function loginProfessional(page: Page) {
  await page.goto('/login')

  await expect(
    page.getByRole('heading', { name: 'Καλώς ήρθες ξανά' })
  ).toBeVisible()

  await page.getByRole('button', {
    name: 'Επαγγελματίας',
    exact: true
  }).click()

  await page.getByRole('button', {
    name: 'Σύνδεση',
    exact: true
  }).last().click()

  await expect.poll(
    () => new URL(page.url()).pathname,
    { timeout: 10_000 }
  ).not.toBe('/login')
}

test.describe('MELEO subscription flow', () => {

  test('professional can open subscription management', async ({ page }) => {
    await loginProfessional(page)

    // Ο demo professional μπορεί να βρίσκεται είτε στο κανονικό
    // dashboard είτε στη ροή onboarding.
    await expect(page.locator('body')).toContainText(
      /Professional|Συνδρομή|πακέτο|επαγγελματικ/i
    )

    const subscriptionButton = page.getByRole('button', {
      name: 'Συνδρομή',
      exact: true
    })

    if (await subscriptionButton.count()) {
      await subscriptionButton.click()

      await expect(page.locator('body')).toContainText(
        /Συνδρομή MELEO|Η συνδρομή σου|BASIC|PREMIUM/i
      )
    }
  })


  test('professional subscription API returns billing state', async ({
    page
  }) => {
    await loginProfessional(page)

    const response = await page.request.get(
      'http://localhost:8787/api/professional/subscription'
    )

    expect(response.ok()).toBeTruthy()

    const data = await response.json()
	
	expect(['basic', 'premium']).toContain(data.plan)
expect([
  'active',
  'past_due',
  'cancelled',
  'pending',
  'none'
]).toContain(data.status)

expect(['demo', 'stripe']).toContain(data.billingMode)

    expect(data).toBeTruthy()

    console.log(
      'SUBSCRIPTION BEFORE:',
      JSON.stringify(data, null, 2)
    )
  })


test('professional can change subscription plan in demo checkout', async ({
  page
}) => {
  await loginProfessional(page)

  /*
   * Normalize test state.
   * Προηγούμενα E2E runs μπορεί να έχουν αφήσει
   * τη demo συνδρομή σε cancelled κατάσταση.
   */
  const normalizeResponse = await page.request.post(
    'http://localhost:8787/api/professional/subscription/resume'
  )

  expect(normalizeResponse.ok()).toBeTruthy()

  /*
   * Διαβάζουμε την αρχική κατάσταση.
   */
  const beforeResponse = await page.request.get(
    'http://localhost:8787/api/professional/subscription'
  )

  expect(beforeResponse.ok()).toBeTruthy()

  const before = await beforeResponse.json()

  console.log(
    'BEFORE PLAN CHANGE:',
    JSON.stringify(before, null, 2)
  )

  expect(['basic', 'premium']).toContain(before.plan)
  expect(before.status).toBe('active')
  expect(before.billingMode).toBe('demo')

  /*
   * Υποχρεωτικά αλλάζουμε σε διαφορετικό πακέτο.
   */
  const targetPlan =
    before.plan === 'premium'
      ? 'basic'
      : 'premium'

  expect(targetPlan).not.toBe(before.plan)

  /*
   * Εκτελούμε demo checkout.
   */
  const checkoutResponse = await page.request.post(
    'http://localhost:8787/api/professional/subscription/checkout',
    {
      data: {
        plan: targetPlan
      }
    }
  )

  expect(checkoutResponse.ok()).toBeTruthy()

  const checkout = await checkoutResponse.json()

  console.log(
    'CHECKOUT RESULT:',
    JSON.stringify(checkout, null, 2)
  )

  expect(checkout.mode).toBe('demo')

  expect(
    checkout.professional.subscriptionPlan
  ).toBe(targetPlan)

  expect(
    checkout.professional.subscriptionStatus
  ).toBe('active')

  /*
   * Ξαναδιαβάζουμε τη subscription state
   * ώστε να αποδείξουμε ότι η αλλαγή αποθηκεύτηκε.
   */
  const afterResponse = await page.request.get(
    'http://localhost:8787/api/professional/subscription'
  )

  expect(afterResponse.ok()).toBeTruthy()

  const after = await afterResponse.json()

  console.log(
    'SUBSCRIPTION AFTER:',
    JSON.stringify(after, null, 2)
  )

  expect(after.plan).toBe(targetPlan)
  expect(after.status).toBe('active')
  expect(after.billingMode).toBe('demo')

  /*
   * Βασικό regression assertion:
   * το τελικό πακέτο πρέπει να είναι διαφορετικό
   * από το αρχικό.
   */
  expect(after.plan).not.toBe(before.plan)
})


 test('subscription survives browser reload', async ({ page }) => {
  await loginProfessional(page)

  const beforeResponse = await page.request.get(
    'http://localhost:8787/api/professional/subscription'
  )

  expect(beforeResponse.ok()).toBeTruthy()

  const before = await beforeResponse.json()

  expect(['basic', 'premium']).toContain(before.plan)
  expect(before.status).toBeTruthy()

  const expectedPlan = before.plan
  const expectedStatus = before.status

  await page.reload()

  await expect(
    page.locator('body')
  ).toContainText(
    /Professional|Συνδρομή|πακέτο|Επισκόπηση|Αιτήματα/i
  )

  const afterResponse = await page.request.get(
    'http://localhost:8787/api/professional/subscription'
  )

  expect(afterResponse.ok()).toBeTruthy()

  const after = await afterResponse.json()

  expect(after.plan).toBe(expectedPlan)
  expect(after.status).toBe(expectedStatus)
})

test('professional can cancel subscription in demo mode', async ({
  page
}) => {
  await loginProfessional(page)

  /*
   * Normalize state:
   * αν προηγούμενο test/run άφησε τη συνδρομή cancelled,
   * την επαναφέρουμε πρώτα σε active.
   */
  const normalizeResponse = await page.request.post(
    'http://localhost:8787/api/professional/subscription/resume'
  )

  expect(normalizeResponse.ok()).toBeTruthy()

  const beforeResponse = await page.request.get(
    'http://localhost:8787/api/professional/subscription'
  )

  expect(beforeResponse.ok()).toBeTruthy()

  const before = await beforeResponse.json()

  expect(before.status).toBe('active')
  expect(['basic', 'premium']).toContain(before.plan)

  /*
   * Cancel.
   */
  const cancelResponse = await page.request.post(
    'http://localhost:8787/api/professional/subscription/cancel'
  )

  expect(cancelResponse.ok()).toBeTruthy()

  const cancelled = await cancelResponse.json()

  expect(
    cancelled.professional.subscriptionStatus
  ).toBe('cancelled')

  /*
   * Επιβεβαιώνουμε ότι αποθηκεύτηκε πραγματικά.
   */
  const afterResponse = await page.request.get(
    'http://localhost:8787/api/professional/subscription'
  )

  expect(afterResponse.ok()).toBeTruthy()

  const after = await afterResponse.json()

  expect(after.status).toBe('cancelled')
  expect(after.plan).toBe(before.plan)
})


test('professional can resume cancelled subscription in demo mode', async ({
  page
}) => {
  await loginProfessional(page)

  /*
   * Φέρνουμε πρώτα τη συνδρομή σε cancelled κατάσταση,
   * ώστε το test να είναι deterministic.
   */
  const cancelResponse = await page.request.post(
    'http://localhost:8787/api/professional/subscription/cancel'
  )

  expect(cancelResponse.ok()).toBeTruthy()

  const cancelled = await cancelResponse.json()

  expect(
    cancelled.professional.subscriptionStatus
  ).toBe('cancelled')

  const resumeResponse = await page.request.post(
    'http://localhost:8787/api/professional/subscription/resume'
  )

  expect(resumeResponse.ok()).toBeTruthy()

  const resumed = await resumeResponse.json()

  expect(
    resumed.professional.subscriptionStatus
  ).toBe('active')

  const afterResponse = await page.request.get(
    'http://localhost:8787/api/professional/subscription'
  )

  expect(afterResponse.ok()).toBeTruthy()

  const after = await afterResponse.json()

  expect(after.status).toBe('active')
})

})