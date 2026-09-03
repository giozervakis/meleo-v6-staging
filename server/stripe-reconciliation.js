import Stripe from 'stripe'
import { config } from './config.js'
import {
  one,
  many,
  sql,
  tx,
  id,
  now
} from './relational/pool.js'
import {
  Professionals
} from './relational/repositories.js'
import { log } from './logger.js'


const PLANS = {
  basic: {
    id: 'basic',
    price: 9.99
  },

  premium: {
    id: 'premium',
    price: 14.99
  }
}


let stripe = null


export function getReconciliationStripe() {
  if (!config.stripeEnabled) {
    return null
  }

  if (!stripe) {
    stripe = new Stripe(
      config.stripe.secretKey,
      {
        apiVersion: '2025-06-30.basil',
        maxNetworkRetries: 2,
        timeout: 20000
      }
    )
  }

  return stripe
}


function isPlan(value) {
  return (
    value === 'basic' ||
    value === 'premium'
  )
}


export function mapReconciliationStripeStatus(status) {
  switch (String(status || '')) {

    case 'active':
    case 'trialing':
      return 'active'

    case 'past_due':
    case 'unpaid':
      return 'past_due'

    case 'canceled':
    case 'incomplete_expired':
      return 'cancelled'

    case 'paused':
      return 'paused'

    default:
      return 'pending'
  }
}


function derivePlan(subscription) {

  const price =
    subscription
      ?.items
      ?.data
      ?.[0]
      ?.price

  const priceId =
    String(
      price?.id || ''
    )

  if (
    config.stripe.pricePremium &&
    priceId === config.stripe.pricePremium
  ) {
    return 'premium'
  }

  if (
    config.stripe.priceBasic &&
    priceId === config.stripe.priceBasic
  ) {
    return 'basic'
  }

  const error =
    new Error(
      'Unknown Stripe subscription Price ID'
    )

  error.code =
    'STRIPE_UNKNOWN_PRICE'

  error.stripeSubscriptionId =
    subscription?.id || null

  error.stripePriceId =
    priceId || null

  throw error
}


function stripePeriodEnd(subscription) {

  const raw =
    subscription
      ?.items
      ?.data
      ?.[0]
      ?.current_period_end ??
    subscription?.current_period_end

  if (!raw) {
    return null
  }

  const value =
    new Date(
      Number(raw) * 1000
    )

  if (
    Number.isNaN(
      value.getTime()
    )
  ) {
    return null
  }

  return value.toISOString()
}


async function professionalForSubscription(
  subscription
) {

  const userId =
    subscription
      ?.metadata
      ?.meleoUserId

  if (userId) {

    const professional =
      await Professionals.byUser(
        userId
      )

    if (professional) {
      return professional
    }
  }

  if (!subscription?.id) {
    return null
  }

  const row =
    await one(
      `SELECT user_id
       FROM professionals
       WHERE stripe_subscription_id=$1`,
      [subscription.id]
    )

  if (!row?.user_id) {
    return null
  }

  return Professionals.byUser(
    row.user_id
  )
}


export async function applyReconciledSubscription(
  subscription
) {

  const professional =
    await professionalForSubscription(
      subscription
    )

  if (!professional) {

    log.warn(
      'stripe.reconcile.unmatched_subscription',
      {
        stripeSubscriptionId:
          subscription?.id || null
      }
    )

    return {
      matched: false,
      changed: false
    }
  }


  const plan =
    derivePlan(subscription)

  const status =
    mapReconciliationStripeStatus(
      subscription.status
    )

  const periodEnd =
    stripePeriodEnd(
      subscription
    )

  const cancelAtPeriodEnd =
    Boolean(
      subscription.cancel_at_period_end
    )

  const featured =
    plan === 'premium' &&
    status === 'active'


  const current = {
    plan:
      professional.subscriptionPlan,

    price:
      Number(
        professional.subscriptionPrice || 0
      ),

    status:
      professional.subscriptionStatus,

    stripeSubscriptionId:
      professional.stripeSubscriptionId,

    periodEnd:
      professional.currentPeriodEnd
        ? new Date(
            professional.currentPeriodEnd
          ).toISOString()
        : null,

    cancelAtPeriodEnd:
      Boolean(
        professional.cancelAtPeriodEnd
      ),

    featured:
      Boolean(
        professional.featured
      ),

    billingMode:
      professional.billingMode
  }


  const desired = {
    plan,

    price:
      PLANS[plan].price,

    status,

    stripeSubscriptionId:
      subscription.id,

    periodEnd,

    cancelAtPeriodEnd,

    featured,

    billingMode: 'stripe'
  }


  const changed =
    current.plan !== desired.plan ||

    Number(current.price) !==
      Number(desired.price) ||

    current.status !== desired.status ||

    current.stripeSubscriptionId !==
      desired.stripeSubscriptionId ||

    current.periodEnd !==
      desired.periodEnd ||

    current.cancelAtPeriodEnd !==
      desired.cancelAtPeriodEnd ||

    current.featured !==
      desired.featured ||

    current.billingMode !==
      desired.billingMode


  const patch = {
    subscriptionPlan:
      desired.plan,

    subscriptionPrice:
      desired.price,

    subscriptionStatus:
      desired.status,

    billingMode:
      desired.billingMode,

    stripeSubscriptionId:
      desired.stripeSubscriptionId,

    currentPeriodEnd:
      desired.periodEnd,

    cancelAtPeriodEnd:
      desired.cancelAtPeriodEnd,

    featured:
      desired.featured
  }


  if (
    status === 'past_due' &&
    !professional.pastDueSince
  ) {
    patch.pastDueSince = now()
  }


  if (status === 'active') {

    patch.pastDueSince = null

    if (
      !professional.subscriptionSince
    ) {
      patch.subscriptionSince = now()
    }

    if (
      !professional.onboardingStage ||
      professional.onboardingStage === 'plan'
    ) {
      patch.onboardingStage =
        'profile'
    }
  }


  if (changed) {

    await Professionals.update(
      professional.id,
      patch
    )
  }


  await sql(
    `INSERT INTO subscriptions(
       id,
       professional_id,
       stripe_subscription_id,
       plan,
       price,
       status,
       stripe_status,
       billing_mode,
       started_at,
       current_period_end,
       cancel_at_period_end
     )
     VALUES(
       $1,$2,$3,$4,$5,$6,$7,
       'stripe',
       now(),
       $8,$9
     )
     ON CONFLICT(stripe_subscription_id)
     DO UPDATE SET
       plan=$4,
       price=$5,
       status=$6,
       stripe_status=$7,
       current_period_end=$8,
       cancel_at_period_end=$9,
       updated_at=now()`,
    [
      id('sub'),
      professional.id,
      subscription.id,
      plan,
      PLANS[plan].price,
      status,
      subscription.status,
      periodEnd,
      cancelAtPeriodEnd
    ]
  )


  if (changed) {

    log.warn(
      'stripe.reconcile.corrected',
      {
        professionalId:
          professional.id,

        stripeSubscriptionId:
          subscription.id,

        previousStatus:
          current.status,

        stripeStatus:
          subscription.status,

        resolvedStatus:
          status,

        previousPlan:
          current.plan,

        resolvedPlan:
          plan
      }
    )
  }


  return {
    matched: true,
    changed,
    professionalId:
      professional.id
  }
}


async function listKnownStripeSubscriptionIds() {

  const rows =
    await many(
      `SELECT DISTINCT
         stripe_subscription_id
       FROM professionals
       WHERE stripe_subscription_id IS NOT NULL
         AND stripe_subscription_id <> ''`
    )

  return rows
    .map(
      row =>
        String(
          row.stripe_subscription_id || ''
        )
    )
    .filter(Boolean)
}


export async function reconcileStripeSubscriptions({
  limit = 500
} = {}) {

  const client =
    getReconciliationStripe()

  if (!client) {
    throw new Error(
      'Stripe reconciliation unavailable: Stripe is not configured'
    )
  }


  const ids =
    await listKnownStripeSubscriptionIds()

  const max =
    Math.max(
      1,
      Math.min(
        Number(limit) || 500,
        5000
      )
    )


  const selected =
    ids.slice(0, max)


  const summary = {
    scanned:
      selected.length,

    matched: 0,

    corrected: 0,

    unchanged: 0,

    missingAtStripe: 0,

    failed: 0
  }


  for (
    const stripeSubscriptionId
    of selected
  ) {

    try {

      const subscription =
        await client
          .subscriptions
          .retrieve(
            stripeSubscriptionId
          )


      const result =
        await applyReconciledSubscription(
          subscription
        )


      if (!result.matched) {
        continue
      }


      summary.matched++


      if (result.changed) {
        summary.corrected++
      } else {
        summary.unchanged++
      }

    } catch (err) {

      const statusCode =
        Number(
          err?.statusCode ||
          err?.status ||
          0
        )


      if (statusCode === 404) {

        summary.missingAtStripe++

        log.warn(
          'stripe.reconcile.subscription_missing',
          {
            stripeSubscriptionId
          }
        )

        continue
      }


      summary.failed++


      log.error(
        'stripe.reconcile.subscription_failed',
        {
          stripeSubscriptionId,

          message:
            err?.message ||
            String(err)
        }
      )
    }
  }


  log.info(
    'stripe.reconcile.completed',
    summary
  )


  /*
   * If Stripe itself is unavailable and every call failed,
   * make the worker retry the job instead of falsely marking
   * reconciliation as successful.
   */
  if (
    summary.scanned > 0 &&
    summary.failed ===
      summary.scanned
  ) {
    throw new Error(
      'Stripe reconciliation failed for every subscription'
    )
  }


  return summary
}


export async function scheduleStripeReconciliation({
  delaySeconds = 0,
  reason = 'scheduled'
} = {}) {

  if (!config.stripeEnabled) {

    return {
      scheduled: false,
      reason: 'stripe_disabled'
    }
  }


  /*
   * D10H.5
   *
   * Serialize the pending/processing singleton decision in
   * PostgreSQL itself.
   *
   * A plain SELECT followed by INSERT is race-prone when
   * multiple workers perform scheduling simultaneously.
   * The transaction-scoped advisory lock makes the check +
   * insert one serialized scheduler critical section.
   */
  const delay =
    String(
      Math.max(
        0,
        Number(delaySeconds) || 0
      )
    )


  const result =
    await tx(
      async client=>{

        await client.query(
          `SELECT pg_advisory_xact_lock(
             hashtext($1)
           )`,
          [
            'meleo:stripe_reconcile:scheduler'
          ]
        )


        const existingResult =
          await client.query(
            `SELECT id
             FROM background_jobs
             WHERE job_type='stripe_reconcile'
               AND status IN (
                 'pending',
                 'processing'
               )
             ORDER BY created_at ASC
             LIMIT 1`
          )


        const existing =
          existingResult.rows?.[0] ||
          null


        if(existing?.id){
          return {
            scheduled:false,
            reason:'already_queued',
            jobId:existing.id
          }
        }


        const jobId =
          id('job')


        await client.query(
          `INSERT INTO background_jobs(
             id,
             job_type,
             payload,
             status,
             priority,
             attempts,
             max_attempts,
             run_at
           )
           VALUES(
             $1,
             'stripe_reconcile',
             $2::jsonb,
             'pending',
             40,
             0,
             5,
             now()+($3||' seconds')::interval
           )`,
          [
            jobId,

            JSON.stringify({
              reason,
              createdAt:
                new Date().toISOString()
            }),

            delay
          ]
        )


        return {
          scheduled:true,
          jobId
        }
      }
    )


  if(result.scheduled){
    log.info(
      'stripe.reconcile.scheduled',
      {
        jobId:result.jobId,
        delaySeconds:
          Number(delay),
        reason
      }
    )
  }


  return result
}
