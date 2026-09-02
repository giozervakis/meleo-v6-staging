/*
 * MELEO v6.3.0
 *
 * Professional billing / Stripe domain service.
 *
 * This service is shared by:
 *   - Stripe webhook processing
 *   - professional subscription HTTP routes
 *
 * Stripe state mutation therefore has one canonical
 * implementation regardless of entry point.
 */

export function createBillingService(
  deps
) {
  const {
    getStripe,
    Users,
    Professionals,
    Notifications,
    mail,
    sql,
    one,
    tx,
    id,
    now,
    PLANS,
    isPlan,
    mapStripeStatus,
    priceIdFor
  } = deps

  async function ensureStripeCustomer(u){if(u.stripe_customer_id)return u.stripe_customer_id;const s=getStripe();const c=await s.customers.create({email:u.email,name:u.name,phone:u.phone||undefined,metadata:{meleoUserId:u.id}});await Users.update(u.id,{stripe_customer_id:c.id});return c.id}

  async function applyStripeSubscription(
    sub,
    notifyUser=false,
    eventContext=null
  ){
    const uid=
      sub.metadata?.meleoUserId

    let p=
      uid
        ? await Professionals.byUser(uid)
        : null

    if(
      !p &&
      sub.id
    ){
      const r=
        await one(
          'SELECT user_id FROM professionals WHERE stripe_subscription_id=$1',
          [sub.id]
        )

      if(r){
        p=
          await Professionals.byUser(
            r.user_id
          )
      }
    }

    if(!p){
      return null
    }

    const incomingEventCreated=
      Number(
        eventContext?.eventCreated ||
        0
      ) ||
      null

    const incomingEventId=
      eventContext?.eventId
        ? String(
            eventContext.eventId
          )
        : null

    const priceId=
      String(
        sub.items?.data?.[0]?.price?.id ||
        ''
      )

    let plan=null

    if(
      priceId &&
      priceId===priceIdFor('premium')
    ){
      plan='premium'
    }
    else if(
      priceId &&
      priceId===priceIdFor('basic')
    ){
      plan='basic'
    }

    if(!plan){
      const error=
        new Error(
          'Unknown Stripe subscription Price ID'
        )

      error.code=
        'STRIPE_UNKNOWN_PRICE'

      error.stripeSubscriptionId=
        sub.id ||
        null

      error.stripePriceId=
        priceId ||
        null

      throw error
    }

    const status=
      mapStripeStatus(
        sub.status
      )

    const period=
      sub.items?.data?.[0]?.current_period_end ??
      sub.current_period_end

    const currentPeriodEnd=
      period
        ? new Date(
            period*1000
          ).toISOString()
        : null

    let applied=false

    await tx(
      async client=>{

        /*
         * One professional row serializes every local subscription
         * mutation, regardless of whether the caller is a webhook,
         * checkout return, admin sync, or reconciliation path.
         *
         * No Stripe/network call occurs inside this transaction.
         */
        const lockedResult=
          await client.query(
            `SELECT
               id,
               user_id,
               subscription_since,
               onboarding_stage,
               past_due_since
             FROM professionals
             WHERE id=$1
             FOR UPDATE`,
            [p.id]
          )

        const locked=
          lockedResult.rows[0]

        if(!locked){
          return
        }

        /*
         * Webhook ordering protection is needed only when Stripe
         * event metadata is supplied.
         */
        if(eventContext){
          const ledgerResult=
            await client.query(
              `SELECT
                 last_stripe_event_created,
                 last_stripe_event_id
               FROM subscriptions
               WHERE stripe_subscription_id=$1`,
              [sub.id]
            )

          const ledger=
            ledgerResult.rows[0] ||
            null

          const lastEventCreated=
            Number(
              ledger?.last_stripe_event_created ||
              0
            ) ||
            null

          const lastEventId=
            ledger?.last_stripe_event_id
              ? String(
                  ledger.last_stripe_event_id
                )
              : null

          if(
            incomingEventCreated &&
            lastEventCreated &&
            incomingEventCreated <
              lastEventCreated
          ){
            return
          }

          if(
            incomingEventCreated &&
            lastEventCreated &&
            incomingEventCreated ===
              lastEventCreated &&
            incomingEventId &&
            incomingEventId ===
              lastEventId
          ){
            return
          }
        }

        const nextPastDueSince=
          status==='past_due'
            ? (
                locked.past_due_since ||
                now()
              )
            : status==='active'
              ? null
              : locked.past_due_since

        const nextSubscriptionSince=
          status==='active' &&
          !locked.subscription_since
            ? now()
            : locked.subscription_since

        const nextOnboardingStage=
          status==='active' &&
          (
            !locked.onboarding_stage ||
            locked.onboarding_stage==='plan'
          )
            ? 'profile'
            : locked.onboarding_stage

        await client.query(
          `UPDATE professionals
           SET
             subscription_plan=$2,
             subscription_price=$3,
             subscription_status=$4,
             billing_mode='stripe',
             stripe_subscription_id=$5,
             current_period_end=$6,
             cancel_at_period_end=$7,
             featured=$8,
             past_due_since=$9,
             subscription_since=$10,
             onboarding_stage=$11,
             updated_at=now()
           WHERE id=$1`,
          [
            p.id,
            plan,
            PLANS[plan].price,
            status,
            sub.id,
            currentPeriodEnd,
            !!sub.cancel_at_period_end,
            plan==='premium' &&
              status==='active',
            nextPastDueSince,
            nextSubscriptionSince,
            nextOnboardingStage
          ]
        )

        /*
         * Professional state and subscription ledger commit together.
         *
         * For non-webhook callers the incoming ordering fields are NULL,
         * therefore previous webhook ordering metadata is preserved.
         */
        await client.query(
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
             cancel_at_period_end,
             last_stripe_event_created,
             last_stripe_event_id
           )
           VALUES(
             $1,$2,$3,$4,$5,$6,$7,
             'stripe',
             now(),
             $8,$9,$10,$11
           )
           ON CONFLICT(stripe_subscription_id)
           DO UPDATE SET
             plan=$4,
             price=$5,
             status=$6,
             stripe_status=$7,
             current_period_end=$8,
             cancel_at_period_end=$9,
             last_stripe_event_created=
               COALESCE(
                 $10,
                 subscriptions.last_stripe_event_created
               ),
             last_stripe_event_id=
               CASE
                 WHEN $10 IS NULL
                 THEN subscriptions.last_stripe_event_id
                 ELSE $11
               END,
             updated_at=now()`,
          [
            id('sub'),
            p.id,
            sub.id,
            plan,
            PLANS[plan].price,
            status,
            sub.status,
            currentPeriodEnd,
            !!sub.cancel_at_period_end,
            incomingEventCreated,
            incomingEventId
          ]
        )

        /*
         * Durable notification belongs to the same local transaction.
         * Mail remains post-commit because it is an external side effect.
         */
        if(
          notifyUser &&
          status==='active'
        ){
          await Notifications.create(
            locked.user_id,
            'subscription',
            `Η συνδρομή ${plan.toUpperCase()} είναι ενεργή`,
            `${PLANS[plan].price.toFixed(2)}€/μήνα`,
            {},
            client
          )
        }

        applied=true
      }
    )

    p=
      await Professionals.byId(
        p.id
      )

    if(
      applied &&
      notifyUser &&
      status==='active' &&
      p
    ){
      const u=
        await Users.byId(
          p.userId
        )

      if(u){
        mail
          .subscriptionActive(
            u.email,
            u.name,
            plan.toUpperCase(),
            PLANS[plan].price.toFixed(2)
          )
          .catch(
            ()=>{}
          )
      }
    }

    return p
  }

  async function recordInvoice(
    inv,
    status
  ){
    let p=null

    const subscriptionRef=
      inv.subscription ||
      inv.parent?.subscription_details?.subscription ||
      inv.metadata?.meleoSubscriptionId ||
      null

    const subscriptionId=
      typeof subscriptionRef==='string'
        ? subscriptionRef
        : subscriptionRef?.id

    if(subscriptionId){
      const row=
        await one(
          'SELECT user_id FROM professionals WHERE stripe_subscription_id=$1',
          [String(subscriptionId)]
        )

      if(row){
        p=
          await Professionals.byUser(
            row.user_id
          )
      }
    }

    if(
      !p &&
      inv.metadata?.meleoProfessionalId
    ){
      p=
        await Professionals.byId(
          String(
            inv.metadata.meleoProfessionalId
          )
        )
    }

    if(
      !p &&
      inv.customer
    ){
      const customerId=
        typeof inv.customer==='string'
          ? inv.customer
          : inv.customer?.id

      if(customerId){
        const row=
          await one(
            `SELECT p.user_id
             FROM professionals p
             JOIN users u
               ON u.id=p.user_id
             WHERE u.stripe_customer_id=$1
             LIMIT 1`,
            [customerId]
          )

        if(row){
          p=
            await Professionals.byUser(
              row.user_id
            )
        }
      }
    }

    const purpose=
      String(
        inv.metadata?.meleoPurpose ||
        ''
      )

    const isPlanUpgrade=
      purpose==='plan_upgrade'

    let ignored=null
    let sendPaymentFailureMail=false

    await tx(
      async client=>{

        /*
         * Failed must never overwrite an invoice already observed as paid.
         * Check and mutation occur inside the same transaction.
         */
        if(status==='failed'){
          const alreadyPaidResult=
            await client.query(
              `SELECT 1 ok
               FROM payments
               WHERE invoice_id=$1
                 AND status='paid'
               LIMIT 1
               FOR UPDATE`,
              [inv.id]
            )

          if(
            alreadyPaidResult.rows[0]
          ){
            ignored={
              ignored:true,
              reason:'already_paid'
            }

            return
          }
        }

        /*
         * Once paid is authoritative, stale failed history for the same
         * invoice is removed atomically with the paid UPSERT.
         */
        if(status==='paid'){
          await client.query(
            `DELETE FROM payments
             WHERE invoice_id=$1
               AND status='failed'`,
            [inv.id]
          )
        }

        await client.query(
          `INSERT INTO payments(
             id,
             professional_id,
             invoice_id,
             amount,
             currency,
             status,
             provider,
             hosted_invoice_url
           )
           VALUES(
             $1,$2,$3,$4,$5,$6,
             'stripe',
             $7
           )
           ON CONFLICT(invoice_id,status)
           DO UPDATE SET
             professional_id=
               COALESCE(
                 payments.professional_id,
                 EXCLUDED.professional_id
               ),
             amount=EXCLUDED.amount,
             currency=EXCLUDED.currency,
             provider='stripe',
             hosted_invoice_url=
               COALESCE(
                 EXCLUDED.hosted_invoice_url,
                 payments.hosted_invoice_url
               )`,
          [
            id('pay'),
            p?.id ||
              null,
            inv.id,
            (
              inv.amount_paid ??
              inv.amount_due ??
              0
            ) / 100,
            (
              inv.currency ||
              'eur'
            ).toUpperCase(),
            status,
            inv.hosted_invoice_url ||
              null
          ]
        )

        /*
         * Durable failure notification is local DB state and therefore
         * commits atomically with the failed payment observation.
         */
        if(
          status==='failed' &&
          p &&
          !isPlanUpgrade
        ){
          await Notifications.create(
            p.userId,
            'billing',
            'Αποτυχία πληρωμής συνδρομής',
            'Ενημέρωσε τον τρόπο πληρωμής για να παραμείνει ενεργό το προφίλ σου.',
            {},
            client
          )

          sendPaymentFailureMail=true
        }
      }
    )

    if(ignored){
      return ignored
    }

    /*
     * Mail is external: always post-commit.
     */
    if(sendPaymentFailureMail){
      const u=
        await Users.byId(
          p.userId
        )

      if(u){
        mail
          .paymentFailed(
            u.email,
            u.name
          )
          .catch(
            ()=>{}
          )
      }
    }

    return {
      ignored:false
    }
  }

  return {
    ensureStripeCustomer,
    applyStripeSubscription,
    recordInvoice
  }
}
