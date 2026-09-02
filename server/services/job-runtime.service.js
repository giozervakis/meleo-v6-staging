/*
 * MELEO D10F.6
 *
 * Canonical PostgreSQL background-job runtime.
 *
 * The worker executable and runtime integration tests use this same
 * implementation for:
 *   - atomic job claiming
 *   - SKIP LOCKED concurrency
 *   - attempt accounting
 *   - successful completion
 *   - retry/backoff
 *   - dead-letter transition
 *   - stale-lock recovery
 *
 * Domain-specific execution remains injected by the worker so this
 * service contains no Stripe, mail, storage or account business logic.
 */

export function retryDelaySeconds(
  attempt
){
  return Math.min(
    3600,
    Math.pow(
      2,
      Math.max(
        0,
        Number(attempt)-1
      )
    )*15
  )
}


export function createJobRuntime({
  tx,
  sql,
  execute,
  observeJob=()=>{},
  log={
    info:()=>{},
    warn:()=>{},
    error:()=>{}
  },
  workerId
}){

  if(
    typeof tx!=='function' ||
    typeof sql!=='function' ||
    typeof execute!=='function'
  ){
    throw new Error(
      'Invalid job runtime dependencies'
    )
  }

  const owner=
    String(
      workerId||
      ''
    ).trim()

  if(!owner){
    throw new Error(
      'Job runtime requires workerId'
    )
  }


  async function claim(){

    return tx(
      async client=>{

        const {rows}=
          await client.query(
            `SELECT *
             FROM background_jobs
             WHERE status='pending'
               AND run_at<=now()
             ORDER BY priority ASC,created_at ASC
             FOR UPDATE SKIP LOCKED
             LIMIT 1`
          )

        const job=
          rows[0]

        if(!job){
          return null
        }

        await client.query(
          `UPDATE background_jobs
           SET
             status='processing',
             locked_at=now(),
             locked_by=$2,
             attempts=attempts+1,
             updated_at=now()
           WHERE id=$1`,
          [
            job.id,
            owner
          ]
        )

        job.attempts=
          Number(
            job.attempts
          )+1

        job.locked_by=
          owner

        return job
      }
    )
  }


  async function run(job){

    try{

      await execute(
        job
      )

      await sql(
        `UPDATE background_jobs
         SET
           status='completed',
           locked_at=null,
           locked_by=null,
           last_error=null,
           completed_at=now(),
           updated_at=now()
         WHERE id=$1`,
        [
          job.id
        ]
      )

      observeJob(
        'completed'
      )

      log.info(
        'job.completed',
        {
          jobId:job.id,
          type:job.job_type,
          attempt:job.attempts
        }
      )

      return {
        status:'completed',
        terminal:false,
        retry:false
      }

    }
    catch(err){

      const terminal=
        Number(
          job.attempts
        )>=
        Number(
          job.max_attempts||
          5
        )

      const delay=
        retryDelaySeconds(
          job.attempts
        )

      const nextStatus=
        terminal
          ? 'failed'
          : 'pending'

      await sql(
        `UPDATE background_jobs
         SET
           status=$2,
           run_at=
             CASE
               WHEN $2='pending'
               THEN now()+($3||' seconds')::interval
               ELSE run_at
             END,
           locked_at=null,
           locked_by=null,
           last_error=$4,
           updated_at=now()
         WHERE id=$1`,
        [
          job.id,
          nextStatus,
          String(delay),
          String(
            err?.message||
            err
          ).slice(
            0,
            2000
          )
        ]
      )

      observeJob(
        terminal
          ? 'failed'
          : 'retry'
      )

      log.error(
        terminal
          ? 'job.dead_letter'
          : 'job.retry',
        {
          jobId:job.id,
          type:job.job_type,
          attempt:job.attempts,
          error:
            err?.message||
            String(err),
          nextDelaySeconds:
            terminal
              ? null
              : delay
        }
      )

      return {
        status:nextStatus,
        terminal,
        retry:
          !terminal,
        delaySeconds:
          terminal
            ? null
            : delay,
        error:
          err
      }
    }
  }


  async function recoverStale(){

    const result=
      await sql(
        `UPDATE background_jobs
         SET
           status='pending',
           locked_at=null,
           locked_by=null,
           run_at=now(),
           updated_at=now(),
           last_error=
             COALESCE(last_error,'') ||
             ' [stale lock recovered]'
         WHERE status='processing'
           AND locked_at<
             now()-interval '10 minutes'`
      )

    if(
      result.rowCount
    ){
      log.warn(
        'job.stale_recovered',
        {
          count:
            result.rowCount
        }
      )
    }

    return result.rowCount
  }


  return {
    claim,
    run,
    recoverStale
  }
}