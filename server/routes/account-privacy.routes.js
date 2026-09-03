import { createAccountDeletionService } from '../services/account-deletion.service.js'
import { decryptSensitive } from '../security.js'

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
    now,
    id
  } = deps

  const accountDeletion=
    createAccountDeletionService({
      Users,
      Professionals,
      many,
      tx,
      audit,
      deleteVerificationObject,
      getStripe,
      now,
      id
    })


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

      /*
       * GDPR data-subject export.
       *
       * Export subject-linked personal data while deliberately
       * excluding reusable authentication secrets, internal
       * storage object keys and unrelated administrative data.
       */

      const sessions=
        await many(
          `
            SELECT
              expires_at,
              created_at,
              ip_hash,
              user_agent_hash
            FROM sessions
            WHERE user_id=$1
            ORDER BY created_at ASC
          `,
          [u.id]
        )

      const identities=
        await many(
          `
            SELECT
              id,
              provider,
              provider_subject,
              provider_email,
              provider_email_verified,
              provider_display_name,
              provider_avatar_url,
              created_at,
              updated_at,
              last_login_at
            FROM user_identities
            WHERE user_id=$1
            ORDER BY created_at ASC
          `,
          [u.id]
        )

      const favorites=
        await many(
          `
            SELECT
              id,
              professional_id,
              created_at
            FROM favorites
            WHERE user_id=$1
            ORDER BY created_at ASC
          `,
          [u.id]
        )

      const notifications=
        await many(
          `
            SELECT
              id,
              type,
              title,
              body,
              is_read,
              created_at
            FROM notifications
            WHERE user_id=$1
            ORDER BY created_at ASC
          `,
          [u.id]
        )

      const bookingIds=
        bookings
          .map(item=>item.id)
          .filter(Boolean)

      const bookingMessageRows=
        bookingIds.length
          ? await many(
              `
                SELECT
                  id,
                  booking_id,
                  sender_role,
                  sender_name,
                  body_encrypted,
                  kind,
                  created_at
                FROM booking_messages
                WHERE booking_id = ANY($1::text[])
                ORDER BY created_at ASC
              `,
              [bookingIds]
            )
          : []

      const bookingMessages=
        bookingMessageRows.map(
          ({
            body_encrypted,
            ...message
          })=>({
            ...message,
            text:
              decryptSensitive(
                body_encrypted
              )
          })
        )

      const reviews=
        p
          ? await many(
              `
                SELECT
                  id,
                  booking_id,
                  professional_id,
                  rating,
                  comment,
                  created_at
                FROM reviews
                WHERE patient_id=$1
                   OR professional_id=$2
                ORDER BY created_at ASC
              `,
              [
                u.id,
                p.id
              ]
            )
          : await many(
              `
                SELECT
                  id,
                  booking_id,
                  professional_id,
                  rating,
                  comment,
                  created_at
                FROM reviews
                WHERE patient_id=$1
                ORDER BY created_at ASC
              `,
              [u.id]
            )

      const supportTickets=
        await many(
          `
            SELECT
              id,
              subject,
              category,
              status,
              created_at,
              updated_at
            FROM support_tickets
            WHERE user_id=$1
            ORDER BY created_at ASC
          `,
          [u.id]
        )

      const supportTicketIds=
        supportTickets
          .map(item=>item.id)
          .filter(Boolean)

      const supportMessages=
        supportTicketIds.length
          ? await many(
              `
                SELECT
                  id,
                  ticket_id,
                  sender_role,
                  body,
                  created_at
                FROM support_messages
                WHERE ticket_id = ANY($1::text[])
                ORDER BY created_at ASC
              `,
              [supportTicketIds]
            )
          : []

      const reports=
        await many(
          `
            SELECT
              id,
              target_type,
              target_id,
              reason,
              details,
              status,
              created_at,
              updated_at
            FROM reports
            WHERE reporter_user_id=$1
            ORDER BY created_at ASC
          `,
          [u.id]
        )

      const verificationRequests=
        p
          ? await many(
              `
                SELECT
                  id,
                  professional_id,
                  license_number,
                  notes,
                  status,
                  admin_note,
                  submitted_at,
                  reviewed_at
                FROM verification_requests
                WHERE professional_id=$1
                ORDER BY submitted_at ASC
              `,
              [p.id]
            )
          : []

      const verificationDocuments=
        p
          ? await many(
              `
                SELECT
                  id,
                  professional_id,
                  request_id,
                  original_name,
                  mime_type,
                  size_bytes,
                  created_at
                FROM verification_documents
                WHERE professional_id=$1
                ORDER BY created_at ASC
              `,
              [p.id]
            )
          : []

      const subscriptions=
        p
          ? await many(
              `
                SELECT
                  id,
                  professional_id,
                  plan,
                  price,
                  status,
                  stripe_status,
                  billing_mode,
                  started_at,
                  current_period_end,
                  cancel_at_period_end,
                  updated_at
                FROM subscriptions
                WHERE professional_id=$1
                ORDER BY started_at ASC
              `,
              [p.id]
            )
          : []

      const payments=
        p
          ? await many(
              `
                SELECT
                  id,
                  professional_id,
                  invoice_id,
                  amount,
                  currency,
                  status,
                  provider,
                  hosted_invoice_url,
                  created_at
                FROM payments
                WHERE professional_id=$1
                ORDER BY created_at ASC
              `,
              [p.id]
            )
          : []

      const counts={
        bookings:bookings.length,
        sessions:sessions.length,
        identities:identities.length,
        favorites:favorites.length,
        notifications:notifications.length,
        bookingMessages:bookingMessages.length,
        reviews:reviews.length,
        supportTickets:supportTickets.length,
        supportMessages:supportMessages.length,
        reports:reports.length,
        verificationRequests:verificationRequests.length,
        verificationDocuments:verificationDocuments.length,
        subscriptions:subscriptions.length,
        payments:payments.length
      }

      res.json({
        exportedAt:now(),
        user:publicUser(u),
        professional:p,
        bookings,
        sessions,
        identities,
        favorites,
        notifications,
        bookingMessages,
        reviews,
        supportTickets,
        supportMessages,
        reports,
        verificationRequests,
        verificationDocuments,
        subscriptions,
        payments,
        exportMeta:{
          counts,
          bookingTotal:total,
          complete:
            bookings.length===total,
          secretFieldsExcluded:[
            'password_hash',
            'session.token_hash',
            'one_time_tokens',
            'verification_documents.storage_key',
            'booking_messages.body_encrypted',
            'booking_messages.sender_user_id',
            'support_messages.sender_user_id',
            'reviews.patient_id'
          ]
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

      const result=
        await accountDeletion.request(
          u.id
        )

      if(result.pending){

        const message=
          result.reason===
          'stripe_cancel_failed'
            ? '\u0397 \u03B4\u03B9\u03B1\u03B3\u03C1\u03B1\u03C6\u03AE \u03B8\u03B1 \u03BF\u03BB\u03BF\u03BA\u03BB\u03B7\u03C1\u03C9\u03B8\u03B5\u03AF \u03BC\u03CC\u03BB\u03B9\u03C2 \u03B1\u03BA\u03C5\u03C1\u03C9\u03B8\u03B5\u03AF \u03B7 \u03C3\u03C5\u03BD\u03B4\u03C1\u03BF\u03BC\u03AE.'
            : '\u0397 \u03B4\u03B9\u03B1\u03B3\u03C1\u03B1\u03C6\u03AE \u03B8\u03B1 \u03BF\u03BB\u03BF\u03BA\u03BB\u03B7\u03C1\u03C9\u03B8\u03B5\u03AF \u03BC\u03CC\u03BB\u03B9\u03C2 \u03B1\u03C6\u03B1\u03B9\u03C1\u03B5\u03B8\u03BF\u03CD\u03BD \u03BC\u03B5 \u03B1\u03C3\u03C6\u03AC\u03BB\u03B5\u03B9\u03B1 \u03C4\u03B1 \u03AD\u03B3\u03B3\u03C1\u03B1\u03C6\u03B1 \u03B5\u03C0\u03B1\u03BB\u03AE\u03B8\u03B5\u03C5\u03C3\u03B7\u03C2.'

        return res
          .status(202)
          .json({
            ok:true,
            pending:true,
            message
          })
      }

      if(
        !result.alreadyDeleted &&
        result.email
      ){
        mail
          .accountDeleted(
            result.email,
            result.name
          )
          .catch(
            ()=>{}
          )
      }

      clearSessionCookie(res)

      res.json({
        ok:true,
        deleted:true
      })
    }
  )

}