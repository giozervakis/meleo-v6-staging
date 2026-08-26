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
    mapStripeStatus
  } = deps

  async function ensureStripeCustomer(u){if(u.stripe_customer_id)return u.stripe_customer_id;const s=getStripe();const c=await s.customers.create({email:u.email,name:u.name,phone:u.phone||undefined,metadata:{meleoUserId:u.id}});await Users.update(u.id,{stripe_customer_id:c.id});return c.id}

  async function applyStripeSubscription(sub,notifyUser=false){const uid=sub.metadata?.meleoUserId;let p=uid?await Professionals.byUser(uid):null;if(!p&&sub.id){const r=await one('SELECT user_id FROM professionals WHERE stripe_subscription_id=$1',[sub.id]);if(r)p=await Professionals.byUser(r.user_id)}if(!p)return null;let plan=isPlan(sub.metadata?.plan)?sub.metadata.plan:'basic';const amount=sub.items?.data?.[0]?.price?.unit_amount;if(amount===1499)plan='premium';const status=mapStripeStatus(sub.status),period=sub.items?.data?.[0]?.current_period_end??sub.current_period_end;const patch={subscriptionPlan:plan,subscriptionPrice:PLANS[plan].price,subscriptionStatus:status,billingMode:'stripe',stripeSubscriptionId:sub.id,currentPeriodEnd:period?new Date(period*1000).toISOString():null,cancelAtPeriodEnd:!!sub.cancel_at_period_end,featured:plan==='premium'&&status==='active'};if(status==='past_due'&&!p.pastDueSince)patch.pastDueSince=now();if(status==='active'){patch.pastDueSince=null;if(!p.subscriptionSince)patch.subscriptionSince=now();if(!p.onboardingStage||p.onboardingStage==='plan')patch.onboardingStage='profile'}p=await Professionals.update(p.id,patch);await sql(`INSERT INTO subscriptions(id,professional_id,stripe_subscription_id,plan,price,status,stripe_status,billing_mode,started_at,current_period_end,cancel_at_period_end) VALUES($1,$2,$3,$4,$5,$6,$7,'stripe',now(),$8,$9) ON CONFLICT(stripe_subscription_id) DO UPDATE SET plan=$4,price=$5,status=$6,stripe_status=$7,current_period_end=$8,cancel_at_period_end=$9,updated_at=now()`,[id('sub'),p.id,sub.id,plan,PLANS[plan].price,status,sub.status,p.currentPeriodEnd,p.cancelAtPeriodEnd]);if(notifyUser&&status==='active'){await Notifications.create(p.userId,'subscription',`Η συνδρομή ${plan.toUpperCase()} είναι ενεργή`,`${PLANS[plan].price.toFixed(2)}€/μήνα`);const u=await Users.byId(p.userId);mail.subscriptionActive(u.email,u.name,plan.toUpperCase(),PLANS[plan].price.toFixed(2)).catch(()=>{})}return p}

  async function recordInvoice(inv,status){let p=null;const sid=inv.subscription||inv.parent?.subscription_details?.subscription;if(sid){const r=await one('SELECT user_id FROM professionals WHERE stripe_subscription_id=$1',[String(sid)]);if(r)p=await Professionals.byUser(r.user_id)}await sql(`INSERT INTO payments(id,professional_id,invoice_id,amount,currency,status,hosted_invoice_url) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(invoice_id,status) DO NOTHING`,[id('pay'),p?.id||null,inv.id,(inv.amount_paid??inv.amount_due??0)/100,(inv.currency||'eur').toUpperCase(),status,inv.hosted_invoice_url||null]);if(status==='failed'&&p)await Notifications.create(p.userId,'billing','Αποτυχία πληρωμής συνδρομής','Ενημέρωσε τον τρόπο πληρωμής για να παραμείνει ενεργό το προφίλ σου.')}

  return {
    ensureStripeCustomer,
    applyStripeSubscription,
    recordInvoice
  }
}
