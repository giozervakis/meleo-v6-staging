import crypto from 'node:crypto'
import pg from 'pg'

const { Pool } = pg

const databaseUrl = String(process.env.DATABASE_URL || '').trim()
const nodeEnv = String(process.env.NODE_ENV || '').trim().toLowerCase()
const allowProduction =
  String(process.env.MELEO_ALLOW_PRODUCTION_CONCURRENCY_TEST || '') === '1'

if (!databaseUrl) {
  console.error(
    'RC2-A6 requires DATABASE_URL pointing to a PostgreSQL test/staging database.'
  )
  process.exit(2)
}

if (nodeEnv === 'production' && !allowProduction) {
  console.error(
    'Refusing to run RC2-A6 with NODE_ENV=production. ' +
    'Use staging/test or explicitly set MELEO_ALLOW_PRODUCTION_CONCURRENCY_TEST=1.'
  )
  process.exit(2)
}

const needsSsl =
  /[?&]sslmode=require/.test(databaseUrl) ||
  String(process.env.DATABASE_SSL || '') === '1'

const pool = new Pool({
  connectionString: databaseUrl,
  max: 4,
  connectionTimeoutMillis: 10000,
  query_timeout: 20000,
  statement_timeout: 20000,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  application_name: 'meleo-rc2-a6-concurrency-test'
})

const suffix = crypto.randomUUID().replaceAll('-', '')
const patientId = `a6_patient_${suffix}`
const professionalUserId = `a6_prouser_${suffix}`
const professionalId = `a6_pro_${suffix}`
const bookingA = `a6_booking_a_${suffix}`
const bookingB = `a6_booking_b_${suffix}`

const visitDate = '2099-12-31'
const visitTime = '23:45'
const passwordHash = 'rc2-a6-test-only:not-a-real-password'

async function cleanup() {
  await pool.query(
    `DELETE FROM bookings WHERE id = ANY($1::text[])`,
    [[bookingA, bookingB]]
  ).catch(() => {})

  await pool.query(
    'DELETE FROM professionals WHERE id=$1',
    [professionalId]
  ).catch(() => {})

  await pool.query(
    `DELETE FROM users WHERE id = ANY($1::text[])`,
    [[patientId, professionalUserId]]
  ).catch(() => {})
}

async function insertBooking(client, id) {
  try {
    await client.query('BEGIN')

    await client.query(
      `
        INSERT INTO bookings(
          id,
          patient_id,
          professional_id,
          service,
          visit_date,
          visit_time,
          status,
          base_price
        )
        VALUES($1,$2,$3,$4,$5,$6,'pending',0)
      `,
      [
        id,
        patientId,
        professionalId,
        'RC2-A6 concurrency test',
        visitDate,
        visitTime
      ]
    )

    await client.query('SELECT pg_sleep(0.25)')
    await client.query('COMMIT')

    return {
      id,
      ok: true,
      code: null
    }
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {}

    return {
      id,
      ok: false,
      code: error?.code || null,
      constraint: error?.constraint || null,
      message: error?.message || String(error)
    }
  }
}

let clientA
let clientB

try {
  await cleanup()

  const indexCheck = await pool.query(
    `
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname='public'
        AND tablename='bookings'
        AND indexname='bookings_professional_active_slot_unique_idx'
    `
  )

  if (indexCheck.rowCount !== 1) {
    throw new Error(
      'Required unique index bookings_professional_active_slot_unique_idx is missing.'
    )
  }

  await pool.query(
    `
      INSERT INTO users(
        id,
        role,
        name,
        email,
        phone,
        password_hash,
        email_verified
      )
      VALUES
        ($1,'patient','RC2 A6 Patient',$2,'',$3,true),
        ($4,'professional','RC2 A6 Professional',$5,'',$3,true)
    `,
    [
      patientId,
      `${patientId}@test.invalid`,
      passwordHash,
      professionalUserId,
      `${professionalUserId}@test.invalid`
    ]
  )

  await pool.query(
    `
      INSERT INTO professionals(
        id,
        user_id,
        specialty,
        verified,
        subscription_status
      )
      VALUES($1,$2,'RC2-A6 Test',true,'active')
    `,
    [professionalId, professionalUserId]
  )

  clientA = await pool.connect()
  clientB = await pool.connect()

  const [resultA, resultB] = await Promise.all([
    insertBooking(clientA, bookingA),
    insertBooking(clientB, bookingB)
  ])

  const results = [resultA, resultB]
  const successful = results.filter(result => result.ok)
  const rejected = results.filter(result => !result.ok)
  const uniqueViolations = rejected.filter(result => result.code === '23505')

  const persisted = await pool.query(
    `
      SELECT id, status
      FROM bookings
      WHERE professional_id=$1
        AND visit_date=$2::date
        AND visit_time=$3::time
        AND status IN (
          'pending',
          'clarification',
          'quoted',
          'accepted'
        )
      ORDER BY id
    `,
    [professionalId, visitDate, visitTime]
  )

  console.log('')
  console.log('MELEO RC2-A6 concurrent double-booking test')
  console.log('===========================================')
  console.log(`professional : ${professionalId}`)
  console.log(`slot         : ${visitDate} ${visitTime}`)
  console.log(`request A    : ${JSON.stringify(resultA)}`)
  console.log(`request B    : ${JSON.stringify(resultB)}`)
  console.log(`successes    : ${successful.length}`)
  console.log(`rejections   : ${rejected.length}`)
  console.log(`23505        : ${uniqueViolations.length}`)
  console.log(`active rows  : ${persisted.rowCount}`)

  const pass =
    successful.length === 1 &&
    rejected.length === 1 &&
    uniqueViolations.length === 1 &&
    persisted.rowCount === 1 &&
    persisted.rows[0]?.id === successful[0]?.id

  if (!pass) {
    console.error('')
    console.error(
      'FAIL - expected exactly 1 successful booking, ' +
      '1 PostgreSQL 23505 rejection, and 1 persisted active booking.'
    )
    process.exitCode = 1
  } else {
    console.log('')
    console.log(
      'PASS - concurrent requests cannot create two active bookings for one slot.'
    )
  }
} catch (error) {
  console.error('')
  console.error('RC2-A6 ERROR:', error?.stack || error)
  process.exitCode = 1
} finally {
  if (clientA) clientA.release()
  if (clientB) clientB.release()

  await cleanup()
  await pool.end()
}