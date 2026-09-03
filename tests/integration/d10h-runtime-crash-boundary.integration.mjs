import crypto from 'node:crypto'
import pg from 'pg'


const sourceDatabaseUrl =
  String(
    process.env.DATABASE_URL||
    ''
  ).trim()


if(!sourceDatabaseUrl){
  throw new Error(
    'DATABASE_URL is required for D10H.7'
  )
}


if(
  String(
    process.env.NODE_ENV||
    ''
  ).toLowerCase()==='production'
){
  throw new Error(
    'D10H.7 refuses NODE_ENV=production'
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
    `D10H.7 refuses non-local PostgreSQL host: ${sourceUrl.hostname}`
  )
}


const databaseName =
  'meleo_d10h7_' +
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
    '[PASS] isolated D10H.7 PostgreSQL database created'
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

  console.log(
    '[PASS] isolated D10H.7 PostgreSQL database removed'
  )
}


let closePool=null
let sql=null
let one=null
let migrate=null
let tx=null


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
    tx,
    migrate,
    closePool
  } = poolModule)


  const {
    createJobRuntime
  } =
    await import(
      '../../server/services/job-runtime.service.js'
    )


  const {
    enqueue
  } =
    await import(
      '../../server/jobs.js'
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
      tx,
      sql,
      execute,
      observeJob:()=>{},
      log:noopLog,
      workerId
    })
  }


  /*
   * ==========================================================
   * A. CRASH AFTER CLAIM -> STALE RECOVERY
   * ==========================================================
   */

  console.log('')
  console.log(
    'D10H.7.A — crash after claim / stale lease recovery'
  )


  const crashJobId =
    await enqueue(
      'd10h7_crash_after_claim',
      {
        case:'crash_after_claim'
      },
      {
        maxAttempts:5
      }
    )


  const crashingWorker =
    runtime(
      'd10h7-crashed-worker',
      async()=>{}
    )


  const claimed =
    await crashingWorker.claim()


  check(
    claimed?.id===crashJobId,
    'job claimed before simulated worker crash'
  )


  const processing =
    await one(
      `
        SELECT
          status,
          attempts,
          locked_by,
          locked_at

        FROM background_jobs

        WHERE id=$1
      `,
      [
        crashJobId
      ]
    )


  check(
    processing?.status==='processing' &&
    Number(processing?.attempts)===1 &&
    processing?.locked_by==='d10h7-crashed-worker' &&
    Boolean(processing?.locked_at),
    'claimed job persists processing lease and attempt'
  )


  await sql(
    `
      UPDATE background_jobs
      SET locked_at=
        now()-interval '11 minutes'
      WHERE id=$1
    `,
    [
      crashJobId
    ]
  )


  const recoveryWorker =
    runtime(
      'd10h7-recovery-worker',
      async()=>{}
    )


  const recoveredCount =
    await recoveryWorker.recoverStale()


  check(
    Number(recoveredCount)===1,
    'stale processing job recovered'
  )


  const recovered =
    await one(
      `
        SELECT
          status,
          attempts,
          locked_by,
          locked_at,
          run_at,
          last_error

        FROM background_jobs

        WHERE id=$1
      `,
      [
        crashJobId
      ]
    )


  check(
    recovered?.status==='pending' &&
    Number(recovered?.attempts)===1 &&
    recovered?.locked_by===null &&
    recovered?.locked_at===null,
    'stale recovery restores pending claimable state'
  )


  check(
    String(
      recovered?.last_error||
      ''
    ).includes(
      '[stale lock recovered]'
    ),
    'stale recovery leaves diagnostic evidence'
  )


  /*
   * ==========================================================
   * B. RECOVERED JOB COMPLETES WITHOUT DUPLICATE
   * ==========================================================
   */

  console.log('')
  console.log(
    'D10H.7.B — recovered job completes once'
  )


  let executionCount=0


  const completingWorker =
    runtime(
      'd10h7-completing-worker',
      async job=>{
        check(
          job.id===crashJobId,
          'recovered runtime received original durable job'
        )

        executionCount++
      }
    )


  const reclaimed =
    await completingWorker.claim()


  check(
    reclaimed?.id===crashJobId &&
    Number(reclaimed?.attempts)===2,
    'recovered job is reclaimed with incremented attempt'
  )


  const completionResult =
    await completingWorker.run(
      reclaimed
    )


  check(
    completionResult?.status==='completed' &&
    completionResult?.terminal===false &&
    executionCount===1,
    'recovered job completes exactly once'
  )


  const completed =
    await one(
      `
        SELECT
          status,
          attempts,
          locked_by,
          locked_at,
          completed_at

        FROM background_jobs

        WHERE id=$1
      `,
      [
        crashJobId
      ]
    )


  check(
    completed?.status==='completed' &&
    Number(completed?.attempts)===2 &&
    completed?.locked_by===null &&
    completed?.locked_at===null &&
    Boolean(completed?.completed_at),
    'completion clears lease and preserves attempt history'
  )


  const duplicateCount =
    await one(
      `
        SELECT count(*)::int count
        FROM background_jobs
        WHERE id=$1
      `,
      [
        crashJobId
      ]
    )


  check(
    Number(duplicateCount?.count)===1,
    'crash recovery does not duplicate durable job'
  )


  /*
   * ==========================================================
   * C. RETRYABLE FAILURE -> SAME JOB PENDING
   * ==========================================================
   */

  console.log('')
  console.log(
    'D10H.7.C — retryable runtime failure'
  )


  const retryJobId =
    await enqueue(
      'd10h7_retryable',
      {
        case:'retryable'
      },
      {
        maxAttempts:3
      }
    )


  const failingRuntime =
    runtime(
      'd10h7-retry-worker',
      async()=>{
        throw new Error(
          'd10h7 retryable failure'
        )
      }
    )


  const retryClaim =
    await failingRuntime.claim()


  check(
    retryClaim?.id===retryJobId &&
    Number(retryClaim?.attempts)===1,
    'retryable job first claim recorded'
  )


  const retryResult =
    await failingRuntime.run(
      retryClaim
    )


  check(
    retryResult?.status==='pending' &&
    retryResult?.retry===true &&
    retryResult?.terminal===false,
    'retryable failure returns same job to pending'
  )


  const retryRow =
    await one(
      `
        SELECT
          status,
          attempts,
          locked_by,
          locked_at,
          last_error,
          run_at

        FROM background_jobs

        WHERE id=$1
      `,
      [
        retryJobId
      ]
    )


  check(
    retryRow?.status==='pending' &&
    Number(retryRow?.attempts)===1 &&
    retryRow?.locked_by===null &&
    retryRow?.locked_at===null &&
    String(
      retryRow?.last_error||
      ''
    ).includes(
      'd10h7 retryable failure'
    ),
    'retryable failure clears lease and persists error'
  )


  /*
   * ==========================================================
   * D. TERMINAL FAILURE -> DURABLE FAILED
   * ==========================================================
   */

  console.log('')
  console.log(
    'D10H.7.D — terminal runtime failure'
  )


  const terminalJobId =
    await enqueue(
      'd10h7_terminal',
      {
        case:'terminal'
      },
      {
        maxAttempts:1
      }
    )


  const terminalRuntime =
    runtime(
      'd10h7-terminal-worker',
      async()=>{
        throw new Error(
          'd10h7 terminal failure'
        )
      }
    )


  const terminalClaim =
    await terminalRuntime.claim()


  check(
    terminalClaim?.id===terminalJobId &&
    Number(terminalClaim?.attempts)===1,
    'terminal job claimed at final allowed attempt'
  )


  const terminalResult =
    await terminalRuntime.run(
      terminalClaim
    )


  check(
    terminalResult?.status==='failed' &&
    terminalResult?.terminal===true &&
    terminalResult?.retry===false,
    'terminal failure enters durable failed state'
  )


  const terminalRow =
    await one(
      `
        SELECT
          status,
          attempts,
          locked_by,
          locked_at,
          last_error

        FROM background_jobs

        WHERE id=$1
      `,
      [
        terminalJobId
      ]
    )


  check(
    terminalRow?.status==='failed' &&
    Number(terminalRow?.attempts)===1 &&
    terminalRow?.locked_by===null &&
    terminalRow?.locked_at===null &&
    String(
      terminalRow?.last_error||
      ''
    ).includes(
      'd10h7 terminal failure'
    ),
    'terminal failure persists diagnostic dead-letter state'
  )


  /*
   * ==========================================================
   * E. MANUAL RECOVERY COMPATIBILITY
   * ==========================================================
   *
   * D10H.6 recovery intentionally preserves attempts.
   * A manually retried failed job is claimable again and the
   * canonical runtime continues normal attempt accounting.
   */

  console.log('')
  console.log(
    'D10H.7.E — D10H.6 manual recovery compatibility'
  )


  await tx(
    async client=>{

      const locked =
        await client.query(
          `
            SELECT id,status
            FROM background_jobs
            WHERE id=$1
            FOR UPDATE
          `,
          [
            terminalJobId
          ]
        )


      check(
        locked.rows[0]?.status==='failed',
        'manual recovery begins from failed state'
      )


      await client.query(
        `
          UPDATE background_jobs
          SET
            status='pending',
            run_at=now(),
            locked_at=null,
            locked_by=null,
            completed_at=null,
            updated_at=now()
          WHERE id=$1
        `,
        [
          terminalJobId
        ]
      )
    }
  )


  let recoveredExecutionCount=0


  const manualRecoveryRuntime =
    runtime(
      'd10h7-manual-recovery-worker',
      async()=>{
        recoveredExecutionCount++
      }
    )


  const manualRecoveryClaim =
    await manualRecoveryRuntime.claim()


  check(
    manualRecoveryClaim?.id===terminalJobId &&
    Number(manualRecoveryClaim?.attempts)===2,
    'manual recovery preserves prior attempts and increments on claim'
  )


  const manualRecoveryResult =
    await manualRecoveryRuntime.run(
      manualRecoveryClaim
    )


  check(
    manualRecoveryResult?.status==='completed' &&
    recoveredExecutionCount===1,
    'manually recovered terminal job can complete successfully'
  )


  const manualRecoveredRow =
    await one(
      `
        SELECT
          status,
          attempts,
          locked_by,
          locked_at,
          completed_at,
          last_error

        FROM background_jobs

        WHERE id=$1
      `,
      [
        terminalJobId
      ]
    )


  check(
    manualRecoveredRow?.status==='completed' &&
    Number(manualRecoveredRow?.attempts)===2 &&
    manualRecoveredRow?.locked_by===null &&
    manualRecoveredRow?.locked_at===null &&
    Boolean(manualRecoveredRow?.completed_at) &&
    manualRecoveredRow?.last_error===null,
    'manual recovery converges to canonical completed state'
  )


  console.log('')
  console.log(
    'D10H.7 RUNTIME CRASH-BOUNDARY CONTRACT'
  )
  console.log(
    '--------------------------------------'
  )
  console.log(
    'Crash after claim -> stale processing lease -> pending recovery'
  )
  console.log(
    'Recovered job -> same durable row -> next attempt -> completed'
  )
  console.log(
    'Retryable failure -> same durable row -> pending'
  )
  console.log(
    'Terminal failure -> durable failed dead-letter'
  )
  console.log(
    'Manual recovery -> failed -> pending -> canonical runtime completion'
  )
  console.log('')
  console.log(
    'MELEO D10H.7 runtime crash-boundary integration: OK'
  )

}
finally{

  try{
    await closePool?.()
  }
  catch{}

  await dropDatabase()
}