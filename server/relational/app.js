import express from 'express'
import crypto from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs'
import { config, root, assertProductionReady } from '../config.js'
import { mail } from '../mail.js'
import { encryptSensitive, decryptSensitive, matchTotpStep } from '../security.js'
import { getPool, sql, one, many, tx, migrate, closePool, id, now, sha256, hashPassword, verifyPassword, publicUser, pagination } from './pool.js'
import { Users, Sessions, Professionals, Notifications, Bookings, Analytics, Admin, audit } from './repositories.js'
import Stripe from 'stripe'
import { canViewBooking, canEditBooking, canViewPatientContact, canReviewBooking } from './authorization.js'
import { redisRateLimit, redisGetJson, redisSetJson, redisPing, closeRedis } from '../redis.js'
import { log, requestId } from '../logger.js'
import { observeRequest, metricsText } from '../metrics.js'
import { queueStats } from '../jobs.js'
import { verificationObjectKey,profilePhotoObjectKey, putVerificationObject, getVerificationObject, deleteVerificationObject, storageReady, createTemporaryDocumentSignature, verifyTemporaryDocumentSignature } from '../object-storage.js'
import { APP_VERSION, RELEASE_CHANNEL } from '../version.js'
import { registerSystemRoutes } from '../routes/system.routes.js'
import { registerLifecycleRoutes } from '../routes/lifecycle.routes.js'
import { registerAuthAccountRoutes } from '../routes/auth-account.routes.js'
import { registerAccountProfileRoutes } from '../routes/account-profile.routes.js'
import { registerAccountPrivacyRoutes } from '../routes/account-privacy.routes.js'
import { registerProfessionalCoreRoutes } from '../routes/professional-core.routes.js'
import { registerProfessionalVerificationRoutes } from '../routes/professional-verification.routes.js'
import { createBillingService } from '../services/billing.service.js'
import { registerProfessionalBillingRoutes } from '../routes/professional-billing.routes.js'
import { registerBookingCoreRoutes } from '../routes/booking-core.routes.js'
import { registerBookingStateRoutes } from '../routes/booking-state.routes.js'
import { registerBookingCommunicationRoutes } from '../routes/booking-communication.routes.js'
import { registerBookingRecoveryRoutes } from '../routes/booking-recovery.routes.js'
import { registerBookingReviewRoutes } from '../routes/booking-review.routes.js'
import { registerBookingCalendarRoutes } from '../routes/booking-calendar.routes.js'
import { registerNotificationRoutes } from '../routes/notifications.routes.js'
import { registerFavoritesRoutes } from '../routes/favorites.routes.js'
import { registerCareTeamRoutes } from '../routes/care-team.routes.js'
import { registerSupportRoutes } from '../routes/support.routes.js'

assertProductionReady()
await migrate()

const app=express(); if(config.trustProxy)app.set('trust proxy',1); app.disable('x-powered-by')
app.use((req,res,next)=>{const rid=requestId(req.headers['x-request-id']);req.requestId=rid;res.setHeader('X-Request-ID',rid);const t=process.hrtime.bigint();res.on('finish',()=>{const ms=Number(process.hrtime.bigint()-t)/1e6;observeRequest(req.method,res.statusCode,ms);const meta={requestId:rid,method:req.method,path:req.path,status:res.statusCode,durationMs:Number(ms.toFixed(2))};if(res.statusCode>=500)log.error('http.request',meta);else if(ms>=config.observability.slowRequestMs)log.warn('http.slow_request',meta)});next()})
const SESSION_COOKIE='meleo_session'; const SESSION_TTL_MS=30*86400000; const ADMIN_SESSION_TTL_MS=config.admin.sessionTtlHours*3600000
const PASSWORD_MIN=8
const passwordPolicy = password => {
  const value = String(password || '')

  const checks = {
    length: value.length >= PASSWORD_MIN,
    lowercase: /[a-zα-ωάέήίόύώϊϋΐΰ]/u.test(value),
    uppercase: /[A-ZΑ-ΩΆΈΉΊΌΎΏΪΫ]/u.test(value),
    number: /\d/.test(value),
    special: /[^A-Za-zΑ-Ωα-ωΆΈΉΊΌΎΏΪΫάέήίόύώϊϋΐΰ0-9\s]/u.test(value)
  }

  return {
    valid: Object.values(checks).every(Boolean),
    checks
  }
}

const passwordPolicyError = {
  error: 'Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες και να περιλαμβάνει κεφαλαίο, πεζό, αριθμό και ειδικό χαρακτήρα.',
  code: 'PASSWORD_POLICY'
}
const str=(v,max=500)=>String(v??'').trim().slice(0,max)
const isEmail=v=>/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(v||''))
const isDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))&&!Number.isNaN(Date.parse(v))
const isTime=v=>/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v||''))
const cookieNamed=(req,name)=>{const raw=String(req.headers.cookie||'');const safe=String(name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const m=raw.match(new RegExp('(?:^|;\\s*)'+safe+'=([^;]+)'));return m?decodeURIComponent(m[1]):''}
const setSessionCookie=(res,t,maxAge=SESSION_TTL_MS)=>res.cookie(SESSION_COOKIE,t,{httpOnly:true,secure:config.isHosted,sameSite:'lax',maxAge,path:'/'})
const clearSessionCookie=res=>res.clearCookie(SESSION_COOKIE,{httpOnly:true,secure:config.isHosted,sameSite:'lax',path:'/'})
const newToken=()=>crypto.randomBytes(32).toString('hex')
const fingerprint=(...parts)=>sha256(parts.join('|'))
function fileKey(){return crypto.createHash('sha256').update(config.security.sensitiveDataKey||'dev-only-insecure-key').digest()}
function encryptFileBuffer(buffer){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',fileKey(),iv),body=Buffer.concat([cipher.update(buffer),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),body])}
function decryptFileBuffer(buffer){const iv=buffer.subarray(0,12),tag=buffer.subarray(12,28),body=buffer.subarray(28),dec=crypto.createDecipheriv('aes-256-gcm',fileKey(),iv);dec.setAuthTag(tag);return Buffer.concat([dec.update(body),dec.final()])}

const PLANS={
 basic:{id:'basic',name:'BASIC',price:9.99,currency:'EUR',interval:'month',recommended:false,features:['Δημόσιο επαγγελματικό προφίλ','Αιτήματα και διαχείριση κρατήσεων','Περιοχή & ακτίνα εξυπηρέτησης','Βασικά στατιστικά']},
 premium:{id:'premium',name:'PREMIUM',price:14.99,currency:'EUR',interval:'month',recommended:true,features:['Όλα τα BASIC','Σήμανση «Προτεινόμενος»','Προτεραιότητα στην κατάταξη αποτελεσμάτων','Advanced profile analytics']}
}
const isPlan=p=>p==='basic'||p==='premium'
let stripe=null; const getStripe=()=>config.stripeEnabled?(stripe||(stripe=new Stripe(config.stripe.secretKey,{apiVersion:'2025-06-30.basil',maxNetworkRetries:2,timeout:20000}))):null
const priceIdFor=plan=>plan==='premium'?config.stripe.pricePremium:config.stripe.priceBasic
const lineItemFor=plan=>priceIdFor(plan)?{price:priceIdFor(plan),quantity:1}:{quantity:1,price_data:{currency:'eur',unit_amount:Math.round(PLANS[plan].price*100),recurring:{interval:'month'},product_data:{name:`MELEO Professional ${PLANS[plan].name}`,metadata:{plan}}}}
const mapStripeStatus=s=>['active','trialing'].includes(s)?'active':s==='past_due'?'past_due':['canceled','unpaid','incomplete_expired','paused'].includes(s)?'cancelled':'pending'
const allowsVisibility=p=>p?.subscriptionStatus==='active'||(p?.subscriptionStatus==='past_due'&&p?.pastDueSince&&(Date.now()-new Date(p.pastDueSince).getTime())<=config.security.subscriptionGraceDays*86400000)

app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('Permissions-Policy','camera=(), microphone=(), payment=(self), geolocation=(self)');res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Content-Security-Policy',["default-src 'self'","script-src 'self'","style-src 'self' 'unsafe-inline'","img-src 'self' data:","font-src 'self' data:","connect-src 'self'","form-action 'self' https://checkout.stripe.com https://billing.stripe.com","frame-ancestors 'none'","base-uri 'self'","object-src 'none'"].join('; '));if(config.isHosted)res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');next()})

// Stripe webhook: idempotency stored relationally, no global DB snapshot.
const {
  ensureStripeCustomer,
  applyStripeSubscription,
  recordInvoice
} = createBillingService(
  {
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
  }
)

app.post('/api/webhooks/stripe',express.raw({type:'application/json',limit:'1mb'}),async(req,res)=>{
 const s=getStripe();if(!s||!config.stripe.webhookSecret)return res.status(503).json({error:'Webhook not configured'})
 let event;try{event=s.webhooks.constructEvent(req.body,req.headers['stripe-signature'],config.stripe.webhookSecret)}catch{return res.status(400).json({error:'Invalid signature'})}
 const existing=await one('SELECT * FROM webhook_events WHERE id=$1',[event.id]);if(existing?.status==='completed')return res.json({received:true,duplicate:true})
 await sql(`INSERT INTO webhook_events(id,type,status,attempts,last_attempt_at) VALUES($1,$2,'processing',1,now()) ON CONFLICT(id) DO UPDATE SET status='processing',attempts=webhook_events.attempts+1,last_attempt_at=now(),error=NULL`,[event.id,event.type])
 try{
   const obj=event.data.object
   if(event.type.startsWith('customer.subscription.')) await applyStripeSubscription(obj)
   if(event.type==='checkout.session.completed'&&obj.subscription){const sub=await s.subscriptions.retrieve(String(obj.subscription));await applyStripeSubscription(sub,true)}
   if(event.type==='invoice.paid'||event.type==='invoice.payment_failed') await recordInvoice(obj,event.type==='invoice.paid'?'paid':'failed')
   await sql(`UPDATE webhook_events SET status='completed',completed_at=now() WHERE id=$1`,[event.id]);res.json({received:true})
 }catch(err){await sql(`UPDATE webhook_events SET status='failed',error=$2 WHERE id=$1`,[event.id,String(err?.message||err).slice(0,1000)]);res.status(500).json({error:'Processing failed'})}
})

app.use(express.json({ limit: '12mb' }))

// Persistent Postgres rate limiter. Works across instances.
function rateLimit({windowMs,max,name,message='Πολλά αιτήματα. Δοκίμασε ξανά σε λίγο.',keyFn}){return async(req,res,next)=>{

//
// Deterministic CI / E2E read-load mode.
//
// Read-only requests bypass throttling only when E2E_MODE is
// explicitly enabled outside production.
//
// Mutation/auth/security rate limits remain fully active so
// security E2E tests continue exercising real protections.
//
// E2E_MODE itself is forbidden by the production configuration
// guard, therefore this branch can never be active in production.
//
if(
  config.e2eMode &&
  !config.isProd &&
  ['GET','HEAD','OPTIONS'].includes(req.method)
){
  return next()
}

const rawKey=keyFn?String(keyFn(req)||'anonymous'):String(req.ip||'local');const bucket=`${name}:${sha256(rawKey).slice(0,24)}`;try{let count,ttlMs;if(config.redis.url){try{const r=await redisRateLimit(config.redis.keyPrefix+'rl:'+bucket,windowMs);count=r.count;ttlMs=r.ttlMs}catch(err){console.warn('[MELEO v5.1] Redis limiter fallback:',err.message)}}if(count==null){const row=await one(`INSERT INTO rate_limits(bucket_key,count,reset_at) VALUES($1,1,now()+($2||' milliseconds')::interval) ON CONFLICT(bucket_key) DO UPDATE SET count=CASE WHEN rate_limits.reset_at<=now() THEN 1 ELSE rate_limits.count+1 END,reset_at=CASE WHEN rate_limits.reset_at<=now() THEN now()+($2||' milliseconds')::interval ELSE rate_limits.reset_at END,updated_at=now() RETURNING count,reset_at`,[bucket,String(windowMs)]);count=row.count;ttlMs=Math.max(0,new Date(row.reset_at).getTime()-Date.now())}if(count>max){res.setHeader('Retry-After',Math.max(1,Math.ceil(ttlMs/1000)));return res.status(429).json({error:message})}next()}catch(e){next(e)}}}
const E2E_MODE = config.e2eMode && !config.isProd

const limits = {
  global: rateLimit({
    windowMs: 60000,
    max: E2E_MODE ? 5000 : 500,
    name: 'global'
  }),

  login: rateLimit({
    windowMs: 900000,
    max: E2E_MODE ? 500 : 20,
    name: 'login'
  }),

  loginAccount: rateLimit({
    windowMs: 900000,
    max: E2E_MODE ? 250 : 10,
    name: 'login-account',
    keyFn: req =>
      String(req.body?.email || '')
        .trim()
        .toLowerCase()
  }),

  admin: rateLimit({
    windowMs: 60000,
    max: E2E_MODE ? 500 : 90,
    name: 'admin'
  }),

  adminWrite: rateLimit({
    windowMs: 60000,
    max: E2E_MODE ? 250 : 20,
    name: 'admin-write'
  }),

  register: rateLimit({
    windowMs: 3600000,
    max: E2E_MODE ? 250 : 10,
    name: 'register'
  }),

  password: rateLimit({
    windowMs: 3600000,
    max: E2E_MODE ? 250 : 8,
    name: 'password'
  }),

  write: rateLimit({
    windowMs: 60000,
    max: E2E_MODE ? 1000 : 60,
    name: 'write'
  }),

  geo: rateLimit({
    windowMs: 60000,
    max: E2E_MODE ? 500 : 30,
    name: 'geo'
  }),

  checkout: rateLimit({
    windowMs: 600000,
    max: E2E_MODE ? 250 : 15,
    name: 'checkout'
  }),

  profile: rateLimit({
    windowMs: 60000,
    max: E2E_MODE ? 500 : 60,
    name: 'profile'
  }),

  analytics: rateLimit({
    windowMs: 60000,
    max: E2E_MODE ? 500 : 25,
    name: 'analytics'
  })
}
app.use('/api',limits.global)
app.use('/api',(req,res,next)=>{if(['GET','HEAD','OPTIONS'].includes(req.method)||req.path.startsWith('/webhooks/'))return next();const origin=String(req.headers.origin||'');if(!origin)return next();try{if(new URL(origin).origin!==new URL(config.appUrl).origin)return res.status(403).json({error:'Μη έγκυρη προέλευση αιτήματος'})}catch{return res.status(403).json({error:'Μη έγκυρη προέλευση αιτήματος'})}next()})

async function auth(req,res,next){const raw=cookieNamed(req,SESSION_COOKIE)||String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');if(!raw)return res.status(401).json({error:'Απαιτείται σύνδεση'});const row=await Sessions.resolve(raw);if(!row)return res.status(401).json({error:'Η συνεδρία έληξε. Συνδέσου ξανά.'});if(row.account_status==='suspended'&&row.role!=='admin')return res.status(403).json({error:'Ο λογαριασμός έχει ανασταλεί από τη MELEO.'});if(row.role==='admin'&&config.admin.bindUserAgent&&row.user_agent_hash&&row.user_agent_hash!==sha256(req.headers['user-agent']||'')){await Sessions.revoke(raw);await audit(row.user_id,'security.admin_session_ua_mismatch',{ipHash:sha256(req.ip||'')});clearSessionCookie(res);return res.status(401).json({error:'Η συνεδρία admin ακυρώθηκε για λόγους ασφαλείας.'})}req.user=publicUser(row);req.user.passwordHash=row.password_hash;req.user.stripeCustomerId=row.stripe_customer_id;req.sessionRaw=raw;next()}
const requireRole=role=>(req,res,next)=>req.user.role===role?next():res.status(403).json({error:role==='admin'?'Admin only':'Δεν επιτρέπεται για αυτόν τον τύπο λογαριασμού'})
const requireConsumer=(req,res,next)=>['patient','professional'].includes(req.user.role)?next():res.status(403).json({error:'Η συγκεκριμένη ενέργεια είναι διαθέσιμη σε χρήστες και επαγγελματίες.'})
const adminIpGuard=(req,res,next)=>{if(!config.admin.ipAllowlist.length)return next();const ip=String(req.ip||'').replace(/^::ffff:/,'');if(config.admin.ipAllowlist.includes(ip))return next();audit(req.user?.id||null,'security.admin_ip_denied',{ipHash:sha256(ip)}).catch(()=>{});return res.status(403).json({error:'Η πρόσβαση διαχειριστή δεν επιτρέπεται από αυτή τη διεύθυνση IP.'})}
function requireVerifiedEmail(req,res,next){if(config.mailEnabled&&!req.user.emailVerified)return res.status(403).json({error:'Επιβεβαίωσε πρώτα το email σου.'});next()}

async function issueSession(user,req,res){const ttl=user.role==='admin'?ADMIN_SESSION_TTL_MS:SESSION_TTL_MS;const raw=newToken();await Sessions.issue(user.id,raw,new Date(Date.now()+ttl).toISOString(),{ipHash:sha256(req.ip||''),uaHash:sha256(req.headers['user-agent']||'')});setSessionCookie(res,raw,ttl)}
async function createToken(userId,type,ttl){const raw=newToken();await sql('DELETE FROM one_time_tokens WHERE user_id=$1 AND type=$2',[userId,type]);await sql(`INSERT INTO one_time_tokens(id,user_id,type,token_hash,expires_at) VALUES($1,$2,$3,$4,now()+($5||' milliseconds')::interval)`,[id('tok'),userId,type,sha256(raw),String(ttl)]);return raw}
async function consumeToken(raw,type){return tx(async c=>{const {rows}=await c.query(`SELECT * FROM one_time_tokens WHERE token_hash=$1 AND type=$2 AND used_at IS NULL AND expires_at>now() FOR UPDATE`,[sha256(raw),type]);const r=rows[0];if(!r)return null;await c.query('UPDATE one_time_tokens SET used_at=now() WHERE id=$1',[r.id]);return r})}

const PROFILE_EDITABLE=['title','specialty','bio','city','area','region','countryCode','latitude','longitude','serviceRadiusKm','price','pricingMode','years','services','availability','languages','available','showPhone','showEmail','preferPlatformContact']
const SPECIALTIES=['Ιατροί','Νοσηλευτική','Φυσικοθεραπεία','Διαιτολογία / Διατροφή','Εργοθεραπεία','Λογοθεραπεία','Μαιευτική φροντίδα','Ψυχολογία','Φροντίδα ηλικιωμένων','Αποκατάσταση']
function sanitizeProfilePatch(body={}){const p={};for(const k of PROFILE_EDITABLE){if(!(k in body))continue;const v=body[k];if(['services','availability','languages'].includes(k))p[k]=(Array.isArray(v)?v:String(v??'').split(',')).map(x=>str(x,80)).filter(Boolean).slice(0,30);else if(k==='price')p[k]=Math.min(5000,Math.max(0,Number(v)||0));else if(k==='years')p[k]=Math.min(70,Math.max(0,Math.round(Number(v)||0)));else if(k==='serviceRadiusKm')p[k]=Math.min(300,Math.max(1,Math.round(Number(v)||15)));else if(k==='pricingMode')p[k]=v==='from'?'from':'contact';else if(['latitude','longitude'].includes(k))p[k]=(v==null||v==='')?null:Number(v);else if(['showPhone','showEmail','preferPlatformContact'].includes(k))p[k]=Boolean(v);else if(k==='specialty')p[k]=SPECIALTIES.includes(v)?v:'';else if(k==='bio')p[k]=str(v,1500);else p[k]=str(v,120)}return p}

async function ensureDemoData(){if(!config.seedDemo)return;const c=await one('SELECT count(*)::int n FROM users');if(c.n)return;const pass=await hashPassword('demo123');await tx(async client=>{for(const u of [{id:'u_patient',role:'patient',name:'Γιώργος Demo',email:'patient@meleo.gr',phone:'6900000000'},{id:'u_nurse1',role:'professional',name:'Μαρία Κωνσταντίνου',email:'maria@meleo.gr',phone:'6901111111'},{id:'u_nurse2',role:'professional',name:'Νίκος Στεφανάκης',email:'nikos@meleo.gr',phone:'6902222222'}])await client.query(`INSERT INTO users(id,role,name,email,phone,password_hash,email_verified,accepted_terms_at) VALUES($1,$2,$3,$4,$5,$6,true,now())`,[u.id,u.role,u.name,u.email,u.phone,pass]);await client.query(`INSERT INTO professionals(id,user_id,title,specialty,verified,featured,city,area,region,latitude,longitude,service_radius_km,subscription_plan,subscription_price,subscription_status,billing_mode,onboarding_completed,onboarding_stage,subscription_since,available,bio,languages,credentials,response_time,years,price,pricing_mode,services,availability) VALUES('p1','u_nurse1','Νοσηλεύτρια','Νοσηλευτική',true,true,'Ηράκλειο','Κέντρο','Κρήτη',35.3387,25.1442,18,'premium',14.99,'active','demo',true,'approved',now(),'Σήμερα','Εξειδίκευση στη μετεγχειρητική φροντίδα.','["Ελληνικά","Αγγλικά"]','["Πτυχίο Νοσηλευτικής","BLS"]','συνήθως σε 8 λεπτά',9,25,'from','["Απλή νοσηλευτική επίσκεψη","Χορήγηση αγωγής","Περιποίηση τραύματος"]','["09:00","11:30","18:00"]'),('p2','u_nurse2','Φυσικοθεραπευτής','Φυσικοθεραπεία',true,false,'Ηράκλειο','Ατσαλένιο','Κρήτη',35.3295,25.1549,20,'basic',9.99,'active','demo',true,'approved',now(),'Αύριο','Κατ’ οίκον φυσικοθεραπεία.','["Ελληνικά","Αγγλικά"]','["Πτυχίο Φυσικοθεραπείας"]','συνήθως σε 14 λεπτά',7,30,'from','["Κατ’ οίκον φυσικοθεραπεία","Μετεγχειρητική αποκατάσταση"]','["08:30","12:00","17:00"]')`);await client.query(`INSERT INTO professional_analytics_daily(professional_id,day,impressions,profile_views,phone_clicks) VALUES('p1',current_date,183,41,12),('p2',current_date,96,24,5)`)});console.log('[MELEO v5] demo relational seed created')}
async function ensureAdmin(){const email=config.admin.email;const pass=config.admin.password||(config.isProd?'':'admin123');if(!pass)return;let u=await Users.byEmail(email);if(!u){u=await Users.create({id:'u_admin',role:'admin',name:'MELEO Admin',email,phone:'',passwordHash:await hashPassword(pass),emailVerified:true,acceptedTermsAt:now()})}else if(config.admin.password){await Users.update(u.id,{password_hash:await hashPassword(config.admin.password)})}}
await ensureDemoData();await ensureAdmin()

registerSystemRoutes(
  app,
  {
    config,
    APP_VERSION,
    PLANS,
    one,
    getPool,
    queueStats,
    metricsText
  }
)
let shuttingDown = false
let shutdownStartedAt = null

registerLifecycleRoutes(
  app,
  {
    config,
    one,
    redisPing,
    storageReady,
    APP_VERSION,
    log,
    getShuttingDown:()=>shuttingDown,
    getShutdownStartedAt:()=>shutdownStartedAt
  }
)

registerAuthAccountRoutes(
  app,
  {
    config,
    limits,
    auth,
    requireVerifiedEmail,

    str,
    isEmail,
    passwordPolicy,
    passwordPolicyError,

    Users,
    Sessions,
    Professionals,

    hashPassword,
    verifyPassword,
    matchTotpStep,

    createToken,
    consumeToken,
    issueSession,
    clearSessionCookie,

    mail,
    audit,
    publicUser,

    id,
    now,
    sha256
  }
)



registerAccountProfileRoutes(
  app,
  {
    limits,
    auth,
    str,
    Users,
    audit,
    publicUser,
    profilePhotoObjectKey,
    putVerificationObject,
    getVerificationObject,
    deleteVerificationObject
  }
)

registerAccountPrivacyRoutes(
  app,
  {
    auth,
    limits,
    Users,
    Sessions,
    Professionals,
    Bookings,
    Notifications,
    many,
    sql,
    tx,
    audit,
    publicUser,
    hashPassword,
    verifyPassword,
    passwordPolicy,
    passwordPolicyError,
    clearSessionCookie
  }
)


// Geocoding with persistent cache. Nominatim only in dev unless explicitly selected.
async function geocode(pathname){const key=sha256(pathname);if(config.redis.url){try{const hit=await redisGetJson(config.redis.keyPrefix+'geo:'+key);if(hit)return hit}catch(err){console.warn('[MELEO v5.1] Redis geocode cache fallback:',err.message)}}const cached=await one('SELECT payload FROM geocode_cache WHERE cache_key=$1 AND expires_at>now()',[key]);if(cached){if(config.redis.url)redisSetJson(config.redis.keyPrefix+'geo:'+key,cached.payload,86400).catch(()=>{});return cached.payload;}const provider=(process.env.GEOCODING_PROVIDER||'nominatim').toLowerCase();

if(provider==='fixture'){
  if(config.isProd){
    throw new Error('Fixture geocoding is forbidden in production')
  }

  const params=
    new URLSearchParams(
      pathname.split('?')[1]||''
    )

  if(pathname.startsWith('/search')){
    const query=
      String(params.get('q')||'')
        .trim()
        .toLocaleLowerCase('el-GR')

    const known=
      query.includes('ηράκλειο')||
      query.includes('heraklion')||
      query.includes('iraklio')

    const data=
      known
        ? [{
            lat:'35.3387',
            lon:'25.1442',
            display_name:'Ηράκλειο, Κρήτη, Ελλάδα',
            address:{
              city:'Ηράκλειο',
              state:'Κρήτη',
              country:'Ελλάδα',
              country_code:'gr'
            }
          }]
        : []

    await sql(
      `INSERT INTO geocode_cache(cache_key,payload,expires_at)
       VALUES($1,$2,now()+interval '30 days')
       ON CONFLICT(cache_key)
       DO UPDATE SET
         payload=$2,
         expires_at=now()+interval '30 days',
         updated_at=now()`,
      [key,JSON.stringify(data)]
    )

    if(config.redis.url){
      redisSetJson(
        config.redis.keyPrefix+'geo:'+key,
        data,
        30*86400
      ).catch(()=>{})
    }

    return data
  }

  if(pathname.startsWith('/reverse')){
    const lat=Number(params.get('lat'))
    const lon=Number(params.get('lon'))

    if(
      !Number.isFinite(lat)||
      !Number.isFinite(lon)
    ){
      throw new Error(
        'Invalid fixture coordinates'
      )
    }

    const data={
      lat:String(lat),
      lon:String(lon),
      display_name:'Ηράκλειο, Κρήτη, Ελλάδα',
      address:{
        city:'Ηράκλειο',
        state:'Κρήτη',
        country:'Ελλάδα',
        country_code:'gr'
      }
    }

    await sql(
      `INSERT INTO geocode_cache(cache_key,payload,expires_at)
       VALUES($1,$2,now()+interval '30 days')
       ON CONFLICT(cache_key)
       DO UPDATE SET
         payload=$2,
         expires_at=now()+interval '30 days',
         updated_at=now()`,
      [key,JSON.stringify(data)]
    )

    if(config.redis.url){
      redisSetJson(
        config.redis.keyPrefix+'geo:'+key,
        data,
        30*86400
      ).catch(()=>{})
    }

    return data
  }

  throw new Error(
    'Unsupported fixture geocoding request'
  )
}

let url,headers={};if(provider==='mapbox'&&process.env.MAPBOX_TOKEN){const q=new URLSearchParams(pathname.split('?')[1]||'');const query=q.get('q')||'';url=`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${encodeURIComponent(process.env.MAPBOX_TOKEN)}&language=el&limit=5`}else{url=`https://nominatim.openstreetmap.org${pathname}`;headers={'User-Agent':`MELEO-Marketplace/5.0 (${config.mail.supportEmail})`,'Accept-Language':'el,en'}}const r=await fetch(url,{headers});if(!r.ok)throw new Error('Geocoding unavailable');let data=await r.json();if(provider==='mapbox'&&data.features)data=data.features.map(f=>({lat:String(f.center[1]),lon:String(f.center[0]),display_name:f.place_name,address:{city:f.context?.find(x=>x.id.startsWith('place.'))?.text||f.text,country:f.context?.find(x=>x.id.startsWith('country.'))?.text||''}}));await sql(`INSERT INTO geocode_cache(cache_key,payload,expires_at) VALUES($1,$2,now()+interval '30 days') ON CONFLICT(cache_key) DO UPDATE SET payload=$2,expires_at=now()+interval '30 days',updated_at=now()`,[key,JSON.stringify(data)]);if(config.redis.url)redisSetJson(config.redis.keyPrefix+'geo:'+key,data,30*86400).catch(()=>{});return data}
app.get('/api/location/search',limits.geo,async(req,res)=>{const q=str(req.query.q,200);if(!q)return res.json([]);try{const raw=(await geocode(`/search?format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(q)}`)).slice(0,5);res.json(raw.map(x=>{const a=x.address||{};return {label:x.display_name||'',lat:Number(x.lat),lon:Number(x.lon),city:a.city||a.town||a.village||a.municipality||a.county||'',region:a.state||a.region||'',countryCode:String(a.country_code||'').toLowerCase(),country:a.country||''}}))}catch(err){log.error('geocode.search.failed',{message:err?.message||String(err)});res.status(503).json({error:'Η υπηρεσία τοποθεσίας δεν είναι διαθέσιμη.'})}})
app.get('/api/location/reverse',limits.geo,async(req,res)=>{const lat=Number(req.query.lat),lon=Number(req.query.lon);if(!Number.isFinite(lat)||!Number.isFinite(lon))return res.status(400).json({error:'Invalid coordinates'});try{const x=await geocode(`/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lon}`),a=x.address||{};res.json({label:x.display_name||'',lat,lon,city:a.city||a.town||a.village||a.municipality||a.county||'',region:a.state||a.region||'',countryCode:String(a.country_code||'').toLowerCase(),country:a.country||''})}catch(err){log.error('geocode.reverse.failed',{message:err?.message||String(err)});res.status(503).json({error:'Η υπηρεσία τοποθεσίας δεν είναι διαθέσιμη.'})}})

app.post('/api/analytics/professional-event',limits.analytics,async(req,res)=>{const pid=str(req.body.professionalId,80),type=str(req.body.type,40),sid=str(req.body.sessionId,100);if(!['impression','profile_view','phone_click'].includes(type)||!pid)return res.status(400).json({error:'Invalid event'});const windowMin=type==='impression'?60:type==='profile_view'?30:5;const fp=fingerprint(pid,type,sid,sha256(req.ip||''),new Date().toISOString().slice(0,13));const accepted=await Analytics.event(pid,type,fp,windowMin);res.json({ok:true,accepted})})
app.get(
  '/api/professional/analytics',
  auth,
  requireRole('professional'),
  async(req,res)=>{
    const p=await Professionals.byUser(req.user.id)

    if(!p){
      return res.status(404).json({
        error:'Professional profile not found'
      })
    }

    const days=Math.min(
      365,
      Math.max(
        1,
        Number(req.query.days)||30
      )
    )

    const analytics=
      await Analytics.summary(
        p.id,
        days
      )

	const trust=
	await meleoTrustForProfessional(
		p.id
	)

	const smartMatchDiagnostics=
	await smartMatchDiagnosticsForProfessional(
		p.id,
		trust
	)

	res.json({
  ...analytics,
  trust,
  smartMatchDiagnostics
})
  }
)

async function meleoTrustForProfessional(professionalId){
  const p=await one(`SELECT id,verified,rating,reviews_count "reviewsCount" FROM professionals WHERE id=$1`,[professionalId])
  if(!p)return null
  const stats=await one(`
    SELECT
      count(*)::int total,
      count(*) FILTER (WHERE status='completed')::int completed,
      count(*) FILTER (WHERE status='cancelled')::int cancelled,
      count(*) FILTER (WHERE status<>'pending')::int progressed,
      count(*) FILTER (WHERE status='completed' AND created_at>=now()-interval '90 days')::int recent_completed
    FROM bookings WHERE professional_id=$1
  `,[professionalId])
  const total=Number(stats?.total||0),completed=Number(stats?.completed||0),cancelled=Number(stats?.cancelled||0)
  const reviews=Number(p.reviewsCount||0),rating=Number(p.rating||0)
  const closed=completed+cancelled
  const completionRate=closed?Math.round((completed/closed)*100):100
  const responseRate=total?Math.round((Number(stats?.progressed||0)/total)*100):100
  const cancellationReliability=closed?Math.round((completed/closed)*100):100
  const eligible=completed>=5&&reviews>=3
  if(!eligible)return {eligible:false,label:'MELEO Verified · Νέος επαγγελματίας',completed,reviews,minCompleted:5,minReviews:3}
  const verificationPoints=p.verified?20:0
  const reviewPoints=Math.round(Math.max(0,Math.min(25,(rating/5)*25)))
  const completionPoints=Math.round(Math.max(0,Math.min(20,(completionRate/100)*20)))
  const responsePoints=Math.round(Math.max(0,Math.min(15,(responseRate/100)*15)))
  const reliabilityPoints=Math.round(Math.max(0,Math.min(10,(cancellationReliability/100)*10)))
  const recent=Number(stats?.recent_completed||0)
  const activityPoints=recent>=8?10:recent>=5?8:recent>=2?6:4
  const score=Math.max(0,Math.min(100,verificationPoints+reviewPoints+completionPoints+responsePoints+reliabilityPoints+activityPoints))
  const label=score>=90?'Εξαιρετική αξιοπιστία':score>=80?'Πολύ υψηλή αξιοπιστία':score>=70?'Υψηλή αξιοπιστία':score>=60?'Καλή αξιοπιστία':'Αναπτυσσόμενη αξιοπιστία'
  return {eligible:true,score,label,completed,reviews,rating:Number(rating.toFixed(1)),completionRate,responseRate,breakdown:{verification:verificationPoints,reviews:reviewPoints,completion:completionPoints,response:responsePoints,reliability:reliabilityPoints,activity:activityPoints}}
}

async function smartMatchDiagnosticsForProfessional(professionalId,trust=null){
  const p=await one(`
    SELECT
      id,
      verified,
      featured,
      rating,
      reviews_count,
      available,
      response_time,
      years,
      subscription_plan,
      subscription_status
    FROM professionals
    WHERE id=$1
  `,[professionalId])

  if(!p)return null

  if(!trust){
    trust=await meleoTrustForProfessional(professionalId)
  }

  const reviews=Number(p.reviews_count||0)
  const rating=Number(p.rating||0)
  const years=Number(p.years||0)

  const available=
    String(p.available||'').toLowerCase()

  const responseTime=
    String(p.response_time||'').toLowerCase()

  const verifiedPoints=
    p.verified ? 6 : 0

  const trustPoints=
    trust?.eligible
      ? Math.max(
          0,
          Math.min(
            28,
            (Number(trust.score||0)/100)*28
          )
        )
      : 18

  const ratingPoints=
    reviews===0
      ? 7
      : Math.max(
          0,
          Math.min(
            14,
            (rating/5)*14
          )
        )

  const reviewConfidencePoints=
    reviews>=20 ? 5 :
    reviews>=10 ? 4 :
    reviews>=5 ? 3 :
    reviews>=1 ? 2 : 1

  const availabilityPoints=
    available.includes('σήμερα') ||
    available.includes('άμεσα')
      ? 8
      : available.includes('διαθέσ')
        ? 6
        : 3

  const responsePoints=
    responseTime.includes('λεπτ')
      ? 6
      : (
          responseTime.includes('ώρα') ||
          responseTime.includes('ωρ')
        )
        ? 5
        : responseTime
          ? 4
          : 2

  const experiencePoints=
    years>=10 ? 3 :
    years>=5 ? 2 :
    years>0 ? 1 : 0

  const premiumPoints=
    p.subscription_plan==='premium' &&
    p.subscription_status==='active'
      ? 8
      : 0

  const featuredPoints=
    p.featured ? 2 : 0

  /*
   * Distance intentionally excluded here.
   *
   * Distance is request-dependent:
   * the same professional receives a different distance
   * contribution for each patient's search location.
   */
  const profileScore=
    verifiedPoints+
    trustPoints+
    ratingPoints+
    reviewConfidencePoints+
    availabilityPoints+
    responsePoints+
    experiencePoints+
    premiumPoints+
    featuredPoints

  return {
    version:'1.1',

    profileScore:Number(
      profileScore.toFixed(1)
    ),

    profileMax:80,

    distance:{
      dynamic:true,
      maxPoints:20,
      note:
        'Η απόσταση υπολογίζεται ξεχωριστά για κάθε αναζήτηση χρήστη.'
    },

    factors:{
      verified:{
        points:verifiedPoints,
        max:6,
        active:!!p.verified
      },

      trust:{
        points:Number(trustPoints.toFixed(1)),
        max:28,
        eligible:!!trust?.eligible,
        score:trust?.eligible
          ? Number(trust.score||0)
          : null,
        fallback:!trust?.eligible
      },

      rating:{
        points:Number(ratingPoints.toFixed(1)),
        max:14,
        rating:Number(rating.toFixed(1)),
        reviews
      },

      reviewConfidence:{
        points:reviewConfidencePoints,
        max:5,
        reviews
      },

      availability:{
        points:availabilityPoints,
        max:8,
        value:p.available||''
      },

      response:{
        points:responsePoints,
        max:6,
        value:p.response_time||''
      },

      experience:{
        points:experiencePoints,
        max:3,
        years
      },

      premium:{
        points:premiumPoints,
        max:8,
        active:premiumPoints===8
      },

      featured:{
        points:featuredPoints,
        max:2,
        active:!!p.featured
      }
    }
  }
}


registerProfessionalCoreRoutes(
  app,
  {
    Professionals,
    limits,
    allowsVisibility,
    meleoTrustForProfessional,
    pagination,
    many,
    one,
    sanitizeProfilePatch,
    auth,
    requireRole
  }
)

app.get('/api/seo/resolve',async(req,res)=>{const specialtySlug=str(req.query.specialty,120),citySlug=str(req.query.city,120);const rows=await many(`SELECT DISTINCT specialty,city FROM professionals WHERE verified=true AND admin_suspended=false AND subscription_status='active' AND specialty<>'' AND city<>'' LIMIT 3000`);const match=rows.find(x=>slugify(x.specialty)===specialtySlug&&slugify(x.city)===citySlug);if(!match)return res.status(404).json({error:'Not found'});res.json(match)})



registerProfessionalVerificationRoutes(
  app,
  {
    auth,
    requireRole,
    requireVerifiedEmail,
    limits,
    Professionals,
    str,
    id,
    verificationObjectKey,
    putVerificationObject,
    deleteVerificationObject,
    encryptFileBuffer,
    sql,
    audit,
    config
  }
)




registerProfessionalBillingRoutes(
  app,
  {
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
  }
)

registerBookingCoreRoutes(
  app,
  {
    auth,
    requireConsumer,
    requireVerifiedEmail,
    limits,
    str,
    isDate,
    isTime,
    Professionals,
    allowsVisibility,
    id,
    Bookings,
    Notifications,
    audit
  }
)

registerBookingStateRoutes(
  app,
  {
    auth,
    limits,
    str,
    Bookings,
    Professionals,
    canEditBooking,
    Notifications
  }
)

registerBookingCommunicationRoutes(
  app,
  {
    auth,
    requireRole,
    limits,
    str,
    Bookings,
    Professionals,
    canViewBooking,
    Notifications
  }
)



registerBookingRecoveryRoutes(
  app,
  {
    auth,
    requireConsumer,
    requireVerifiedEmail,
    limits,
    str,
    id,
    Bookings,
    Professionals,
    allowsVisibility,
    Notifications,
    audit
  }
)


registerBookingReviewRoutes(
  app,
  {
    auth,
    requireConsumer,
    limits,
    Bookings,
    canReviewBooking,
    str,
    tx,
    id,
    Professionals,
    Notifications
  }
)



registerNotificationRoutes(
  app,
  {
    auth,
    Notifications
  }
)



app.get(
  '/api/communication/unread',
  auth,
  async(req,res)=>{

    const [
      notifications,
      messages
    ]=await Promise.all([
      Notifications.unreadCount(req.user.id),
      Bookings.unreadMessageCount(req.user.id)
    ])

    res.json({
      notifications,
      messages,
      total:
        Number(notifications||0)+
        Number(messages||0)
    })
  }
)






registerFavoritesRoutes(
  app,
  {
    auth,
    requireConsumer,
    limits,
    one,
    sql,
    id,
    many
  }
)





registerCareTeamRoutes(
  app,
  {
    auth,
    many,
    one,
    Professionals,
    allowsVisibility,
    meleoTrustForProfessional
  }
)



app.post('/api/reports',auth,limits.write,async(req,res)=>{const rid=id('rpt');await sql(`INSERT INTO reports(id,reporter_user_id,target_type,target_id,reason,details) VALUES($1,$2,$3,$4,$5,$6)`,[rid,req.user.id,str(req.body.targetType,40),str(req.body.targetId,80),str(req.body.reason,200),str(req.body.details,1500)]);res.json({ok:true,id:rid})})

// Multi-instance SSE via Postgres LISTEN/NOTIFY + persisted live_events.
const liveClients=new Map();const listener=await getPool().connect();await listener.query('LISTEN meleo_live');listener.on('notification',msg=>{let meta;try{meta=JSON.parse(msg.payload||'{}')}catch{return}const uid=meta.userId,clients=liveClients.get(uid);if(!clients?.size)return;one('SELECT payload FROM live_events WHERE id=$1 AND user_id=$2',[meta.eventId,uid]).then(e=>{if(!e)return;for(const r of [...clients])try{r.write(`event: meleo\ndata: ${JSON.stringify(e.payload)}\n\n`)}catch{clients.delete(r)}}).catch(()=>{})})
app.get('/api/live',auth,async(req,res)=>{res.setHeader('Content-Type','text/event-stream');res.setHeader('Cache-Control','no-cache');res.setHeader('Connection','keep-alive');res.flushHeaders?.();const set=liveClients.get(req.user.id)||new Set();set.add(res);liveClients.set(req.user.id,set);res.write(`event: ready\ndata: {}\n\n`);const ping=setInterval(()=>{try{res.write(': ping\n\n')}catch{}},25000);req.on('close',()=>{clearInterval(ping);set.delete(res);if(!set.size)liveClients.delete(req.user.id)})})


registerBookingCalendarRoutes(
  app,
  {
    auth,
    Bookings,
    Professionals,
    canViewBooking,
    canViewPatientContact,
    str
  }
)


registerSupportRoutes(
  app,
  {
    auth,
    requireRole,
    limits,
    pagination,
    many,
    one,
    sql,
    tx,
    id,
    str,
    Notifications
  }
)

app.use('/api/admin',auth,requireRole('admin'),adminIpGuard,limits.admin)
app.use('/api/admin',(req,res,next)=>['GET','HEAD','OPTIONS'].includes(req.method)?next():limits.adminWrite(req,res,next))

// ============================================================
// MELEO SMART REQUEST LEARNING v1
// ============================================================

let smartLearningSchemaReady = false

async function ensureSmartLearningSchema(){

  if(smartLearningSchemaReady)return

  await sql(`
    CREATE TABLE IF NOT EXISTS smart_request_learning (
      id text PRIMARY KEY,
      normalized_text text NOT NULL UNIQUE,
      sample_text text NOT NULL,
      occurrences integer NOT NULL DEFAULT 1,
      status text NOT NULL DEFAULT 'new',
      learned_specialty text,
      learned_service text,
      admin_note text,
      first_seen_at timestamptz NOT NULL DEFAULT now(),
      last_seen_at timestamptz NOT NULL DEFAULT now(),
      reviewed_at timestamptz,
      reviewed_by text
    )
  `)

  await sql(`
    CREATE INDEX IF NOT EXISTS smart_request_learning_status_idx
    ON smart_request_learning(status)
  `)

  await sql(`
    CREATE INDEX IF NOT EXISTS smart_request_learning_occurrences_idx
    ON smart_request_learning(occurrences DESC)
  `)

  smartLearningSchemaReady=true
}

function normalizeSmartRequest(value){

  return String(value||'')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/ς/g,'σ')
    .replace(/[^\p{L}\p{N}\s]/gu,' ')
    .replace(/\s+/g,' ')
    .trim()
}


// ------------------------------------------------------------
// PUBLIC / SMART REQUEST TRACKING
// ------------------------------------------------------------

app.post(
  '/api/smart-request/unmatched',
  limits.write,
  async(req,res)=>{

    await ensureSmartLearningSchema()

    const text=str(req.body.text,500)

    if(!text || text.length<3){
      return res.status(400).json({
        error:'Το αίτημα είναι πολύ μικρό.'
      })
    }

    const normalized=normalizeSmartRequest(text)

    if(!normalized){
      return res.status(400).json({
        error:'Μη έγκυρο αίτημα.'
      })
    }

    const existing=await one(
      `
      SELECT id
      FROM smart_request_learning
      WHERE normalized_text=$1
      `,
      [normalized]
    )

    if(existing){

      await sql(
        `
        UPDATE smart_request_learning
        SET
          occurrences=occurrences+1,
          sample_text=$1,
          last_seen_at=now()
        WHERE id=$2
        `,
        [text,existing.id]
      )

      return res.json({
        ok:true,
        aggregated:true
      })
    }

    const sid=id('smart')

    await sql(
      `
      INSERT INTO smart_request_learning(
        id,
        normalized_text,
        sample_text
      )
      VALUES($1,$2,$3)
      `,
      [
        sid,
        normalized,
        text
      ]
    )

    res.json({
      ok:true,
      id:sid,
      aggregated:false
    })
  }
)


// ------------------------------------------------------------
// LEARNED RULE LOOKUP
// ------------------------------------------------------------

app.post(
  '/api/smart-request/learned-match',
  async(req,res)=>{

    await ensureSmartLearningSchema()

    const text=str(req.body.text,500)
    const normalized=normalizeSmartRequest(text)

    if(!normalized){
      return res.json({
        match:null
      })
    }

    const rows=await many(
      `
      SELECT
        id,
        normalized_text "normalizedText",
        learned_specialty "specialty",
        learned_service "service",
        occurrences
      FROM smart_request_learning
      WHERE status='learned'
        AND learned_specialty IS NOT NULL
      ORDER BY occurrences DESC
      LIMIT 500
      `
    )

    let best=null
    let bestScore=0

    for(const row of rows){

      const phrase=row.normalizedText||''

      if(!phrase)continue

      let score=0

      if(normalized===phrase){
        score=100
      }
      else if(normalized.includes(phrase)){
        score=80
      }
      else if(phrase.includes(normalized) && normalized.length>=8){
        score=60
      }

      if(score>bestScore){
        bestScore=score
        best=row
      }
    }

    res.json({
      match:best
        ?{
            specialty:best.specialty,
            service:best.service||'',
            score:bestScore,
            source:'learned'
          }
        :null
    })
  }
)


// ------------------------------------------------------------
// ADMIN LIST
// ------------------------------------------------------------

app.get(
  '/api/admin/smart-requests',
  async(req,res)=>{

    await ensureSmartLearningSchema()

    const status=str(req.query.status,30)
    const q=str(req.query.q,150)

    const where=[]
    const params=[]

    if(status && status!=='all'){
      params.push(status)
      where.push(`status=$${params.length}`)
    }

    if(q){
      params.push(`%${q}%`)
      where.push(
        `(sample_text ILIKE $${params.length}
          OR normalized_text ILIKE $${params.length}
          OR learned_specialty ILIKE $${params.length}
          OR learned_service ILIKE $${params.length})`
      )
    }

    const rows=await many(
      `
      SELECT
        id,
        sample_text "text",
        normalized_text "normalizedText",
        occurrences,
        status,
        learned_specialty "specialty",
        learned_service "service",
        admin_note "note",
        first_seen_at "firstSeenAt",
        last_seen_at "lastSeenAt",
        reviewed_at "reviewedAt"
      FROM smart_request_learning
      ${where.length?'WHERE '+where.join(' AND '):''}
      ORDER BY
        CASE status
          WHEN 'new' THEN 0
          WHEN 'reviewed' THEN 1
          WHEN 'learned' THEN 2
          ELSE 3
        END,
        occurrences DESC,
        last_seen_at DESC
      LIMIT 300
      `,
      params
    )

    const summary=await one(
      `
      SELECT
        count(*)::int total,
        count(*) FILTER(WHERE status='new')::int new,
        count(*) FILTER(WHERE status='reviewed')::int reviewed,
        count(*) FILTER(WHERE status='learned')::int learned,
        count(*) FILTER(WHERE status='ignored')::int ignored,
        coalesce(sum(occurrences),0)::int occurrences
      FROM smart_request_learning
      `
    )

    res.json({
      items:rows,
      summary
    })
  }
)


// ------------------------------------------------------------
// ADMIN DECISION
// ------------------------------------------------------------

app.patch(
  '/api/admin/smart-requests/:id',
  async(req,res)=>{

    await ensureSmartLearningSchema()

    const item=await one(
      `
      SELECT *
      FROM smart_request_learning
      WHERE id=$1
      `,
      [req.params.id]
    )

    if(!item){
      return res.status(404).json({
        error:'Smart request not found'
      })
    }

    const status=[
      'new',
      'reviewed',
      'learned',
      'ignored'
    ].includes(req.body.status)
      ?req.body.status
      :'reviewed'

    const specialty=str(req.body.specialty,150)
    const service=str(req.body.service,200)
    const note=str(req.body.note,1000)

    if(status==='learned' && !specialty){
      return res.status(400).json({
        error:'Για Learned request απαιτείται ειδικότητα.'
      })
    }

    await sql(
      `
      UPDATE smart_request_learning
      SET
        status=$1,
        learned_specialty=$2,
        learned_service=$3,
        admin_note=$4,
        reviewed_at=now(),
        reviewed_by=$5
      WHERE id=$6
      `,
      [
        status,
        specialty||null,
        service||null,
        note||null,
        req.user.id,
        item.id
      ]
    )

    await audit(
      req.user.id,
      'admin.smart_request.update',
      {
        smartRequestId:item.id,
        status,
        specialty,
        service
      }
    )

    res.json({
      ok:true
    })
  }
)

// END MELEO SMART REQUEST LEARNING v1

app.get('/api/admin/stats',async(_req,res)=>res.json(await Admin.stats()))
app.get(
  '/api/admin/command-center',
  async(_req,res)=>{
    res.json(
      await Admin.commandCenter()
    )
  }
)
app.get('/api/admin/members',async(req,res)=>{const {page,limit,offset}=pagination(req.query,{defaultLimit:30,maxLimit:100});const q=str(req.query.q,100),role=str(req.query.role,30);const where=["u.deleted_at IS NULL","u.role<>'admin'"],vals=[];let i=1;if(q){where.push(`(u.name ILIKE $${i} OR u.email ILIKE $${i})`);vals.push(`%${q}%`);i++}if(role){where.push(`u.role=$${i++}`);vals.push(role)}vals.push(limit,offset);const rows=await many(`SELECT u.id,u.name,u.email,u.phone,u.role,u.email_verified "emailVerified",u.account_status "accountStatus",u.suspended_at "suspendedAt",u.suspension_reason "suspensionReason",u.deletion_pending "deletionPending",u.last_login_at "lastLoginAt",u.created_at "createdAt",p.id "professionalId",p.specialty,p.verified,p.featured,p.rating,p.reviews_count reviews,p.city,p.subscription_plan "subscriptionPlan",p.subscription_status "subscriptionStatus",p.subscription_price "subscriptionPrice",p.billing_mode "billingMode",p.current_period_end "currentPeriodEnd",p.onboarding_stage "onboardingStage",p.onboarding_completed "onboardingCompleted",v.id "verificationRequestId",v.status "verificationStatus" FROM users u LEFT JOIN professionals p ON p.user_id=u.id LEFT JOIN LATERAL (SELECT id,status FROM verification_requests vr WHERE vr.professional_id=p.id ORDER BY submitted_at DESC LIMIT 1) v ON true WHERE ${where.join(' AND ')} ORDER BY u.created_at DESC LIMIT $${i++} OFFSET $${i}`,[...vals]);const items=rows.map(m=>{let lifecycleStatus='';if(m.deletionPending)lifecycleStatus='deletion_pending';else if(m.role==='professional'){if(m.verified)lifecycleStatus='approved';else if(m.verificationStatus==='pending')lifecycleStatus='pending_verification';else if(m.verificationStatus==='rejected')lifecycleStatus='verification_rejected';else if(!['active','past_due'].includes(m.subscriptionStatus||''))lifecycleStatus='awaiting_subscription';else if(!m.specialty||!m.city)lifecycleStatus='profile_incomplete';else lifecycleStatus='verification_required'}return {...m,lifecycleStatus,subscriptionPrice:Number(m.subscriptionPrice||0),rating:Number(m.rating||0),reviews:Number(m.reviews||0)}});const c=await one(`SELECT count(*)::int total FROM users u WHERE u.deleted_at IS NULL AND u.role<>'admin'`);res.json({items,page,limit,total:c.total,totalPages:Math.ceil(c.total/limit)})})

app.patch('/api/admin/members/:id/action',limits.write,async(req,res)=>{const u=await Users.byId(req.params.id);if(!u)return res.status(404).json({error:'Not found'});const p=u.role==='professional'?await Professionals.byUser(u.id):null,action=str(req.body.action,40),reason=str(req.body.reason,500);if(action==='suspend'){await Users.update(u.id,{account_status:'suspended',suspended_at:now(),suspension_reason:reason});await Sessions.revokeUser(u.id)}else if(action==='reactivate')await Users.update(u.id,{account_status:'active',suspended_at:null,suspension_reason:''});else if(action==='verify'&&p)await Professionals.update(p.id,{verified:true,onboardingStage:'approved',onboardingCompleted:true});else if(action==='unverify'&&p)await Professionals.update(p.id,{verified:false,onboardingStage:'verification'});else if(action==='feature'&&p&&p.subscriptionPlan==='premium')await Professionals.update(p.id,{featured:true});else if(action==='unfeature'&&p)await Professionals.update(p.id,{featured:false});else return res.status(400).json({error:'Μη έγκυρη ενέργεια.'});await audit(req.user.id,`admin.member.${action}`,{targetUserId:u.id,reason});res.json({ok:true})})
app.get('/api/admin/audit',async(req,res)=>{const {page,limit,offset}=pagination(req.query,{defaultLimit:50,maxLimit:200});const items=await many(`SELECT a.id,a.actor_id "actorId",u.name "actorName",u.email "actorEmail",a.action,a.meta,a.created_at at FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT $1 OFFSET $2`,[limit,offset]);res.json({items,page,limit})})
app.get('/api/admin/insights',async(_req,res)=>{
 const topPros=await many(`SELECT p.id,u.name,p.specialty,p.subscription_plan plan,p.verified,p.rating,p.reviews_count reviews,count(b.id)::int requests,count(b.id) FILTER(WHERE b.status='completed')::int completed,coalesce(sum(a.profile_views),0)::int "profileViews",coalesce(sum(a.impressions),0)::int impressions FROM professionals p JOIN users u ON u.id=p.user_id LEFT JOIN bookings b ON b.professional_id=p.id LEFT JOIN professional_analytics_daily a ON a.professional_id=p.id AND a.day>=current_date-30 GROUP BY p.id,u.name ORDER BY completed DESC,requests DESC LIMIT 10`);
 const signupByRole=await many(`SELECT role,count(*)::int count,count(*) FILTER(WHERE created_at>=now()-interval '30 days')::int new30 FROM users WHERE deleted_at IS NULL AND role IN ('patient','professional') GROUP BY role`);
 const bookingStatus=await many(`SELECT status name,count(*)::int count FROM bookings GROUP BY status ORDER BY count DESC`);
 const reviewDist=await many(`SELECT gs stars,coalesce(count(r.id),0)::int count FROM generate_series(5,1,-1) gs LEFT JOIN reviews r ON r.rating=gs GROUP BY gs ORDER BY gs DESC`);
 const x=await one(`SELECT (SELECT count(*) FROM users WHERE deleted_at IS NULL AND created_at>=now()-interval '7 days')::int "newUsers7",(SELECT count(*) FROM users WHERE deleted_at IS NULL AND created_at>=now()-interval '30 days')::int "newUsers30",(SELECT count(*) FROM bookings WHERE created_at>=now()-interval '7 days')::int "newBookings7",(SELECT count(*) FROM bookings WHERE created_at>=now()-interval '30 days')::int "newBookings30"`);
 res.json({topPros,signupByRole,bookingStatus,reviewDist,...x})
})

app.get('/api/admin/bookings',async(req,res)=>res.json(await Bookings.listForUser({id:req.user.id,role:'admin'},req.query)))
app.get('/api/admin/subscriptions',async(req,res)=>{const subscriptions=await many(`SELECT s.id,s.professional_id "professionalId",s.stripe_subscription_id "stripeSubscriptionId",s.plan,s.price,s.status,s.stripe_status "stripeStatus",s.billing_mode "billingMode",s.started_at "startedAt",s.current_period_end "currentPeriodEnd",s.cancel_at_period_end "cancelAtPeriodEnd",s.updated_at "updatedAt",u.name "professionalName",u.email FROM subscriptions s JOIN professionals p ON p.id=s.professional_id JOIN users u ON u.id=p.user_id ORDER BY s.updated_at DESC LIMIT 200`);const payments=await many(`SELECT id,professional_id "professionalId",invoice_id "invoiceId",amount,currency,status,provider,hosted_invoice_url "hostedInvoiceUrl",created_at "createdAt" FROM payments ORDER BY created_at DESC LIMIT 200`);res.json({subscriptions:subscriptions.map(x=>({...x,price:Number(x.price||0)})),payments:payments.map(x=>({...x,amount:Number(x.amount||0)}))})})

app.get('/api/admin/verifications',async(req,res)=>{const {page,limit,offset}=pagination(req.query,{defaultLimit:30,maxLimit:100});const rows=await many(`SELECT v.id,v.professional_id "professionalId",v.license_number "licenseNumber",v.notes,v.status,v.admin_note "adminNote",v.submitted_at "createdAt",u.name,u.email,u.phone,p.specialty,p.subscription_plan "subscriptionPlan",p.subscription_status "subscriptionStatus",p.city FROM verification_requests v JOIN professionals p ON p.id=v.professional_id JOIN users u ON u.id=p.user_id ORDER BY v.submitted_at DESC LIMIT $1 OFFSET $2`,[limit,offset]);const items=[];for(const v of rows){const docs=await many(`SELECT id,original_name name,mime_type mime,size_bytes size,created_at "createdAt" FROM verification_documents WHERE professional_id=$1 ORDER BY created_at DESC`,[v.professionalId]);items.push({...v,documents:docs,documentCount:docs.length})}const c=await one('SELECT count(*)::int total FROM verification_requests');res.json({items,page,limit,total:c.total,totalPages:Math.ceil(c.total/limit)})})

app.get('/api/admin/verification-documents/:id',async(req,res)=>{const d=await one('SELECT * FROM verification_documents WHERE id=$1',[req.params.id]);if(!d)return res.status(404).end();try{const encrypted=await getVerificationObject(d.storage_key||`${d.id}.bin`);res.setHeader('Content-Type',d.mime_type);res.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(d.original_name)}`);res.setHeader('Cache-Control','no-store, private');res.end(decryptFileBuffer(encrypted))}catch(e){if(e?.code==='ENOENT'||e?.status===404)return res.status(404).end();throw e}})
app.post('/api/admin/verification-documents/:id/access',limits.write,async(req,res)=>{const d=await one('SELECT id FROM verification_documents WHERE id=$1',[req.params.id]);if(!d)return res.status(404).end();const expires=Date.now()+config.storage.signedUrlTtlSeconds*1000;const sig=createTemporaryDocumentSignature(d.id,expires);res.json({url:`/api/admin/verification-documents/${encodeURIComponent(d.id)}/signed?expires=${expires}&sig=${encodeURIComponent(sig)}`,expiresAt:new Date(expires).toISOString()})})
app.get('/api/admin/verification-documents/:id/signed',async(req,res)=>{if(!verifyTemporaryDocumentSignature(req.params.id,req.query.expires,req.query.sig))return res.status(403).json({error:'Ο προσωρινός σύνδεσμος έληξε ή δεν είναι έγκυρος.'});const d=await one('SELECT * FROM verification_documents WHERE id=$1',[req.params.id]);if(!d)return res.status(404).end();try{const encrypted=await getVerificationObject(d.storage_key||`${d.id}.bin`);res.setHeader('Content-Type',d.mime_type);res.setHeader('Content-Disposition',`inline; filename*=UTF-8''${encodeURIComponent(d.original_name)}`);res.setHeader('Cache-Control','no-store, private');res.end(decryptFileBuffer(encrypted))}catch(e){if(e?.code==='ENOENT'||e?.status===404)return res.status(404).end();throw e}})
app.patch('/api/admin/verifications/:id',async(req,res)=>{const v=await one('SELECT * FROM verification_requests WHERE id=$1',[req.params.id]);if(!v)return res.status(404).json({error:'Not found'});const status=req.body.status==='approved'?'approved':'rejected',approved=status==='approved',note=str(req.body.note||req.body.adminNote,1000);if(!approved&&!note)return res.status(400).json({error:'Ο λόγος απόρριψης είναι υποχρεωτικός.'});const p=await Professionals.byId(v.professional_id);if(!p)return res.status(404).json({error:'Professional not found'});if(approved&&!['active','past_due'].includes(p.subscriptionStatus||''))return res.status(400).json({error:'Δεν μπορεί να εγκριθεί επαγγελματικός λογαριασμός χωρίς ενεργή ή past-due συνδρομή.'});await tx(async c=>{await c.query(`UPDATE verification_requests SET status=$1,admin_note=$2,reviewed_by=$3,reviewed_at=now() WHERE id=$4`,[status,note,req.user.id,v.id]);await c.query(`UPDATE professionals SET verified=$1,onboarding_stage=$2,onboarding_completed=$1,updated_at=now() WHERE id=$3`,[approved,approved?'approved':'verification_rejected',v.professional_id])});const u=await Users.byId(p.userId);if(u){if(approved){await Notifications.create(u.id,'verification','Ο επαγγελματικός σας λογαριασμός ενεργοποιήθηκε','Η επαλήθευση ολοκληρώθηκε. Από το μενού προφίλ της πλατφόρμας επιλέξτε Professional Dashboard για να διαχειριστείτε το επαγγελματικό σας προφίλ και τα αιτήματα.')}else{await Notifications.create(u.id,'verification','Χρειάζεται ενέργεια για τον επαγγελματικό σας λογαριασμό',`Η επαγγελματική ενεργοποίηση δεν ολοκληρώθηκε. Λόγος: ${note}`)}mail.verificationDecision(u.email,u.name,approved,note).catch(()=>{})}await audit(req.user.id,`verification.${status}`,{requestId:v.id,professionalId:v.professional_id,reason:note});res.json({ok:true})})
app.post('/api/admin/professionals/:id/sync-subscription',async(req,res)=>{const p=await Professionals.byId(req.params.id);if(!p)return res.status(404).json({error:'Not found'});if(!p.stripeSubscriptionId||!getStripe())return res.status(400).json({error:'Δεν υπάρχει Stripe subscription.'});const sub=await getStripe().subscriptions.retrieve(p.stripeSubscriptionId);const updated=await applyStripeSubscription(sub);await audit(req.user.id,'admin.subscription.sync',{professionalId:p.id});res.json({professional:updated})})

app.get('/api/admin/reports',async(req,res)=>{const {page,limit,offset}=pagination(req.query,{defaultLimit:30,maxLimit:100});const items=await many(`SELECT r.*,u.name reporter_name,u.email reporter_email FROM reports r JOIN users u ON u.id=r.reporter_user_id ORDER BY created_at DESC LIMIT $1 OFFSET $2`,[limit,offset]);res.json({items,page,limit})})
app.patch('/api/admin/reports/:id',async(req,res)=>{await sql('UPDATE reports SET status=$1,updated_at=now() WHERE id=$2',[str(req.body.status,40)||'closed',req.params.id]);res.json({ok:true})})

// SEO + static build support.
function slugify(v=''){return String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9\u0370-\u03ff]+/g,'-').replace(/^-+|-+$/g,'')}
function htmlEscape(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function injectSeo(html,{title,description,canonical,body='',jsonLd=null}){
  let out=html.replace(/<title>.*?<\/title>/i,`<title>${htmlEscape(title)}</title>`)
  const meta=`<meta name="description" content="${htmlEscape(description)}"><link rel="canonical" href="${htmlEscape(canonical)}"><meta property="og:title" content="${htmlEscape(title)}"><meta property="og:description" content="${htmlEscape(description)}"><meta property="og:url" content="${htmlEscape(canonical)}"><meta property="og:type" content="website">${jsonLd?`<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g,'\\u003c')}</script>`:''}`
  out=out.replace('</head>',`${meta}</head>`)
  if(body)out=out.replace('<div id="root"></div>',`<div id="root"><main class="seo-prerender">${body}</main></div>`)
  return out
}
const dist=path.join(root,'dist')

//
// Public machine-readable discovery endpoints must exist
// independently of whether the API is also serving the SPA.
//
// This keeps integration/load tests deterministic and is also
// correct for deployments where frontend and API are separated.
//
app.get('/robots.txt',(_req,res)=>
  res
    .type('text/plain')
    .send(
      `User-agent: *\nAllow: /\nSitemap: ${config.appUrl}/sitemap.xml\n`
    )
)

app.get('/sitemap.xml',async(_req,res)=>{
  const pros=await many(
    `SELECT p.id
     FROM professionals p
     JOIN users u ON u.id=p.user_id
     WHERE p.verified=true
       AND p.admin_suspended=false
       AND p.subscription_status='active'
       AND u.deleted_at IS NULL`
  )

  const combos=await many(
    `SELECT DISTINCT specialty,city
     FROM professionals
     WHERE verified=true
       AND admin_suspended=false
       AND subscription_status='active'
       AND specialty<>''
       AND city<>''
     LIMIT 1000`
  )

  const urls=[
    `${config.appUrl}/`,
    `${config.appUrl}/search`,
    ...pros.map(
      p=>`${config.appUrl}/professionals/${p.id}`
    ),
    ...combos.map(
      x=>`${config.appUrl}/care/${encodeURIComponent(slugify(x.specialty))}/${encodeURIComponent(slugify(x.city))}`
    )
  ]

  res
    .type('application/xml')
    .send(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u=>`<url><loc>${htmlEscape(u)}</loc></url>`).join('')}</urlset>`
    )
})

if(config.isHosted&&fs.existsSync(dist)){
 const baseHtml=()=>fs.readFileSync(path.join(dist,'index.html'),'utf8')
 app.get('/professionals/:id',async(req,res,next)=>{
   const p=await Professionals.byId(req.params.id);if(!p||!p.verified||p.adminSuspended||!allowsVisibility(p))return next()
   const title=`${p.name} · ${p.specialty} | MELEO`
   const description=`${p.title||p.specialty} στην περιοχή ${p.city||p.region||'σου'}. ${p.verified?'MELEO Verified. ':''}${p.pricingMode==='from'?`Από ${p.price}€ βασική επίσκεψη.`:'Κόστος κατόπιν επικοινωνίας.'}`
   const canonical=`${config.appUrl}/professionals/${p.id}`
   const body=`<section><h1>${htmlEscape(p.name)}</h1><p>${htmlEscape(p.specialty)} · ${htmlEscape(p.city)}</p><p>${htmlEscape(p.bio||'')}</p></section>`
   const jsonLd={'@context':'https://schema.org','@type':'Person',name:p.name,jobTitle:p.title||p.specialty,address:{'@type':'PostalAddress',addressLocality:p.city,addressRegion:p.region,addressCountry:String(p.countryCode||'GR').toUpperCase()},url:canonical}
   res.type('html').send(injectSeo(baseHtml(),{title,description,canonical,body,jsonLd}))
 })
 app.get('/care/:specialty/:city',async(req,res,next)=>{
   const rows=await many(`SELECT DISTINCT specialty,city FROM professionals WHERE verified=true AND admin_suspended=false AND subscription_status='active' AND specialty<>'' AND city<>'' LIMIT 3000`)
   const match=rows.find(x=>slugify(x.specialty)===req.params.specialty&&slugify(x.city)===req.params.city);if(!match)return next()
   const count=await one(`SELECT count(*)::int n FROM professionals WHERE verified=true AND admin_suspended=false AND subscription_status='active' AND specialty=$1 AND city=$2`,[match.specialty,match.city])
   const title=`${match.specialty} ${match.city} · Βρες επαγγελματία | MELEO`
   const description=`Βρες επαληθευμένους επαγγελματίες ${match.specialty} στην περιοχή ${match.city}. Σύγκρινε προφίλ, διαθεσιμότητα και στείλε αίτημα μέσω MELEO.`
   const canonical=`${config.appUrl}/care/${encodeURIComponent(req.params.specialty)}/${encodeURIComponent(req.params.city)}`
   const body=`<section><h1>${htmlEscape(match.specialty)} στην περιοχή ${htmlEscape(match.city)}</h1><p>${count.n} διαθέσιμες επιλογές στη MELEO.</p></section>`
   res.type('html').send(injectSeo(baseHtml(),{title,description,canonical,body}))
 })
 app.use(express.static(dist,{maxAge:'1h',etag:true}))
 app.get(/.*/,(_req,res)=>res.sendFile(path.join(dist,'index.html')))
}else app.get('/',(_req,res)=>res.json({service:'MELEO API',status:'online',version:APP_VERSION,releaseChannel:RELEASE_CHANNEL,architecture:'PostgreSQL relational + Redis multi-instance + background worker + observability + secure S3 object storage'}))

app.use((err,req,res,_next)=>{
  if(err?.type==='entity.too.large'){
    log.warn('http.payload_too_large',{
      requestId:req.requestId,
      path:req.path,
      method:req.method
    })

    return res.status(413).json({
      error:'Το αρχείο είναι πολύ μεγάλο.'
    })
  }

  log.error('http.unhandled_error',{
    requestId:req.requestId,
    error:err
  })

  res.status(500).json({
    error:'Εσωτερικό σφάλμα. Δοκίμασε ξανά.'
  })
})

// sweeps without global lock
setInterval(async()=>{try{
 await Sessions.sweep();await sql('DELETE FROM one_time_tokens WHERE expires_at<=now() OR used_at IS NOT NULL');await sql('DELETE FROM analytics_event_dedup WHERE expires_at<=now()');await sql("DELETE FROM rate_limits WHERE reset_at<=now()-interval '1 hour'");await sql('DELETE FROM geocode_cache WHERE expires_at<=now()');
 const pending=await many(`SELECT u.id,p.stripe_subscription_id FROM users u LEFT JOIN professionals p ON p.user_id=u.id WHERE u.deletion_pending=true LIMIT 20`);for(const x of pending){try{if(x.stripe_subscription_id&&getStripe())await getStripe().subscriptions.cancel(x.stripe_subscription_id);await Users.update(x.id,{deletion_pending:false,deleted_at:now(),name:'Deleted User',phone:'',account_status:'suspended'});await Sessions.revokeUser(x.id);await audit(null,'account.deletion.finalized',{userId:x.id})}catch(err){console.warn('[MELEO v5] deletion retry failed',x.id,err.message)}}
 }catch(e){console.error('[MELEO v5 sweep]',e.message)}},15*60_000).unref()

const server=app.listen(config.port,()=>{
  log.info('api.started',{
    version:APP_VERSION,
    url:`http://localhost:${config.port}`,
    instance:
      process.env.INSTANCE_ID||
      process.env.HOSTNAME||
      'local'
  })

  console.log(
    `MELEO v${APP_VERSION} relational API [${process.env.INSTANCE_ID||process.env.HOSTNAME||'local'}] → http://localhost:${config.port}`
  )
})

server.keepAliveTimeout = 65000
server.headersTimeout = 66000

async function shutdown(
  signal='shutdown',
  exitCode=0
){
  if(shuttingDown) return

  shuttingDown=true
  shutdownStartedAt=
    new Date().toISOString()

  log.warn(
    'api.shutdown.started',
    {
      signal,
      shutdownStartedAt
    }
  )

  const forceTimer=setTimeout(
    ()=>{
      log.error(
        'api.shutdown.forced',
        {signal}
      )

      process.exit(1)
    },
    30000
  )

  forceTimer.unref()

  try{
    /*
     * Tell Node to stop accepting new connections.
     *
     * Do NOT await this yet because SSE connections
     * are long-lived and must be closed first.
     */
    const httpClosed=
      new Promise(resolve=>{
        server.close(()=>resolve())
      })

    /*
     * Close SSE clients immediately so server.close()
     * can drain successfully.
     */
    for(
      const clients
      of liveClients.values()
    ){
      for(const client of clients){
        try{
          client.write(
            'event: shutdown\n' +
            'data: {"reason":"server_restart"}\n\n'
          )
        }catch{}

        try{
          client.end()
        }catch{}
      }
    }

    liveClients.clear()

    /*
     * Close idle keep-alive connections where
     * supported by the current Node runtime.
     */
    try{
      server.closeIdleConnections?.()
    }catch{}

    await httpClosed

    try{
      await listener.query(
        'UNLISTEN meleo_live'
      )
    }catch(err){
      log.warn(
        'api.shutdown.unlisten_failed',
        {
          message:
            err?.message||
            String(err)
        }
      )
    }

    try{
      listener.release()
    }catch{}

    await closeRedis()
    await closePool()

    clearTimeout(forceTimer)

    log.info(
      'api.shutdown.completed',
      {signal}
    )

    process.exit(exitCode)
  }catch(err){
    clearTimeout(forceTimer)

    log.error(
      'api.shutdown.failed',
      {
        signal,
        message:
          err?.message||
          String(err),
        stack:err?.stack
      }
    )

    process.exit(1)
  }
}

process.on(
  'SIGTERM',
  ()=>shutdown('SIGTERM',0)
)

process.on(
  'SIGINT',
  ()=>shutdown('SIGINT',0)
)

process.on(
  'uncaughtException',
  err=>{
    log.error(
      'process.uncaught_exception',
      {
        message:
          err?.message||
          String(err),
        stack:err?.stack
      }
    )

    shutdown(
      'uncaughtException',
      1
    ).catch(
      ()=>process.exit(1)
    )
  }
)

process.on(
  'unhandledRejection',
  reason=>{
    const err=
      reason instanceof Error
        ? reason
        : new Error(
            String(reason)
          )

    log.error(
      'process.unhandled_rejection',
      {
        message:err.message,
        stack:err.stack
      }
    )

    shutdown(
      'unhandledRejection',
      1
    ).catch(
      ()=>process.exit(1)
    )
  }
)
