/*
 * MELEO v7.0 RC2-A8
 *
 * Account security/privacy lifecycle routes.
 *
 * GDPR hardening:
 * - complete paginated account export
 * - professional export covers both sides of the marketplace
 * - deletion destroys reusable authentication material
 * - direct identifiers and sensitive free text are scrubbed
 * - verification document objects are removed from storage
 * - relational history is retained under anonymised tombstone identities
 */

export function registerAccountPrivacyRoutes(
  app,
  deps
) {
  const {
    auth,
    limits,
    Users,
    Sessions,
    Professionals,
    Bookings,
    many,
    tx,
    audit,
    publicUser,
    hashPassword,
    verifyPassword,
    passwordPolicy,
    passwordPolicyError,
    clearSessionCookie,
    deleteVerificationObject,
    getStripe,
    mail,
    now
  } = deps


  app.post(
    '/api/me/change-password',
    auth,
    limits.password,
    async(req,res)=>{

      const u=
        await Users.byId(
          req.user.id
        )

      if(
        !await verifyPassword(
          String(
            req.body.currentPassword||''
          ),
          u.password_hash
        )
      ){
        return res
          .status(400)
          .json({
            error:
              '\u039F \u03C4\u03C1\u03AD\u03C7\u03C9\u03BD \u03BA\u03C9\u03B4\u03B9\u03BA\u03CC\u03C2 \u03B4\u03B5\u03BD \u03B5\u03AF\u03BD\u03B1\u03B9 \u03C3\u03C9\u03C3\u03C4\u03CC\u03C2.'
          })
      }

      const np=
        String(
          req.body.newPassword||''
        )

      if(!passwordPolicy(np).valid){
        return res
          .status(400)
          .json(
            passwordPolicyError
          )
      }

      const passwordHash=
        await hashPassword(np)

      await tx(async client=>{

        await client.query(
          `
            UPDATE users
            SET
              password_hash=$2,
              updated_at=now()
            WHERE id=$1
          `,
          [
            u.id,
            passwordHash
          ]
        )

        await client.query(
          `
            DELETE FROM sessions
            WHERE user_id=$1
          `,
          [u.id]
        )
      })

      clearSessionCookie(res)

      res.json({
        ok:true
      })
    }
  )


  app.get(
    '/api/me/export',
    auth,
    async(req,res)=>{

      const u=
        await Users.byId(
          req.user.id
        )

      const p=
        u.role==='professional'
          ? await Professionals.byUser(
              u.id
            )
          : null

      /*
       * Bookings.listForUser is intentionally paged at 100 rows.
       * Export walks every page instead of silently returning only page 1.
       */
      const bookings=[]
      const limit=100
      let page=1
      let total=0
      let totalPages=1

      do{

        const result=
          await Bookings.listForUser(
            publicUser(u),
            {
              limit,
              page,
              ...(
                u.role==='professional'
                  ? {scope:'all'}
                  : {}
              )
            }
          )

        bookings.push(
          ...(result.items||[])
        )

        total=
          Number(
            result.total||0
          )

        totalPages=
          Math.max(
            1,
            Number(
              result.totalPages||1
            )
          )

        page+=1

      }while(
        page<=totalPages
      )

      res.json({
        exportedAt:now(),
        user:publicUser(u),
        professional:p,
        bookings,
        exportMeta:{
          bookingCount:
            bookings.length,
          bookingTotal:
            total,
          complete:
            bookings.length===total
        }
      })
    }
  )


  app.delete(
    '/api/me',
    auth,
    limits.password,
    async(req,res)=>{

      const u=
        await Users.byId(
          req.user.id
        )

      if(
        req.body.password &&
        !await verifyPassword(
          String(
            req.body.password
          ),
          u.password_hash
        )
      ){
        return res
          .status(400)
          .json({
            error:
              '\u039B\u03AC\u03B8\u03BF\u03C2 \u03BA\u03C9\u03B4\u03B9\u03BA\u03CC\u03C2.'
          })
      }

      const p=
        u.role==='professional'
          ? await Professionals.byUser(
              u.id
            )
          : null

      /*
       * Subscription cancellation comes first. If Stripe cannot confirm
       * cancellation, deletion remains pending instead of hiding an active
       * billing relationship.
       */
      const stripe=
        getStripe()

      if(
        p?.stripeSubscriptionId &&
        stripe
      ){
        try{

          await stripe
            .subscriptions
            .cancel(
              p.stripeSubscriptionId
            )

        }catch(error){

          await tx(async client=>{

            await client.query(
              `
                UPDATE users
                SET
                  deletion_pending=true,
                  deletion_requested_at=$2,
                  updated_at=now()
                WHERE id=$1
              `,
              [
                u.id,
                now()
              ]
            )

            await audit(
              u.id,
              'privacy.deletion_pending',
              {
                reason:
                  'stripe_cancel_failed'
              },
              client
            )
          })

          return res
            .status(202)
            .json({
              ok:true,
              pending:true,
              message:
                '\u0397 \u03B4\u03B9\u03B1\u03B3\u03C1\u03B1\u03C6\u03AE \u03B8\u03B1 \u03BF\u03BB\u03BF\u03BA\u03BB\u03B7\u03C1\u03C9\u03B8\u03B5\u03AF \u03BC\u03CC\u03BB\u03B9\u03C2 \u03B1\u03BA\u03C5\u03C1\u03C9\u03B8\u03B5\u03AF \u03B7 \u03C3\u03C5\u03BD\u03B4\u03C1\u03BF\u03BC\u03AE.'
            })
        }
      }


      /*
       * Verification files may contain licences, certificates or identity
       * documents. Remove the real storage objects before claiming deletion
       * complete.
       */
      let verificationDocuments=[]

      if(p){

        verificationDocuments=
          await many(
            `
              SELECT
                id,
                storage_key "storageKey"

              FROM verification_documents

              WHERE professional_id=$1
            `,
            [p.id]
          )

        try{

          for(
            const document
            of verificationDocuments
          ){
            if(document.storageKey){

              await deleteVerificationObject(
                document.storageKey
              )
            }
          }

        }catch(error){

          await tx(async client=>{

            await client.query(
              `
                UPDATE users
                SET
                  deletion_pending=true,
                  deletion_requested_at=$2,
                  updated_at=now()
                WHERE id=$1
              `,
              [
                u.id,
                now()
              ]
            )

            await audit(
              u.id,
              'privacy.verification_storage_delete_failed',
              {
                documentCount:
                  verificationDocuments.length
              },
              client
            )
          })

          return res
            .status(202)
            .json({
              ok:true,
              pending:true,
              message:
                '\u0397 \u03B4\u03B9\u03B1\u03B3\u03C1\u03B1\u03C6\u03AE \u03B8\u03B1 \u03BF\u03BB\u03BF\u03BA\u03BB\u03B7\u03C1\u03C9\u03B8\u03B5\u03AF \u03BC\u03CC\u03BB\u03B9\u03C2 \u03B1\u03C6\u03B1\u03B9\u03C1\u03B5\u03B8\u03BF\u03CD\u03BD \u03BC\u03B5 \u03B1\u03C3\u03C6\u03AC\u03BB\u03B5\u03B9\u03B1 \u03C4\u03B1 \u03AD\u03B3\u03B3\u03C1\u03B1\u03C6\u03B1 \u03B5\u03C0\u03B1\u03BB\u03AE\u03B8\u03B5\u03C5\u03C3\u03B7\u03C2.'
            })
        }
      }


      /*
       * Preserve referential integrity while removing direct identifiers.
       * Bookings/reviews/support/audit history continue to reference the same
       * stable user id, but that id no longer authenticates or identifies the
       * person directly.
       */
      const deletedEmail=
        `deleted+${u.id}@deleted.invalid`

      await tx(async client=>{

        await client.query(
          `
            DELETE FROM sessions
            WHERE user_id=$1
          `,
          [u.id]
        )

        await client.query(
          `
            DELETE FROM one_time_tokens
            WHERE user_id=$1
          `,
          [u.id]
        )

        await client.query(
          `
            DELETE FROM user_identities
            WHERE user_id=$1
          `,
          [u.id]
        )

        await client.query(
          `
            DELETE FROM favorites
            WHERE user_id=$1
          `,
          [u.id]
        )

        await client.query(
          `
            DELETE FROM notifications
            WHERE user_id=$1
          `,
          [u.id]
        )


        /*
         * Patient-controlled free text can contain health or contact data.
         * Transactional booking facts remain for operational/accounting
         * integrity.
         */
        await client.query(
          `
            UPDATE bookings

            SET
              address='',
              notes_encrypted='',
              updated_at=now()

            WHERE patient_id=$1
          `,
          [u.id]
        )

        await client.query(
          `
            UPDATE booking_messages

            SET
              sender_name='Deleted User',
              body_encrypted=''

            WHERE sender_user_id=$1
          `,
          [u.id]
        )

        await client.query(
          `
            UPDATE reviews

            SET comment=''

            WHERE patient_id=$1
          `,
          [u.id]
        )

        await client.query(
          `
            UPDATE support_tickets

            SET
              subject='',
              updated_at=now()

            WHERE user_id=$1
          `,
          [u.id]
        )

        await client.query(
          `
            UPDATE support_messages

            SET body=''

            WHERE sender_user_id=$1
          `,
          [u.id]
        )

        await client.query(
          `
            UPDATE reports

            SET
              reason='account_deleted',
              details='',
              updated_at=now()

            WHERE reporter_user_id=$1
          `,
          [u.id]
        )


        if(p){

          await client.query(
            `
              UPDATE verification_requests

              SET
                license_number='',
                notes='',
                admin_note=''

              WHERE professional_id=$1
            `,
            [p.id]
          )

          /*
           * Storage objects have already been removed successfully.
           * Remove their identifying metadata from PostgreSQL as well.
           */
          await client.query(
            `
              DELETE FROM verification_documents
              WHERE professional_id=$1
            `,
            [p.id]
          )

          await client.query(
            `
              UPDATE professionals

              SET
                title='',
                verified=false,
                featured=false,
                admin_suspended=true,
                city='',
                area='',
                region='',
                latitude=NULL,
                longitude=NULL,
                available='',
                bio='',
                languages='[]'::jsonb,
                credentials='[]'::jsonb,
                response_time='',
                services='[]'::jsonb,
                availability='[]'::jsonb,
                show_phone=false,
                show_email=false,
                prefer_platform_contact=true,
                subscription_status='cancelled',
                stripe_subscription_id=NULL,
                current_period_end=NULL,
                cancel_at_period_end=false,
                past_due_since=NULL,
                updated_at=now()

              WHERE id=$1
            `,
            [p.id]
          )
        }


        /*
         * Critical A8 requirement:
         * raw email and the reusable password hash must not survive deletion.
         */
        await client.query(
          `
            UPDATE users

            SET
              name='Deleted User',
              email=$2,
              phone='',
              password_hash='!account-deleted!',
              email_verified=false,
              stripe_customer_id=NULL,
              deletion_pending=false,
              deletion_requested_at=
                coalesce(
                  deletion_requested_at,
                  now()
                ),
              deleted_at=now(),
              last_totp_step=NULL,
              last_login_at=NULL,
              account_status='suspended',
              suspended_at=now(),
              suspension_reason='account_deleted',
              updated_at=now()

            WHERE id=$1
          `,
          [
            u.id,
            deletedEmail
          ]
        )

        await audit(
          u.id,
          'privacy.account_deleted',
          {
            anonymized:true,
            credentialsRemoved:true,
            verificationObjectsRemoved:
              verificationDocuments.length
          },
          client
        )
      })


      mail
        .accountDeleted(
          u.email,
          u.name
        )
        .catch(
          ()=>{}
        )

      clearSessionCookie(res)

      res.json({
        ok:true,
        deleted:true
      })
    }
  )
}