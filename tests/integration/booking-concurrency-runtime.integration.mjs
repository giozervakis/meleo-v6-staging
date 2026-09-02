import crypto from 'node:crypto'
import pg from 'pg'

const sourceDatabaseUrl =
  String(
    process.env.DATABASE_URL ||
    ''
  ).trim()

if(!sourceDatabaseUrl){
  throw new Error(
    'DATABASE_URL is required for D10F.4'
  )
}

if(
  String(
    process.env.NODE_ENV ||
    ''
  ).toLowerCase()==='production'
){
  throw new Error(
    'D10F.4 refuses NODE_ENV=production'
  )
}


const sourceUrl =
  new URL(
    sourceDatabaseUrl
  )

const allowedHosts =
  new Set([
    '127.0.0.1',
    'localhost',
    'db'
  ])

if(
  !allowedHosts.has(
    sourceUrl.hostname
  )
){
  throw new Error(
    `D10F.4 refuses non-local PostgreSQL host: ${sourceUrl.hostname}`
  )
}


const databaseName =
  'meleo_d10f4_' +
  crypto
    .randomUUID()
    .replace(/-/g,'')


function databaseUrl(name){

  const url =
    new URL(
      sourceDatabaseUrl
    )

  url.pathname =
    `/${name}`

  return url.toString()
}


const maintenanceUrl =
  databaseUrl(
    'postgres'
  )

const isolatedUrl =
  databaseUrl(
    databaseName
  )


function check(
  condition,
  message,
  detail=''
){

  if(!condition){

    throw new Error(
      '[FAIL] ' +
      message +
      (
        detail
          ? ` — ${detail}`
          : ''
      )
    )
  }

  console.log(
    `[PASS] ${message}`
  )
}


async function withClient(
  connectionString,
  fn
){

  const client =
    new pg.Client({
      connectionString
    })

  await client.connect()

  try{
    return await fn(
      client
    )
  }
  finally{
    await client.end()
  }
}


async function admin(fn){

  return withClient(
    maintenanceUrl,
    fn
  )
}


async function createDatabase(){

  await admin(
    client =>
      client.query(
        `CREATE DATABASE "${databaseName}"`
      )
  )

  console.log(
    '[PASS] isolated D10F.4 PostgreSQL database created'
  )
}


async function dropDatabase(){

  await admin(
    async client => {

      await client.query(
        `
          SELECT
            pg_terminate_backend(pid)

          FROM pg_stat_activity

          WHERE
            datname=$1
            AND pid<>pg_backend_pid()
        `,
        [
          databaseName
        ]
      )

      await client.query(
        `DROP DATABASE IF EXISTS "${databaseName}"`
      )
    }
  )


  const exists =
    await admin(
      async client => {

        const result =
          await client.query(
            `
              SELECT 1
              FROM pg_database
              WHERE datname=$1
            `,
            [
              databaseName
            ]
          )

        return (
          result.rowCount>0
        )
      }
    )


  check(
    !exists,
    'isolated D10F.4 database cleanup verified'
  )
}


const suffix =
  crypto
    .randomUUID()
    .replace(/-/g,'')

const patientId =
  `d10f4_patient_${suffix}`

const professionalUserId =
  `d10f4_pro_user_${suffix}`

const professionalId =
  `d10f4_pro_${suffix}`

const bookingA =
  `d10f4_booking_a_${suffix}`

const bookingB =
  `d10f4_booking_b_${suffix}`

const createRollbackBooking =
  `d10f4_create_rollback_${suffix}`

const transitionRollbackBooking =
  `d10f4_transition_rollback_${suffix}`

const invalidRecipient =
  `d10f4_missing_user_${suffix}`

const visitDate =
  '2099-11-21'

const raceTime =
  '10:15'

const createRollbackTime =
  '11:15'

const transitionRollbackTime =
  '12:15'


let closePool =
  null

let sql =
  null

let migrate =
  null

let Bookings =
  null


try{

  await createDatabase()


  /*
   * Production configuration must see the isolated database
   * before pool/repository modules are imported.
   */
  process.env.DATABASE_URL =
    isolatedUrl

  process.env.DATABASE_SSL =
    '0'

  process.env.DATABASE_POOL_MAX =
    '8'

  process.env.NODE_ENV =
    'test'

  process.env.REDIS_URL =
    ''

  process.env.REDIS_REQUIRED =
    '0'

  process.env.SENSITIVE_DATA_KEY =
    process.env.SENSITIVE_DATA_KEY ||
    crypto
      .randomBytes(32)
      .toString('hex')


  const poolModule =
    await import(
      '../../server/relational/pool.js'
    )

  sql =
    poolModule.sql

  migrate =
    poolModule.migrate

  closePool =
    poolModule.closePool


  const repositoryModule =
    await import(
      '../../server/relational/repositories.js'
    )

  Bookings =
    repositoryModule.Bookings


  check(
    typeof Bookings?.create==='function',
    'production Bookings.create loaded'
  )

  check(
    typeof Bookings?.transition==='function',
    'production Bookings.transition loaded'
  )


  await migrate()

  check(
    true,
    'production migrations completed on isolated database'
  )


  const index =
    await sql(
      `
        SELECT
          indexname,
          indexdef

        FROM pg_indexes

        WHERE
          schemaname='public'
          AND tablename='bookings'
          AND indexname=
            'bookings_professional_active_slot_unique_idx'
      `
    )

  check(
    index.rowCount===1,
    'active-slot unique index exists'
  )


  /*
   * Deterministic fixtures.
   */
  await sql(
    `
      INSERT INTO users(
        id,
        role,
        name,
        email,
        phone,
        password_hash,
        email_verified,
        accepted_terms_at
      )
      VALUES
        (
          $1,
          'patient',
          'D10F4 Patient',
          $2,
          '',
          'd10f4-not-login-hash',
          true,
          now()
        ),
        (
          $3,
          'professional',
          'D10F4 Professional',
          $4,
          '',
          'd10f4-not-login-hash',
          true,
          now()
        )
    `,
    [
      patientId,
      `${patientId}@test.invalid`,
      professionalUserId,
      `${professionalUserId}@test.invalid`
    ]
  )


  await sql(
    `
      INSERT INTO professionals(
        id,
        user_id,
        title,
        specialty,
        verified,
        subscription_status,
        subscription_plan,
        onboarding_completed
      )
      VALUES(
        $1,
        $2,
        'D10F4 Professional',
        'Νοσηλευτική',
        true,
        'active',
        'premium',
        true
      )
    `,
    [
      professionalId,
      professionalUserId
    ]
  )

  check(
    true,
    'deterministic D10F.4 fixtures created'
  )


  // ==========================================================
  // TEST A
  // CONCURRENT SAME-SLOT CREATION
  // ==========================================================

  console.log('')
  console.log(
    'D10F.4.A — concurrent same-slot creation'
  )


  function creation(
    bookingId
  ){

    return Bookings.create(
      {
        id:
          bookingId,

        patientId,

        professionalId,

        service:
          'D10F.4 concurrent booking',

        date:
          visitDate,

        time:
          raceTime,

        address:
          'D10F4',

        notes:
          'concurrent-create',

        repeat:
          'Μία φορά',

        price:
          25
      },
      {
        userId:
          professionalUserId,

        type:
          'd10f4-create',

        title:
          'D10F4 create race',

        body:
          bookingId,

        options:{
          actionType:
            'booking',

          actionId:
            bookingId,

          actionUrl:
            '/dashboard'
        }
      }
    )
  }


  /*
   * Do not await either operation before both have been started.
   */
  const createResults =
    await Promise.allSettled([
      creation(
        bookingA
      ),

      creation(
        bookingB
      )
    ])


  const createSuccesses =
    createResults
      .map(
        (
          result,
          index
        ) => ({
          result,
          bookingId:
            index===0
              ? bookingA
              : bookingB
        })
      )
      .filter(
        item =>
          item.result.status===
          'fulfilled'
      )


  const createFailures =
    createResults
      .filter(
        result =>
          result.status===
          'rejected'
      )


  check(
    createSuccesses.length===1,
    'same-slot race has exactly one successful creation'
  )

  check(
    createFailures.length===1,
    'same-slot race has exactly one rejected creation'
  )

  check(
    createFailures[0]?.reason?.code===
      '23505',
    'losing same-slot creation is rejected by PostgreSQL uniqueness'
  )


  const createWinnerId =
    createSuccesses[0]
      .bookingId


  const activeSlotRows =
    await sql(
      `
        SELECT
          id,
          status

        FROM bookings

        WHERE
          professional_id=$1
          AND visit_date=$2::date
          AND visit_time=$3::time
          AND status IN(
            'pending',
            'clarification',
            'quoted',
            'accepted'
          )
      `,
      [
        professionalId,
        visitDate,
        raceTime
      ]
    )


  check(
    activeSlotRows.rowCount===1 &&
    activeSlotRows.rows[0]?.id===
      createWinnerId,
    'exactly one authoritative active booking survives'
  )


  const createNotifications =
    await sql(
      `
        SELECT
          action_id

        FROM notifications

        WHERE
          user_id=$1
          AND type='d10f4-create'
      `,
      [
        professionalUserId
      ]
    )


  check(
    createNotifications.rowCount===1 &&
    createNotifications.rows[0]?.action_id===
      createWinnerId,
    'losing create transaction leaves no orphan durable notification'
  )


  const createLiveEvents =
    await sql(
      `
        SELECT
          id

        FROM live_events

        WHERE
          user_id=$1
          AND payload->>'kind'=
            'notification.created'
          AND payload->'notification'->>'type'=
            'd10f4-create'
      `,
      [
        professionalUserId
      ]
    )


  check(
    createLiveEvents.rowCount===1,
    'losing create transaction leaves no orphan live event'
  )


  // ==========================================================
  // TEST B
  // CONCURRENT SAME-STATE TRANSITION
  // ==========================================================

  console.log('')
  console.log(
    'D10F.4.B — concurrent same-state transition'
  )


  const transitionRequests =
    [
      {
        target:
          'accepted',

        marker:
          'accept'
      },

      {
        target:
          'cancelled',

        marker:
          'cancel'
      }
    ]


  const transitionResults =
    await Promise.all(
      transitionRequests.map(
        request =>
          Bookings.transition(
            createWinnerId,
            'pending',
            {
              status:
                request.target
            },
            {
              userId:
                patientId,

              type:
                'd10f4-transition',

              title:
                `D10F4 ${request.marker}`,

              body:
                request.target,

              options:{
                actionType:
                  'booking',

                actionId:
                  createWinnerId,

                actionUrl:
                  '/patient'
              }
            }
          )
      )
    )


  const transitionWinners =
    transitionResults
      .map(
        (
          result,
          index
        ) => ({
          result,
          target:
            transitionRequests[
              index
            ].target
        })
      )
      .filter(
        item =>
          item.result?.ok===
          true
      )


  const transitionLosers =
    transitionResults
      .filter(
        result =>
          result?.ok===
          false
      )


  check(
    transitionWinners.length===1,
    'same-state transition race has exactly one winner'
  )

  check(
    transitionLosers.length===1,
    'same-state transition race has exactly one loser'
  )

  check(
    transitionLosers[0]?.code===
      'BOOKING_STATE_CONFLICT',
    'losing transition receives BOOKING_STATE_CONFLICT'
  )


  const transitionWinnerStatus =
    transitionWinners[0]
      .target


  const transitionedBooking =
    await sql(
      `
        SELECT
          status

        FROM bookings

        WHERE id=$1
      `,
      [
        createWinnerId
      ]
    )


  check(
    transitionedBooking.rowCount===1 &&
    transitionedBooking.rows[0]?.status===
      transitionWinnerStatus,
    'database state equals the winning transition'
  )


  const transitionNotifications =
    await sql(
      `
        SELECT
          id,
          body

        FROM notifications

        WHERE
          user_id=$1
          AND type='d10f4-transition'
          AND action_id=$2
      `,
      [
        patientId,
        createWinnerId
      ]
    )


  check(
    transitionNotifications.rowCount===1,
    'losing transition leaves no orphan durable notification'
  )


  const transitionLiveEvents =
    await sql(
      `
        SELECT
          id

        FROM live_events

        WHERE
          user_id=$1
          AND payload->>'kind'=
            'notification.created'
          AND payload->'notification'->>'type'=
            'd10f4-transition'
          AND payload->'notification'->>'actionId'=$2
      `,
      [
        patientId,
        createWinnerId
      ]
    )


  check(
    transitionLiveEvents.rowCount===1,
    'losing transition leaves no orphan live event'
  )


  const activeAfterTransition =
    await sql(
      `
        SELECT
          count(*)::int count

        FROM bookings

        WHERE
          professional_id=$1
          AND visit_date=$2::date
          AND visit_time=$3::time
          AND status IN(
            'pending',
            'clarification',
            'quoted',
            'accepted'
          )
      `,
      [
        professionalId,
        visitDate,
        raceTime
      ]
    )


  const expectedActiveCount =
    transitionWinnerStatus===
      'cancelled'
        ? 0
        : 1


  check(
    Number(
      activeAfterTransition
        .rows?.[0]?.count ||
      0
    )===
      expectedActiveCount,
    'active-slot index state matches winning transition'
  )


  // ==========================================================
  // TEST C
  // CREATE TRANSACTION ROLLBACK WHEN NOTIFICATION FAILS
  // ==========================================================

  console.log('')
  console.log(
    'D10F.4.C — create atomic rollback'
  )


  let createRollbackError =
    null

  try{

    await Bookings.create(
      {
        id:
          createRollbackBooking,

        patientId,

        professionalId,

        service:
          'D10F4 create rollback',

        date:
          visitDate,

        time:
          createRollbackTime,

        price:
          25
      },
      {
        /*
         * users FK must fail after booking INSERT,
         * forcing rollback of the whole transaction.
         */
        userId:
          invalidRecipient,

        type:
          'd10f4-rollback',

        title:
          'must rollback',

        body:
          'must rollback',

        options:{
          actionType:
            'booking',

          actionId:
            createRollbackBooking
        }
      }
    )

  }
  catch(error){

    createRollbackError =
      error
  }


  check(
    createRollbackError?.code===
      '23503',
    'create side-effect failure reaches real PostgreSQL FK failure'
  )


  const rolledBackCreate =
    await sql(
      `
        SELECT
          count(*)::int count

        FROM bookings

        WHERE id=$1
      `,
      [
        createRollbackBooking
      ]
    )


  check(
    Number(
      rolledBackCreate
        .rows?.[0]?.count ||
      0
    )===0,
    'failed create side effect rolls booking INSERT back'
  )


  const rolledBackCreateNotifications =
    await sql(
      `
        SELECT
          count(*)::int count

        FROM notifications

        WHERE action_id=$1
      `,
      [
        createRollbackBooking
      ]
    )


  check(
    Number(
      rolledBackCreateNotifications
        .rows?.[0]?.count ||
      0
    )===0,
    'failed create transaction leaves no notification'
  )


  // ==========================================================
  // TEST D
  // TRANSITION TRANSACTION ROLLBACK WHEN NOTIFICATION FAILS
  // ==========================================================

  console.log('')
  console.log(
    'D10F.4.D — transition atomic rollback'
  )


  await Bookings.create(
    {
      id:
        transitionRollbackBooking,

      patientId,

      professionalId,

      service:
        'D10F4 transition rollback',

      date:
        visitDate,

      time:
        transitionRollbackTime,

      price:
        25
    },
    null
  )


  let transitionRollbackError =
    null

  try{

    await Bookings.transition(
      transitionRollbackBooking,
      'pending',
      {
        status:
          'accepted'
      },
      {
        userId:
          invalidRecipient,

        type:
          'd10f4-transition-rollback',

        title:
          'must rollback',

        body:
          'must rollback',

        options:{
          actionType:
            'booking',

          actionId:
            transitionRollbackBooking
        }
      }
    )

  }
  catch(error){

    transitionRollbackError =
      error
  }


  check(
    transitionRollbackError?.code===
      '23503',
    'transition side-effect failure reaches real PostgreSQL FK failure'
  )


  const rolledBackTransition =
    await sql(
      `
        SELECT
          status

        FROM bookings

        WHERE id=$1
      `,
      [
        transitionRollbackBooking
      ]
    )


  check(
    rolledBackTransition.rowCount===1 &&
    rolledBackTransition.rows[0]?.status===
      'pending',
    'failed transition side effect rolls state mutation back'
  )


  const transitionRollbackNotifications =
    await sql(
      `
        SELECT
          count(*)::int count

        FROM notifications

        WHERE action_id=$1
      `,
      [
        transitionRollbackBooking
      ]
    )


  check(
    Number(
      transitionRollbackNotifications
        .rows?.[0]?.count ||
      0
    )===0,
    'failed transition transaction leaves no notification'
  )


  // ==========================================================
  // FINAL DATABASE INVARIANTS
  // ==========================================================

  const duplicateGroups =
    await sql(
      `
        SELECT
          count(*)::int count

        FROM(
          SELECT
            professional_id,
            visit_date,
            visit_time

          FROM bookings

          WHERE status IN(
            'pending',
            'clarification',
            'quoted',
            'accepted'
          )

          GROUP BY
            professional_id,
            visit_date,
            visit_time

          HAVING count(*)>1
        ) conflicts
      `
    )


  check(
    Number(
      duplicateGroups
        .rows?.[0]?.count ||
      0
    )===0,
    'no duplicate active booking slot exists after all races'
  )


  console.log('')
  console.log(
    'MELEO D10F.4 booking concurrency runtime: OK'
  )
}
catch(error){

  console.error('')
  console.error(
    error?.stack ||
    error
  )

  process.exitCode =
    1
}
finally{

  try{
    if(closePool){
      await closePool()
    }
  }
  catch(error){
    console.error(
      '[FAIL] pool cleanup:',
      error?.message ||
      error
    )

    process.exitCode =
      1
  }

  try{
    await dropDatabase()
  }
  catch(error){
    console.error(
      '[FAIL] database cleanup:',
      error?.stack ||
      error
    )

    process.exitCode =
      1
  }
}