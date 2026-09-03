/*
 * MELEO v6.3.0
 * Admin Observability routes
 *
 * Admin authentication and rate limiting are provided
 * by the path-scoped /api/admin middleware in app.js.
 */

export function registerAdminObservabilityRoutes(
  app,
  {
    Admin,
    pagination,
    many,
    one,
    tx,
    audit
  }
) {

  app.get('/api/admin/stats',async(_req,res)=>res.json(await Admin.stats()))


  app.get(
    '/api/admin/command-center',
    async(_req,res)=>{
      res.json(
        await Admin.commandCenter()
      )
    }
  )


  app.get('/api/admin/audit',async(req,res)=>{const {page,limit,offset}=pagination(req.query,{defaultLimit:50,maxLimit:200});const items=await many(`SELECT a.id,a.actor_id "actorId",u.name "actorName",u.email "actorEmail",a.action,a.meta,a.created_at at FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT $1 OFFSET $2`,[limit,offset]);res.json({items,page,limit})})


  app.get('/api/admin/insights',async(_req,res)=>{
   const topPros=await many(`SELECT p.id,u.name,p.specialty,p.subscription_plan plan,p.verified,p.rating,p.reviews_count reviews,count(b.id)::int requests,count(b.id) FILTER(WHERE b.status='completed')::int completed,coalesce(sum(a.profile_views),0)::int "profileViews",coalesce(sum(a.impressions),0)::int impressions FROM professionals p JOIN users u ON u.id=p.user_id LEFT JOIN bookings b ON b.professional_id=p.id LEFT JOIN professional_analytics_daily a ON a.professional_id=p.id AND a.day>=current_date-30 GROUP BY p.id,u.name ORDER BY completed DESC,requests DESC LIMIT 10`);
   const signupByRole=await many(`SELECT role,count(*)::int count,count(*) FILTER(WHERE created_at>=now()-interval '30 days')::int new30 FROM users WHERE deleted_at IS NULL AND role IN ('patient','professional') GROUP BY role`);
   const bookingStatus=await many(`SELECT status name,count(*)::int count FROM bookings GROUP BY status ORDER BY count DESC`);
   const reviewDist=await many(`SELECT gs stars,coalesce(count(r.id),0)::int count FROM generate_series(5,1,-1) gs LEFT JOIN reviews r ON r.rating=gs GROUP BY gs ORDER BY gs DESC`);
   const x=await one(`SELECT (SELECT count(*) FROM users WHERE deleted_at IS NULL AND created_at>=now()-interval '7 days')::int "newUsers7",(SELECT count(*) FROM users WHERE deleted_at IS NULL AND created_at>=now()-interval '30 days')::int "newUsers30",(SELECT count(*) FROM bookings WHERE created_at>=now()-interval '7 days')::int "newBookings7",(SELECT count(*) FROM bookings WHERE created_at>=now()-interval '30 days')::int "newBookings30"`);
   res.json({topPros,signupByRole,bookingStatus,reviewDist,...x})
  })


  /*
   * ==========================================================
   * D10H.6 — FAILED ASYNC JOB OBSERVABILITY / RECOVERY
   * ==========================================================
   */

  app.get(
    '/api/admin/async-jobs/failed',
    async(req,res)=>{

      const {
        page,
        limit,
        offset
      }=pagination(
        req.query,
        {
          defaultLimit:50,
          maxLimit:200
        }
      )

      const items=
        await many(
          `SELECT
             id,
             job_type "jobType",
             status,
             attempts,
             max_attempts "maxAttempts",
             priority,
             run_at "runAt",
             locked_at "lockedAt",
             locked_by "lockedBy",
             last_error "lastError",
             created_at "createdAt",
             updated_at "updatedAt",
             completed_at "completedAt"
           FROM background_jobs
           WHERE status='failed'
           ORDER BY updated_at DESC,created_at DESC
           LIMIT $1 OFFSET $2`,
          [
            limit,
            offset
          ]
        )

      const totalRow=
        await one(
          `SELECT count(*)::int count
           FROM background_jobs
           WHERE status='failed'`
        )

      res.json({
        items,
        page,
        limit,
        total:
          Number(
            totalRow?.count||
            0
          )
      })
    }
  )


  app.post(
    '/api/admin/async-jobs/:id/retry',
    async(req,res)=>{

      const jobId=
        String(
          req.params.id||
          ''
        ).trim()

      if(!jobId){
        return res
          .status(400)
          .json({
            error:'invalid_job_id'
          })
      }

      const outcome=
        await tx(
          async client=>{

            const currentResult=
              await client.query(
                `SELECT
                   id,
                   job_type,
                   status,
                   attempts,
                   max_attempts,
                   last_error
                 FROM background_jobs
                 WHERE id=$1
                 FOR UPDATE`,
                [
                  jobId
                ]
              )

            const current=
              currentResult.rows[0]

            if(!current){
              return {
                state:'not_found'
              }
            }

            if(
              current.status!==
              'failed'
            ){
              return {
                state:'not_failed',
                status:
                  current.status
              }
            }

            const updatedResult=
              await client.query(
                `UPDATE background_jobs
                 SET
                   status='pending',
                   run_at=now(),
                   locked_at=null,
                   locked_by=null,
                   completed_at=null,
                   updated_at=now()
                 WHERE id=$1
                 RETURNING
                   id,
                   job_type,
                   status,
                   attempts,
                   max_attempts,
                   run_at`,
                [
                  jobId
                ]
              )

            await audit(
              req.user?.id||null,
              'async.job.retry_requested',
              {
                jobId:
                  current.id,
                jobType:
                  current.job_type,
                attempts:
                  Number(
                    current.attempts||
                    0
                  ),
                maxAttempts:
                  Number(
                    current.max_attempts||
                    0
                  ),
                previousError:
                  current.last_error||
                  null
              },
              client
            )

            return {
              state:'retried',
              job:
                updatedResult.rows[0]
            }
          }
        )

      if(
        outcome.state===
        'not_found'
      ){
        return res
          .status(404)
          .json({
            error:'job_not_found'
          })
      }

      if(
        outcome.state===
        'not_failed'
      ){
        return res
          .status(409)
          .json({
            error:'job_not_failed',
            status:
              outcome.status
          })
      }

      res.json({
        ok:true,
        job:
          outcome.job
      })
    }
  )


}
