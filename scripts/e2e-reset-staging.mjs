import pg from 'pg'

const {
  DATABASE_URL = '',
  NODE_ENV = '',
  E2E_MODE = ''
} = process.env

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL missing')
}

if (NODE_ENV !== 'staging') {
  throw new Error(
    `Refusing E2E reset outside staging. NODE_ENV=${NODE_ENV}`
  )
}

if (E2E_MODE !== '1') {
  throw new Error(
    'Refusing E2E reset because E2E_MODE is not 1'
  )
}

const needsSsl =
  /[?&]sslmode=require/i.test(DATABASE_URL) ||
  process.env.DATABASE_SSL === '1'

const db = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: needsSsl
    ? { rejectUnauthorized: false }
    : undefined
})

await db.connect()

try {
  await db.query('BEGIN')

  /*
   * --------------------------------------------------
   * Known MELEO demo identities
   * --------------------------------------------------
   */

  const demoUserIds = [
    'u_patient',
    'u_nurse1',
    'u_nurse2'
  ]

  /*
   * Find any professional profile accidentally created
   * for the demo patient.
   */
  const accidentalProfessional =
    await db.query(
      `
      SELECT id
      FROM professionals
      WHERE user_id = 'u_patient'
      `
    )

  const accidentalProfessionalIds =
    accidentalProfessional.rows.map(
      row => row.id
    )

  console.log(
    'Accidental patient professional profiles:',
    accidentalProfessionalIds
  )

  /*
   * --------------------------------------------------
   * 1. Remove bookings belonging to the demo patient.
   *
   * booking_messages / reviews cascade from bookings.
   * --------------------------------------------------
   */

  await db.query(
    `
    DELETE FROM bookings
    WHERE patient_id = 'u_patient'
    `
  )

  /*
   * If the patient was accidentally converted into a
   * professional, remove bookings pointing to that
   * accidental professional profile as well.
   */
  if (accidentalProfessionalIds.length) {
    await db.query(
      `
      DELETE FROM bookings
      WHERE professional_id = ANY($1::text[])
      `,
      [accidentalProfessionalIds]
    )
  }

  /*
   * --------------------------------------------------
   * 2. Clean support/report data tied to demo patient.
   * These do not all have ON DELETE CASCADE.
   * --------------------------------------------------
   */

  await db.query(
    `
    DELETE FROM support_messages
    WHERE sender_user_id = 'u_patient'
    `
  )

  await db.query(
    `
    DELETE FROM support_tickets
    WHERE user_id = 'u_patient'
    `
  )

  await db.query(
    `
    DELETE FROM reports
    WHERE reporter_user_id = 'u_patient'
    `
  )

  /*
   * --------------------------------------------------
   * 3. Remove accidental professional profile.
   *
   * Dependent verification/subscription/analytics rows
   * cascade through professionals.
   * --------------------------------------------------
   */

  await db.query(
    `
    DELETE FROM professionals
    WHERE user_id = 'u_patient'
    `
  )

  /*
   * --------------------------------------------------
   * 4. Restore patient identity.
   * --------------------------------------------------
   */

  const patientUpdate =
    await db.query(
      `
      UPDATE users
      SET
        role = 'patient',
        account_status = 'active',
        suspended_at = NULL,
        suspension_reason = '',
        deletion_pending = false,
        deletion_requested_at = NULL
      WHERE id = 'u_patient'
      RETURNING id, role, email
      `
    )

  if (patientUpdate.rowCount !== 1) {
    throw new Error(
      'u_patient was not found in staging database'
    )
  }

  /*
   * --------------------------------------------------
   * 5. Restore the two canonical demo professionals.
   * --------------------------------------------------
   */

  await db.query(
    `
    UPDATE users
    SET
      role = 'professional',
      account_status = 'active',
      suspended_at = NULL,
      suspension_reason = ''
    WHERE id IN ('u_nurse1', 'u_nurse2')
    `
  )

  await db.query(
    `
    UPDATE professionals
    SET
      verified = true,
      subscription_status = 'active',
      billing_mode = 'demo',
      onboarding_completed = true,
      onboarding_stage = 'approved',
      admin_suspended = false
    WHERE id IN ('p1', 'p2')
    `
  )

  await db.query(
    `
    UPDATE professionals
    SET
      subscription_plan = 'premium',
      subscription_price = 14.99,
      featured = true
    WHERE id = 'p1'
    `
  )

  await db.query(
    `
    UPDATE professionals
    SET
      subscription_plan = 'basic',
      subscription_price = 9.99,
      featured = false
    WHERE id = 'p2'
    `
  )

  /*
   * --------------------------------------------------
   * 6. Remove old sessions for demo identities.
   *
   * Important: forces every E2E run to authenticate
   * against the newly restored roles.
   * --------------------------------------------------
   */

  await db.query(
    `
    DELETE FROM sessions
    WHERE user_id = ANY($1::text[])
    `,
    [demoUserIds]
  )

  /*
   * --------------------------------------------------
   * 7. Clear disposable notifications generated by E2E.
   * --------------------------------------------------
   */

  await db.query(
    `
    DELETE FROM notifications
    WHERE user_id = ANY($1::text[])
    `,
    [demoUserIds]
  )

  await db.query('COMMIT')

  /*
   * --------------------------------------------------
   * Verification
   * --------------------------------------------------
   */

  const users =
    await db.query(
      `
      SELECT id, role, email
      FROM users
      WHERE id = ANY($1::text[])
      ORDER BY id
      `,
      [demoUserIds]
    )

  const patientProfessional =
    await db.query(
      `
      SELECT id, user_id
      FROM professionals
      WHERE user_id = 'u_patient'
      `
    )

  const pros =
    await db.query(
      `
      SELECT
        id,
        user_id,
        subscription_plan,
        subscription_status,
        verified,
        onboarding_stage
      FROM professionals
      WHERE id IN ('p1', 'p2')
      ORDER BY id
      `
    )

  console.log('\n===== USERS =====')
  console.table(users.rows)

  console.log(
    '\n===== PATIENT PROFESSIONAL PROFILE ====='
  )

  console.table(patientProfessional.rows)

  console.log(
    '\n===== DEMO PROFESSIONALS ====='
  )

  console.table(pros.rows)

  console.log(
    '\nMELEO staging E2E state reset completed.'
  )
}
catch (error) {
  await db.query('ROLLBACK').catch(() => {})
  console.error(error)
  process.exitCode = 1
}
finally {
  await db.end()
}