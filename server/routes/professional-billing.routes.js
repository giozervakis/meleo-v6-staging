/*
 * MELEO v6.3.0
 *
 * Professional subscription HTTP routes.
 *
 * Stripe reconciliation logic is intentionally not duplicated
 * here. Domain mutation is delegated to billing.service.js.
 */

export function registerProfessionalBillingRoutes(
  app,
  deps
) {
  const {
    auth,
    requireRole,
    limits,
    Professionals,
    many,
    getStripe,
    config,
    PLANS,
    str,
    isPlan,
    allowsVisibility,
    priceIdFor,
    lineItemFor,
    Users,
    ensureStripeCustomer,
    applyStripeSubscription
  } = deps

  app.get('/api/professional/subscription',auth,requireRole('professional'),async(req,res)=>{
   const p=await Professionals.byUser(req.user.id);if(!p)return res.status(404).json({error:'Δεν βρέθηκε επαγγελματικό προφίλ'});
   const invoices=await many(`SELECT id,invoice_id "invoiceId",amount,currency,status,provider,hosted_invoice_url "hostedInvoiceUrl",created_at "createdAt" FROM payments WHERE professional_id=$1 ORDER BY created_at DESC LIMIT 24`,[p.id]);
   res.json({plan:p.subscriptionPlan,price:p.subscriptionPrice,status:p.subscriptionStatus,stripeStatus:p.stripeStatus||null,billingMode:p.billingMode,currentPeriodEnd:p.currentPeriodEnd,cancelAtPeriodEnd:Boolean(p.cancelAtPeriodEnd),portalAvailable:Boolean(getStripe()&&config.stripe.portalEnabled&&p.stripeSubscriptionId),invoices:invoices.map(x=>({...x,amount:Number(x.amount||0)}))})
  })

  app.post('/api/professional/subscription/checkout',auth,requireRole('professional'),limits.checkout,async(req,res)=>{const plan=str(req.body.plan,20);if(!isPlan(plan))return res.status(400).json({error:'Μη έγκυρο πακέτο.'});const p=await Professionals.byUser(req.user.id);if(config.demoCheckout){await Professionals.update(p.id,{subscriptionPlan:plan,subscriptionPrice:PLANS[plan].price,subscriptionStatus:'active',billingMode:'demo',subscriptionSince:p.subscriptionSince||now(),featured:plan==='premium',onboardingStage:'profile'});return res.json({mode:'demo',demo:true,professional:await Professionals.byId(p.id)})}const s=getStripe();if(!s)return res.status(503).json({error:'Οι πληρωμές δεν έχουν ρυθμιστεί.'});if(p.stripeSubscriptionId&&allowsVisibility(p)){const sub=await s.subscriptions.retrieve(p.stripeSubscriptionId);const item=sub.items.data[0];const configured=priceIdFor(plan);const updated=await s.subscriptions.update(sub.id,{items:[{id:item.id,...(configured?{price:configured}:{price_data:lineItemFor(plan).price_data})}],proration_behavior:'create_prorations',cancel_at_period_end:false,metadata:{...sub.metadata,plan}});await applyStripeSubscription(updated);return res.json({changed:true,professional:await Professionals.byId(p.id)})}const u=await Users.byEmail(req.user.email),customer=await ensureStripeCustomer(u);const session=await s.checkout.sessions.create({mode:'subscription',customer,customer_update:{name:'auto'},line_items:[lineItemFor(plan)],payment_method_types:['card'],locale:'el',allow_promotion_codes:true,billing_address_collection:'required',tax_id_collection:config.stripe.collectTaxId?{enabled:true}:undefined,automatic_tax:config.stripe.automaticTax?{enabled:true}:undefined,client_reference_id:u.id,subscription_data:{metadata:{plan,meleoUserId:u.id,meleoProfessionalId:p.id}},metadata:{plan,meleoUserId:u.id,meleoProfessionalId:p.id},success_url:`${config.appUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${config.appUrl}/?checkout=cancel`});res.json({mode:'stripe',url:session.url,sessionId:session.id})})

  app.post('/api/professional/subscription/sync',auth,requireRole('professional'),async(req,res)=>{const s=getStripe();if(!s)return res.status(503).json({error:'Stripe unavailable'});if(req.body.sessionId){const session=await s.checkout.sessions.retrieve(str(req.body.sessionId,300));if(session.client_reference_id&&session.client_reference_id!==req.user.id)return res.status(403).json({error:'Invalid checkout session'});if(session.subscription){const sub=await s.subscriptions.retrieve(String(session.subscription));await applyStripeSubscription(sub,true)}}res.json({professional:await Professionals.byUser(req.user.id)})})

  app.post('/api/professional/subscription/portal',auth,requireRole('professional'),async(req,res)=>{const s=getStripe();if(!s)return res.status(503).json({error:'Stripe unavailable'});const u=await Users.byEmail(req.user.email),customer=await ensureStripeCustomer(u);const session=await s.billingPortal.sessions.create({customer,return_url:`${config.appUrl}/?billing=return`,locale:'el'});res.json({url:session.url})})

  app.post('/api/professional/subscription/cancel',auth,requireRole('professional'),async(req,res)=>{const p=await Professionals.byUser(req.user.id);if(config.demoCheckout){await Professionals.update(p.id,{subscriptionStatus:'cancelled',featured:false});return res.json({professional:await Professionals.byId(p.id)})}const sub=await getStripe().subscriptions.update(p.stripeSubscriptionId,{cancel_at_period_end:true});await applyStripeSubscription(sub);res.json({professional:await Professionals.byId(p.id)})})

  app.post('/api/professional/subscription/resume',auth,requireRole('professional'),async(req,res)=>{const p=await Professionals.byUser(req.user.id);if(config.demoCheckout){await Professionals.update(p.id,{subscriptionStatus:'active',featured:p.subscriptionPlan==='premium'});return res.json({professional:await Professionals.byId(p.id)})}const sub=await getStripe().subscriptions.update(p.stripeSubscriptionId,{cancel_at_period_end:false});await applyStripeSubscription(sub);res.json({professional:await Professionals.byId(p.id)})})
}
