/*
 * MELEO v6.3.0
 *
 * Professional subscription HTTP routes.
 *
 * Billing policy:
 * - BASIC -> PREMIUM: immediate, prorated.
 * - PREMIUM -> BASIC: scheduled for the next renewal.
 * - A scheduled downgrade can be cancelled before it becomes effective.
 */
export function registerProfessionalBillingRoutes(app,deps) {
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
    Notifications,
    mail,
    ensureStripeCustomer,
    applyStripeSubscription,
    recordInvoice,
    now
  } = deps

  const scheduleIdOf=sub=>{
    if(!sub?.schedule)return null
    return typeof sub.schedule==='string' ? sub.schedule : sub.schedule.id
  }

  const stripePriceId=item=>{
    const price=item?.price
    return typeof price==='string' ? price : price?.id
  }

  const isoFromUnix=value=>
    value ? new Date(Number(value)*1000).toISOString() : null

  async function scheduleState(s,sub){
    const sid=scheduleIdOf(sub)
    if(!sid)return null

    const schedule=await s.subscriptionSchedules.retrieve(sid)
    if(schedule?.status==='canceled'||schedule?.status==='released'||schedule?.status==='completed'){
      return null
    }

    const target=String(schedule?.metadata?.meleoScheduledPlan||'')
    const effectiveAt=Number(schedule?.metadata?.meleoScheduledEffectiveAt||0)

    if(!isPlan(target)||!effectiveAt)return null

    return {
      scheduleId:schedule.id,
      plan:target,
      effectiveAt:isoFromUnix(effectiveAt)
    }
  }

  async function createDowngradeSchedule(s,sub,p,u){
    const configured=priceIdFor('basic')
    if(!configured){
      const err=new Error('Δεν έχει ρυθμιστεί Stripe BASIC price.')
      err.statusCode=503
      throw err
    }

    const periodEnd=
      Number(sub.items?.data?.[0]?.current_period_end||sub.current_period_end||0)

    if(!periodEnd){
      const err=new Error('Δεν βρέθηκε η επόμενη ημερομηνία ανανέωσης.')
      err.statusCode=409
      throw err
    }

    let schedule
    const existingScheduleId=scheduleIdOf(sub)

    if(existingScheduleId){
      schedule=await s.subscriptionSchedules.retrieve(existingScheduleId)
    }else{
      schedule=await s.subscriptionSchedules.create({
        from_subscription:sub.id
      })
    }

    const currentPhase=
      schedule.phases?.find(
        phase=>Number(phase.end_date)===periodEnd
      ) ||
      schedule.phases?.find(
        phase=>Number(phase.start_date)<=Math.floor(Date.now()/1000) &&
               Number(phase.end_date)>Math.floor(Date.now()/1000)
      ) ||
      schedule.phases?.[0]

    if(!currentPhase){
      throw new Error('Δεν ήταν δυνατός ο προσδιορισμός της τρέχουσας Stripe billing phase.')
    }

    const currentItems=(currentPhase.items||[]).map(item=>({
      price:stripePriceId(item),
      quantity:item.quantity||1
    })).filter(item=>item.price)

    if(!currentItems.length){
      const currentItem=sub.items?.data?.[0]
      const currentPrice=stripePriceId(currentItem)
      if(!currentPrice)throw new Error('Δεν βρέθηκε το τρέχον Stripe price.')
      currentItems.push({price:currentPrice,quantity:currentItem.quantity||1})
    }

    const metadata={
      meleoScheduledPlan:'basic',
      meleoScheduledEffectiveAt:String(periodEnd),
      meleoProfessionalId:p.id,
      meleoUserId:u.id
    }

    const updated=await s.subscriptionSchedules.update(schedule.id,{
      end_behavior:'release',
      metadata,
      phases:[
        {
          start_date:currentPhase.start_date,
          end_date:periodEnd,
          items:currentItems,
          metadata:{
            ...(sub.metadata||{}),
            plan:'premium',
            meleoUserId:u.id,
            meleoProfessionalId:p.id
          }
        },
        {
          start_date:periodEnd,
          items:[{price:configured,quantity:1}],
          metadata:{
            ...(sub.metadata||{}),
            plan:'basic',
            meleoUserId:u.id,
            meleoProfessionalId:p.id
          }
        }
      ]
    })

    return {
      schedule:updated,
      effectiveAt:isoFromUnix(periodEnd)
    }
  }

  app.get('/api/professional/subscription',auth,requireRole('professional'),async(req,res)=>{
    const p=await Professionals.byUser(req.user.id)
    if(!p)return res.status(404).json({error:'Δεν βρέθηκε επαγγελματικό προφίλ'})

    const invoices=await many(
      `SELECT id,invoice_id "invoiceId",amount,currency,status,provider,hosted_invoice_url "hostedInvoiceUrl",created_at "createdAt"
       FROM payments
       WHERE professional_id=$1
       ORDER BY created_at DESC
       LIMIT 24`,
      [p.id]
    )

    let scheduledPlan=null
    let scheduledPlanEffectiveAt=null

    const s=getStripe()
    if(s&&p.stripeSubscriptionId){
      try{
        const sub=await s.subscriptions.retrieve(p.stripeSubscriptionId)
        const scheduled=await scheduleState(s,sub)
        scheduledPlan=scheduled?.plan||null
        scheduledPlanEffectiveAt=scheduled?.effectiveAt||null
      }catch{
        // Billing summary remains available even if Stripe schedule lookup is temporarily unavailable.
      }
    }

    res.json({
      plan:p.subscriptionPlan,
      price:p.subscriptionPrice,
      status:p.subscriptionStatus,
      stripeStatus:p.stripeStatus||null,
      billingMode:p.billingMode,
      currentPeriodEnd:p.currentPeriodEnd,
      cancelAtPeriodEnd:Boolean(p.cancelAtPeriodEnd),
      scheduledPlan,
      scheduledPlanEffectiveAt,
      portalAvailable:Boolean(getStripe()&&config.stripe.portalEnabled&&p.stripeSubscriptionId),
      invoices:invoices.map(x=>({...x,amount:Number(x.amount||0)}))
    })
  })

  app.post('/api/professional/subscription/checkout',auth,requireRole('professional'),limits.checkout,async(req,res)=>{
    const plan=str(req.body.plan,20)
    if(!isPlan(plan))return res.status(400).json({error:'Μη έγκυρο πακέτο.'})

    const p=await Professionals.byUser(req.user.id)
    if(!p)return res.status(404).json({error:'Δεν βρέθηκε επαγγελματικό προφίλ'})

    if(config.demoCheckout){
      await Professionals.update(p.id,{
        subscriptionPlan:plan,
        subscriptionPrice:PLANS[plan].price,
        subscriptionStatus:'active',
        billingMode:'demo',
        subscriptionSince:p.subscriptionSince||now(),
        featured:plan==='premium',
        onboardingStage:'profile'
      })
      return res.json({mode:'demo',demo:true,professional:await Professionals.byId(p.id)})
    }

    const s=getStripe()
    if(!s)return res.status(503).json({error:'Οι πληρωμές δεν έχουν ρυθμιστεί.'})

    const u=await Users.byEmail(req.user.email)

    if(p.stripeSubscriptionId&&allowsVisibility(p)){
      const sub=await s.subscriptions.retrieve(p.stripeSubscriptionId)
      const currentPlan=String(p.subscriptionPlan||'').toLowerCase()
      const existingSchedule=await scheduleState(s,sub)

      if(plan===currentPlan){
        return res.json({
          changed:false,
          scheduledPlan:existingSchedule?.plan||null,
          scheduledPlanEffectiveAt:existingSchedule?.effectiveAt||null,
          professional:await Professionals.byId(p.id)
        })
      }

      // PREMIUM -> BASIC keeps PREMIUM benefits through the already-paid period.
      if(currentPlan==='premium'&&plan==='basic'){
        if(existingSchedule?.plan==='basic'){
          return res.json({
            changed:false,
            scheduled:true,
            scheduledPlan:'basic',
            scheduledPlanEffectiveAt:existingSchedule.effectiveAt,
            professional:await Professionals.byId(p.id)
          })
        }

        const scheduled=await createDowngradeSchedule(s,sub,p,u)
        const date=new Date(scheduled.effectiveAt).toLocaleDateString('el-GR')

        await Notifications.create(
          p.userId,
          'billing',
          'Η αλλαγή σε BASIC προγραμματίστηκε',
          `Διατηρείς το PREMIUM έως ${date}. Από τότε η συνδρομή σου θα γίνει BASIC.`,
          {priority:'normal',actionType:'billing',actionUrl:'/professional?tab=billing'}
        )

        mail.subscriptionDowngradeScheduled(
          u.email,u.name,'PREMIUM','BASIC',date
        ).catch(()=>{})

        return res.json({
          changed:true,
          scheduled:true,
          scheduledPlan:'basic',
          scheduledPlanEffectiveAt:scheduled.effectiveAt,
          professional:await Professionals.byId(p.id)
        })
      }

      // BASIC -> PREMIUM:
      // - fixed €5 difference, charged immediately
      // - original Stripe billing-cycle anchor remains unchanged
      // - PREMIUM is activated only after the one-off upgrade invoice is paid
      // - the paid invoice is recorded locally before the HTTP response returns
      if(existingSchedule?.scheduleId){
        await s.subscriptionSchedules.release(existingSchedule.scheduleId,{
          preserve_cancel_date:true
        })
      }

      const freshSub=
        existingSchedule?.scheduleId
          ? await s.subscriptions.retrieve(p.stripeSubscriptionId)
          : sub

      const item=freshSub.items.data[0]
      const configured=priceIdFor('premium')
      if(!configured){
        return res.status(503).json({error:'Δεν έχει ρυθμιστεί Stripe PREMIUM price.'})
      }

      const customerId=
        typeof freshSub.customer==='string'
          ? freshSub.customer
          : freshSub.customer?.id

      if(!customerId){
        return res.status(409).json({error:'Δεν βρέθηκε Stripe customer για τη συνδρομή.'})
      }

      const upgradeAmountCents=
        Math.max(
          0,
          Math.round(
            (PLANS.premium.price-PLANS.basic.price)*100
          )
        )

      let upgradeInvoice

      try{
        const draftInvoice=await s.invoices.create({
          customer:customerId,
          collection_method:'charge_automatically',
          auto_advance:false,
          description:'MELEO BASIC → PREMIUM upgrade',
          metadata:{
            meleoPurpose:'plan_upgrade',
            meleoFromPlan:'basic',
            meleoToPlan:'premium',
            meleoUserId:u.id,
            meleoProfessionalId:p.id,
            meleoSubscriptionId:freshSub.id
          }
        })

        await s.invoiceItems.create({
          customer:customerId,
          invoice:draftInvoice.id,
          amount:upgradeAmountCents,
          currency:'eur',
          description:'MELEO BASIC → PREMIUM — διαφορά πακέτου',
          metadata:{
            meleoPurpose:'plan_upgrade',
            meleoFromPlan:'basic',
            meleoToPlan:'premium',
            meleoUserId:u.id,
            meleoProfessionalId:p.id,
            meleoSubscriptionId:freshSub.id
          }
        })

        const finalized=
          await s.invoices.finalizeInvoice(draftInvoice.id)

        upgradeInvoice=
          await s.invoices.pay(finalized.id)

        if(
          !upgradeInvoice?.paid &&
          upgradeInvoice?.status!=='paid'
        ){
          const err=new Error('Η χρέωση της διαφοράς δεν ολοκληρώθηκε.')
          err.statusCode=402
          throw err
        }
      }catch(err){
        await Notifications.create(
          p.userId,
          'billing',
          'Η αναβάθμιση σε PREMIUM δεν ολοκληρώθηκε',
          'Η χρέωση των 5,00€ δεν ολοκληρώθηκε. Παραμένεις στο BASIC.',
          {priority:'high',actionType:'billing',actionUrl:'/professional?tab=billing'}
        )

        mail.paymentFailed(
          u.email,u.name
        ).catch(()=>{})

        return res.status(
          Number(err?.statusCode||402)
        ).json({
          error:
            'Η χρέωση των 5,00€ δεν ολοκληρώθηκε. Το πακέτο παραμένει BASIC.'
        })
      }

      // The one-off €5 invoice is already paid.
      // Now change only the recurring price; proration is explicitly disabled
      // so the original renewal date/current_period_end remains intact.
      const updated=await s.subscriptions.update(freshSub.id,{
        items:[{
          id:item.id,
          price:configured
        }],
        proration_behavior:'none',
        cancel_at_period_end:false,
        metadata:{
          ...freshSub.metadata,
          plan:'premium'
        }
      })

      await applyStripeSubscription(updated)

      // Do not wait for Stripe webhook delivery to populate billing history.
      // recordInvoice is idempotent, therefore the later invoice.paid webhook
      // safely becomes a no-op for this invoice/status pair.
      await recordInvoice(upgradeInvoice,'paid')

      const refreshed=await Professionals.byId(p.id)
      const chargedAmount=(upgradeAmountCents/100).toFixed(2)

      await Notifications.create(
        p.userId,
        'billing',
        'Η αναβάθμιση σε PREMIUM ολοκληρώθηκε',
        `Χρεώθηκε η διαφορά των ${chargedAmount}€ και τα PREMIUM προνόμιά σου ενεργοποιήθηκαν άμεσα.`,
        {priority:'normal',actionType:'billing',actionUrl:'/professional?tab=billing'}
      )

      mail.subscriptionUpgradeCharged(
        u.email,
        u.name,
        chargedAmount,
        refreshed.currentPeriodEnd
      ).catch(()=>{})

      return res.json({
        changed:true,
        charged:true,
        chargedAmount:Number(chargedAmount),
        invoiceId:upgradeInvoice.id,
        professional:refreshed
      })
    }

    const customer=await ensureStripeCustomer(u)
    const session=await s.checkout.sessions.create({
      mode:'subscription',
      customer,
      customer_update:{name:'auto',address:'auto'},
      line_items:[lineItemFor(plan)],
      payment_method_types:['card'],
      locale:'el',
      allow_promotion_codes:true,
      billing_address_collection:'required',
      tax_id_collection:config.stripe.collectTaxId?{enabled:true}:undefined,
      automatic_tax:config.stripe.automaticTax?{enabled:true}:undefined,
      client_reference_id:u.id,
      subscription_data:{
        metadata:{plan,meleoUserId:u.id,meleoProfessionalId:p.id}
      },
      metadata:{plan,meleoUserId:u.id,meleoProfessionalId:p.id},
      success_url:`${config.appUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:`${config.appUrl}/?checkout=cancel`
    })

    res.json({mode:'stripe',url:session.url,sessionId:session.id})
  })

  app.post('/api/professional/subscription/downgrade/cancel',auth,requireRole('professional'),async(req,res)=>{
    const p=await Professionals.byUser(req.user.id)
    if(!p?.stripeSubscriptionId)return res.status(409).json({error:'Δεν υπάρχει ενεργή Stripe συνδρομή.'})

    const s=getStripe()
    if(!s)return res.status(503).json({error:'Stripe unavailable'})

    const sub=await s.subscriptions.retrieve(p.stripeSubscriptionId)
    const scheduled=await scheduleState(s,sub)

    if(!scheduled?.scheduleId){
      return res.json({changed:false,professional:await Professionals.byId(p.id)})
    }

    await s.subscriptionSchedules.release(scheduled.scheduleId,{
      preserve_cancel_date:true
    })

    const u=await Users.byEmail(req.user.email)

    await Notifications.create(
      p.userId,
      'billing',
      'Η προγραμματισμένη αλλαγή σε BASIC ακυρώθηκε',
      'Η συνδρομή σου παραμένει PREMIUM και θα συνεχίσει να ανανεώνεται ως PREMIUM.',
      {priority:'normal',actionType:'billing',actionUrl:'/professional?tab=billing'}
    )

    mail.subscriptionDowngradeCancelled(
      u.email,u.name,'PREMIUM'
    ).catch(()=>{})

    res.json({
      changed:true,
      scheduledPlan:null,
      scheduledPlanEffectiveAt:null,
      professional:await Professionals.byId(p.id)
    })
  })

  app.post('/api/professional/subscription/sync',auth,requireRole('professional'),async(req,res)=>{
    const s=getStripe()
    if(!s)return res.status(503).json({error:'Stripe unavailable'})

    if(req.body.sessionId){
      const session=await s.checkout.sessions.retrieve(str(req.body.sessionId,300))
      if(session.client_reference_id&&session.client_reference_id!==req.user.id){
        return res.status(403).json({error:'Invalid checkout session'})
      }
      if(session.subscription){
        const sub=await s.subscriptions.retrieve(String(session.subscription))
        await applyStripeSubscription(sub,true)
      }
    }

    res.json({professional:await Professionals.byUser(req.user.id)})
  })

  app.post('/api/professional/subscription/portal',auth,requireRole('professional'),async(req,res)=>{
    const s=getStripe()
    if(!s)return res.status(503).json({error:'Stripe unavailable'})

    const u=await Users.byEmail(req.user.email)
    const customer=await ensureStripeCustomer(u)
    const session=await s.billingPortal.sessions.create({
      customer,
      return_url:`${config.appUrl}/?billing=return`,
      locale:'el'
    })

    res.json({url:session.url})
  })

  app.post('/api/professional/subscription/cancel',auth,requireRole('professional'),async(req,res)=>{
    const p=await Professionals.byUser(req.user.id)

    if(config.demoCheckout){
      await Professionals.update(p.id,{subscriptionStatus:'cancelled',featured:false})
      return res.json({professional:await Professionals.byId(p.id)})
    }

    const s=getStripe()
    const current=await s.subscriptions.retrieve(p.stripeSubscriptionId)
    const scheduled=await scheduleState(s,current)

    if(scheduled?.scheduleId){
      await s.subscriptionSchedules.release(scheduled.scheduleId,{
        preserve_cancel_date:true
      })
    }

    const sub=await s.subscriptions.update(p.stripeSubscriptionId,{
      cancel_at_period_end:true
    })
    await applyStripeSubscription(sub)

    res.json({professional:await Professionals.byId(p.id)})
  })

  app.post('/api/professional/subscription/resume',auth,requireRole('professional'),async(req,res)=>{
    const p=await Professionals.byUser(req.user.id)

    if(config.demoCheckout){
      await Professionals.update(p.id,{
        subscriptionStatus:'active',
        featured:p.subscriptionPlan==='premium'
      })
      return res.json({professional:await Professionals.byId(p.id)})
    }

    const sub=await getStripe().subscriptions.update(
      p.stripeSubscriptionId,
      {cancel_at_period_end:false}
    )

    await applyStripeSubscription(sub)
    res.json({professional:await Professionals.byId(p.id)})
  })
}