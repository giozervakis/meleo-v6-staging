import { sql, one, id } from './relational/pool.js'

export async function enqueue(jobType,payload,{priority=100,maxAttempts=5,runAt=null}={}){
  const jid=id('job')
  await sql(`INSERT INTO background_jobs(id,job_type,payload,priority,max_attempts,run_at) VALUES($1,$2,$3,$4,$5,COALESCE($6::timestamptz,now()))`,[jid,jobType,payload,priority,maxAttempts,runAt])
  return jid
}
export async function queueStats(){
  return await one(`SELECT count(*) FILTER (WHERE status='pending')::int pending,count(*) FILTER (WHERE status='processing')::int processing,count(*) FILTER (WHERE status='failed')::int failed FROM background_jobs`)||{pending:0,processing:0,failed:0}
}
