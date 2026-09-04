import express from 'express'

import {
  createRemoteJWKSet,
  jwtVerify
} from 'jose'
import crypto from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs'
import { config, root, assertProductionReady } from '../config.js'
import { mail } from '../mail.js'
import { encryptSensitive, decryptSensitive, matchTotpStep } from '../security.js'
import { getPool, sql, one, many, tx, migrate, closePool, id, now, sha256, hashPassword, verifyPassword, publicUser, pagination } from './pool.js'
import { createLiveEventRuntime } from '../services/live-event-runtime.service.js'
import { createGeocodeService } from '../services/geocoding.service.js'
import { createRateLimitService } from '../services/rate-limit.service.js'
import {
  GOOGLE_OAUTH_CONFIG,
  GOOGLE_OAUTH_TRANSACTION_COOKIE,
  assertGoogleOAuthConfiguration,
  createGoogleOAuthTransaction,
  validateGoogleOAuthTransaction,
  googleAuthorizationUrl,
  exchangeGoogleAuthorizationCode,
  verifyGoogleIdToken,
  setGoogleOAuthTransactionCookie,
  clearGoogleOAuthTransactionCookie
} from '../services/google-oauth.service.js'
import { Users, Sessions, Professionals, Notifications, Bookings, Analytics, Admin, audit } from './repositories.js'
import Stripe from 'stripe'
import { canViewBooking, canEditBooking, canViewPatientContact, canReviewBooking } from './authorization.js'
import { redisRateLimit, redisGetJson, redisSetJson, redisPing, closeRedis } from '../redis.js'
import { log } from '../logger.js'
import { requestObservability } from '../request-observability.js'
import { observeRequest, observeError, metricsText } from '../metrics.js'
import { collectOperationalMetrics } from '../operational-metrics.js'
import { createHttpErrorHandler } from '../error-observability.js'
import { queueStats } from '../jobs.js'
import { createObjectStorageService } from '../services/object-storage.service.js'
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
import { registerBookingQuoteRoutes } from '../routes/booking-quote.routes.js'
import { registerBookingRecoveryRoutes } from '../routes/booking-recovery.routes.js'
import { registerBookingReviewRoutes } from '../routes/booking-review.routes.js'
import { registerBookingCalendarRoutes } from '../routes/booking-calendar.routes.js'
import { registerNotificationRoutes } from '../routes/notifications.routes.js'
import { registerFavoritesRoutes } from '../routes/favorites.routes.js'
import { registerCareTeamRoutes } from '../routes/care-team.routes.js'
import { registerSupportRoutes } from '../routes/support.routes.js'
import { registerReportRoutes } from '../routes/reports.routes.js'
import { registerCommunicationSummaryRoutes } from '../routes/communication-summary.routes.js'
import { registerLocationRoutes } from '../routes/location.routes.js'
import { registerAnalyticsRoutes } from '../routes/analytics.routes.js'
import { registerProfessionalAnalyticsRoutes } from '../routes/professional-analytics.routes.js'
import { registerSmartRequestRoutes } from '../routes/smart-request.routes.js'
import { registerSeoRoutes } from '../routes/seo.routes.js'
import { registerAdminReportsRoutes } from '../routes/admin-reports.routes.js'
import { registerAdminVerificationRoutes } from '../routes/admin-verification.routes.js'
import { registerAdminMembersRoutes } from '../routes/admin-members.routes.js'
import { registerAdminObservabilityRoutes } from '../routes/admin-observability.routes.js'
import { registerAdminBookingsRoutes } from '../routes/admin-bookings.routes.js'
import { registerAdminSubscriptionsRoutes } from '../routes/admin-subscriptions.routes.js'
import { registerPublicWebRoutes } from '../routes/public-web.routes.js'

assertProductionReady()
await migrate()
assertGoogleOAuthConfiguration()

const {
  verificationObjectKey,
  profilePhotoObjectKey,
  putVerificationObject,
  getVerificationObject,
  deleteVerificationObject,
  storageReady,
  createTemporaryDocumentSignature,
  verifyTemporaryDocumentSignature
} = createObjectStorageService()



/* ============================================================
 * MELEO Social Identity Persistence
 *
 * Provider identities are authoritative by:
 *
 *   provider + provider_subject
 *
 * Email is used only as a secondary account-linking signal
 * after the OAuth provider has cryptographically verified it.
 *
 * This deliberately keeps provider identities outside users,
 * allowing Google / Apple / Facebook to share one MELEO user.
 * ============================================================ */

const SOCIAL_IDENTITY_PROVIDER_GOOGLE =
  'google'


function normalizeSocialEmail(
  value
) {
  return String(
    value || ''
  )
    .trim()
    .toLowerCase()
}


async function socialIdentityBySubject(
  provider,
  providerSubject
) {
  const normalizedProvider =
    String(
      provider || ''
    )
      .trim()
      .toLowerCase()

  const normalizedSubject =
    String(
      providerSubject || ''
    )
      .trim()

  if (
    !normalizedProvider ||
    !normalizedSubject
  ) {
    return null
  }

  return one(
    `
      SELECT
        ui.*,
        u.role,
        u.name,
        u.email,
        u.phone,
        u.password_hash,
        u.email_verified,
        u.account_status,
        u.stripe_customer_id,
        u.deleted_at
      FROM user_identities ui
      JOIN users u
        ON u.id = ui.user_id
      WHERE ui.provider = $1
        AND ui.provider_subject = $2
      LIMIT 1
    `,
    [
      normalizedProvider,
      normalizedSubject
    ]
  )
}


async function socialIdentityForUserProvider(
  userId,
  provider
) {
  return one(
    `
      SELECT *
      FROM user_identities
      WHERE user_id = $1
        AND provider = $2
      LIMIT 1
    `,
    [
      userId,
      String(provider || '')
        .trim()
        .toLowerCase()
    ]
  )
}


async function insertSocialIdentity({
  userId,
  provider,
  providerSubject,
  providerEmail = null
}) {
  const normalizedProvider =
    String(
      provider || ''
    )
      .trim()
      .toLowerCase()

  const normalizedSubject =
    String(
      providerSubject || ''
    )
      .trim()

  const normalizedEmail =
    normalizeSocialEmail(
      providerEmail
    ) || null

  if (
    !userId ||
    !normalizedProvider ||
    !normalizedSubject
  ) {
    throw new Error(
      'Invalid social identity'
    )
  }

  return one(
    `
      INSERT INTO user_identities(
        id,
        user_id,
        provider,
        provider_subject,
        provider_email,
        created_at,
        updated_at,
        last_login_at
      )
      VALUES(
        $1,
        $2,
        $3,
        $4,
        $5,
        now(),
        now(),
        now()
      )
      RETURNING *
    `,
    [
      id('uid'),
      userId,
      normalizedProvider,
      normalizedSubject,
      normalizedEmail
    ]
  )
}


async function touchSocialIdentity(
  identityId,
  providerEmail = null
) {
  const normalizedEmail =
    normalizeSocialEmail(
      providerEmail
    ) || null

  return one(
    `
      UPDATE user_identities
      SET
        provider_email =
          COALESCE(
            $2,
            provider_email
          ),
        last_login_at = now(),
        updated_at = now()
      WHERE id = $1
      RETURNING *
    `,
    [
      identityId,
      normalizedEmail
    ]
  )
}


async function linkSocialIdentity({
  userId,
  provider,
  providerSubject,
  providerEmail = null
}) {
  const existingSubject =
    await socialIdentityBySubject(
      provider,
      providerSubject
    )

  /*
   * A provider subject can belong to only one MELEO user.
   * Never silently move it between accounts.
   */
  if (
    existingSubject &&
    existingSubject.user_id !== userId
  ) {
    const error =
      new Error(
        'Social identity is already linked to another account'
      )

    error.code =
      'SOCIAL_IDENTITY_CONFLICT'

    throw error
  }


  const existingProvider =
    await socialIdentityForUserProvider(
      userId,
      provider
    )

  /*
   * One provider identity per MELEO user.
   * Prevent replacing Google identity A with Google identity B.
   */
  if (
    existingProvider &&
    existingProvider.provider_subject !==
      String(providerSubject)
  ) {
    const error =
      new Error(
        'Another identity from this provider is already linked'
      )

    error.code =
      'SOCIAL_PROVIDER_ALREADY_LINKED'

    throw error
  }


  if (existingSubject) {

    await touchSocialIdentity(
      existingSubject.id,
      providerEmail
    )

    return existingSubject
  }


  if (existingProvider) {

    await touchSocialIdentity(
      existingProvider.id,
      providerEmail
    )

    return existingProvider
  }


  return insertSocialIdentity({
    userId,
    provider,
    providerSubject,
    providerEmail
  })
}


async function resolveGoogleAccount(
  googleProfile
) {
  const provider =
    SOCIAL_IDENTITY_PROVIDER_GOOGLE

  const subject =
    String(
      googleProfile?.sub || ''
    ).trim()

  const email =
    normalizeSocialEmail(
      googleProfile?.email
    )

  const emailVerified =
    googleProfile?.email_verified === true


  if (!subject) {
    const error =
      new Error(
        'Google identity does not contain a subject'
      )

    error.code =
      'GOOGLE_SUBJECT_MISSING'

    throw error
  }


  /*
   * 1. Strongest lookup:
   *    Google issuer + immutable Google subject.
   */
  const linked =
    await socialIdentityBySubject(
      provider,
      subject
    )


  if (linked) {

    if (
      linked.deleted_at
    ) {
      const error =
        new Error(
          'Linked MELEO account is unavailable'
        )

      error.code =
        'ACCOUNT_UNAVAILABLE'

      throw error
    }


    if (
      linked.account_status ===
      'suspended'
    ) {
      const error =
        new Error(
          'Linked MELEO account is suspended'
        )

      error.code =
        'ACCOUNT_SUSPENDED'

      throw error
    }


    await touchSocialIdentity(
      linked.id,
      email || null
    )


    const user =
      await Users.byId(
        linked.user_id
      )


    return {
      user,
      identity:
        await socialIdentityBySubject(
          provider,
          subject
        ),
      created: false,
      linkedByEmail: false
    }
  }


  /*
   * 2. No existing Google subject.
   *
   * Linking by email is allowed only when Google itself
   * cryptographically asserted email_verified=true.
   */
  if (
    email &&
    emailVerified
  ) {

    const existingUser =
      await Users.byEmail(
        email
      )


    if (existingUser) {

      if (
        existingUser.deleted_at
      ) {
        const error =
          new Error(
            'Existing MELEO account is unavailable'
          )

        error.code =
          'ACCOUNT_UNAVAILABLE'

        throw error
      }


      if (
        existingUser.account_status ===
        'suspended'
      ) {
        const error =
          new Error(
            'Existing MELEO account is suspended'
          )

        error.code =
          'ACCOUNT_SUSPENDED'

        throw error
      }


      const identity =
        await linkSocialIdentity({
          userId:
            existingUser.id,

          provider,

          providerSubject:
            subject,

          providerEmail:
            email
        })


      /*
       * A verified Google email is sufficient to mark the
       * matching MELEO email as verified.
       */
      if (
        !existingUser.email_verified
      ) {
        await Users.update(
          existingUser.id,
          {
            email_verified:
              true
          }
        )
      }


      const refreshed =
        await Users.byId(
          existingUser.id
        )


      return {
        user:
          refreshed,

        identity,

        created:
          false,

        linkedByEmail:
          true
      }
    }
  }


  /*
   * 3. Creating a new MELEO account requires a verified email.
   *
   * Do not create an email-less or unverified-email account
   * from Google OAuth.
   */
  if (
    !email ||
    !emailVerified
  ) {
    const error =
      new Error(
        'A verified Google email is required'
      )

    error.code =
      'GOOGLE_VERIFIED_EMAIL_REQUIRED'

    throw error
  }


  const name =
    String(
      googleProfile?.name ||
      email.split('@')[0] ||
      'MELEO User'
    )
      .trim()
      .slice(
        0,
        120
      )


  /*
   * Social-only accounts intentionally have no usable
   * local password.
   */
  const userId =
    id(
      'usr'
    )


  const user =
    await Users.create({
      id:
        userId,

      role:
        'patient',

      name,

      email,

      phone:
        '',

      passwordHash:
        null,

      emailVerified:
        true,

      acceptedTermsAt:
        now(),

      termsVersion:
        config.legal.termsVersion
    })


  const identity =
    await linkSocialIdentity({
      userId:
        user.id,

      provider,

      providerSubject:
        subject,

      providerEmail:
        email
    })


  await audit(
    user.id,
    'auth.social_account_created',
    {
      provider
    }
  )


  return {
    user,
    identity,
    created:
      true,

    linkedByEmail:
      false
  }
}

const app=express();
app.use(requestObservability)
if(config.trustProxy)app.set('trust proxy',1); app.disable('x-powered-by')
app.use((req,res,next)=>{const t=process.hrtime.bigint();res.on('finish',()=>{const ms=Number(process.hrtime.bigint()-t)/1e6;observeRequest(req.method,res.statusCode,ms);if(ms>=config.observability.slowRequestMs)log.warn('http.slow_request',{requestId:req.requestId,method:req.method,path:req.path,status:res.statusCode,durationMs:Number(ms.toFixed(2))})});next()})
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
const priceIdFor=plan=>{
  if(plan==='premium')return config.stripe.pricePremium
  if(plan==='basic')return config.stripe.priceBasic
  return ''
}

const lineItemFor=plan=>{
  if(!isPlan(plan)){
    const error=
      new Error(
        'Invalid Stripe subscription plan'
      )

    error.code='STRIPE_INVALID_PLAN'
    error.statusCode=400

    throw error
  }

  const price=
    priceIdFor(plan)

  if(!price){
    const error=
      new Error(
        `Stripe ${plan.toUpperCase()} price is not configured`
      )

    error.code='STRIPE_PRICE_NOT_CONFIGURED'
    error.statusCode=503
    error.plan=plan

    throw error
  }

  return {
    price,
    quantity:1
  }
}
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
    tx,
    id,
    now,
    PLANS,
    isPlan,
    mapStripeStatus,
    priceIdFor
  }
)

const baseHtml=()=>fs.readFileSync(path.join(root,'dist','index.html'),'utf8')

registerPublicWebRoutes(
  app,
  {
    config,
    many,
    one,
    Professionals,
    slugify,
  allowsVisibility,
  injectSeo,
  baseHtml,
  APP_VERSION,
  RELEASE_CHANNEL
  }
)

app.post('/api/webhooks/stripe',express.raw({type:'application/json',limit:'1mb'}),async(req,res)=>{
 const s=getStripe();if(!s||!config.stripe.webhookSecret)return res.status(503).json({error:'Webhook not configured'})
 let event;try{event=s.webhooks.constructEvent(req.body,req.headers['stripe-signature'],config.stripe.webhookSecret)}catch{return res.status(400).json({error:'Invalid signature'})}

 // Atomic claim: completed/currently-processing events never execute twice.
 // Failed or stale processing claims may be retried.
 let claimed=await one(
   `INSERT INTO webhook_events(id,type,status,attempts,last_attempt_at)
    VALUES($1,$2,'processing',1,now())
    ON CONFLICT(id) DO NOTHING RETURNING id`,
   [event.id,event.type]
 )
 if(!claimed){
   claimed=await one(
     `UPDATE webhook_events
      SET status='processing',attempts=attempts+1,last_attempt_at=now(),error=NULL
      WHERE id=$1 AND (
        status='failed' OR
        (status='processing' AND last_attempt_at<now()-interval '5 minutes')
      )
      RETURNING id`,
     [event.id]
   )
 }
 if(!claimed)return res.json({received:true,duplicate:true})

 try{
   const obj=event.data.object
   const eventContext={eventId:event.id,eventCreated:event.created}

   if(event.type.startsWith('customer.subscription.')){
     // Stripe delivery order is not guaranteed. Re-read canonical state so a
     // delayed event cannot roll a subscription backwards.
     let canonical=obj
     try{
       canonical=await s.subscriptions.retrieve(String(obj.id))
     }catch(err){
       if(event.type!=='customer.subscription.deleted')throw err
     }
     await applyStripeSubscription(canonical,false,eventContext)
   }

   if(event.type==='checkout.session.completed'&&obj.subscription){
     const sub=await s.subscriptions.retrieve(String(obj.subscription))
     await applyStripeSubscription(sub,true,eventContext)
   }

   if(event.type==='invoice.paid'||event.type==='invoice.payment_failed'){
     await recordInvoice(obj,event.type==='invoice.paid'?'paid':'failed')
   }

   await sql(
     `UPDATE webhook_events SET status='completed',completed_at=now(),error=NULL WHERE id=$1`,
     [event.id]
   )
   res.json({received:true})
 }catch(err){
   await sql(
     `UPDATE webhook_events SET status='failed',error=$2 WHERE id=$1`,
     [event.id,String(err?.message||err).slice(0,1000)]
   )
   res.status(500).json({error:'Processing failed'})
 }
})

app.use(express.json({ limit: '12mb' }))

const {
  limits
} = createRateLimitService({
  config,
  sha256,
  redisRateLimit,
  one
})

app.use('/api',limits.global)
app.use('/api',(req,res,next)=>{if(['GET','HEAD','OPTIONS'].includes(req.method)||req.path.startsWith('/webhooks/'))return next();const origin=String(req.headers.origin||'');if(!origin)return next();try{if(new URL(origin).origin!==new URL(config.appUrl).origin)return res.status(403).json({error:'Μη έγκυρη προέλευση αιτήματος'})}catch{return res.status(403).json({error:'Μη έγκυρη προέλευση αιτήματος'})}next()})

async function auth(req,res,next){const raw=cookieNamed(req,SESSION_COOKIE)||String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');if(!raw)return res.status(401).json({error:'Απαιτείται σύνδεση'});const row=await Sessions.resolve(raw);if(!row)return res.status(401).json({error:'Η συνεδρία έληξε. Συνδέσου ξανά.'});if(row.account_status==='suspended'&&row.role!=='admin')return res.status(403).json({error:'Ο λογαριασμός έχει ανασταλεί από τη MELEO.'});if(row.role==='admin'&&config.admin.bindUserAgent&&row.user_agent_hash&&row.user_agent_hash!==sha256(req.headers['user-agent']||'')){await Sessions.revoke(raw);await audit(row.user_id,'security.admin_session_ua_mismatch',{ipHash:sha256(req.ip||'')});clearSessionCookie(res);return res.status(401).json({error:'Η συνεδρία admin ακυρώθηκε για λόγους ασφαλείας.'})}req.user=publicUser(row);req.user.passwordHash=row.password_hash;req.user.stripeCustomerId=row.stripe_customer_id;req.sessionRaw=raw;next()}
const requireRole=role=>(req,res,next)=>req.user.role===role?next():res.status(403).json({error:role==='admin'?'Admin only':'Δεν επιτρέπεται για αυτόν τον τύπο λογαριασμού'})
const requireConsumer=(req,res,next)=>['patient','professional'].includes(req.user.role)?next():res.status(403).json({error:'Η συγκεκριμένη ενέργεια είναι διαθέσιμη σε χρήστες και επαγγελματίες.'})
const adminIpGuard=(req,res,next)=>{if(!config.admin.ipAllowlist.length)return next();const ip=String(req.ip||'').replace(/^::ffff:/,'');if(config.admin.ipAllowlist.includes(ip))return next();audit(req.user?.id||null,'security.admin_ip_denied',{ipHash:sha256(ip)}).catch(()=>{});return res.status(403).json({error:'Η πρόσβαση διαχειριστή δεν επιτρέπεται από αυτή τη διεύθυνση IP.'})}
function requireVerifiedEmail(req,res,next){if(config.mailEnabled&&!req.user.emailVerified)return res.status(403).json({error:'Επιβεβαίωσε πρώτα το email σου.'});next()}

async function issueSession(user,req,res){const ttl=user.role==='admin'?ADMIN_SESSION_TTL_MS:SESSION_TTL_MS;const raw=newToken();await Sessions.issue(user.id,raw,new Date(Date.now()+ttl).toISOString(),{ipHash:sha256(req.ip||''),uaHash:sha256(req.headers['user-agent']||'')});setSessionCookie(res,raw,ttl)}
async function createToken(
  userId,
  type,
  ttl
){
  const raw=
    newToken()

  await tx(
    async client=>{

      await client.query(
        'DELETE FROM one_time_tokens WHERE user_id=$1 AND type=$2',
        [
          userId,
          type
        ]
      )

      await client.query(
        `
          INSERT INTO one_time_tokens(
            id,
            user_id,
            type,
            token_hash,
            expires_at
          )
          VALUES(
            $1,$2,$3,$4,
            now()+($5||' milliseconds')::interval
          )
        `,
        [
          id('tok'),
          userId,
          type,
          sha256(raw),
          String(ttl)
        ]
      )
    }
  )

  return raw
}
async function consumeToken(raw,type,client=null){
  const consume=async c=>{
    const {rows}=await c.query(
      `SELECT *
       FROM one_time_tokens
       WHERE token_hash=$1
         AND type=$2
         AND used_at IS NULL
         AND expires_at>now()
       FOR UPDATE`,
      [sha256(raw),type]
    )

    const r=rows[0]

    if(!r){
      return null
    }

    await c.query(
      'UPDATE one_time_tokens SET used_at=now() WHERE id=$1',
      [r.id]
    )

    return r
  }

  return client
    ? consume(client)
    : tx(consume)
}

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
    googleOAuthEnabled:
      GOOGLE_OAUTH_CONFIG.enabled,
    APP_VERSION,
    PLANS,
    one,
    getPool,
    queueStats,
    metricsText,
    collectOperationalMetrics
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
    collectOperationalMetrics,
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
    tx,

    mail,
    audit,
    publicUser,

    id,
    now,
    sha256,

    googleOAuthEnabled:
      GOOGLE_OAUTH_CONFIG.enabled,

    createGoogleOAuthTransaction,
    validateGoogleOAuthTransaction,
    googleAuthorizationUrl,
    exchangeGoogleAuthorizationCode,
    verifyGoogleIdToken,
    resolveGoogleAccount,

    getGoogleOAuthTransactionCookie:
      req =>
        cookieNamed(
          req,
          GOOGLE_OAUTH_TRANSACTION_COOKIE
        ),

    setGoogleOAuthTransactionCookie,
    clearGoogleOAuthTransactionCookie
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
    id,
    audit,
    publicUser,
    hashPassword,
    verifyPassword,
    passwordPolicy,
    passwordPolicyError,
    clearSessionCookie,
    deleteVerificationObject,
    getStripe,
    mail,
    now
  }
)

// Geocoding infrastructure is owned by the dedicated service.
const geocode =
  createGeocodeService({
    config,
    sha256,
    redisGetJson,
    redisSetJson,
    one,
    sql
  })

registerLocationRoutes({
  app,
  limits,
  str,
  geocode,
  log
})

registerAnalyticsRoutes({
  app,
  limits,
  str,
  Analytics,
  fingerprint,
  sha256
})


registerProfessionalAnalyticsRoutes(
  app,
  {
    auth,
    requireRole,
    Professionals,
    Analytics,
    meleoTrustForProfessional,
    smartMatchDiagnosticsForProfessional
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
    requireRole,
    tx
  }
)

registerSeoRoutes({
  app,
  many,
  str,
  slugify
})

registerProfessionalVerificationRoutes(
  app,
  {
    auth,
    requireRole,
    requireVerifiedEmail,
    limits,
    Professionals,
    many,
    tx,
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
    Notifications,
    mail,
    ensureStripeCustomer,
    applyStripeSubscription,
    recordInvoice,
    now
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
    Users,
    allowsVisibility,
    id,
    Bookings,
    Notifications,
    mail,
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
    Users,
    canEditBooking,
    Notifications,
    mail
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



registerBookingQuoteRoutes(
  app,
  {
    auth,
    requireRole,
    limits,
    str,
    Bookings,
    Professionals
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



registerCommunicationSummaryRoutes(
  app,
  {
    auth,
    Notifications,
    Bookings
  }
)

registerFavoritesRoutes(
  app,
  {
    auth,
    requireConsumer,
    limits,
    tx,
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



registerReportRoutes(
  app,
  {
    auth,
    limits,
    sql,
    id,
    str
  }
)

// Multi-instance SSE via Postgres LISTEN/NOTIFY + persisted live_events.
const liveEventRuntime =
  await createLiveEventRuntime(
    app,
    {
      auth,
      getPool,
      one
    }
  )


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



registerSmartRequestRoutes(
  app,
  {
    limits,
    one,
    many,
    id,
    str,
    now,
    audit,
    tx,
    ensureSmartLearningSchema,
    normalizeSmartRequest
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

registerAdminObservabilityRoutes(
  app,
  {
    Admin,
    pagination,
    many,
    one,
    tx,
    audit
  }
)

registerAdminBookingsRoutes({
  app,
  Bookings
})

registerAdminSubscriptionsRoutes({
  app,
  Professionals,
  many,
  getStripe,
  applyStripeSubscription,
  audit
})



registerAdminMembersRoutes({
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
  })


registerAdminReportsRoutes({
  app,
  pagination,
  many,
  sql,
  id,
  str,
  now
})


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

// ------------------------------------------------------------
// LEARNED RULE LOOKUP
// ------------------------------------------------------------

// ------------------------------------------------------------
// ADMIN LIST
// ------------------------------------------------------------

// ------------------------------------------------------------
// ADMIN DECISION
// ------------------------------------------------------------

// END MELEO SMART REQUEST LEARNING v1




registerAdminVerificationRoutes(
  app,
  {
    limits,
    pagination,
    one,
    many,
    tx,
    str,
    Users,
    Professionals,
    Notifications,
    audit,
    mail,
    config,
    getVerificationObject,
    decryptFileBuffer,
    createTemporaryDocumentSignature,
    verifyTemporaryDocumentSignature
  }
)


// SEO + static build support.
function slugify(v=''){return String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9\u0370-\u03ff]+/g,'-').replace(/^-+|-+$/g,'')}
function htmlEscape(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function injectSeo(html,{title,description,canonical,body='',jsonLd=null}){
  let out=html.replace(/<title>.*?<\/title>/i,`<title>${htmlEscape(title)}</title>`).replace(/<meta\s+name=["']description["'][^>]*>/i,'')
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
if(config.isHosted&&fs.existsSync(dist)){
  app.use(express.static(dist,{maxAge:'1h',etag:true}))
  app.get(/.*/,(_req,res)=>res.sendFile(path.join(dist,'index.html')))
}

app.use(createHttpErrorHandler({
  log,
  observeError
}))

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
    liveEventRuntime.closeClients()

    /*
     * Close idle keep-alive connections where
     * supported by the current Node runtime.
     */
    try{
      server.closeIdleConnections?.()
    }catch{}

    await httpClosed

    try{
      await liveEventRuntime.closeListener()
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
    observeError('process','uncaught_exception')

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
    observeError('process','unhandled_rejection')

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
