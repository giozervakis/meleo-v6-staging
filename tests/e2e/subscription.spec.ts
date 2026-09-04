import { test, expect, Page } from '@playwright/test'

const API =
  process.env.E2E_API_URL ||
  'http://localhost:8787'

async function loginProfessional(page: Page) {
  await page.goto('/login')

  await expect(
    page.getByRole('heading', {
      name: 'Καλώς ήρθες ξανά'
    })
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

  test(
    'professional can open subscription management',
    async ({ page }) => {
      await loginProfessional(page)

      await expect(
        page.locator('body')
      ).toContainText(
        /Professional|Συνδρομή|πακέτο|επαγγελματικ/i
      )

      const subscriptionButton =
        page.getByRole('button', {
          name: 'Συνδρομή',
          exact: true
        })

      if (await subscriptionButton.count()) {
        await subscriptionButton.click()

        await expect(
          page.locator('body')
        ).toContainText(
          /Συνδρομή MELEO|Η συνδρομή σου|BASIC|PREMIUM/i
        )
      }
    }
  )

  test(
    'professional subscription API returns billing state',
    async ({ page }) => {
      await loginProfessional(page)

      const response =
        await page.request.get(
          `${API}/api/professional/subscription`
        )

      expect(
        response.ok(),
        `Subscription API failed: ${await response.text()}`
      ).toBeTruthy()

      const data =
        await response.json()

      expect([
        'basic',
        'premium'
      ]).toContain(data.plan)

      expect([
        'active',
        'past_due',
        'cancelled',
        'pending',
        'none'
      ]).toContain(data.status)

      expect([
        'demo',
        'stripe'
      ]).toContain(data.billingMode)

      expect(data).toBeTruthy()

      console.log(
        'SUBSCRIPTION BEFORE:',
        JSON.stringify(data, null, 2)
      )
    }
  )

  test(
    'professional can change subscription plan in demo checkout',
    async ({ page }) => {
      await loginProfessional(page)

      const normalizeResponse =
        await page.request.post(
          `${API}/api/professional/subscription/resume`
        )

      expect(
        normalizeResponse.ok(),
        `Subscription resume failed: ${
          await normalizeResponse.text()
        }`
      ).toBeTruthy()

      const beforeResponse =
        await page.request.get(
          `${API}/api/professional/subscription`
        )

      expect(
        beforeResponse.ok(),
        `Subscription read failed: ${
          await beforeResponse.text()
        }`
      ).toBeTruthy()

      const before =
        await beforeResponse.json()

      console.log(
        'BEFORE PLAN CHANGE:',
        JSON.stringify(before, null, 2)
      )

      expect([
        'basic',
        'premium'
      ]).toContain(before.plan)

      expect(before.status).toBe('active')

      expect(before.billingMode).toBe('demo')

      const targetPlan =
        before.plan === 'premium'
          ? 'basic'
          : 'premium'

      expect(targetPlan).not.toBe(before.plan)

      const checkoutResponse =
        await page.request.post(
          `${API}/api/professional/subscription/checkout`,
          {
            data: {
              plan: targetPlan
            }
          }
        )

      expect(
        checkoutResponse.ok(),
        `Checkout failed: ${
          await checkoutResponse.text()
        }`
      ).toBeTruthy()

      const checkout =
        await checkoutResponse.json()

      console.log(
        'CHECKOUT RESULT:',
        JSON.stringify(checkout, null, 2)
      )

      expect(checkout.mode).toBe('demo')

      if(before.plan==='premium'&&targetPlan==='basic'){
        expect(
          checkout.professional.subscriptionPlan
        ).toBe('premium')

        expect(checkout.scheduled).toBe(true)
        expect(checkout.scheduledPlan).toBe('basic')
        expect(checkout.scheduledPlanEffectiveAt).toBeTruthy()
      }else{
        expect(
          checkout.professional.subscriptionPlan
        ).toBe(targetPlan)
      }

      expect(
        checkout.professional.subscriptionStatus
      ).toBe('active')

      const afterResponse =
        await page.request.get(
          `${API}/api/professional/subscription`
        )

      expect(
        afterResponse.ok(),
        `Subscription re-read failed: ${
          await afterResponse.text()
        }`
      ).toBeTruthy()

      const after =
        await afterResponse.json()

      console.log(
        'SUBSCRIPTION AFTER:',
        JSON.stringify(after, null, 2)
      )

      if(before.plan==='premium'&&targetPlan==='basic'){
        expect(after.plan).toBe('premium')
        expect(after.scheduledPlan).toBe('basic')
        expect(after.scheduledPlanEffectiveAt).toBeTruthy()
      }else{
        expect(after.plan).toBe(targetPlan)
        expect(after.plan).not.toBe(before.plan)
      }

      expect(after.status).toBe('active')
      expect(after.billingMode).toBe('demo')
    }
  )

  test(
    'subscription survives browser reload',
    async ({ page }) => {
      await loginProfessional(page)

      const beforeResponse =
        await page.request.get(
          `${API}/api/professional/subscription`
        )

      expect(
        beforeResponse.ok(),
        `Subscription read failed: ${
          await beforeResponse.text()
        }`
      ).toBeTruthy()

      const before =
        await beforeResponse.json()

      expect([
        'basic',
        'premium'
      ]).toContain(before.plan)

      expect(before.status).toBeTruthy()

      const expectedPlan =
        before.plan

      const expectedStatus =
        before.status

      await page.reload()

      await expect(
        page.locator('body')
      ).toContainText(
        /Professional|Συνδρομή|πακέτο|Επισκόπηση|Αιτήματα/i
      )

      const afterResponse =
        await page.request.get(
          `${API}/api/professional/subscription`
        )

      expect(
        afterResponse.ok(),
        `Subscription re-read failed: ${
          await afterResponse.text()
        }`
      ).toBeTruthy()

      const after =
        await afterResponse.json()

      expect(after.plan).toBe(expectedPlan)
      expect(after.status).toBe(expectedStatus)
    }
  )

  test(
    'professional can cancel subscription in demo mode',
    async ({ page }) => {
      await loginProfessional(page)

      const normalizeResponse =
        await page.request.post(
          `${API}/api/professional/subscription/resume`
        )

      expect(
        normalizeResponse.ok(),
        `Subscription resume failed: ${
          await normalizeResponse.text()
        }`
      ).toBeTruthy()

      const beforeResponse =
        await page.request.get(
          `${API}/api/professional/subscription`
        )

      expect(
        beforeResponse.ok(),
        `Subscription read failed: ${
          await beforeResponse.text()
        }`
      ).toBeTruthy()

      const before =
        await beforeResponse.json()

      expect(before.status).toBe('active')

      expect([
        'basic',
        'premium'
      ]).toContain(before.plan)

      const cancelResponse =
        await page.request.post(
          `${API}/api/professional/subscription/cancel`
        )

      expect(
        cancelResponse.ok(),
        `Subscription cancel failed: ${
          await cancelResponse.text()
        }`
      ).toBeTruthy()

      const cancelled =
        await cancelResponse.json()

      expect(
        cancelled.professional.subscriptionStatus
      ).toBe('active')

      expect(
        cancelled.professional.cancelAtPeriodEnd
      ).toBe(true)

      expect(
        cancelled.professional.currentPeriodEnd
      ).toBeTruthy()

      const afterResponse =
        await page.request.get(
          `${API}/api/professional/subscription`
        )

      expect(
        afterResponse.ok(),
        `Subscription re-read failed: ${
          await afterResponse.text()
        }`
      ).toBeTruthy()

      const after =
        await afterResponse.json()

      expect(after.status).toBe('active')
      expect(after.cancelAtPeriodEnd).toBe(true)
      expect(after.currentPeriodEnd).toBeTruthy()
      expect(after.plan).toBe(before.plan)
    }
  )

  test(
    'professional can resume cancelled subscription in demo mode',
    async ({ page }) => {
      await loginProfessional(page)

      const cancelResponse =
        await page.request.post(
          `${API}/api/professional/subscription/cancel`
        )

      expect(
        cancelResponse.ok(),
        `Subscription cancel failed: ${
          await cancelResponse.text()
        }`
      ).toBeTruthy()

      const cancelled =
        await cancelResponse.json()

      expect(
        cancelled.professional.subscriptionStatus
      ).toBe('active')

      expect(
        cancelled.professional.cancelAtPeriodEnd
      ).toBe(true)

      const resumeResponse =
        await page.request.post(
          `${API}/api/professional/subscription/resume`
        )

      expect(
        resumeResponse.ok(),
        `Subscription resume failed: ${
          await resumeResponse.text()
        }`
      ).toBeTruthy()

      const resumed =
        await resumeResponse.json()

      expect(
        resumed.professional.subscriptionStatus
      ).toBe('active')

      expect(
        resumed.professional.cancelAtPeriodEnd
      ).toBe(false)

      const afterResponse =
        await page.request.get(
          `${API}/api/professional/subscription`
        )

      expect(
        afterResponse.ok(),
        `Subscription re-read failed: ${
          await afterResponse.text()
        }`
      ).toBeTruthy()

      const after =
        await afterResponse.json()

      expect(after.status).toBe('active')
      expect(after.cancelAtPeriodEnd).toBe(false)
    }
  )
})