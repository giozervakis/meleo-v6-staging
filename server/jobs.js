import { sql, one, id } from './relational/pool.js'


function normalizeDedupKey(value){
  if(
    value === undefined ||
    value === null
  ){
    return null
  }

  const normalized =
    String(value)
      .trim()
      .slice(0,240)

  return normalized || null
}


export async function enqueue(
  jobType,
  payload,
  {
    priority=100,
    maxAttempts=5,
    runAt=null,
    dedupKey=null
  }={}
){
  const jid=
    id('job')

  const normalizedDedupKey=
    normalizeDedupKey(
      dedupKey
    )

  if(!normalizedDedupKey){
    await sql(
      `INSERT INTO background_jobs(
         id,
         job_type,
         payload,
         priority,
         max_attempts,
         run_at
       )
       VALUES(
         $1,$2,$3,$4,$5,
         COALESCE($6::timestamptz,now())
       )`,
      [
        jid,
        jobType,
        payload,
        priority,
        maxAttempts,
        runAt
      ]
    )

    return jid
  }

  const existingOrInserted=
    await one(
      `
        WITH inserted AS (
          INSERT INTO background_jobs(
            id,
            job_type,
            payload,
            priority,
            max_attempts,
            run_at,
            dedup_key
          )
          VALUES(
            $1,$2,$3,$4,$5,
            COALESCE($6::timestamptz,now()),
            $7
          )

          ON CONFLICT(
            job_type,
            dedup_key
          )
          WHERE dedup_key IS NOT NULL

          DO NOTHING

          RETURNING id
        )

        SELECT id
        FROM inserted

        UNION ALL

        SELECT id
        FROM background_jobs
        WHERE
          job_type=$2
          AND dedup_key=$7

        LIMIT 1
      `,
      [
        jid,
        jobType,
        payload,
        priority,
        maxAttempts,
        runAt,
        normalizedDedupKey
      ]
    )

  if(!existingOrInserted?.id){
    throw new Error(
      'Unable to resolve idempotent background job'
    )
  }

  return existingOrInserted.id
}


export async function queueStats(){
  return await one(
    `SELECT
       count(*) FILTER (
         WHERE status='pending'
       )::int pending,
       count(*) FILTER (
         WHERE status='processing'
       )::int processing,
       count(*) FILTER (
         WHERE status='failed'
       )::int failed
     FROM background_jobs`
  ) || {
    pending:0,
    processing:0,
    failed:0
  }
}
