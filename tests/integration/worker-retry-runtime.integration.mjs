import crypto from 'node:crypto'
import pg from 'pg'

const sourceDatabaseUrl =
  String(
    process.env.DATABASE_URL||
    ''
  ).trim()

if(!sourceDatabaseUrl){
  throw new Error(
    'DATABASE_URL is required for D10F.6'
  )
}

if(
  String(
    process.env.NODE_ENV||
    ''
  ).toLowerCase()==='production'
){
  throw new Error(
    'D10F.6 refuses NODE_ENV=production'
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
    `D10F.6 refuses non-local PostgreSQL host: ${sourceUrl.hostname}`
  )
}


const databaseName =
  'meleo_d10f6_' +
  crypto
    .randomUUID()
    .replace(/-/g,'')


function databaseUrl(
  name
){
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
      `[FAIL] ${message}` +
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
    client=>
      client.query(
        `CREATE DATABASE "${databaseName}"`
      )
  )

  console.log(
    '[PASS] isolated D10F.6 PostgreSQL database created'
  )
}


async function dropDatabase(){

  await admin(
    async client=>{

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
      async client=>{

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

        return result.rowCount>0
      }
    )

  check(
    !exists,
    'isolated D10F.6 database cleanup verified'
  )
}


let closePool=null
let sql=null
let one=null
let migrate=null


try{

  await createDatabase()

  process.env.DATABASE_URL =
    isolatedUrl

  process.env.DATABASE_SSL =
    '0'

  process.env.DATABASE_POOL_MAX =
    '12'

  process.env.NODE_ENV =
    'test'

  process.env.REDIS_URL =
    ''

  process.env.REDIS_REQUIRED =
    '0'

  process.env.SENSITIVE_DATA_KEY =
    crypto
      .randomBytes(32)
      .toString('hex')


  const poolModule =
    await import(
      '../../server/relational/pool.js'
    )

  ;({
    sql,
    one,
    migrate,
    closePool
  } = poolModule)


  const {
    createJobRuntime,
    retryDelaySeconds
  } =
    await import(
      '../../server/services/job-runtime.service.js'
    )


  const {
    enqueue,
    queueStats
  } =
    await import(
      '../../server/jobs.js'
    )


  check(
    typeof createJobRuntime===
      'function',
    'production job runtime service loaded'
  )

  check(
    retryDelaySeconds(1)===15 &&
    retryDelaySeconds(2)===30 &&
    retryDelaySeconds(3)===60 &&
    retryDelaySeconds(20)===3600,
    'production exponential backoff contract verified'
  )


  await migrate()

  check(
    true,
    'production migrations completed'
  )


  const noopLog={
    info(){},
    warn(){},
    error(){}
  }


  function runtime(
    workerId,
    execute
  ){
    return createJobRuntime({
      tx:
        poolModule.tx,
      sql,
      execute,
      observeJob:()=>{},
      log:noopLog,
      workerId
    })
  }


  // ==========================================================
  // A. ENQUEUE + QUEUE STATS
  // ==========================================================

  console.log('')
  console.log(
    'D10F.6.A — enqueue and queue stats'
  )


  const statsBefore =
    await queueStats()

  const enqueueId =
    await enqueue(
      'd10f6_noop',
      {
        case:'enqueue'
      },
      {
        priority:90,
        maxAttempts:5
      }
    )


  const enqueued =
    await one(
      `
        SELECT
          id,
          job_type,
          status,
          priority,
          attempts,
          max_attempts

        FROM background_jobs

        WHERE id=$1
      `,
      [
        enqueueId
      ]
    )


  check(
    enqueued?.job_type===
      'd10f6_noop' &&
    enqueued?.status===
      'pending' &&
    Number(enqueued?.priority)===90 &&
    Number(enqueued?.attempts)===0 &&
    Number(enqueued?.max_attempts)===5,
    'production enqueue persists canonical pending job'
  )


  const statsAfter =
    await queueStats()

  check(
    Number(statsAfter.pending)===
      Number(statsBefore.pending)+1,
    'queueStats reflects pending enqueue'
  )


  await sql(
    `
      DELETE FROM background_jobs
      WHERE id=$1
    `,
    [
      enqueueId
    ]
  )


  // ==========================================================
  // B. PRIORITY + FUTURE RUN_AT EXCLUSION
  // ==========================================================

  console.log('')
  console.log(
    'D10F.6.B — priority and future scheduling'
  )


  const ids = {
    future:
      'job_d10f6_future',
    low:
      'job_d10f6_low',
    high:
      'job_d10f6_high'
  }


  await sql(
    `
      INSERT INTO background_jobs(
        id,
        job_type,
        payload,
        status,
        priority,
        max_attempts,
        run_at
      )
      VALUES
        (
          $1,
          'd10f6_test',
          '{}'::jsonb,
          'pending',
          1,
          5,
          now()+interval '1 hour'
        ),
        (
          $2,
          'd10f6_test',
          '{}'::jsonb,
          'pending',
          100,
          5,
          now()
        ),
        (
          $3,
          'd10f6_test',
          '{}'::jsonb,
          'pending',
          10,
          5,
          now()
        )
    `,
    [
      ids.future,
      ids.low,
      ids.high
    ]
  )


  const priorityRuntime =
    runtime(
      'd10f6-priority-worker',
      async()=>{}
    )


  const firstPriority =
    await priorityRuntime.claim()


  check(
    firstPriority?.id===
      ids.high,
    'ready job with highest priority is claimed first'
  )


  await priorityRuntime.run(
    firstPriority
  )


  const secondPriority =
    await priorityRuntime.claim()


  check(
    secondPriority?.id===
      ids.low,
    'second ready priority job is claimed next'
  )


  await priorityRuntime.run(
    secondPriority
  )


  const noFutureClaim =
    await priorityRuntime.claim()


  check(
    noFutureClaim===null,
    'future run_at job is not claimed'
  )


  // ==========================================================
  // C. CONCURRENT CLAIM — EXACTLY ONE WINNER
  // ==========================================================

  console.log('')
  console.log(
    'D10F.6.C — concurrent SKIP LOCKED claim'
  )


  await sql(
    `
      DELETE FROM background_jobs
    `
  )


  await sql(
    `
      INSERT INTO background_jobs(
        id,
        job_type,
        payload,
        status,
        priority,
        max_attempts,
        run_at
      )
      VALUES(
        'job_d10f6_race',
        'd10f6_race',
        '{}'::jsonb,
        'pending',
        20,
        5,
        now()
      )
    `
  )


  const workerA =
    runtime(
      'd10f6-worker-a',
      async()=>{}
    )

  const workerB =
    runtime(
      'd10f6-worker-b',
      async()=>{}
    )


  const race =
    await Promise.all([
      workerA.claim(),
      workerB.claim()
    ])


  const winners =
    race.filter(
      Boolean
    )


  check(
    winners.length===1,
    'two concurrent workers produce exactly one claim winner'
  )


  const claimedRace =
    await one(
      `
        SELECT
          status,
          attempts,
          locked_by,
          locked_at IS NOT NULL "hasLock"

        FROM background_jobs

        WHERE id='job_d10f6_race'
      `
    )


  check(
    claimedRace?.status===
      'processing' &&
    Number(
      claimedRace?.attempts
    )===1 &&
    Boolean(
      claimedRace?.hasLock
    ),
    'claim atomically marks processing and increments attempts once'
  )


  check(
    [
      'd10f6-worker-a',
      'd10f6-worker-b'
    ].includes(
      claimedRace?.locked_by
    ),
    'claim records authoritative worker owner'
  )


  const winningRuntime =
    claimedRace.locked_by===
      'd10f6-worker-a'
      ? workerA
      : workerB


  await winningRuntime.run(
    winners[0]
  )


  const completedRace =
    await one(
      `
        SELECT
          status,
          attempts,
          locked_by,
          locked_at,
          completed_at

        FROM background_jobs

        WHERE id='job_d10f6_race'
      `
    )


  check(
    completedRace?.status===
      'completed' &&
    Number(
      completedRace?.attempts
    )===1 &&
    completedRace?.locked_by===
      null &&
    completedRace?.locked_at===
      null &&
    completedRace?.completed_at,
    'successful execution clears locks and marks completed'
  )


  // ==========================================================
  // D. RETRY + BACKOFF
  // ==========================================================

  console.log('')
  console.log(
    'D10F.6.D — retry and exponential backoff'
  )


  await sql(
    `
      DELETE FROM background_jobs
    `
  )


  await sql(
    `
      INSERT INTO background_jobs(
        id,
        job_type,
        payload,
        status,
        priority,
        attempts,
        max_attempts,
        run_at
      )
      VALUES(
        'job_d10f6_retry',
        'd10f6_retry',
        '{}'::jsonb,
        'pending',
        20,
        0,
        4,
        now()
      )
    `
  )


  let failureCount=0

  const retryRuntime =
    runtime(
      'd10f6-retry-worker',
      async()=>{
        failureCount++
        throw new Error(
          `D10F6_INJECTED_FAILURE_${failureCount}`
        )
      }
    )


  const retryClaim1 =
    await retryRuntime.claim()

  const beforeFailure1 =
    Date.now()

  const retryResult1 =
    await retryRuntime.run(
      retryClaim1
    )


  check(
    retryResult1?.status===
      'pending' &&
    retryResult1?.retry===
      true &&
    retryResult1?.delaySeconds===
      15,
    'first failure schedules 15-second retry'
  )


  const retryRow1 =
    await one(
      `
        SELECT
          status,
          attempts,
          locked_at,
          locked_by,
          last_error,
          extract(
            epoch from run_at
          )*1000 "runAtMs"

        FROM background_jobs

        WHERE id='job_d10f6_retry'
      `
    )


  check(
    retryRow1?.status===
      'pending' &&
    Number(
      retryRow1?.attempts
    )===1 &&
    retryRow1?.locked_at===
      null &&
    retryRow1?.locked_by===
      null &&
    String(
      retryRow1?.last_error||
      ''
    ).includes(
      'D10F6_INJECTED_FAILURE_1'
    ),
    'retry clears lock, preserves error, and remains pending'
  )


  const retryDelay1 =
    Number(
      retryRow1?.runAtMs
    )-
    beforeFailure1


  check(
    retryDelay1>=13000 &&
    retryDelay1<=20000,
    'first persisted retry run_at is approximately 15 seconds'
  )


  /*
   * Force the retry ready without waiting 15 real seconds.
   * This changes only the test fixture timestamp, not production logic.
   */
  await sql(
    `
      UPDATE background_jobs
      SET run_at=now()
      WHERE id='job_d10f6_retry'
    `
  )


  const retryClaim2 =
    await retryRuntime.claim()

  const retryResult2 =
    await retryRuntime.run(
      retryClaim2
    )


  check(
    Number(
      retryClaim2?.attempts
    )===2 &&
    retryResult2?.delaySeconds===
      30,
    'second claim increments attempts and schedules 30-second retry'
  )


  const retryRow2 =
    await one(
      `
        SELECT
          status,
          attempts,
          last_error

        FROM background_jobs

        WHERE id='job_d10f6_retry'
      `
    )


  check(
    retryRow2?.status===
      'pending' &&
    Number(
      retryRow2?.attempts
    )===2 &&
    String(
      retryRow2?.last_error||
      ''
    ).includes(
      'D10F6_INJECTED_FAILURE_2'
    ),
    'second retry persists updated attempt/error state'
  )


  // ==========================================================
  // E. DEAD LETTER / MAX ATTEMPTS
  // ==========================================================

  console.log('')
  console.log(
    'D10F.6.E — terminal failed state'
  )


  await sql(
    `
      DELETE FROM background_jobs
    `
  )


  await sql(
    `
      INSERT INTO background_jobs(
        id,
        job_type,
        payload,
        status,
        priority,
        attempts,
        max_attempts,
        run_at
      )
      VALUES(
        'job_d10f6_dead',
        'd10f6_dead',
        '{}'::jsonb,
        'pending',
        20,
        1,
        2,
        now()
      )
    `
  )


  const deadRuntime =
    runtime(
      'd10f6-dead-worker',
      async()=>{
        throw new Error(
          'D10F6_TERMINAL_FAILURE'
        )
      }
    )


  const deadClaim =
    await deadRuntime.claim()


  check(
    Number(
      deadClaim?.attempts
    )===2,
    'terminal claim reaches max_attempts exactly'
  )


  const deadResult =
    await deadRuntime.run(
      deadClaim
    )


  check(
    deadResult?.status===
      'failed' &&
    deadResult?.terminal===
      true &&
    deadResult?.retry===
      false &&
    deadResult?.delaySeconds===
      null,
    'max-attempt failure becomes terminal dead-letter'
  )


  const deadRow =
    await one(
      `
        SELECT
          status,
          attempts,
          locked_at,
          locked_by,
          last_error

        FROM background_jobs

        WHERE id='job_d10f6_dead'
      `
    )


  check(
    deadRow?.status===
      'failed' &&
    Number(
      deadRow?.attempts
    )===2 &&
    deadRow?.locked_at===
      null &&
    deadRow?.locked_by===
      null &&
    String(
      deadRow?.last_error||
      ''
    ).includes(
      'D10F6_TERMINAL_FAILURE'
    ),
    'dead-letter row preserves terminal error and releases lock'
  )


  const statsDead =
    await queueStats()


  check(
    Number(
      statsDead.failed
    )===1,
    'queueStats reports terminal failed job'
  )


  // ==========================================================
  // F. STALE LOCK RECOVERY
  // ==========================================================

  console.log('')
  console.log(
    'D10F.6.F — stale processing lock recovery'
  )


  await sql(
    `
      DELETE FROM background_jobs
    `
  )


  await sql(
    `
      INSERT INTO background_jobs(
        id,
        job_type,
        payload,
        status,
        priority,
        attempts,
        max_attempts,
        run_at,
        locked_at,
        locked_by,
        last_error
      )
      VALUES
        (
          'job_d10f6_stale',
          'd10f6_stale',
          '{}'::jsonb,
          'processing',
          20,
          1,
          5,
          now(),
          now()-interval '11 minutes',
          'dead-worker',
          'previous failure'
        ),
        (
          'job_d10f6_fresh_lock',
          'd10f6_stale',
          '{}'::jsonb,
          'processing',
          20,
          1,
          5,
          now(),
          now()-interval '1 minute',
          'live-worker',
          null
        )
    `
  )


  const recoveryRuntime =
    runtime(
      'd10f6-recovery-worker',
      async()=>{}
    )


  const recoveredCount =
    await recoveryRuntime.recoverStale()


  check(
    recoveredCount===1,
    'stale recovery touches exactly expired processing lock'
  )


  const staleRow =
    await one(
      `
        SELECT
          status,
          locked_at,
          locked_by,
          last_error

        FROM background_jobs

        WHERE id='job_d10f6_stale'
      `
    )


  check(
    staleRow?.status===
      'pending' &&
    staleRow?.locked_at===
      null &&
    staleRow?.locked_by===
      null &&
    String(
      staleRow?.last_error||
      ''
    ).includes(
      '[stale lock recovered]'
    ),
    'expired processing lock is safely returned to pending'
  )


  const freshLockRow =
    await one(
      `
        SELECT
          status,
          locked_by

        FROM background_jobs

        WHERE id='job_d10f6_fresh_lock'
      `
    )


  check(
    freshLockRow?.status===
      'processing' &&
    freshLockRow?.locked_by===
      'live-worker',
    'non-stale processing lock is not recovered'
  )


  // ==========================================================
  // G. ACCOUNT-DELETION RETRY NON-RECURSION CONTRACT
  // ==========================================================

  console.log('')
  console.log(
    'D10F.6.G — account deletion retry non-recursion'
  )


  const {
    Users,
    Professionals,
    audit
  } =
    await import(
      '../../server/relational/repositories.js'
    )


  const {
    createAccountDeletionService
  } =
    await import(
      '../../server/services/account-deletion.service.js'
    )


  const suffix =
    crypto
      .randomUUID()
      .replace(/-/g,'')

  const userId =
    `d10f6_user_${suffix}`

  const professionalId =
    `d10f6_pro_${suffix}`


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
        accepted_terms_at,
        deletion_pending,
        deletion_requested_at
      )
      VALUES(
        $1,
        'professional',
        'D10F6 Retry User',
        $2,
        '',
        'd10f6-hash',
        true,
        now(),
        true,
        now()
      )
    `,
    [
      userId,
      `${userId}@test.invalid`
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
        subscription_price,
        billing_mode,
        stripe_subscription_id,
        onboarding_completed,
        onboarding_stage
      )
      VALUES(
        $1,
        $2,
        'D10F6 Professional',
        'Νοσηλευτική',
        true,
        'active',
        'basic',
        9.99,
        'stripe',
        'sub_d10f6_retry',
        true,
        'profile'
      )
    `,
    [
      professionalId,
      userId
    ]
  )


  await sql(
    `
      DELETE FROM background_jobs
    `
  )


  await sql(
    `
      INSERT INTO background_jobs(
        id,
        job_type,
        payload,
        status,
        priority,
        attempts,
        max_attempts,
        run_at
      )
      VALUES(
        'job_d10f6_delete_retry',
        'account_deletion_retry',
        $1::jsonb,
        'processing',
        20,
        1,
        48,
        now()
      )
    `,
    [
      JSON.stringify({
        userId
      })
    ]
  )


  const deletionService =
    createAccountDeletionService({
      Users,
      Professionals,
      many:
        poolModule.many,
      tx:
        poolModule.tx,
      audit,
      deleteVerificationObject:
        async()=>{},
      getStripe:
        ()=>null,
      now:
        poolModule.now,
      id:
        poolModule.id
    })


  let deletionRetryError=null


  try{
    await deletionService.retry(
      userId
    )
  }
  catch(error){
    deletionRetryError=
      error
  }


  check(
    deletionRetryError?.code===
      'ACCOUNT_DELETION_STRIPE_UNAVAILABLE',
    'worker-mode deletion retry fails loudly when Stripe is unavailable'
  )


  const recoveryJobs =
    await sql(
      `
        SELECT
          id,
          status

        FROM background_jobs

        WHERE
          job_type='account_deletion_retry'
          AND payload->>'userId'=$1
      `,
      [
        userId
      ]
    )


  check(
    recoveryJobs.rowCount===1 &&
    recoveryJobs.rows[0]?.id===
      'job_d10f6_delete_retry',
    'account deletion retry does not recursively enqueue another recovery job'
  )


  const pendingUser =
    await one(
      `
        SELECT
          deletion_pending

        FROM users

        WHERE id=$1
      `,
      [
        userId
      ]
    )


  check(
    pendingUser?.deletion_pending===
      true,
    'failed deletion retry preserves durable deletion_pending state'
  )


  console.log('')
  console.log(
    'MELEO D10F.6 worker / retry runtime integration: OK'
  )

}
catch(error){

  console.error('')
  console.error(
    error?.stack||
    error
  )

  process.exitCode=1

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
      error?.message||
      error
    )
    process.exitCode=1
  }

  try{
    await dropDatabase()
  }
  catch(error){
    console.error(
      '[FAIL] database cleanup:',
      error?.stack||
      error
    )
    process.exitCode=1
  }
}