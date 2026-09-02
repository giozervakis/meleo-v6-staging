/**
 * MELEO v6.3.0
 * Admin Members routes.
 *
 * Admin authentication/authorization and admin rate limiting
 * remain path-scoped in relational/app.js.
 */

export function registerAdminMembersRoutes({
  app,
  one,
  many,
  pagination,
  id,
  str,
  now,
  audit,
  Users,
  Professionals,
  tx,
  limits,
  Sessions
}) {
  app.get('/api/admin/members',async(req,res)=>{const {page,limit,offset}=pagination(req.query,{defaultLimit:30,maxLimit:100});const q=str(req.query.q,100),role=str(req.query.role,30);const where=["u.deleted_at IS NULL","u.role<>'admin'"],vals=[];let i=1;if(q){where.push(`(u.name ILIKE $${i} OR u.email ILIKE $${i})`);vals.push(`%${q}%`);i++}if(role){where.push(`u.role=$${i++}`);vals.push(role)}vals.push(limit,offset);const rows=await many(`SELECT u.id,u.name,u.email,u.phone,u.role,u.email_verified "emailVerified",u.account_status "accountStatus",u.suspended_at "suspendedAt",u.suspension_reason "suspensionReason",u.deletion_pending "deletionPending",u.last_login_at "lastLoginAt",u.created_at "createdAt",p.id "professionalId",p.specialty,p.verified,p.featured,p.rating,p.reviews_count reviews,p.city,p.subscription_plan "subscriptionPlan",p.subscription_status "subscriptionStatus",p.subscription_price "subscriptionPrice",p.billing_mode "billingMode",p.current_period_end "currentPeriodEnd",p.onboarding_stage "onboardingStage",p.onboarding_completed "onboardingCompleted",v.id "verificationRequestId",v.status "verificationStatus" FROM users u LEFT JOIN professionals p ON p.user_id=u.id LEFT JOIN LATERAL (SELECT id,status FROM verification_requests vr WHERE vr.professional_id=p.id ORDER BY submitted_at DESC LIMIT 1) v ON true WHERE ${where.join(' AND ')} ORDER BY u.created_at DESC LIMIT $${i++} OFFSET $${i}`,[...vals]);const items=rows.map(m=>{let lifecycleStatus='';if(m.deletionPending)lifecycleStatus='deletion_pending';else if(m.role==='professional'){if(m.verified)lifecycleStatus='approved';else if(m.verificationStatus==='pending')lifecycleStatus='pending_verification';else if(m.verificationStatus==='rejected')lifecycleStatus='verification_rejected';else if(!['active','past_due'].includes(m.subscriptionStatus||''))lifecycleStatus='awaiting_subscription';else if(!m.specialty||!m.city)lifecycleStatus='profile_incomplete';else lifecycleStatus='verification_required'}return {...m,lifecycleStatus,subscriptionPrice:Number(m.subscriptionPrice||0),rating:Number(m.rating||0),reviews:Number(m.reviews||0)}});const c=await one(`SELECT count(*)::int total FROM users u WHERE u.deleted_at IS NULL AND u.role<>'admin'`);res.json({items,page,limit,total:c.total,totalPages:Math.ceil(c.total/limit)})})

  app.patch(
    '/api/admin/members/:id/action',
    limits.write,
    async(req,res)=>{

      const u=
        await Users.byId(
          req.params.id
        )

      if(!u){
        return res
          .status(404)
          .json({
            error:'Not found'
          })
      }

      const p=
        u.role==='professional'
          ? await Professionals.byUser(
              u.id
            )
          : null

      const action=
        str(
          req.body.action,
          40
        )

      const reason=
        str(
          req.body.reason,
          500
        )

      const validAction =
        action==='suspend' ||
        action==='reactivate' ||
        (
          action==='verify' &&
          p
        ) ||
        (
          action==='unverify' &&
          p
        ) ||
        (
          action==='feature' &&
          p &&
          p.subscriptionPlan==='premium'
        ) ||
        (
          action==='unfeature' &&
          p
        )

      if(!validAction){
        return res
          .status(400)
          .json({
            error:
              'Μη έγκυρη ενέργεια.'
          })
      }

      await tx(
        async client=>{

          if(
            action==='suspend'
          ){
            await client.query(
              `
                UPDATE users
                SET
                  account_status='suspended',
                  suspended_at=$2,
                  suspension_reason=$3,
                  updated_at=now()
                WHERE id=$1
              `,
              [
                u.id,
                now(),
                reason
              ]
            )

            await client.query(
              `
                DELETE FROM sessions
                WHERE user_id=$1
              `,
              [u.id]
            )
          }

          else if(
            action==='reactivate'
          ){
            await client.query(
              `
                UPDATE users
                SET
                  account_status='active',
                  suspended_at=NULL,
                  suspension_reason='',
                  updated_at=now()
                WHERE id=$1
              `,
              [u.id]
            )
          }

          else if(
            action==='verify'
          ){
            await client.query(
              `
                UPDATE professionals
                SET
                  verified=true,
                  onboarding_stage='approved',
                  onboarding_completed=true,
                  updated_at=now()
                WHERE id=$1
              `,
              [p.id]
            )
          }

          else if(
            action==='unverify'
          ){
            await client.query(
              `
                UPDATE professionals
                SET
                  verified=false,
                  onboarding_stage='verification',
                  updated_at=now()
                WHERE id=$1
              `,
              [p.id]
            )
          }

          else if(
            action==='feature'
          ){
            await client.query(
              `
                UPDATE professionals
                SET
                  featured=true,
                  updated_at=now()
                WHERE id=$1
              `,
              [p.id]
            )
          }

          else if(
            action==='unfeature'
          ){
            await client.query(
              `
                UPDATE professionals
                SET
                  featured=false,
                  updated_at=now()
                WHERE id=$1
              `,
              [p.id]
            )
          }

          await audit(
            req.user.id,
            `admin.member.${action}`,
            {
              targetUserId:
                u.id,
              reason
            },
            client
          )
        }
      )

      res.json({
        ok:true
      })
    }
  )

}
