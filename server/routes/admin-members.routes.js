/**
 * MELEO v6.3.0
 * Admin Members routes.
 *
 * Admin authentication/authorization and admin rate limiting
 * remain path-scoped in relational/app.js.
 */

import Stripe from 'stripe'
import { tx } from '../relational/pool.js'
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
    limits,
    Sessions
  }) {
  /*
   * Temporary staging-only account inventory.
   *
   * Security:
   * - This module is mounted after /api/admin auth + admin-role middleware.
   * - Explicitly refuses to run outside NODE_ENV=staging.
   * - Read-only: it performs no UPDATE/DELETE and makes no Stripe API calls.
   *
   * Purpose:
   * - identify manually-created staging accounts
   * - show local Stripe customer/subscription references
   * - protect canonical E2E/demo identities from accidental cleanup
   *
   * Remove after staging account cleanup is completed.
   */
  app.get(
    '/api/admin/staging/account-inventory',
    async(req,res)=>{
      if(
        String(process.env.NODE_ENV||'')
          .trim()
          .toLowerCase()!=='staging'
      ){
        return res.status(404).json({
          error:'Not found'
        })
      }

      const canonicalDemoUserIds=new Set([
        'u_patient',
        'u_nurse1',
        'u_nurse2'
      ])

      const canonicalDemoEmails=new Set([
        'patient@meleo.gr',
        'maria@meleo.gr',
        'admin@meleo.gr'
      ])

      const rows=await many(`
        SELECT
          u.id,
          u.name,
          u.email,
          u.role,
          u.account_status AS "accountStatus",
          u.email_verified AS "emailVerified",
          u.created_at AS "createdAt",
          u.last_login_at AS "lastLoginAt",
          u.stripe_customer_id AS "stripeCustomerId",

          p.id AS "professionalId",
          p.specialty,
          p.city,
          p.verified,
          p.subscription_plan AS "subscriptionPlan",
          p.subscription_status AS "subscriptionStatus",
          p.subscription_price AS "subscriptionPrice",
          p.billing_mode AS "billingMode",
          p.stripe_subscription_id AS "stripeSubscriptionId",
          p.current_period_end AS "currentPeriodEnd",

          (
            SELECT count(*)::int
            FROM bookings b
            WHERE
              b.patient_id=u.id
              OR (
                p.id IS NOT NULL
                AND b.professional_id=p.id
              )
          ) AS "bookingCount",

          (
            SELECT count(*)::int
            FROM subscriptions s
            WHERE p.id IS NOT NULL
              AND s.professional_id=p.id
          ) AS "subscriptionRowCount",

          (
            SELECT count(*)::int
            FROM payments pay
            WHERE p.id IS NOT NULL
              AND pay.professional_id=p.id
          ) AS "paymentRowCount"

        FROM users u

        LEFT JOIN professionals p
          ON p.user_id=u.id

        WHERE u.deleted_at IS NULL

        ORDER BY
          u.created_at ASC,
          u.email ASC
      `)

      const items=rows.map(row=>{
        const email=
          String(row.email||'')
            .trim()
            .toLowerCase()

        const canonicalDemo=
          canonicalDemoUserIds.has(row.id) ||
          canonicalDemoEmails.has(email)

        return {
          ...row,
          subscriptionPrice:
            Number(row.subscriptionPrice||0),

          bookingCount:
            Number(row.bookingCount||0),

          subscriptionRowCount:
            Number(row.subscriptionRowCount||0),

          paymentRowCount:
            Number(row.paymentRowCount||0),

          inventoryClass:
            canonicalDemo
              ? 'canonical_demo'
              : 'manual_or_other',

          cleanupCandidate:
            !canonicalDemo
        }
      })

      const summary={
        total:items.length,
        canonicalDemo:
          items.filter(
            x=>x.inventoryClass==='canonical_demo'
          ).length,
        manualOrOther:
          items.filter(
            x=>x.inventoryClass==='manual_or_other'
          ).length,
        withStripeCustomer:
          items.filter(x=>!!x.stripeCustomerId).length,
        withStripeSubscription:
          items.filter(x=>!!x.stripeSubscriptionId).length
      }

      res.setHeader(
        'Cache-Control',
        'no-store'
      )

      res.json({
        environment:'staging',
        readOnly:true,
        summary,
        items
      })
    }
  )

  /*
   * TEMPORARY STAGING-ONLY destructive cleanup endpoint.
   *
   * Fixed allowlist:
   *   exactly seven approved staging test accounts.
   *
   * Safety properties:
   * - admin middleware inherited from /api/admin
   * - NODE_ENV must be staging
   * - explicit confirmation phrase required
   * - fixed user-id/email allowlist
   * - canonical demo accounts are blocked
   * - Stripe LIVE keys are rejected
   * - Stripe subscription/customer ownership is verified
   * - all Stripe objects are preflighted before cancellation
   * - already-cancelled subscriptions are retry-safe
   * - database cleanup runs in one transaction
   *
   * Stripe customers themselves are intentionally retained.
   *
   * Remove this endpoint after cleanup verification.
   */
  app.post(
    '/api/admin/staging/account-cleanup',
    async(req,res)=>{
      if(
        String(process.env.NODE_ENV||'')
          .trim()
          .toLowerCase()!=='staging'
      ){
        return res.status(404).json({
          error:'Not found'
        })
      }

      if(
        String(req.body?.confirm||'')!==
        'DELETE_STAGING_ACCOUNTS_7'
      ){
        return res.status(400).json({
          error:'Explicit staging cleanup confirmation required'
        })
      }

      const targets=[
        {
          id:'usr_d82068fd-a236-4175-835f-445cd7916a58',
          email:'eirprotogeraki@gmail.com'
        },
        {
          id:'usr_5c93f235-9a5f-40df-9f84-444d5678e665',
          email:'giozervakis@gmail.com'
        },
        {
          id:'usr_4f9d64f8-5f8f-4328-a266-c757491f68f2',
          email:'imblish@gmail.com'
        },
        {
          id:'usr_14eb7f35-c7da-491d-a7f8-4ad1720c796e',
          email:'rc2-a8-patient-f6d9da26ce48@example.invalid'
        },
        {
          id:'usr_647e73ed-8796-4d6f-b071-069da42a07e7',
          email:'rc2-a8-professional-f6d9da26ce48@example.invalid'
        },
        {
          id:'usr_6fd8b6e4-34eb-4b6a-9eb4-11c0b642d416',
          email:'kassmich@hotmail.com',
          stripeCustomerId:'cus_VACYJrj3t0lGnG',
          stripeSubscriptionId:'sub_1U9sXIKvEFUJ2hGu6ACXqWiy'
        },
        {
          id:'usr_0f413bb1-a3dd-497b-b11e-19ded0ff4200',
          email:'gzervakis1983@hotmail.com',
          stripeCustomerId:'cus_VAFBUf48Qf8tPh',
          stripeSubscriptionId:'sub_1U9uiGKvEFUJ2hGuTuVPcNVf'
        }
      ]

      const canonicalIds=new Set([
        'u_patient',
        'u_nurse1',
        'u_nurse2',
        'u_admin'
      ])

      const canonicalEmails=new Set([
        'patient@meleo.gr',
        'maria@meleo.gr',
        'nikos@meleo.gr',
        'admin@meleo.gr'
      ])

      for(const target of targets){
        const email=
          String(target.email||'')
            .trim()
            .toLowerCase()

        if(
          canonicalIds.has(target.id) ||
          canonicalEmails.has(email)
        ){
          return res.status(409).json({
            error:'Canonical staging identity detected; cleanup refused'
          })
        }
      }


      // ------------------------------------------------------
      // Database identity preflight
      // ------------------------------------------------------

      const targetIds=targets.map(x=>x.id)

      const dbRows=await many(`
        SELECT
          u.id,
          lower(u.email) AS email,
          u.stripe_customer_id AS "stripeCustomerId",
          p.id AS "professionalId",
          p.stripe_subscription_id AS "stripeSubscriptionId"

        FROM users u

        LEFT JOIN professionals p
          ON p.user_id=u.id

        WHERE u.id=ANY($1::text[])

        ORDER BY u.id
      `,[targetIds])

      if(dbRows.length!==targets.length){
        return res.status(409).json({
          error:'Cleanup preflight failed: expected seven target users',
          expected:targets.length,
          found:dbRows.length
        })
      }

      const dbById=new Map(
        dbRows.map(row=>[row.id,row])
      )

      for(const target of targets){
        const row=dbById.get(target.id)

        if(!row){
          return res.status(409).json({
            error:'Cleanup target missing from database',
            targetId:target.id
          })
        }

        if(
          String(row.email||'').trim().toLowerCase()!==
          String(target.email).trim().toLowerCase()
        ){
          return res.status(409).json({
            error:'Cleanup identity mismatch',
            targetId:target.id
          })
        }

        const expectedCustomer=
          target.stripeCustomerId||null

        const expectedSubscription=
          target.stripeSubscriptionId||null

        const actualCustomer=
          row.stripeCustomerId||null

        const actualSubscription=
          row.stripeSubscriptionId||null

        if(
          actualCustomer!==expectedCustomer ||
          actualSubscription!==expectedSubscription
        ){
          return res.status(409).json({
            error:'Stripe reference mismatch; cleanup refused',
            targetId:target.id
          })
        }
      }


      // ------------------------------------------------------
      // Stripe test-mode preflight
      // ------------------------------------------------------

      const stripeTargets=
        targets.filter(x=>x.stripeSubscriptionId)

      const stripeSecret=
        String(process.env.STRIPE_SECRET_KEY||'').trim()

      if(stripeTargets.length){
        if(
          stripeSecret.startsWith('sk_live_') ||
          stripeSecret.startsWith('rk_live_')
        ){
          return res.status(409).json({
            error:'LIVE Stripe credential detected; cleanup refused'
          })
        }

        if(
          !/^((sk|rk)_test_)/.test(stripeSecret)
        ){
          return res.status(409).json({
            error:'Stripe TEST credential required for staging cleanup'
          })
        }
      }

      let stripe=null

      if(stripeTargets.length){
        stripe=new Stripe(
          stripeSecret,
          {
            apiVersion:'2025-06-30.basil',
            maxNetworkRetries:2,
            timeout:20000
          }
        )
      }

      const stripePreflight=[]

      for(const target of stripeTargets){
        let subscription

        try{
          subscription=
            await stripe.subscriptions.retrieve(
              target.stripeSubscriptionId
            )
        }catch(err){
          return res.status(409).json({
            error:'Stripe subscription preflight failed',
            targetId:target.id,
            subscriptionId:target.stripeSubscriptionId,
            stripeCode:err?.code||null
          })
        }

        const customerId=
          typeof subscription.customer==='string'
            ? subscription.customer
            : subscription.customer?.id

        if(customerId!==target.stripeCustomerId){
          return res.status(409).json({
            error:'Stripe customer/subscription ownership mismatch',
            targetId:target.id,
            subscriptionId:target.stripeSubscriptionId
          })
        }

        stripePreflight.push({
          target,
          status:subscription.status
        })
      }


      // ------------------------------------------------------
      // Cancel Stripe TEST subscriptions.
      //
      // This intentionally happens before DB deletion.
      // If DB cleanup later fails, Stripe is safely cancelled
      // and the DB transaction rolls back, allowing retry.
      // ------------------------------------------------------

      const stripeResults=[]

      for(const item of stripePreflight){
        const {
          target,
          status
        }=item

        if(status==='canceled'){
          stripeResults.push({
            subscriptionId:target.stripeSubscriptionId,
            status:'already_canceled'
          })

          continue
        }

        try{
          const cancelled=
            await stripe.subscriptions.cancel(
              target.stripeSubscriptionId
            )

          stripeResults.push({
            subscriptionId:target.stripeSubscriptionId,
            status:cancelled.status
          })
        }catch(err){
          return res.status(502).json({
            error:'Stripe TEST subscription cancellation failed',
            targetId:target.id,
            subscriptionId:target.stripeSubscriptionId,
            stripeCode:err?.code||null,
            alreadyProcessed:stripeResults
          })
        }
      }


      // ------------------------------------------------------
      // Transactional PostgreSQL cleanup
      // ------------------------------------------------------

      const dbResult=await tx(async client=>{
        const locked=await client.query(`
          SELECT
            u.id,
            lower(u.email) AS email,
            p.id AS professional_id

          FROM users u

          LEFT JOIN professionals p
            ON p.user_id=u.id

          WHERE u.id=ANY($1::text[])

          ORDER BY u.id

          FOR UPDATE OF u
        `,[targetIds])

        if(locked.rows.length!==targets.length){
          throw new Error(
            'STAGING_CLEANUP_TARGET_SET_CHANGED'
          )
        }

        for(const target of targets){
          const row=
            locked.rows.find(x=>x.id===target.id)

          if(
            !row ||
            row.email!==
              String(target.email).trim().toLowerCase()
          ){
            throw new Error(
              'STAGING_CLEANUP_IDENTITY_CHANGED'
            )
          }
        }

        const professionalIds=
          locked.rows
            .map(x=>x.professional_id)
            .filter(Boolean)


        // Users may have reviewed other professionals.
        await client.query(`
          UPDATE verification_requests
          SET
            reviewed_by=NULL,
            reviewed_at=
              CASE
                WHEN reviewed_by=ANY($1::text[])
                  THEN reviewed_at
                ELSE reviewed_at
              END
          WHERE reviewed_by=ANY($1::text[])
        `,[targetIds])


        // Messages may belong to bookings/tickets that survive.
        await client.query(`
          DELETE FROM booking_messages
          WHERE sender_user_id=ANY($1::text[])
        `,[targetIds])

        await client.query(`
          DELETE FROM support_messages
          WHERE sender_user_id=ANY($1::text[])
        `,[targetIds])


        // Reviews have non-cascade patient/professional FKs.
        if(professionalIds.length){
          await client.query(`
            DELETE FROM reviews
            WHERE
              patient_id=ANY($1::text[])
              OR professional_id=ANY($2::text[])
          `,[targetIds,professionalIds])
        }else{
          await client.query(`
            DELETE FROM reviews
            WHERE patient_id=ANY($1::text[])
          `,[targetIds])
        }


        // Bookings have non-cascade patient/professional FKs.
        // booking_messages and reviews tied to deleted bookings
        // cascade from booking_id.
        if(professionalIds.length){
          await client.query(`
            DELETE FROM bookings
            WHERE
              patient_id=ANY($1::text[])
              OR professional_id=ANY($2::text[])
          `,[targetIds,professionalIds])
        }else{
          await client.query(`
            DELETE FROM bookings
            WHERE patient_id=ANY($1::text[])
          `,[targetIds])
        }


        // Support tickets and their child messages.
        await client.query(`
          DELETE FROM support_tickets
          WHERE user_id=ANY($1::text[])
        `,[targetIds])


        // User reports have a non-cascade FK.
        await client.query(`
          DELETE FROM reports
          WHERE reporter_user_id=ANY($1::text[])
        `,[targetIds])


        // Do not keep detached test-payment records.
        if(professionalIds.length){
          await client.query(`
            DELETE FROM payments
            WHERE professional_id=ANY($1::text[])
          `,[professionalIds])
        }


        // Final user deletion cascades:
        // professionals -> subscriptions/verification/analytics/
        // availability/favorites, plus sessions, tokens,
        // notifications, identities and live events.
        const deleted=await client.query(`
          DELETE FROM users
          WHERE id=ANY($1::text[])
          RETURNING id
        `,[targetIds])

        if(deleted.rows.length!==targets.length){
          throw new Error(
            'STAGING_CLEANUP_DELETE_COUNT_MISMATCH'
          )
        }

        return {
          deletedUserIds:
            deleted.rows.map(x=>x.id).sort(),

          deletedUserCount:
            deleted.rows.length,

          professionalIds:
            professionalIds.sort()
        }
      })


      res.setHeader(
        'Cache-Control',
        'no-store'
      )

      return res.json({
        ok:true,
        environment:'staging',
        destructive:true,
        deletedUserCount:dbResult.deletedUserCount,
        deletedUserIds:dbResult.deletedUserIds,
        deletedProfessionalIds:dbResult.professionalIds,
        stripeSubscriptions:stripeResults,
        stripeCustomersDeleted:false
      })
    }
  )

  app.get('/api/admin/members',async(req,res)=>{const {page,limit,offset}=pagination(req.query,{defaultLimit:30,maxLimit:100});const q=str(req.query.q,100),role=str(req.query.role,30);const where=["u.deleted_at IS NULL","u.role<>'admin'"],vals=[];let i=1;if(q){where.push(`(u.name ILIKE $${i} OR u.email ILIKE $${i})`);vals.push(`%${q}%`);i++}if(role){where.push(`u.role=$${i++}`);vals.push(role)}vals.push(limit,offset);const rows=await many(`SELECT u.id,u.name,u.email,u.phone,u.role,u.email_verified "emailVerified",u.account_status "accountStatus",u.suspended_at "suspendedAt",u.suspension_reason "suspensionReason",u.deletion_pending "deletionPending",u.last_login_at "lastLoginAt",u.created_at "createdAt",p.id "professionalId",p.specialty,p.verified,p.featured,p.rating,p.reviews_count reviews,p.city,p.subscription_plan "subscriptionPlan",p.subscription_status "subscriptionStatus",p.subscription_price "subscriptionPrice",p.billing_mode "billingMode",p.current_period_end "currentPeriodEnd",p.onboarding_stage "onboardingStage",p.onboarding_completed "onboardingCompleted",v.id "verificationRequestId",v.status "verificationStatus" FROM users u LEFT JOIN professionals p ON p.user_id=u.id LEFT JOIN LATERAL (SELECT id,status FROM verification_requests vr WHERE vr.professional_id=p.id ORDER BY submitted_at DESC LIMIT 1) v ON true WHERE ${where.join(' AND ')} ORDER BY u.created_at DESC LIMIT $${i++} OFFSET $${i}`,[...vals]);const items=rows.map(m=>{let lifecycleStatus='';if(m.deletionPending)lifecycleStatus='deletion_pending';else if(m.role==='professional'){if(m.verified)lifecycleStatus='approved';else if(m.verificationStatus==='pending')lifecycleStatus='pending_verification';else if(m.verificationStatus==='rejected')lifecycleStatus='verification_rejected';else if(!['active','past_due'].includes(m.subscriptionStatus||''))lifecycleStatus='awaiting_subscription';else if(!m.specialty||!m.city)lifecycleStatus='profile_incomplete';else lifecycleStatus='verification_required'}return {...m,lifecycleStatus,subscriptionPrice:Number(m.subscriptionPrice||0),rating:Number(m.rating||0),reviews:Number(m.reviews||0)}});const c=await one(`SELECT count(*)::int total FROM users u WHERE u.deleted_at IS NULL AND u.role<>'admin'`);res.json({items,page,limit,total:c.total,totalPages:Math.ceil(c.total/limit)})})

  app.patch('/api/admin/members/:id/action',limits.write,async(req,res)=>{const u=await Users.byId(req.params.id);if(!u)return res.status(404).json({error:'Not found'});const p=u.role==='professional'?await Professionals.byUser(u.id):null,action=str(req.body.action,40),reason=str(req.body.reason,500);if(action==='suspend'){await Users.update(u.id,{account_status:'suspended',suspended_at:now(),suspension_reason:reason});await Sessions.revokeUser(u.id)}else if(action==='reactivate')await Users.update(u.id,{account_status:'active',suspended_at:null,suspension_reason:''});else if(action==='verify'&&p)await Professionals.update(p.id,{verified:true,onboardingStage:'approved',onboardingCompleted:true});else if(action==='unverify'&&p)await Professionals.update(p.id,{verified:false,onboardingStage:'verification'});else if(action==='feature'&&p&&p.subscriptionPlan==='premium')await Professionals.update(p.id,{featured:true});else if(action==='unfeature'&&p)await Professionals.update(p.id,{featured:false});else return res.status(400).json({error:'Μη έγκυρη ενέργεια.'});await audit(req.user.id,`admin.member.${action}`,{targetUserId:u.id,reason});res.json({ok:true})})
}
