export function registerAdminVerificationRoutes(
  app,
  {
    limits,
    pagination,
    one,
    many,
    tx,
    str,
    Users,
    Professionals,
    Notifications,
    audit,
    mail,
    config,
    getVerificationObject,
    decryptFileBuffer,
    createTemporaryDocumentSignature,
    verifyTemporaryDocumentSignature
  }
) {

  app.get(
    '/api/admin/verifications',
    async(req,res)=>{
      const {
        page,
        limit,
        offset
      } =
        pagination(
          req.query,
          {
            defaultLimit:30,
            maxLimit:100
          }
        )

      const rows =
        await many(
          `SELECT
             v.id,
             v.professional_id "professionalId",
             v.license_number "licenseNumber",
             v.notes,
             v.status,
             v.admin_note "adminNote",
             v.submitted_at "createdAt",
             u.name,
             u.email,
             u.phone,
             p.specialty,
             p.subscription_plan "subscriptionPlan",
             p.subscription_status "subscriptionStatus",
             p.city
           FROM verification_requests v
           JOIN professionals p
             ON p.id=v.professional_id
           JOIN users u
             ON u.id=p.user_id
           ORDER BY v.submitted_at DESC
           LIMIT $1 OFFSET $2`,
          [
            limit,
            offset
          ]
        )

      const items = []

      for (
        const v of rows
      ) {
        const docs =
          await many(
            `SELECT
               id,
               original_name name,
               mime_type mime,
               size_bytes size,
               created_at "createdAt"
             FROM verification_documents
             WHERE professional_id=$1
             ORDER BY created_at DESC`,
            [
              v.professionalId
            ]
          )

        items.push({
          ...v,
          documents:docs,
          documentCount:docs.length
        })
      }

      const c =
        await one(
          'SELECT count(*)::int total FROM verification_requests'
        )

      res.json({
        items,
        page,
        limit,
        total:c.total,
        totalPages:
          Math.ceil(
            c.total / limit
          )
      })
    }
  )


  app.get(
    '/api/admin/verification-documents/:id',
    async(req,res)=>{
      const d =
        await one(
          'SELECT * FROM verification_documents WHERE id=$1',
          [
            req.params.id
          ]
        )

      if(!d){
        return res
          .status(404)
          .end()
      }

      try {
        const encrypted =
          await getVerificationObject(
            d.storage_key ||
            `${d.id}.bin`
          )

        res.setHeader(
          'Content-Type',
          d.mime_type
        )

        res.setHeader(
          'Content-Disposition',
          `attachment; filename*=UTF-8''${encodeURIComponent(d.original_name)}`
        )

        res.setHeader(
          'Cache-Control',
          'no-store, private'
        )

        res.end(
          decryptFileBuffer(
            encrypted
          )
        )
      }
      catch(e){
        if(
          e?.code === 'ENOENT' ||
          e?.status === 404
        ){
          return res
            .status(404)
            .end()
        }

        throw e
      }
    }
  )


  app.post(
    '/api/admin/verification-documents/:id/access',
    limits.write,
    async(req,res)=>{
      const d =
        await one(
          'SELECT id FROM verification_documents WHERE id=$1',
          [
            req.params.id
          ]
        )

      if(!d){
        return res
          .status(404)
          .end()
      }

      const expires =
        Date.now() +
        config.storage.signedUrlTtlSeconds *
        1000

      const sig =
        createTemporaryDocumentSignature(
          d.id,
          expires
        )

      res.json({
        url:
          `/api/admin/verification-documents/${encodeURIComponent(d.id)}/signed?expires=${expires}&sig=${encodeURIComponent(sig)}`,

        expiresAt:
          new Date(
            expires
          ).toISOString()
      })
    }
  )


  app.get(
    '/api/admin/verification-documents/:id/signed',
    async(req,res)=>{
      if(
        !verifyTemporaryDocumentSignature(
          req.params.id,
          req.query.expires,
          req.query.sig
        )
      ){
        return res
          .status(403)
          .json({
            error:
              'Ο προσωρινός σύνδεσμος έληξε ή δεν είναι έγκυρος.'
          })
      }

      const d =
        await one(
          'SELECT * FROM verification_documents WHERE id=$1',
          [
            req.params.id
          ]
        )

      if(!d){
        return res
          .status(404)
          .end()
      }

      try {
        const encrypted =
          await getVerificationObject(
            d.storage_key ||
            `${d.id}.bin`
          )

        res.setHeader(
          'Content-Type',
          d.mime_type
        )

        res.setHeader(
          'Content-Disposition',
          `inline; filename*=UTF-8''${encodeURIComponent(d.original_name)}`
        )

        res.setHeader(
          'Cache-Control',
          'no-store, private'
        )

        res.end(
          decryptFileBuffer(
            encrypted
          )
        )
      }
      catch(e){
        if(
          e?.code === 'ENOENT' ||
          e?.status === 404
        ){
          return res
            .status(404)
            .end()
        }

        throw e
      }
    }
  )


  app.patch(
    '/api/admin/verifications/:id',
    async(req,res)=>{
      const v =
        await one(
          'SELECT * FROM verification_requests WHERE id=$1',
          [
            req.params.id
          ]
        )

      if(!v){
        return res
          .status(404)
          .json({
            error:'Not found'
          })
      }

      const status =
        req.body.status === 'approved'
          ? 'approved'
          : 'rejected'

      const approved =
        status === 'approved'

      const note =
        str(
          req.body.note ||
          req.body.adminNote,
          1000
        )

      if(
        !approved &&
        !note
      ){
        return res
          .status(400)
          .json({
            error:
              'Ο λόγος απόρριψης είναι υποχρεωτικός.'
          })
      }

      const p =
        await Professionals.byId(
          v.professional_id
        )

      if(!p){
        return res
          .status(404)
          .json({
            error:
              'Professional not found'
          })
      }

      if(
        approved &&
        ![
          'active',
          'past_due'
        ].includes(
          p.subscriptionStatus || ''
        )
      ){
        return res
          .status(400)
          .json({
            error:
              'Δεν μπορεί να εγκριθεί επαγγελματικός λογαριασμός χωρίς ενεργή ή past-due συνδρομή.'
          })
      }

      const u =
        await Users.byId(
          p.userId
        )

      await tx(
        async c=>{
          await c.query(
            `UPDATE verification_requests
             SET
               status=$1,
               admin_note=$2,
               reviewed_by=$3,
               reviewed_at=now()
             WHERE id=$4`,
            [
              status,
              note,
              req.user.id,
              v.id
            ]
          )

          await c.query(
            `UPDATE professionals
             SET
               verified=$1,
               onboarding_stage=$2,
               onboarding_completed=$1,
               updated_at=now()
             WHERE id=$3`,
            [
              approved,
              approved
                ? 'approved'
                : 'verification_rejected',
              v.professional_id
            ]
          )

          if(u){
            if(approved){
              await Notifications.create(
                u.id,
                'verification',
                'Ο επαγγελματικός σας λογαριασμός ενεργοποιήθηκε',
                'Η επαλήθευση ολοκληρώθηκε. Από το μενού προφίλ της πλατφόρμας επιλέξτε Professional Dashboard για να διαχειριστείτε το επαγγελματικό σας προφίλ και τα αιτήματα.',
                {},
                c
              )
            }
            else {
              await Notifications.create(
                u.id,
                'verification',
                'Χρειάζεται ενέργεια για τον επαγγελματικό σας λογαριασμό',
                `Η επαγγελματική ενεργοποίηση δεν ολοκληρώθηκε. Λόγος: ${note}`,
                {},
                c
              )
            }
          }

          await audit(
            req.user.id,
            `verification.${status}`,
            {
              requestId:v.id,
              professionalId:
                v.professional_id,
              reason:note
            },
            c
          )
        }
      )

      if(u){
        mail
          .verificationDecision(
            u.email,
            u.name,
            approved,
            note
          )
          .catch(
            ()=>{}
          )
      }

      res.json({
        ok:true
      })
    }
  )
}
