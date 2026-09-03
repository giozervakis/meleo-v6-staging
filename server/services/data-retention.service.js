export function createDataRetentionService({
  sql,
  now=()=>new Date()
}={}){
  if(typeof sql!=='function'){
    throw new Error(
      'createDataRetentionService requires sql'
    )
  }

  const clampDays=(value,fallback)=>{
    const n=Number(value)

    if(
      !Number.isFinite(n) ||
      n<1
    ){
      return fallback
    }

    return Math.min(
      3650,
      Math.floor(n)
    )
  }

  const clampBatch=(value)=>{
    const n=Number(value)

    if(
      !Number.isFinite(n) ||
      n<1
    ){
      return 500
    }

    return Math.min(
      5000,
      Math.floor(n)
    )
  }

  const policy={
    liveEventsDays:
      clampDays(
        process.env.RETENTION_LIVE_EVENTS_DAYS,
        7
      ),

    completedJobsDays:
      clampDays(
        process.env.RETENTION_COMPLETED_JOBS_DAYS,
        30
      ),

    failedJobsDays:
      clampDays(
        process.env.RETENTION_FAILED_JOBS_DAYS,
        90
      ),

    auditLogsDays:
      clampDays(
        process.env.RETENTION_AUDIT_LOGS_DAYS,
        365
      ),

    batchSize:
      clampBatch(
        process.env.RETENTION_PURGE_BATCH_SIZE
      )
  }


  async function purgeBatch({
    table,
    predicate,
    params
  }){
    /*
     * PostgreSQL does not support DELETE ... LIMIT directly.
     * ctid provides a bounded batch without changing schema.
     */
    const result=
      await sql(
        `
          WITH doomed AS (
            SELECT ctid
            FROM ${table}
            WHERE ${predicate}
            ORDER BY ctid
            LIMIT $1
          )
          DELETE FROM ${table}
          WHERE ctid IN (
            SELECT ctid
            FROM doomed
          )
        `,
        [
          policy.batchSize,
          ...params
        ]
      )

    return Number(
      result?.rowCount||0
    )
  }


  async function purge(){
    const startedAt=
      now()

    const summary={
      liveEvents:0,
      completedJobs:0,
      failedJobs:0,
      auditLogs:0,
      startedAt:
        startedAt instanceof Date
          ? startedAt.toISOString()
          : String(startedAt)
    }


    summary.liveEvents=
      await purgeBatch({
        table:'live_events',
        predicate:
          `created_at <
           now() -
           ($2::integer * interval '1 day')`,
        params:[
          policy.liveEventsDays
        ]
      })


    summary.completedJobs=
      await purgeBatch({
        table:'background_jobs',
        predicate:
          `status='completed'
           AND COALESCE(
             completed_at,
             updated_at,
             created_at
           ) <
           now() -
           ($2::integer * interval '1 day')`,
        params:[
          policy.completedJobsDays
        ]
      })


    summary.failedJobs=
      await purgeBatch({
        table:'background_jobs',
        predicate:
          `status='failed'
           AND updated_at <
           now() -
           ($2::integer * interval '1 day')`,
        params:[
          policy.failedJobsDays
        ]
      })


    summary.auditLogs=
      await purgeBatch({
        table:'audit_logs',
        predicate:
          `created_at <
           now() -
           ($2::integer * interval '1 day')`,
        params:[
          policy.auditLogsDays
        ]
      })


    summary.total=
      summary.liveEvents+
      summary.completedJobs+
      summary.failedJobs+
      summary.auditLogs

    return {
      policy,
      summary
    }
  }


  return {
    policy,
    purge
  }
}