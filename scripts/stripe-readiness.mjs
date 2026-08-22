import fs from 'node:fs'; import Stripe from 'stripe'
if (process.loadEnvFile && fs.existsSync('.env')) process.loadEnvFile('.env')
const key=process.env.STRIPE_SECRET_KEY||''; const appUrl=(process.env.APP_URL||'').replace(/\/$/,''); const failures=[]; const checks={}
if(!key) failures.push('STRIPE_SECRET_KEY missing')
if(!process.env.STRIPE_WEBHOOK_SECRET) failures.push('STRIPE_WEBHOOK_SECRET missing')
if(!process.env.STRIPE_PRICE_BASIC) failures.push('STRIPE_PRICE_BASIC missing')
if(!process.env.STRIPE_PRICE_PREMIUM) failures.push('STRIPE_PRICE_PREMIUM missing')
if(!failures.length){
 try{
  const stripe=new Stripe(key)
  for(const [name,id] of [['basic',process.env.STRIPE_PRICE_BASIC],['premium',process.env.STRIPE_PRICE_PREMIUM]]){
    const p=await stripe.prices.retrieve(id); checks[name]={id:p.id,active:p.active,currency:p.currency,unit_amount:p.unit_amount,recurring:p.recurring?.interval||null}; if(!p.active) failures.push(`${name} Stripe price is inactive`)
  }
  const endpoints=await stripe.webhookEndpoints.list({limit:100}); const wanted=`${appUrl}/api/webhooks/stripe`; const ep=endpoints.data.find(x=>x.url===wanted)
  checks.webhook={wanted,found:Boolean(ep),enabled_events:ep?.enabled_events||[]}; if(!ep) failures.push(`Stripe webhook endpoint not found: ${wanted}`)
 }catch(e){ failures.push(`Stripe API check failed: ${e.message}`) }
}
const report={version:'5.7.0',checkedAt:new Date().toISOString(),mode:key.startsWith('sk_live_')?'live':key.startsWith('sk_test_')?'test':'unknown',checks,failures,passed:failures.length===0}
fs.mkdirSync('reports',{recursive:true}); fs.writeFileSync('reports/stripe-readiness.json',JSON.stringify(report,null,2)); console.log(`MELEO v5.7 Stripe readiness: ${report.passed?'PASS':'FAIL'}`); if(failures.length) console.error(failures.join('\n')); process.exitCode=report.passed?0:1
