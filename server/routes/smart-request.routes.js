export function registerSmartRequestRoutes(
  app,
  {
    limits,
    one,
    many,
    id,
    str,
    now,
    audit,
    tx,
    ensureSmartLearningSchema,
    normalizeSmartRequest
  }
) {

  app.post(
    '/api/smart-request/unmatched',
    limits.write,
    async(req,res)=>{
      await ensureSmartLearningSchema()

      const text =
        str(
          req.body.text,
          1200
        )

      const normalized =
        normalizeSmartRequest(text)

      if(!normalized){
        return res.status(400).json({
          error:'Invalid request'
        })
      }

      const row =
        await one(
          `INSERT INTO smart_request_learning(
             id,
             normalized_text,
             sample_text,
             occurrences,
             status,
             first_seen_at,
             last_seen_at
           )
           VALUES(
             $1,
             $2,
             $3,
             1,
             'new',
             $4,
             $4
           )
           ON CONFLICT(normalized_text)
           DO UPDATE SET
             occurrences=
               smart_request_learning.occurrences+1,
             sample_text=
               EXCLUDED.sample_text,
             last_seen_at=
               EXCLUDED.last_seen_at
           RETURNING occurrences`,
          [
            id('srl'),
            normalized,
            text,
            now()
          ]
        )

      res.json({
        ok:true,
        learned:false,
        existing:
          Number(
            row?.occurrences || 0
          ) > 1
      })
    }
  )


  app.post(
    '/api/smart-request/learned-match',
    async(req,res)=>{
      await ensureSmartLearningSchema()

      const text =
        str(
          req.body.text,
          1200
        )

      const normalized =
        normalizeSmartRequest(text)

      if(!normalized){
        return res.json({
          matched:false
        })
      }

      const rows =
        await many(
          `SELECT
             id,
             normalized_text,
             learned_specialty,
             learned_service
           FROM smart_request_learning
           WHERE status='learned'
             AND learned_specialty IS NOT NULL
           ORDER BY occurrences DESC,
                    last_seen_at DESC
           LIMIT 500`
        )

      const hit =
        rows.find(
          row =>
            normalized.includes(
              row.normalized_text
            ) ||
            row.normalized_text.includes(
              normalized
            )
        )

      if(!hit){
        return res.json({
          matched:false
        })
      }

      res.json({
        matched:true,
        specialty:
          str(
            hit.learned_specialty,
            120
          ),
        service:
          str(
            hit.learned_service,
            160
          )
      })
    }
  )


  app.get(
    '/api/admin/smart-requests',
    async(req,res)=>{
      await ensureSmartLearningSchema()

      const status =
        str(
          req.query.status,
          30
        )

      const q =
        str(
          req.query.q,
          200
        )

      const where = []
      const params = []

      if(status){
        params.push(status)
        where.push(
          `status=$${params.length}`
        )
      }

      if(q){
        params.push(`%${q}%`)
        where.push(
          `(sample_text ILIKE $${params.length}
            OR normalized_text ILIKE $${params.length})`
        )
      }

      const clause =
        where.length
          ? `WHERE ${where.join(' AND ')}`
          : ''

      const items =
        await many(
          `SELECT
             id,
             normalized_text "normalizedText",
             sample_text "sampleText",
             occurrences,
             status,
             learned_specialty "learnedSpecialty",
             learned_service "learnedService",
             admin_note "adminNote",
             first_seen_at "firstSeenAt",
             last_seen_at "lastSeenAt",
             reviewed_at "reviewedAt"
           FROM smart_request_learning
           ${clause}
           ORDER BY last_seen_at DESC
           LIMIT 300`,
          params
        )

      const counts =
        await one(
          `SELECT
             count(*)::int total,
             count(*) FILTER (
               WHERE status='new'
             )::int new,
             count(*) FILTER (
               WHERE status='learned'
             )::int learned,
             count(*) FILTER (
               WHERE status='ignored'
             )::int ignored
           FROM smart_request_learning`
        )

      res.json({
        items,
        counts
      })
    }
  )


  app.patch(
    '/api/admin/smart-requests/:id',
    async(req,res)=>{
      await ensureSmartLearningSchema()

      const existing =
        await one(
          `SELECT *
           FROM smart_request_learning
           WHERE id=$1`,
          [req.params.id]
        )

      if(!existing){
        return res.status(404).json({
          error:'Not found'
        })
      }

      const status =
        ['new','learned','ignored']
          .includes(req.body.status)
          ? req.body.status
          : existing.status

      const learnedSpecialty =
        str(
          req.body.learnedSpecialty,
          120
        )

      const learnedService =
        str(
          req.body.learnedService,
          160
        )

      const adminNote =
        str(
          req.body.adminNote,
          1000
        )

      await tx(
        async c=>{
          await c.query(
            `UPDATE smart_request_learning
             SET status=$1,
                 learned_specialty=$2,
                 learned_service=$3,
                 admin_note=$4,
                 reviewed_at=$5
             WHERE id=$6`,
            [
              status,
              learnedSpecialty || null,
              learnedService || null,
              adminNote,
              now(),
              existing.id
            ]
          )

          await audit(
            req.user.id,
            'smart_request.review',
            {
              smartRequestId:
                existing.id,
              status
            },
            c
          )
        }
      )

      res.json({
        ok:true
      })
    }
  )
}
