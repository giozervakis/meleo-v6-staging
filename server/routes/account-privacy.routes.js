import { createAccountDeletionService } from '../services/account-deletion.service.js'

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