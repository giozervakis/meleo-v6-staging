import { test, expect, Page } from '@playwright/test'

async function loginAsPatient(page: Page) {
  await page.goto('/login')

  await page
    .getByRole('button', { name: 'Συνοδός', exact: true })
    .click()

  await page
    .getByRole('button', { name: 'Σύνδεση', exact: true })
    .last()
    .click()

  await expect(
    page.getByRole('heading', {
      name: 'Η επόμενη φροντίδα σου'
    })
  ).toBeVisible()
}

test.describe('MELEO booking flow', () => {

  test('patient creates a real booking request', async ({ page }) => {

    await loginAsPatient(page)

    /*
     * 1. Άνοιγμα αναζήτησης
     */
    await page.goto('/search')

    await expect(
      page.getByRole('heading', {
        name: /Βρες τη σωστή φροντίδα/
      })
    ).toBeVisible()

    /*
     * 2. Βρίσκουμε έναν επαγγελματία.
     *
     * Δεν βασιζόμαστε σε συγκεκριμένο όνομα,
     * ώστε το test να μην σπάει αν αλλάξουν
     * τα demo δεδομένα.
     */
    const requestButton = page.getByRole('button', {
      name: /Ζήτησε επίσκεψη|Συνδέσου για αίτημα/
    }).first()

    /*
     * Αν το CTA δεν υπάρχει στη search page,
     * ανοίγουμε το πρώτο διαθέσιμο profile.
     */
    if (!(await requestButton.isVisible().catch(() => false))) {

      const profileLink = page
        .getByRole('button', {
          name: /Προβολή|Προφίλ|Δες προφίλ/
        })
        .first()

      if (await profileLink.isVisible().catch(() => false)) {
        await profileLink.click()
      } else {
        /*
         * Fallback:
         * click στο πρώτο professional card.
         */
        const card = page.locator(
          '.professional-card, .pro-card, [data-professional-id]'
        ).first()

        await expect(card).toBeVisible()
        await card.click()
      }
    }

    /*
     * 3. Profile
     */
    const bookingCTA = page.getByRole('button', {
      name: 'Ζήτησε επίσκεψη',
      exact: true
    })

    await expect(bookingCTA).toBeVisible()
    await bookingCTA.click()

    /*
     * 4. Booking Step 1
     */
    await expect(
      page.getByRole('heading', {
        name: 'Πότε χρειάζεσαι φροντίδα;'
      })
    ).toBeVisible()

    /*
     * Επιλέγουμε πρώτη πραγματική υπηρεσία.
     */
    const serviceSelect = page.getByLabel('Υπηρεσία')

    const serviceOptions =
      await serviceSelect.locator('option').count()

    expect(serviceOptions).toBeGreaterThan(0)

    if (serviceOptions > 1) {
      await serviceSelect.selectOption({ index: 1 })
    }

    /*
     * Ημερομηνία: αύριο.
     */
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)

    const yyyy = tomorrow.getFullYear()
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0')
    const dd = String(tomorrow.getDate()).padStart(2, '0')

    const bookingDate = `${yyyy}-${mm}-${dd}`

    await page
      .getByLabel('Ημερομηνία')
      .fill(bookingDate)

    /*
     * Επιλέγουμε διαθέσιμη ώρα.
     */
    const timeSelect = page.getByLabel('Ώρα')

    const timeOptions =
      await timeSelect.locator('option').count()

    expect(timeOptions).toBeGreaterThan(0)

    if (timeOptions > 1) {
      await timeSelect.selectOption({ index: 1 })
    }

    await page
      .getByRole('button', {
        name: /Συνέχεια/
      })
      .click()

    /*
     * 5. Booking Step 2
     */
    await expect(
      page.getByRole('heading', {
        name: 'Στοιχεία επίσκεψης'
      })
    ).toBeVisible()

    await page
      .getByPlaceholder('Οδός, αριθμός, περιοχή')
      .fill('Λεωφόρος Κνωσού 100, Ηράκλειο')

    /*
     * Δεν βάζουμε ιατρικά/ευαίσθητα δεδομένα
     * στο E2E fixture.
     */
    const notes = page.locator('textarea')

    if (await notes.isVisible().catch(() => false)) {
      await notes.fill('Playwright E2E booking test')
    }

    /*
     * Consent επικοινωνίας.
     */
    const consent = page.locator(
      '.booking-consent input[type="checkbox"]'
    )

    await expect(consent).toBeVisible()
    await consent.check()

    /*
     * 6. Παρακολουθούμε το πραγματικό POST.
     */
    const bookingResponsePromise =
      page.waitForResponse(response =>
        response.url().includes('/api/bookings') &&
        response.request().method() === 'POST'
      )

    const submitButton = page.getByRole('button', {
      name: 'Αποστολή αιτήματος',
      exact: true
    })

    await expect(submitButton).toBeEnabled()

    await submitButton.click()

    const bookingResponse =
      await bookingResponsePromise

    expect(
      bookingResponse.status(),
      `POST /api/bookings returned ${bookingResponse.status()}`
    ).toBeGreaterThanOrEqual(200)

    expect(
      bookingResponse.status()
    ).toBeLessThan(300)

    /*
     * 7. Success screen
     */
    await expect(
      page.getByRole('heading', {
        name: /Η κράτησή σου είναι σε αναμονή/
      })
    ).toBeVisible()

    await expect(
      page.getByRole('button', {
        name: 'Οι κρατήσεις μου',
        exact: true
      })
    ).toBeVisible()

    /*
     * 8. Patient dashboard
     */
    await page
      .getByRole('button', {
        name: 'Οι κρατήσεις μου',
        exact: true
      })
      .click()

    await expect(
      page.locator('body')
    ).toContainText(
      /Οι κρατήσεις μου|αναμονή|pending|επιβεβαίωση/i
    )
  })
})