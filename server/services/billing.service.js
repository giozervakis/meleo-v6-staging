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
    id,
    now,
    PLANS,
    isPlan,
    mapStripeStatus,
    priceIdFor
  } = deps

  async function ensureStripeCustomer(u){if(u.stripe_customer_id)return u.stripe_customer_id;const s=getStripe();const c=await s.customers.create({email:u.email,name:u.name,phone:u.phone||undefined,metadata:{meleoUserId:u.id}});await Users.update(u.id,{stripe_customer_id:c.id});return c.id}

  async function applyStripeSubscription(sub,notifyUser=false,eventContext=null){
    const uid=sub.metadata?.meleoUserId
    let p=uid?await Professionals.byUser(uid):null
    if(!p&&sub.id){
      const r=await one('SELECT user_id FROM professionals WHERE stripe_subscription_id=$1',[sub.id])
      if(r)p=await Professionals.byUser(r.user_id)
    }
    if(!p)return null

    const incomingEventCreated=Number(eventContext?.eventCreated||0)||null
    const incomingEventId=eventContext?.eventId?String(eventContext.eventId):null
    const existingLedger=sub.id?await one(
      `SELECT last_stripe_event_created "lastStripeEventCreated",
              last_stripe_event_id "lastStripeEventId"
       FROM subscriptions WHERE stripe_subscription_id=$1`,
      [sub.id]
    ):null
    const lastEventCreated=Number(existingLedger?.lastStripeEventCreated||0)||null

    if(incomingEventCreated&&lastEventCreated&&incomingEventCreated<lastEventCreated)return p
    if(
      incomingEventCreated&&lastEventCreated&&
      incomingEventCreated===lastEventCreated&&
      incomingEventId&&existingLedger?.lastStripeEventId===incomingEventId
    )return p
    const priceId=String(
      sub.items?.data?.[0]?.price?.id||''
    )

    let plan=null

    if(
      priceId &&
      priceId===priceIdFor('premium')
    ){
      plan='premium'
    }else if(
      priceId &&
      priceId===priceIdFor('basic')
    ){
      plan='basic'
    }

    if(!plan){
      const error=new Error(
        'Unknown Stripe subscription Price ID'
      )
      error.code='STRIPE_UNKNOWN_PRICE'
      error.stripeSubscriptionId=sub.id||null
      error.stripePriceId=priceId||null
      throw error
    }

    const status=mapStripeStatus(sub.status)
    const period=sub.items?.data?.[0]?.current_period_end??sub.current_period_end
    const patch={
      subscriptionPlan:plan,
      subscriptionPrice:PLANS[plan].price,
      subscriptionStatus:status,
      billingMode:'stripe',
      stripeSubscriptionId:sub.id,
      currentPeriodEnd:period?new Date(period*1000).toISOString():null,
      cancelAtPeriodEnd:!!sub.cancel_at_period_end,
      featured:plan==='premium'&&status==='active'
    }
    if(status==='past_due'&&!p.pastDueSince)patch.pastDueSince=now()
    if(status==='active'){
      patch.pastDueSince=null
      if(!p.subscriptionSince)patch.subscriptionSince=now()
      if(!p.onboardingStage||p.onboardingStage==='plan')patch.onboardingStage='profile'
    }
    p=await Professionals.update(p.id,patch)

    await sql(
      `INSERT INTO subscriptions(
         id,professional_id,stripe_subscription_id,plan,price,status,
         stripe_status,billing_mode,started_at,current_period_end,
         cancel_at_period_end,last_stripe_event_created,last_stripe_event_id
       )
       VALUES($1,$2,$3,$4,$5,$6,$7,'stripe',now(),$8,$9,$10,$11)
       ON CONFLICT(stripe_subscription_id) DO UPDATE SET
         plan=$4,price=$5,status=$6,stripe_status=$7,current_period_end=$8,
         cancel_at_period_end=$9,
         last_stripe_event_created=COALESCE($10,subscriptions.last_stripe_event_created),
         last_stripe_event_id=CASE WHEN $10 IS NULL
           THEN subscriptions.last_stripe_event_id ELSE $11 END,
         updated_at=now()`,
      [id('sub'),p.id,sub.id,plan,PLANS[plan].price,status,sub.status,
       p.currentPeriodEnd,p.cancelAtPeriodEnd,incomingEventCreated,incomingEventId]
    )

    if(notifyUser&&status==='active'){
      await Notifications.create(
        p.userId,'subscription',
        `\u0397 \u03c3\u03c5\u03bd\u03b4\u03c1\u03bf\u03bc\u03ae ${plan.toUpperCase()} \u03b5\u03af\u03bd\u03b1\u03b9 \u03b5\u03bd\u03b5\u03c1\u03b3\u03ae`,
        `${PLANS[plan].price.toFixed(2)}\u20ac/\u03bc\u03ae\u03bd\u03b1`
      )
      const u=await Users.byId(p.userId)
      mail.subscriptionActive(
        u.email,u.name,plan.toUpperCase(),PLANS[plan].price.toFixed(2)
      ).catch(()=>{})
    }
    return p
  }

  async function recordInvoice(inv,status){
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
      const row=await one(
        'SELECT user_id FROM professionals WHERE stripe_subscription_id=$1',
        [String(subscriptionId)]
      )
      if(row)p=await Professionals.byUser(row.user_id)
    }

    if(!p&&inv.metadata?.meleoProfessionalId){
      p=await Professionals.byId(
        String(inv.metadata.meleoProfessionalId)
      )
    }

    if(!p&&inv.customer){
      const customerId=
        typeof inv.customer==='string'
          ? inv.customer
          : inv.customer?.id

      if(customerId){
        const row=await one(
          `SELECT p.user_id
           FROM professionals p
           JOIN users u ON u.id=p.user_id
           WHERE u.stripe_customer_id=$1
           LIMIT 1`,
          [customerId]
        )
        if(row)p=await Professionals.byUser(row.user_id)
      }
    }

    const purpose=
      String(
        inv.metadata?.meleoPurpose||
        ''
      )

    const isPlanUpgrade=
      purpose==='plan_upgrade'

    /*
     * Stripe webhook delivery is not guaranteed to arrive in business-order.
     *
     * A one-off BASIC -> PREMIUM invoice can emit a payment_failed event
     * before the explicit invoices.pay() call succeeds. In that case:
     * - the endpoint owns the upgrade-specific failure UX
     * - the generic recurring-subscription failure UX must not fire
     *
     * Also keep invoice history monotonic:
     * - once an invoice is locally paid, a later failed event is ignored
     * - when paid arrives after failed, remove the stale failed history row
     */
    if(status==='failed'){
      const alreadyPaid=
        await one(
          `SELECT 1 ok
           FROM payments
           WHERE invoice_id=$1
             AND status='paid'
           LIMIT 1`,
          [inv.id]
        )

      if(alreadyPaid){
        return {
          ignored:true,
          reason:'already_paid'
        }
      }
    }

    if(status==='paid'){
      await sql(
        `DELETE FROM payments
         WHERE invoice_id=$1
           AND status='failed'`,
        [inv.id]
      )
    }
    await sql(
      `INSERT INTO payments(
         id,professional_id,invoice_id,amount,currency,status,
         provider,hosted_invoice_url
       )
       VALUES($1,$2,$3,$4,$5,$6,'stripe',$7)
       ON CONFLICT(invoice_id,status) DO UPDATE SET
         professional_id=COALESCE(payments.professional_id,EXCLUDED.professional_id),
         amount=EXCLUDED.amount,
         currency=EXCLUDED.currency,
         provider='stripe',
         hosted_invoice_url=COALESCE(EXCLUDED.hosted_invoice_url,payments.hosted_invoice_url)`,
      [
        id('pay'),
        p?.id||null,
        inv.id,
        (inv.amount_paid??inv.amount_due??0)/100,
        (inv.currency||'eur').toUpperCase(),
        status,
        inv.hosted_invoice_url||null
      ]
    )

    if(status==='failed'&&p&&!isPlanUpgrade){
      await Notifications.create(
        p.userId,
        'billing',
        'Αποτυχία πληρωμής συνδρομής',
        'Ενημέρωσε τον τρόπο πληρωμής για να παραμείνει ενεργό το προφίλ σου.'
      )

      const u=await Users.byId(p.userId)
      if(u){
        mail.paymentFailed(
          u.email,u.name
        ).catch(()=>{})
      }
    }
  }

  return {
    ensureStripeCustomer,
    applyStripeSubscription,
    recordInvoice
  }
}
