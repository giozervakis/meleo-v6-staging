import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { config, root, assertProductionReady } from './config.js'
import { read, lock, commit, mutate, requestContext, initDb, runSweep, closeStore, storeInfo, id, now, hash, verifyPassword, sha256, publicUser, ensureAdmin, audit } from './db.js'
import { mail } from './mail.js'
import { encryptSensitive, decryptSensitive, matchTotpStep } from './security.js'
import {
  PLANS, isPlan, getStripe, createCheckoutSession, syncCheckoutSession, refreshSubscription,
  createPortalSession, changePlan, cancelSubscription, resumeSubscription,
  handleWebhookEvent, subscriptionAllowsVisibility
} from './payments.js'

assertProductionReady()

const app = express()
if (config.trustProxy) app.set('trust proxy', 1)

/* ------------------------------------------------------------------ *
 * Ασφάλεια: headers
 * ------------------------------------------------------------------ */
app.disable('x-powered-by')

// Κάθε αίτημα αποκτά δικό του transaction context (δες server/db.js).
app.use(requestContext)

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), payment=(self), geolocation=(self)')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'"
  ].join('; '))
  if (config.isProd) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  next()
})

/* ------------------------------------------------------------------ *
 * Stripe webhook — ΠΡΕΠΕΙ να δεχτεί raw body πριν το express.json()
 * ------------------------------------------------------------------ */
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
  const stripe = getStripe()
  if (!stripe || !config.stripe.webhookSecret) return res.status(503).json({ error: 'Webhook not configured' })
  let event
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], config.stripe.webhookSecret)
  } catch (err) {
    console.error('[MELEO] Άκυρη υπογραφή webhook:', err.message)
    return res.status(400).json({ error: 'Invalid signature' })
  }
  try {
    await handleWebhookEvent(event)
    res.json({ received: true })
  } catch (err) {
    console.error('[MELEO] Σφάλμα επεξεργασίας webhook:', event.type, err)
    // 500 ώστε το Stripe να επαναλάβει την αποστολή.
    res.status(500).json({ error: 'Processing failed' })
  }
})

app.use(express.json({ limit: '256kb' }))

/* ------------------------------------------------------------------ *
 * Rate limiting
 * ------------------------------------------------------------------ */
const buckets = new Map()
setInterval(() => {
  const t = Date.now()
  for (const [k, v] of buckets) if (v.reset < t) buckets.delete(k)
}, 60_000).unref()

function rateLimit({ windowMs, max, name, message = 'Πολλά αιτήματα. Δοκίμασε ξανά σε λίγο.' }) {
  return (req, res, next) => {
    const key = `${name}:${req.ip || 'local'}`
    const t = Date.now()
    let b = buckets.get(key)
    if (!b || b.reset < t) { b = { count: 0, reset: t + windowMs }; buckets.set(key, b) }
    b.count++
    if (b.count > max) {
      res.setHeader('Retry-After', Math.ceil((b.reset - t) / 1000))
      return res.status(429).json({ error: message })
    }
    next()
  }
}

const E2E_MODE =
  process.env.E2E_MODE === '1'
  
const limits = {
  global: rateLimit({
    windowMs: 60_000,
    max: E2E_MODE ? 5000 : 300,
    name: 'global'
  }),

  login: rateLimit({
    windowMs: 15 * 60_000,
    max: E2E_MODE ? 500 : 20,
    name: 'login',
    message: 'Πολλές προσπάθειες σύνδεσης. Δοκίμασε ξανά σε λίγα λεπτά.'
  }),

  register: rateLimit({
    windowMs: 60 * 60_000,
    max: E2E_MODE ? 250 : 10,
    name: 'register',
    message: 'Πολλές εγγραφές από αυτή τη σύνδεση. Δοκίμασε αργότερα.'
  }),

  password: rateLimit({
    windowMs: 60 * 60_000,
    max: E2E_MODE ? 250 : 8,
    name: 'password'
  }),

  write: rateLimit({
    windowMs: 60_000,
    max: E2E_MODE ? 1000 : 40,
    name: 'write'
  }),

  geo: rateLimit({
    windowMs: 60_000,
    max: E2E_MODE ? 500 : 40,
    name: 'geo'
  }),

  checkout: rateLimit({
    windowMs: 10 * 60_000,
    max: E2E_MODE ? 250 : 15,
    name: 'checkout'
  }),

  profile: rateLimit({
    windowMs: 60_000,
    max: E2E_MODE ? 500 : 45,
    name: 'profile',
    message: 'Πολλά αιτήματα προφίλ. Δοκίμασε ξανά σε λίγο.'
  }),

  analytics: rateLimit({
    windowMs: 60_000,
    max: E2E_MODE ? 500 : 20,
    name: 'analytics',
    message: 'Πάρα πολλά analytics events. Δοκίμασε ξανά αργότερα.'
  })
}
app.use('/api', limits.global)

/* ------------------------------------------------------------------ *
 * Helpers & validation
 * ------------------------------------------------------------------ */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const str = (v, max = 500) => String(v ?? '').trim().slice(0, max)
const isEmail = v => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(v || ''))
const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && !Number.isNaN(Date.parse(v))
const isTime = v => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || ''))
const PASSWORD_MIN = 8
const SESSION_COOKIE = 'meleo_session'
const cookieNamed=(req,name)=>{const raw=String(req.headers.cookie||'');const safe=String(name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const m=raw.match(new RegExp('(?:^|;\\s*)'+safe+'=([^;]+)'));return m?decodeURIComponent(m[1]):''}
const cookieValue = req => { const raw=String(req.headers.cookie||''); const m=raw.match(new RegExp('(?:^|;\\s*)'+SESSION_COOKIE+'=([^;]+)')); return m?decodeURIComponent(m[1]):'' }
const setSessionCookie = (res, token) => res.cookie(SESSION_COOKIE, token, { httpOnly:true, secure:config.isProd, sameSite:'lax', maxAge:SESSION_TTL_MS, path:'/' })
const clearSessionCookie = res => res.clearCookie(SESSION_COOKIE, { httpOnly:true, secure:config.isProd, sameSite:'lax', path:'/' })

// Same-origin προστασία για state-changing API requests όταν χρησιμοποιούμε cookie auth.
app.use('/api', (req,res,next)=>{
  if (['GET','HEAD','OPTIONS'].includes(req.method) || req.path.startsWith('/webhooks/')) return next()
  const origin=String(req.headers.origin||'')
  if (!origin) return next() // native clients / server-to-server
  try { if (new URL(origin).origin !== new URL(config.appUrl).origin) return res.status(403).json({error:'Μη έγκυρη προέλευση αιτήματος'}) } catch { return res.status(403).json({error:'Μη έγκυρη προέλευση αιτήματος'}) }
  next()
})

const newToken = () => crypto.randomBytes(32).toString('hex')

function issueSession(db, userId, extra = {}) {
  const token = newToken()
  db.sessions.push({ id: id('ses'), token: sha256(token), userId, createdAt: now(), expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(), ...extra })
  if (db.sessions.length > 20000) db.sessions = db.sessions.slice(-20000)
  return token
}

async function auth(req, res, next) {
  const raw = cookieValue(req) || String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!raw) return res.status(401).json({ error: 'Απαιτείται σύνδεση' })
  // Ανάγνωση χωρίς κλειδί: το auth τρέχει σε ΚΑΘΕ αίτημα και δεν πρέπει να
  // κρατά write lock στη βάση.
  const db = await read()
  const hashed = sha256(raw)
  const session = db.sessions.find(s => s.token === hashed)
  if (!session) return res.status(401).json({ error: 'Απαιτείται σύνδεση' })
  if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
    await mutate(d => { d.sessions = d.sessions.filter(x => x.token !== hashed) })
    return res.status(401).json({ error: 'Η συνεδρία έληξε. Συνδέσου ξανά.' })
  }
  const user = db.users.find(u => u.id === session.userId && !u.deletedAt)
  if (!user) return res.status(401).json({ error: 'Μη έγκυρη συνεδρία' })
  if (user.accountStatus === 'suspended' && user.role !== 'admin') return res.status(403).json({ error: 'Ο λογαριασμός έχει ανασταλεί από τη MELEO. Επικοινώνησε με την υποστήριξη.' })
  req.user = user
  req.sessionToken = hashed
  next()
}
const requireRole = role => (req, res, next) =>
  req.user.role === role ? next() : res.status(403).json({ error: role === 'admin' ? 'Admin only' : 'Δεν επιτρέπεται για αυτόν τον τύπο λογαριασμού' })

function requireVerifiedEmail(req, res, next) {
  if (config.mailEnabled && !req.user.emailVerified) {
    return res.status(403).json({ error: 'Επιβεβαίωσε πρώτα το email σου. Έλεγξε τα εισερχόμενά σου ή ζήτησε νέο σύνδεσμο.' })
  }
  next()
}

function createOneTimeToken(db, userId, type, ttlMs) {
  const token = newToken()
  db.tokens = db.tokens.filter(t => !(t.userId === userId && t.type === type))
  db.tokens.push({ id: id('tok'), userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttlMs).toISOString(), usedAt: null, createdAt: now() })
  return token
}
function consumeToken(db, token, type) {
  const hashed = sha256(token)
  const record = db.tokens.find(t => t.tokenHash === hashed && t.type === type && !t.usedAt)
  if (!record) return null
  if (new Date(record.expiresAt).getTime() < Date.now()) return null
  record.usedAt = now()
  return record
}

/** Πεδία που επιτρέπεται να αλλάξει ο επαγγελματίας μόνος του.
 *  Τα verified / featured / subscription* / rating / reviews ΔΕΝ ανήκουν εδώ:
 *  διαφορετικά ένας χρήστης θα μπορούσε να αυτο-πιστοποιηθεί ή να παρακάμψει την πληρωμή. */
const PROFILE_EDITABLE = ['title', 'specialty', 'bio', 'city', 'area', 'region', 'countryCode', 'latitude', 'longitude', 'serviceRadiusKm', 'price', 'pricingMode', 'years', 'services', 'availability', 'languages', 'available', 'showPhone', 'showEmail', 'preferPlatformContact']
const SPECIALTIES = ['Νοσηλευτική', 'Φυσικοθεραπεία', 'Διαιτολογία / Διατροφή', 'Εργοθεραπεία', 'Λογοθεραπεία', 'Μαιευτική φροντίδα', 'Ψυχολογία', 'Φροντίδα ηλικιωμένων', 'Αποκατάσταση']

function sanitizeProfilePatch(body = {}) {
  const patch = {}
  for (const key of PROFILE_EDITABLE) {
    if (!(key in body)) continue
    const v = body[key]
    switch (key) {
      case 'services': case 'availability': case 'languages':
        patch[key] = (Array.isArray(v) ? v : String(v ?? '').split(',')).map(x => str(x, 80)).filter(Boolean).slice(0, 30)
        break
      case 'price': patch.price = Math.min(5000, Math.max(0, Number(v) || 0)); break
      case 'years': patch.years = Math.min(70, Math.max(0, Math.round(Number(v) || 0))); break
      case 'serviceRadiusKm': patch.serviceRadiusKm = Math.min(300, Math.max(1, Math.round(Number(v) || 15))); break
      case 'pricingMode': patch.pricingMode = v === 'from' ? 'from' : 'contact'; break
      case 'latitude': case 'longitude': patch[key] = (v == null || v === '') ? null : Number(v); break
      case 'showPhone': case 'showEmail': case 'preferPlatformContact': patch[key] = Boolean(v); break
      case 'specialty': patch.specialty = SPECIALTIES.includes(v) ? v : ''; break
      case 'bio': patch.bio = str(v, 1500); break
      default: patch[key] = str(v, 120)
    }
  }
  if (patch.latitude != null && !Number.isFinite(patch.latitude)) patch.latitude = null
  if (patch.longitude != null && !Number.isFinite(patch.longitude)) patch.longitude = null
  return patch
}

const profileBasicsComplete = p => Boolean(p?.specialty && p?.title && p?.city)
const isPubliclyVisible = p => Boolean(p?.verified && !p?.adminSuspended && subscriptionAllowsVisibility(p?.subscriptionStatus, p))
const publicProfessional = p => ({ ...p, userId: undefined, stripeSubscriptionId: undefined, stripeStatus: undefined, currentPeriodEnd: undefined, cancelAtPeriodEnd: undefined, billingMode: undefined })

const liveClients = new Map()
function emitLive(userId, payload) {
  const clients = liveClients.get(userId)
  if (!clients?.size) return
  const chunk = `event: meleo\ndata: ${JSON.stringify(payload)}\n\n`
  for (const res of [...clients]) { try { res.write(chunk) } catch { clients.delete(res) } }
}
function notify(db, userId, type, title, text) {
  if (!userId) return
  const item = { id: id('ntf'), userId, type, title, text, read: false, createdAt: now() }
  db.notifications.push(item)
  queueMicrotask(() => emitLive(userId, { kind:'notification', notification:item }))
}

/* ------------------------------------------------------------------ *
 * Γεωκωδικοποίηση (OpenStreetMap Nominatim)
 * Προσοχή: όριο ~1 req/s και απαγόρευση heavy production use.
 * Δες LAUNCH_CHECKLIST.md για μετάβαση σε εμπορικό provider.
 * ------------------------------------------------------------------ */
const geoCache = new Map()
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, toRad = x => x * Math.PI / 180
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}
async function nominatim(pathname) {
  if (geoCache.has(pathname)) return geoCache.get(pathname)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org${pathname}`, {
      headers: { 'User-Agent': `MELEO-Marketplace/3.3 (${config.mail.supportEmail})`, 'Accept-Language': 'el,en' },
      signal: controller.signal
    })
    if (!r.ok) throw new Error('Geocoding unavailable')
    const data = await r.json()
    geoCache.set(pathname, data)
    if (geoCache.size > 2000) geoCache.delete(geoCache.keys().next().value)
    return data
  } finally { clearTimeout(timer) }
}
const geoLabel = item => {
  const a = item.address || {}
  return [a.city || a.town || a.village || a.municipality || a.county, a.state, a.country].filter(Boolean).join(', ') || item.display_name || 'Τοποθεσία'
}

/* ------------------------------------------------------------------ *
 * Δημόσια πληροφορία ρυθμίσεων (ώστε να μη δείχνει demo UI σε production)
 * ------------------------------------------------------------------ */
app.get('/api/config', (_req, res) => res.json({
  env: config.env,
  demoAuth: config.demoAuth,
  demoCheckout: config.demoCheckout,
  paymentsEnabled: config.stripeEnabled,
  mailEnabled: config.mailEnabled,
  portalEnabled: config.stripeEnabled && config.stripe.portalEnabled,
  plans: Object.values(PLANS),
  termsVersion: config.legal.termsVersion,
  emergencyNumber: config.emergencyNumber,
  legal: {
    company: config.legal.company,
    vatNumber: config.legal.vatNumber,
    address: config.legal.address,
    supportEmail: config.mail.supportEmail,
    dpoEmail: config.legal.dpoEmail
  }
}))

app.get('/api/health', async (_req, res) => {
  const db = await read()
  res.json({
    ok: true, service: 'MELEO API', version: '4.0.0', env: config.env,
    payments: config.stripeEnabled ? 'stripe' : (config.demoCheckout ? 'demo' : 'disabled'),
    mail: config.mailEnabled, storage: storeInfo(),
    users: db.users.length, professionals: db.professionals.length
  })
})
app.get('/api/ready', async (_req,res)=>{
  try {
    const db=await read()
    const checks={database:Boolean(db&&Array.isArray(db.users)),payments:config.isProd?config.stripeEnabled:true,mail:config.isProd?config.mailEnabled:true,admin2fa:config.isProd?Boolean(config.admin.totpSecret):true}
    const ok=Object.values(checks).every(Boolean)
    res.status(ok?200:503).json({ok,service:'MELEO',version:'4.0.0',checks})
  } catch { res.status(503).json({ok:false,service:'MELEO',version:'4.0.0'}) }
})
app.get('/api/plans', (_req, res) => res.json(Object.values(PLANS)))

/* ------------------------------------------------------------------ *
 * Auth
 * ------------------------------------------------------------------ */
app.post('/api/auth/register', limits.register, async (req, res) => {
  const name = str(req.body?.name, 120)
  const email = str(req.body?.email, 190).toLowerCase()
  const phone = str(req.body?.phone, 30)
  const password = String(req.body?.password ?? '')
  const role = req.body?.role === 'professional' ? 'professional' : 'patient'
  const acceptedTerms = req.body?.acceptedTerms === true

  if (!name || !email || !password || !phone) return res.status(400).json({ error: 'Συμπλήρωσε όνομα, email, τηλέφωνο και κωδικό' })
  if (!isEmail(email)) return res.status(400).json({ error: 'Μη έγκυρο email' })
  if (password.length < PASSWORD_MIN) return res.status(400).json({ error: `Ο κωδικός πρέπει να έχει τουλάχιστον ${PASSWORD_MIN} χαρακτήρες` })
  if (!/^[+\d\s()-]{8,30}$/.test(phone)) return res.status(400).json({ error: 'Μη έγκυρος αριθμός τηλεφώνου' })
  if (!acceptedTerms) return res.status(400).json({ error: 'Πρέπει να αποδεχτείς τους Όρους Χρήσης και την Πολιτική Απορρήτου' })

  const db = await lock()
  if (db.users.some(u => u.email === email)) return res.status(409).json({ error: 'Το email χρησιμοποιείται ήδη' })

  const user = {
    id: id('u'), role, name, email, password: hash(password), phone,
    emailVerified: false, acceptedTermsAt: now(), termsVersion: config.legal.termsVersion,
    createdAt: now(), deletedAt: null, stripeCustomerId: null, deletionPending:false, deletionRequestedAt:null, lastTotpStep:null, accountStatus:'active', suspendedAt:null, suspensionReason:'', lastLoginAt:null
  }
  db.users.push(user)
  if (role === 'professional') {
    db.professionals.push({
      id: id('p'), userId: user.id, title: '', specialty: '', verified: false, featured: false, rating: 0, reviews: 0, distance: 0,
      city: '', area: '', region: '', countryCode: 'gr', latitude: null, longitude: null, serviceRadiusKm: 15,
      subscriptionPlan: null, subscriptionPrice: 0, subscriptionStatus: 'none', billingMode: null, stripeSubscriptionId: null,
      currentPeriodEnd: null, cancelAtPeriodEnd: false, onboardingCompleted: false, onboardingStage: 'plan',
      available: 'Κατόπιν συνεννόησης', bio: '', years: 0, price: 0, pricingMode: 'contact',
      services: [], availability: [], languages: ['Ελληνικά'], credentials: [], showPhone:true, showEmail:true, preferPlatformContact:false, createdAt: now()
    })
  }
  const token = issueSession(db, user.id)
  const verifyToken = createOneTimeToken(db, user.id, 'verify_email', 48 * 60 * 60 * 1000)
  audit(db, user.id, 'auth.register', { role })
  await commit(db)

  mail.verifyEmail(email, name.split(' ')[0], `${config.appUrl}/?verify=${verifyToken}`).catch(() => {})
  setSessionCookie(res, token)
  res.json({ user: publicUser(user) })
})

app.post('/api/auth/login', limits.login, async (req, res) => {
  const email = str(req.body?.email, 190).toLowerCase()
  const db = await lock()
  const user = db.users.find(u => u.email === email && !u.deletedAt)
  if (!user || !verifyPassword(String(req.body?.password ?? ''), user.password)) {
    return res.status(401).json({ error: 'Λάθος email ή κωδικός' })
  }
  if (user.role === 'admin' && config.admin.totpSecret) {
    const matchedStep = matchTotpStep(config.admin.totpSecret, req.body?.totp)
    if (matchedStep === null) return res.status(401).json({ error: 'Απαιτείται έγκυρος 6ψήφιος κωδικός 2FA', requires2fa: true })
    if (user.lastTotpStep != null && Number(user.lastTotpStep) >= matchedStep) {
      audit(db, user.id, 'auth.totp_replay_blocked', { step: matchedStep })
      await commit(db)
      return res.status(401).json({ error: 'Ο κωδικός 2FA έχει ήδη χρησιμοποιηθεί. Περίμενε τον επόμενο κωδικό.', requires2fa: true })
    }
    user.lastTotpStep = matchedStep
  }
  user.lastLoginAt = now()
  const token = issueSession(db, user.id)
  await commit(db)
  setSessionCookie(res, token)
  res.json({ user: publicUser(user) })
})

app.post('/api/auth/logout', auth, async (req, res) => {
  await mutate(db => { db.sessions = db.sessions.filter(s => s.token !== req.sessionToken) })
  clearSessionCookie(res)
  res.json({ ok: true })
})

// Demo social login: υπάρχει ΜΟΝΟ εκτός production.
app.post('/api/auth/social-demo', async (req, res) => {
  if (!config.demoAuth) return res.status(404).json({ error: 'Η υπηρεσία δεν είναι διαθέσιμη' })
  const db = await lock()
  const user = db.users.find(u => u.id === 'u_patient')
  if (!user) return res.status(404).json({ error: 'Demo user unavailable' })
  const token = issueSession(db, user.id, { provider: str(req.body?.provider, 20) })
  await commit(db)
  setSessionCookie(res, token)
  res.json({ user: publicUser(user), demo: true })
})

app.post('/api/auth/forgot-password', limits.password, async (req, res) => {
  const email = str(req.body?.email, 190).toLowerCase()
  const db = await lock()
  const user = db.users.find(u => u.email === email && !u.deletedAt)
  if (user) {
    const token = createOneTimeToken(db, user.id, 'reset_password', 60 * 60 * 1000)
    await commit(db)
    mail.resetPassword(user.email, user.name.split(' ')[0], `${config.appUrl}/?reset=${token}`).catch(() => {})
  }
  // Ίδια απάντηση πάντα, ώστε να μην αποκαλύπτεται ποια emails υπάρχουν.
  res.json({ ok: true, message: 'Αν το email αντιστοιχεί σε λογαριασμό, θα λάβεις σύνδεσμο επαναφοράς.' })
})

app.post('/api/auth/reset-password', limits.password, async (req, res) => {
  const token = str(req.body?.token, 200)
  const password = String(req.body?.password ?? '')
  if (password.length < PASSWORD_MIN) return res.status(400).json({ error: `Ο κωδικός πρέπει να έχει τουλάχιστον ${PASSWORD_MIN} χαρακτήρες` })
  const db = await lock()
  const record = consumeToken(db, token, 'reset_password')
  if (!record) return res.status(400).json({ error: 'Ο σύνδεσμος δεν είναι έγκυρος ή έχει λήξει.' })
  const user = db.users.find(u => u.id === record.userId)
  if (!user) return res.status(400).json({ error: 'Ο λογαριασμός δεν βρέθηκε.' })
  user.password = hash(password)
  db.sessions = db.sessions.filter(s => s.userId !== user.id) // αποσύνδεση όλων των συσκευών
  audit(db, user.id, 'auth.password_reset')
  await commit(db)
  res.json({ ok: true })
})

app.post('/api/auth/verify-email', async (req, res) => {
  const db = await lock()
  const record = consumeToken(db, str(req.body?.token, 200), 'verify_email')
  if (!record) return res.status(400).json({ error: 'Ο σύνδεσμος επιβεβαίωσης δεν είναι έγκυρος ή έχει λήξει.' })
  const user = db.users.find(u => u.id === record.userId)
  if (user) user.emailVerified = true
  await commit(db)
  res.json({ ok: true })
})

app.post('/api/auth/verify-email/resend', auth, limits.password, async (req, res) => {
  if (req.user.emailVerified) return res.json({ ok: true, alreadyVerified: true })
  const db = await lock()
  const token = createOneTimeToken(db, req.user.id, 'verify_email', 48 * 60 * 60 * 1000)
  await commit(db)
  mail.verifyEmail(req.user.email, req.user.name.split(' ')[0], `${config.appUrl}/?verify=${token}`).catch(() => {})
  res.json({ ok: true, mailEnabled: config.mailEnabled })
})

app.get('/api/me', auth, async (req, res) => {
  const db = await read()
  const pro = db.professionals.find(p => p.userId === req.user.id) || null
  res.json({ user: publicUser(req.user), professional: pro })
})

app.put('/api/me', auth, limits.write, async (req, res) => {
  const name = str(req.body?.name, 120)
  const phone = str(req.body?.phone, 30)
  if (name && name.length < 2) return res.status(400).json({ error: 'Μη έγκυρο όνομα' })
  if (phone && !/^[+\d\s()-]{8,30}$/.test(phone)) return res.status(400).json({ error: 'Μη έγκυρος αριθμός τηλεφώνου' })
  const db = await lock()
  const u = db.users.find(x => x.id === req.user.id)
  if (name) u.name = name
  if (phone) u.phone = phone
  await commit(db)
  res.json({ user: publicUser(u) })
})

app.post('/api/me/change-password', auth, limits.password, async (req, res) => {
  const current = String(req.body?.currentPassword ?? '')
  const next = String(req.body?.newPassword ?? '')
  if (!verifyPassword(current, req.user.password)) return res.status(401).json({ error: 'Ο τρέχων κωδικός δεν είναι σωστός' })
  if (next.length < PASSWORD_MIN) return res.status(400).json({ error: `Ο νέος κωδικός πρέπει να έχει τουλάχιστον ${PASSWORD_MIN} χαρακτήρες` })
  const db = await lock()
  const u = db.users.find(x => x.id === req.user.id)
  u.password = hash(next)
  db.sessions = db.sessions.filter(s => s.userId !== u.id || s.token === req.sessionToken)
  audit(db, u.id, 'auth.password_change')
  await commit(db)
  res.json({ ok: true })
})

/* ------------------------------------------------------------------ *
 * GDPR: εξαγωγή & διαγραφή δεδομένων
 * ------------------------------------------------------------------ */
app.get('/api/me/export', auth, async (req, res) => {
  const db = await read()
  const pro = db.professionals.find(p => p.userId === req.user.id) || null
  const myBookings = db.bookings.filter(b => b.patientId === req.user.id || (pro && b.professionalId === pro.id))
  res.setHeader('Content-Disposition', 'attachment; filename="meleo-data-export.json"')
  res.json({
    exportedAt: now(),
    account: publicUser(req.user),
    professionalProfile: pro,
    bookings: myBookings.map(b=>({...b,notes:decryptSensitive(b.notes)})),
    reviewsWritten: db.reviews.filter(r => r.patientId === req.user.id),
    notifications: db.notifications.filter(n => n.userId === req.user.id),
    subscriptions: pro ? db.subscriptions.filter(s => s.professionalId === pro.id) : [],
    payments: pro ? db.payments.filter(p => p.professionalId === pro.id) : [],
    verificationRequests: db.verificationRequests.filter(v => v.userId === req.user.id)
  })
})

async function finalizeAccountDeletion(userId) {
  await mutate(db => {
    const u = db.users.find(x => x.id === userId)
    const p = db.professionals.find(x => x.userId === userId)
    if (p) db.professionals = db.professionals.filter(x => x.id !== p.id)
    db.favorites = db.favorites.filter(f => f.userId !== userId)
    db.notifications = db.notifications.filter(n => n.userId !== userId)
    db.sessions = db.sessions.filter(s => s.userId !== userId)
    db.tokens = db.tokens.filter(t => t.userId !== userId)
    for (const d of db.verificationDocuments.filter(v=>v.userId===userId)) { try { fs.unlinkSync(secureFilePath(d.id)) } catch {} }
    db.verificationDocuments = db.verificationDocuments.filter(v=>v.userId!==userId)
    db.verificationRequests = db.verificationRequests.filter(v => v.userId !== userId)
    db.reviews = db.reviews.map(r => r.patientId === userId ? { ...r, comment: '', anonymised: true } : r)
    if (u) {
      u.name = 'Διαγραμμένος χρήστης'; u.email = `deleted_${u.id}@meleo.invalid`; u.phone = ''
      u.password = hash(crypto.randomBytes(24).toString('hex')); u.deletedAt = now(); u.stripeCustomerId = null
      u.deletionPending=false; u.deletionCompletedAt=now()
    }
    audit(db, userId, 'account.deleted')
  })
}

async function retryPendingDeletions() {
  if (!config.stripeEnabled) return
  const snapshot=await read()
  const pending=snapshot.users.filter(u=>u.deletionPending && !u.deletedAt && u.role!=='admin').slice(0,50)
  for (const u of pending) {
    const p=snapshot.professionals.find(x=>x.userId===u.id)
    try {
      if (p?.stripeSubscriptionId) await cancelSubscription(p,{immediately:true})
      await finalizeAccountDeletion(u.id)
      console.log(`[MELEO] Ολοκληρώθηκε pending διαγραφή για ${u.id}`)
    } catch(err) {
      await mutate(db=>{const x=db.users.find(v=>v.id===u.id);if(x){x.deletionLastRetryAt=now();x.deletionRetryCount=Number(x.deletionRetryCount||0)+1;x.deletionLastError=String(err?.message||err).slice(0,300)} audit(db,u.id,'account.deletion_retry_failed',{error:String(err?.message||err).slice(0,200)})})
    }
  }
}

app.delete('/api/me', auth, limits.password, async (req, res) => {
  if (req.user.role === 'admin') return res.status(400).json({ error: 'Ο λογαριασμός admin δεν διαγράφεται από εδώ.' })
  if (!verifyPassword(String(req.body?.password ?? ''), req.user.password)) {
    return res.status(401).json({ error: 'Επιβεβαίωσε τον κωδικό σου για να διαγραφεί ο λογαριασμός.' })
  }
  // Πρώτα ακυρώνουμε τη συνδρομή στον πάροχο πληρωμών, αλλιώς η χρέωση συνεχίζεται.
  const pro = (await read()).professionals.find(p => p.userId === req.user.id)
  if (pro?.stripeSubscriptionId && config.stripeEnabled) {
    try { await cancelSubscription(pro, { immediately: true }) }
    catch (err) {
      console.error('[MELEO] Αποτυχία ακύρωσης συνδρομής κατά τη διαγραφή:', err.message)
      await mutate(db => { const u=db.users.find(x=>x.id===req.user.id); if(u){u.deletionPending=true;u.deletionRequestedAt=now()} audit(db,req.user.id,'account.deletion_pending',{reason:'stripe_cancel_failed'}) })
      return res.status(503).json({ error: 'Η διαγραφή τέθηκε σε αναμονή επειδή δεν επιβεβαιώθηκε η ακύρωση της συνδρομής. Δεν θα διαγραφεί ο λογαριασμός μέχρι να διακοπούν οι επαναλαμβανόμενες χρεώσεις.' })
    }
  }
  await finalizeAccountDeletion(req.user.id)
  res.json({ ok: true })
})

/* ------------------------------------------------------------------ *
 * Τοποθεσία
 * ------------------------------------------------------------------ */
app.get('/api/location/search', limits.geo, async (req, res) => {
  const q = str(req.query.q, 120)
  if (q.length < 2) return res.json([])
  try {
    const data = await nominatim(`/search?format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(q)}`)
    res.json(data.map(x => ({ label: geoLabel(x), displayName: x.display_name, lat: Number(x.lat), lon: Number(x.lon), countryCode: x.address?.country_code || '', city: x.address?.city || x.address?.town || x.address?.village || '', region: x.address?.state || '' })))
  } catch { res.status(503).json({ error: 'Η υπηρεσία γεωεντοπισμού δεν είναι προσωρινά διαθέσιμη' }) }
})
app.get('/api/location/reverse', limits.geo, async (req, res) => {
  const lat = Number(req.query.lat), lon = Number(req.query.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return res.status(400).json({ error: 'Μη έγκυρες συντεταγμένες' })
  try {
    const x = await nominatim(`/reverse?format=jsonv2&addressdetails=1&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`)
    res.json({ label: geoLabel(x), displayName: x.display_name, lat, lon, countryCode: x.address?.country_code || '', city: x.address?.city || x.address?.town || x.address?.village || '', region: x.address?.state || '' })
  } catch { res.json({ label: 'Η τρέχουσα τοποθεσία μου', lat, lon }) }
})

/* ------------------------------------------------------------------ *
 * Professional performance analytics
 * Privacy-friendly aggregate counters for marketplace exposure.
 * ------------------------------------------------------------------ */
app.post('/api/analytics/professional-event', limits.analytics, async (req, res) => {
  const professionalId = str(req.body?.professionalId, 80)
  const type = str(req.body?.type, 40)
  const sessionId = str(req.body?.sessionId, 100)
  if (!professionalId || !sessionId || !['impression','profile_view','phone_click'].includes(type)) return res.status(400).json({ error: 'Μη έγκυρο analytics event' })
  const db = await lock()
  const p = db.professionals.find(x => x.id === professionalId)
  if (!p || !isPubliclyVisible(p)) return res.status(404).json({ error: 'Δεν βρέθηκε' })
  const nowMs=Date.now()
  const bucketMs=type==='phone_click' ? 30*60*1000 : 24*60*60*1000
  const bucket=Math.floor(nowMs/bucketMs)
  const ua=String(req.headers['user-agent']||'').slice(0,250)
  const networkHash=sha256(`${req.ip||''}|${ua}`)
  let visitorId=cookieNamed(req,'meleo_visitor')
  if(!visitorId){visitorId=crypto.randomBytes(18).toString('hex');res.cookie('meleo_visitor',visitorId,{httpOnly:true,secure:config.isProd,sameSite:'lax',maxAge:365*86400000,path:'/'})}
  const visitorFingerprint=sha256(`${professionalId}|${type}|${visitorId}|${bucket}`)
  const networkFingerprint=sha256(`${professionalId}|${type}|${networkHash}|${bucket}`)
  db.analyticsEvents = db.analyticsEvents || []
  if (db.analyticsEvents.some(x=>x.fingerprint===visitorFingerprint || x.networkFingerprint===networkFingerprint)) { await commit(db); return res.json({ ok:true, deduplicated:true }) }
  db.analyticsEvents.push({id:id('ae'),professionalId,type,fingerprint:visitorFingerprint,networkFingerprint,createdAt:now()})
  let row = db.professionalAnalytics.find(x => x.professionalId === professionalId)
  if (!row) { row = { id: id('pa'), professionalId, impressions: 0, profileViews: 0, phoneClicks: 0, updatedAt: now() }; db.professionalAnalytics.push(row) }
  if (type === 'impression') row.impressions = Number(row.impressions || 0) + 1
  if (type === 'profile_view') row.profileViews = Number(row.profileViews || 0) + 1
  if (type === 'phone_click') row.phoneClicks = Number(row.phoneClicks || 0) + 1
  row.updatedAt = now()
  await commit(db)
  res.json({ ok: true, deduplicated:false })
})

app.get('/api/professional/analytics', auth, requireRole('professional'), async (req, res) => {
  const db = await read()
  const p = db.professionals.find(x => x.userId === req.user.id)
  if (!p) return res.status(404).json({ error: 'Δεν βρέθηκε επαγγελματικό προφίλ' })
  const row = db.professionalAnalytics.find(x => x.professionalId === p.id) || {}
  const bookings = db.bookings.filter(b => b.professionalId === p.id)
  const completed = bookings.filter(b => b.status === 'completed')
  const reviews = db.reviews.filter(r => r.professionalId === p.id)
  const newClients = new Set(completed.map(b => b.patientId)).size
  res.json({
    impressions: Number(row.impressions || 0),
    profileViews: Number(row.profileViews || 0),
    phoneClicks: Number(row.phoneClicks || 0),
    requests: bookings.length,
    newClients,
    reviews: reviews.length,
    completed: completed.length,
    requestConversion: Number(row.profileViews || 0) ? Number(((bookings.length / Number(row.profileViews)) * 100).toFixed(1)) : 0,
    clientConversion: bookings.length ? Number(((newClients / bookings.length) * 100).toFixed(1)) : 0,
    updatedAt: row.updatedAt || null
  })
})

/* ------------------------------------------------------------------ *
 * Δημόσια αναζήτηση επαγγελματιών
 * ------------------------------------------------------------------ */
app.get('/api/professionals', async (req, res) => {
  const specialty = str(req.query.specialty, 80)
  const service = str(req.query.service, 80)
  const location = str(req.query.location, 120)
  let lat = Number(req.query.lat), lon = Number(req.query.lon)
  const db = await read()

  let items = db.professionals.filter(isPubliclyVisible)
  if (specialty) items = items.filter(p => (p.specialty || '').toLowerCase() === specialty.toLowerCase())
  if (service) items = items.filter(p => (p.services || []).some(s => s.toLowerCase().includes(service.toLowerCase())))

  if ((!Number.isFinite(lat) || !Number.isFinite(lon)) && location) {
    try {
      const data = await nominatim(`/search?format=jsonv2&addressdetails=1&limit=1&q=${encodeURIComponent(location)}`)
      if (data[0]) { lat = Number(data[0].lat); lon = Number(data[0].lon) }
    } catch { /* συνεχίζουμε χωρίς γεωγραφικό φιλτράρισμα */ }
  }
  const hasPoint = Number.isFinite(lat) && Number.isFinite(lon)

  items = items.map(p => {
    const canDistance = hasPoint && Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude))
    const distance = canDistance ? haversineKm(lat, lon, Number(p.latitude), Number(p.longitude)) : Number(p.distance || 0)
    const owner = db.users.find(u => u.id === p.userId); return { ...p, distance: Number(distance.toFixed(1)), name: owner?.name || 'Επαγγελματίας' }
  })
  if (hasPoint) items = items.filter(p => !p.latitude || !p.longitude || p.distance <= Number(p.serviceRadiusKm || 25))

  // PREMIUM πρώτα (εμπορική προβολή), μετά απόσταση/βαθμολογία.
  items.sort((a, b) =>
    Number(b.subscriptionPlan === 'premium') - Number(a.subscriptionPlan === 'premium') ||
    (hasPoint ? a.distance - b.distance : b.rating - a.rating) ||
    b.rating - a.rating)

  res.json(items.map(publicProfessional))
})

app.get('/api/professionals/:id', limits.profile, async (req, res) => {
  const db = await read()
  const p = db.professionals.find(x => x.id === req.params.id)
  if (!p || !isPubliclyVisible(p)) return res.status(404).json({ error: 'Δεν βρέθηκε' })
  const u = db.users.find(x => x.id === p.userId)
  res.json({ ...publicProfessional(p), name: u?.name || 'Επαγγελματίας', phone: p.showPhone===false?'':(u?.phone||''), email: p.showEmail===false?'':(u?.email||''), contactPreference: p.preferPlatformContact?'platform':'direct' })
})

app.get('/api/professionals/:id/reviews', async (req, res) => {
  const db = await read()
  res.json(db.reviews.filter(r => r.professionalId === req.params.id).map(r => ({
    id: r.id, rating: r.rating, comment: r.comment, createdAt: r.createdAt, verifiedBooking: true,
    patientName: (db.users.find(u => u.id === r.patientId)?.name || 'Χρήστης').split(' ')[0] + ' •••'
  })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
})


function secureFilePath(docId) {
  fs.mkdirSync(config.security.verificationStorageDir, { recursive: true, mode: 0o700 })
  return path.join(config.security.verificationStorageDir, `${docId}.bin`)
}
function decryptFileBuffer(buffer) {
  const key = crypto.createHash('sha256').update(config.security.sensitiveDataKey || 'dev-only-insecure-key').digest()
  const iv=buffer.subarray(0,12), tag=buffer.subarray(12,28), body=buffer.subarray(28)
  const decipher=crypto.createDecipheriv('aes-256-gcm',key,iv); decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(body),decipher.final()])
}
function encryptFileBuffer(buffer) {
  const key = crypto.createHash('sha256').update(config.security.sensitiveDataKey || 'dev-only-insecure-key').digest()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const body = Buffer.concat([cipher.update(buffer), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), body])
}

/* ------------------------------------------------------------------ *
 * Προφίλ & επαλήθευση επαγγελματία
 * ------------------------------------------------------------------ */
app.put('/api/professional/profile', auth, requireRole('professional'), limits.write, async (req, res) => {
  const patch = sanitizeProfilePatch(req.body)
  const db = await lock()
  const p = db.professionals.find(x => x.userId === req.user.id)
  if (!p) return res.status(404).json({ error: 'Δεν βρέθηκε επαγγελματικό προφίλ' })
  Object.assign(p, patch)
  if (p.pricingMode === 'contact') p.price = 0
  if (subscriptionAllowsVisibility(p.subscriptionStatus, p) && !p.onboardingCompleted && profileBasicsComplete(p)) p.onboardingStage = 'verification'
  await commit(db)
  res.json(p)
})


app.post('/api/professional/verification-document', auth, requireRole('professional'), requireVerifiedEmail, limits.write, async (req, res) => {
  const name = str(req.body?.name, 120)
  const type = str(req.body?.type, 50) || 'supporting_document'
  const mime = str(req.body?.mime, 80)
  const dataBase64 = String(req.body?.dataBase64 || '')
  const expiresAt = str(req.body?.expiresAt, 30) || null
  if (!name || !dataBase64) return res.status(400).json({ error: 'Λείπει αρχείο επαλήθευσης' })
  if (!['application/pdf','image/jpeg','image/png','image/webp'].includes(mime)) return res.status(400).json({ error: 'Επιτρέπονται PDF, JPG, PNG ή WEBP' })
  let buffer
  try { buffer = Buffer.from(dataBase64, 'base64') } catch { return res.status(400).json({ error: 'Μη έγκυρο αρχείο' }) }
  if (!buffer.length || buffer.length > 5 * 1024 * 1024) return res.status(400).json({ error: 'Το αρχείο πρέπει να είναι έως 5MB' })
  const detectedMime = (() => {
    if (buffer.length>=5 && buffer.subarray(0,5).toString('ascii')==='%PDF-') return 'application/pdf'
    if (buffer.length>=3 && buffer[0]===0xff && buffer[1]===0xd8 && buffer[2]===0xff) return 'image/jpeg'
    if (buffer.length>=8 && buffer.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return 'image/png'
    if (buffer.length>=12 && buffer.subarray(0,4).toString('ascii')==='RIFF' && buffer.subarray(8,12).toString('ascii')==='WEBP') return 'image/webp'
    return ''
  })()
  if (!detectedMime || detectedMime !== mime) return res.status(400).json({ error: 'Το πραγματικό format του αρχείου δεν συμφωνεί με τον δηλωμένο τύπο.' })
  const docId = id('vdoc')
  fs.writeFileSync(secureFilePath(docId), encryptFileBuffer(buffer), { mode: 0o600 })
  const doc = { id: docId, userId: req.user.id, name, type, mime, size: buffer.length, expiresAt, status: 'submitted', createdAt: now() }
  await mutate(db => { db.verificationDocuments.push(doc); audit(db, req.user.id, 'verification.document_uploaded', { documentId: docId, type }) })
  res.json({ ...doc, storage: 'encrypted' })
})

app.get('/api/professional/verification-documents', auth, requireRole('professional'), async (req,res)=>{
  const db=await read(); res.json(db.verificationDocuments.filter(x=>x.userId===req.user.id).map(({userId,...x})=>x))
})

app.post('/api/professional/verification', auth, requireRole('professional'), requireVerifiedEmail, limits.write, async (req, res) => {
  const db = await lock()
  const p = db.professionals.find(x => x.userId === req.user.id)
  if (!p) return res.status(404).json({ error: 'Δεν βρέθηκε επαγγελματικό προφίλ' })
  if (!subscriptionAllowsVisibility(p.subscriptionStatus, p)) return res.status(402).json({ error: 'Απαιτείται ενεργή BASIC ή PREMIUM συνδρομή πριν από την επαλήθευση' })
  if (!profileBasicsComplete(p)) return res.status(400).json({ error: 'Ολοκλήρωσε πρώτα τα βασικά επαγγελματικά στοιχεία' })

  const licenseNumber = str(req.body?.licenseNumber, 60)
  const documents = db.verificationDocuments.filter(x => x.userId === req.user.id)
  if (config.isProd && documents.length === 0) return res.status(400).json({ error: 'Ανέβασε τουλάχιστον ένα απαιτούμενο δικαιολογητικό πριν την υποβολή.' })
  if (!licenseNumber) return res.status(400).json({ error: 'Συμπλήρωσε αριθμό άδειας / μητρώου' })

  const existing = db.verificationRequests.find(x => x.userId === req.user.id && x.status === 'pending')
  if (existing) {
    p.onboardingCompleted = true; p.onboardingStage = 'pending_verification'; await commit(db)
    return res.json(existing)
  }
  const request = { id: id('vr'), userId: req.user.id, licenseNumber, notes: str(req.body?.notes, 1000), documentIds: documents.map(x=>x.id), status: 'pending', createdAt: now() }
  db.verificationRequests.push(request)
  p.onboardingCompleted = true
  p.onboardingStage = 'pending_verification'
  audit(db, req.user.id, 'verification.submitted')
  await commit(db)
  res.json(request)
})

/* ------------------------------------------------------------------ *
 * Συνδρομές: πραγματικές πληρωμές (κάρτα / Google Pay) μέσω Stripe
 * ------------------------------------------------------------------ */
app.get('/api/professional/subscription', auth, requireRole('professional'), async (req, res) => {
  const db = await read()
  const p = db.professionals.find(x => x.userId === req.user.id)
  if (!p) return res.status(404).json({ error: 'Δεν βρέθηκε επαγγελματικό προφίλ' })
  res.json({
    plan: p.subscriptionPlan, price: p.subscriptionPrice, status: p.subscriptionStatus, stripeStatus: p.stripeStatus || null,
    billingMode: p.billingMode, currentPeriodEnd: p.currentPeriodEnd, cancelAtPeriodEnd: Boolean(p.cancelAtPeriodEnd),
    portalAvailable: config.stripeEnabled && config.stripe.portalEnabled && Boolean(p.stripeSubscriptionId),
    invoices: db.payments.filter(x => x.professionalId === p.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 24)
  })
})

app.post('/api/professional/subscription/checkout', auth, requireRole('professional'), limits.checkout, async (req, res, next) => {
  const plan = str(req.body?.plan, 20)
  if (!isPlan(plan)) return res.status(400).json({ error: 'Μη έγκυρο πακέτο' })
  const db = await lock()
  const p = db.professionals.find(x => x.userId === req.user.id)
  if (!p) return res.status(404).json({ error: 'Δεν βρέθηκε επαγγελματικό προφίλ' })

  // Ενεργή συνδρομή → αλλαγή πακέτου με proration, όχι νέα χρέωση.
  if (p.stripeSubscriptionId && subscriptionAllowsVisibility(p.subscriptionStatus, p)) {
    if (p.subscriptionPlan === plan) return res.json({ mode: 'unchanged', professional: p })
    try {
      const updated = await changePlan(p, plan)
      return res.json({ mode: 'plan_changed', professional: updated })
    } catch (err) { return next(err) }
  }

  if (config.stripeEnabled) {
    try {
      const { url } = await createCheckoutSession({ user: req.user, professional: p, plan })
      return res.json({ mode: 'stripe', url })
    } catch (err) { return next(err) }
  }

  if (config.demoCheckout) {
    const updated = await mutate(d => {
      const pro = d.professionals.find(x => x.userId === req.user.id)
      pro.subscriptionPlan = plan
      pro.subscriptionPrice = PLANS[plan].price
      pro.subscriptionStatus = 'active'
      pro.billingMode = 'demo'
      pro.featured = plan === 'premium'
      pro.subscriptionSince = now()
      pro.onboardingStage = 'profile'
      d.subscriptions.push({ id: id('sub'), professionalId: pro.id, plan, price: PLANS[plan].price, status: 'active', billingMode: 'demo', startedAt: now() })
      notify(d, req.user.id, 'subscription', `Η συνδρομή ${plan.toUpperCase()} ενεργοποιήθηκε (demo)`, 'Τοπική δοκιμαστική λειτουργία — δεν έγινε πραγματική χρέωση.')
      return pro
    })
    return res.json({ mode: 'demo', professional: updated })
  }

  res.status(503).json({ error: 'Οι πληρωμές δεν είναι διαθέσιμες αυτή τη στιγμή. Δοκίμασε ξανά σε λίγο ή επικοινώνησε με την υποστήριξη.' })
})

// Fallback μετά την επιστροφή από το Checkout, όσο εκκρεμεί το webhook.
app.post('/api/professional/subscription/sync', auth, requireRole('professional'), async (req, res, next) => {
  const sessionId = str(req.body?.sessionId, 200)
  try {
    if (sessionId) await syncCheckoutSession(sessionId, req.user)
    else {
      const p = (await read()).professionals.find(x => x.userId === req.user.id)
      if (p?.stripeSubscriptionId) await refreshSubscription(p)
    }
    res.json({ professional: (await read()).professionals.find(x => x.userId === req.user.id) || null })
  } catch (err) { next(err) }
})

app.post('/api/professional/subscription/portal', auth, requireRole('professional'), async (req, res, next) => {
  if (!config.stripeEnabled || !config.stripe.portalEnabled) return res.status(503).json({ error: 'Η διαχείριση συνδρομής δεν είναι διαθέσιμη.' })
  try { res.json({ url: await createPortalSession(req.user) }) } catch (err) { next(err) }
})

app.post('/api/professional/subscription/cancel', auth, requireRole('professional'), async (req, res, next) => {
  const p = (await lock()).professionals.find(x => x.userId === req.user.id)
  if (!p) return res.status(404).json({ error: 'Δεν βρέθηκε επαγγελματικό προφίλ' })
  if (!p.stripeSubscriptionId) {
    const updated = await mutate(d => {
      const pro = d.professionals.find(x => x.userId === req.user.id)
      pro.subscriptionStatus = 'cancelled'; pro.featured = false
      const sub = d.subscriptions.find(s => s.professionalId === pro.id && s.status === 'active')
      if (sub) { sub.status = 'cancelled'; sub.updatedAt = now() }
      return pro
    })
    return res.json({ professional: updated })
  }
  try { res.json({ professional: await cancelSubscription(p, { immediately: false }) }) } catch (err) { next(err) }
})

app.post('/api/professional/subscription/resume', auth, requireRole('professional'), async (req, res, next) => {
  const p = (await read()).professionals.find(x => x.userId === req.user.id)

  if (!p) {
    return res.status(404).json({
      error: 'Δεν βρέθηκε επαγγελματικό προφίλ'
    })
  }

  /*
   * Local/demo subscription:
   * δεν υπάρχει Stripe subscription ID,
   * άρα επαναφέρουμε το subscription state τοπικά.
   */
  if (!p.stripeSubscriptionId) {
    const updated = await mutate(d => {
      const pro = d.professionals.find(
        x => x.userId === req.user.id
      )

      if (!pro) {
        throw new Error(
          'Δεν βρέθηκε επαγγελματικό προφίλ'
        )
      }

      pro.subscriptionStatus = 'active'

      pro.featured =
        pro.subscriptionPlan === 'premium'

      const sub = d.subscriptions.find(
        s =>
          s.professionalId === pro.id &&
          s.status === 'cancelled'
      )

      if (sub) {
        sub.status = 'active'
        sub.updatedAt = now()
      }

      return pro
    })

    return res.json({
      professional: updated
    })
  }

  /*
   * Stripe subscription.
   */
  try {
    res.json({
      professional: await resumeSubscription(p)
    })
  } catch (err) {
    next(err)
  }
})

/* ------------------------------------------------------------------ *
 * Κρατήσεις
 * ------------------------------------------------------------------ */
app.post('/api/bookings', auth, requireRole('patient'), requireVerifiedEmail, limits.write, async (req, res) => {
  const professionalId = str(req.body?.professionalId, 60)
  const service = str(req.body?.service, 120)
  const date = str(req.body?.date, 10)
  const time = str(req.body?.time, 5)
  const address = str(req.body?.address, 200)
  const notes = str(req.body?.notes, 1500)
  const repeat = ['once', 'daily7', 'twice7'].includes(req.body?.repeat) ? req.body.repeat : 'once'
  const contactConsent = req.body?.contactConsent === true

  if (!professionalId || !service || !address) return res.status(400).json({ error: 'Λείπουν στοιχεία κράτησης' })
  if (!contactConsent) return res.status(400).json({ error: 'Απαιτείται συγκατάθεση για κοινοποίηση στοιχείων επικοινωνίας στον επαγγελματία.' })
  if (!isDate(date)) return res.status(400).json({ error: 'Μη έγκυρη ημερομηνία' })
  if (!isTime(time)) return res.status(400).json({ error: 'Μη έγκυρη ώρα' })
  if (new Date(`${date}T23:59:59`) < new Date(Date.now() - 86400000)) return res.status(400).json({ error: 'Η ημερομηνία έχει παρέλθει' })

  const db = await lock()
  const p = db.professionals.find(x => x.id === professionalId)
  if (!p || !isPubliclyVisible(p)) return res.status(404).json({ error: 'Ο επαγγελματίας δεν είναι διαθέσιμος' })
  if ((p.services || []).length && !p.services.includes(service)) return res.status(400).json({ error: 'Η υπηρεσία δεν προσφέρεται από τον επαγγελματία' })
  const open = db.bookings.filter(b => b.patientId === req.user.id && ['pending', 'clarification', 'quoted'].includes(b.status))
  if (open.length >= 10) return res.status(429).json({ error: 'Έχεις πολλά ανοιχτά αιτήματα. Ολοκλήρωσε ή ακύρωσε κάποια πρώτα.' })

  const booking = {
    id: id('b'), patientId: req.user.id, professionalId, service, date, time, address, notes: encryptSensitive(notes), contactConsentAt: now(), repeat,
    status: 'pending', price: p.pricingMode === 'contact' ? 0 : Number(p.price || 0),
    agreedPrice: null, proposedPrice: null, pricingMode: p.pricingMode || 'contact',
    messages: [], createdAt: now()
  }
  db.bookings.push(booking)
  notify(db, p.userId, 'booking', 'Νέο αίτημα επίσκεψης', `${req.user.name} · ${service} · ${date} ${time}`)
  await commit(db)
  const proUser = db.users.find(u => u.id === p.userId)
  if (proUser) mail.newBooking(proUser.email, proUser.name.split(' ')[0], service, date, time).catch(() => {})
  res.json(booking)
})

function decorateBooking(db, b) {
  const p = db.professionals.find(x => x.id === b.professionalId)
  const patient = db.users.find(u => u.id === b.patientId)
  const proUser = db.users.find(u => u.id === p?.userId)
  // Τα στοιχεία επικοινωνίας αποκαλύπτονται μόνο όσο το αίτημα είναι ενεργό.
  const contactVisible = b.status !== 'cancelled'
  return {
    ...b,
    notes: decryptSensitive(b.notes),
    professionalName: proUser?.name || 'Επαγγελματίας',
    professionalEmail: contactVisible ? (proUser?.email || '') : '',
    professionalPhone: contactVisible ? (proUser?.phone || '') : '',
    patientName: patient?.name || 'Χρήστης',
    patientEmail: contactVisible ? (patient?.email || '') : '',
    patientPhone: contactVisible ? (patient?.phone || '') : '',
    reviewed: db.reviews.some(r => r.bookingId === b.id),
    review: db.reviews.find(r => r.bookingId === b.id) || null
  }
}

app.get('/api/bookings', auth, async (req, res) => {
  const db = await read()
  let items
  if (req.user.role === 'patient') items = db.bookings.filter(b => b.patientId === req.user.id)
  else if (req.user.role === 'professional') {
    const pro = db.professionals.find(p => p.userId === req.user.id)
    items = pro ? db.bookings.filter(b => b.professionalId === pro.id) : []
  } else items = db.bookings
  res.json(items.map(b => decorateBooking(db, b)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
})

const STATUS_FLOW = {
  professional: { accepted: ['pending', 'clarification', 'quoted'], completed: ['accepted'], cancelled: ['pending', 'clarification', 'quoted', 'accepted'] },
  patient: { cancelled: ['pending', 'clarification', 'quoted', 'accepted'] }
}
app.patch('/api/bookings/:id/status', auth, limits.write, async (req, res) => {
  const nextStatus = str(req.body?.status, 20)
  const db = await lock()
  const b = db.bookings.find(x => x.id === req.params.id)
  if (!b) return res.status(404).json({ error: 'Δεν βρέθηκε κράτηση' })
  const p = db.professionals.find(x => x.id === b.professionalId)

  const isPro = req.user.role === 'professional' && p?.userId === req.user.id
  const isPatient = req.user.role === 'patient' && b.patientId === req.user.id
  if (!isPro && !isPatient && req.user.role !== 'admin') return res.status(403).json({ error: 'Δεν επιτρέπεται' })

  if (req.user.role !== 'admin') {
    const allowedFrom = STATUS_FLOW[isPro ? 'professional' : 'patient'][nextStatus]
    if (!allowedFrom || !allowedFrom.includes(b.status)) {
      return res.status(400).json({ error: `Μη επιτρεπτή μετάβαση κατάστασης (${b.status} → ${nextStatus || '—'})` })
    }
  }
  b.status = nextStatus
  b.updatedAt = now()
  if (nextStatus === 'accepted' && b.agreedPrice == null && b.proposedPrice != null) b.agreedPrice = Number(b.proposedPrice)
  notify(db, isPro ? b.patientId : p?.userId, 'booking', 'Ενημέρωση κράτησης', `${b.service} · ${nextStatus}`)
  await commit(db)
  res.json(decorateBooking(db, b))
})

app.post('/api/bookings/:id/clarification', auth, requireRole('professional'), limits.write, async (req, res) => {
  const db = await lock()
  const b = db.bookings.find(x => x.id === req.params.id)
  if (!b) return res.status(404).json({ error: 'Δεν βρέθηκε αίτημα' })
  const p = db.professionals.find(x => x.id === b.professionalId)
  if (p?.userId !== req.user.id) return res.status(403).json({ error: 'Δεν επιτρέπεται' })
  const question = str(req.body?.question, 1000)
  if (!question) return res.status(400).json({ error: 'Γράψε τη διευκρίνιση που χρειάζεσαι' })
  b.messages.push({ id: id('msg'), fromRole: 'professional', fromName: req.user.name, text: question, createdAt: now() })
  b.status = 'clarification'
  notify(db, b.patientId, 'clarification', 'Ο επαγγελματίας ζήτησε διευκρινίσεις', question.slice(0, 140))
  await commit(db)
  res.json(decorateBooking(db, b))
})

app.post('/api/bookings/:id/message', auth, limits.write, async (req, res) => {
  const db = await lock()
  const b = db.bookings.find(x => x.id === req.params.id)
  if (!b) return res.status(404).json({ error: 'Δεν βρέθηκε αίτημα' })
  const p = db.professionals.find(x => x.id === b.professionalId)
  const isPatient = req.user.role === 'patient' && b.patientId === req.user.id
  const isPro = req.user.role === 'professional' && p?.userId === req.user.id
  if (!isPatient && !isPro) return res.status(403).json({ error: 'Δεν επιτρέπεται' })
  if (['cancelled', 'completed'].includes(b.status)) return res.status(400).json({ error: 'Το αίτημα έχει κλείσει' })
  const text = str(req.body?.text, 1500)
  if (!text) return res.status(400).json({ error: 'Γράψε ένα μήνυμα' })
  if (b.messages.length > 200) return res.status(429).json({ error: 'Υπερβολικά πολλά μηνύματα σε αυτό το αίτημα' })
  b.messages.push({ id: id('msg'), fromRole: req.user.role, fromName: req.user.name, text, createdAt: now() })
  if (isPatient && b.status === 'clarification') b.status = 'pending'
  notify(db, isPatient ? p?.userId : b.patientId, 'message', 'Νέο μήνυμα σε αίτημα', text.slice(0, 140))
  await commit(db)
  res.json(decorateBooking(db, b))
})

app.post('/api/bookings/:id/quote', auth, requireRole('professional'), limits.write, async (req, res) => {
  const db = await lock()
  const b = db.bookings.find(x => x.id === req.params.id)
  if (!b) return res.status(404).json({ error: 'Δεν βρέθηκε αίτημα' })
  const p = db.professionals.find(x => x.id === b.professionalId)
  if (p?.userId !== req.user.id) return res.status(403).json({ error: 'Δεν επιτρέπεται' })
  if (!['pending', 'clarification', 'quoted'].includes(b.status)) return res.status(400).json({ error: 'Το αίτημα δεν δέχεται πρόταση κόστους σε αυτή την κατάσταση' })
  const amount = Number(req.body?.amount)
  if (!Number.isFinite(amount) || amount <= 0 || amount > 5000) return res.status(400).json({ error: 'Μη έγκυρο ποσό' })
  const extra = str(req.body?.message, 500)
  b.proposedPrice = Number(amount.toFixed(2))
  b.status = 'quoted'
  b.messages.push({ id: id('msg'), fromRole: 'professional', fromName: req.user.name, text: `Πρόταση τελικού κόστους: ${b.proposedPrice.toFixed(2)}€${extra ? ' · ' + extra : ''}`, createdAt: now() })
  notify(db, b.patientId, 'quote', 'Νέα πρόταση κόστους', `${b.proposedPrice.toFixed(2)}€ · ${extra || b.service}`)
  await commit(db)
  res.json(decorateBooking(db, b))
})

app.post('/api/bookings/:id/quote-decision', auth, requireRole('patient'), limits.write, async (req, res) => {
  const db = await lock()
  const b = db.bookings.find(x => x.id === req.params.id)
  if (!b) return res.status(404).json({ error: 'Δεν βρέθηκε αίτημα' })
  if (b.patientId !== req.user.id) return res.status(403).json({ error: 'Δεν επιτρέπεται' })
  if (b.status !== 'quoted') return res.status(400).json({ error: 'Δεν υπάρχει ενεργή πρόταση κόστους' })
  const p = db.professionals.find(x => x.id === b.professionalId)
  if (req.body?.decision === 'accept') {
    b.agreedPrice = Number(b.proposedPrice || b.price || 0)
    b.status = 'accepted'
    b.messages.push({ id: id('msg'), fromRole: 'patient', fromName: req.user.name, text: `Αποδοχή τελικού κόστους ${b.agreedPrice.toFixed(2)}€ και επιβεβαίωση επίσκεψης.`, createdAt: now() })
    notify(db, p?.userId, 'accepted', 'Η πρόταση κόστους έγινε αποδεκτή', `${req.user.name} · ${b.agreedPrice.toFixed(2)}€`)
  } else {
    b.status = 'pending'
    b.messages.push({ id: id('msg'), fromRole: 'patient', fromName: req.user.name, text: 'Δεν έγινε αποδεκτή η πρόταση κόστους. Χρειάζεται νέα συνεννόηση.', createdAt: now() })
    notify(db, p?.userId, 'quote', 'Η πρόταση κόστους δεν έγινε αποδεκτή', b.service)
  }
  await commit(db)
  res.json(decorateBooking(db, b))
})

app.post('/api/bookings/:id/review', auth, requireRole('patient'), limits.write, async (req, res) => {
  const db = await lock()
  const b = db.bookings.find(x => x.id === req.params.id)
  if (!b || b.patientId !== req.user.id || b.status !== 'completed') return res.status(400).json({ error: 'Αξιολόγηση επιτρέπεται μόνο μετά από ολοκληρωμένη επίσκεψη' })
  if (db.reviews.some(r => r.bookingId === b.id)) return res.status(409).json({ error: 'Έχει ήδη υποβληθεί αξιολόγηση' })
  const rating = Math.max(1, Math.min(5, Math.round(Number(req.body?.rating || 0))))
  if (!rating) return res.status(400).json({ error: 'Επίλεξε βαθμολογία' })
  const review = { id: id('rev'), bookingId: b.id, patientId: req.user.id, professionalId: b.professionalId, rating, comment: str(req.body?.comment, 1000), createdAt: now(), verifiedBooking: true }
  db.reviews.push(review)
  const p = db.professionals.find(x => x.id === b.professionalId)
  const rs = db.reviews.filter(r => r.professionalId === b.professionalId)
  if (p) { p.reviews = rs.length; p.rating = Number((rs.reduce((a, r) => a + r.rating, 0) / rs.length).toFixed(1)) }
  await commit(db)
  res.json(review)
})

/* ------------------------------------------------------------------ *
 * Ειδοποιήσεις, αγαπημένα, αναφορές
 * ------------------------------------------------------------------ */
app.get('/api/notifications', auth, async (req, res) => {
  const db = await read()
  res.json(db.notifications.filter(n => n.userId === req.user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100))
})
app.patch('/api/notifications/:id/read', auth, async (req, res) => {
  const db = await lock()
  const n = db.notifications.find(x => x.id === req.params.id && x.userId === req.user.id)
  if (!n) return res.status(404).json({ error: 'Δεν βρέθηκε' })
  n.read = true; await commit(db); res.json(n)
})
app.post('/api/favorites/:professionalId', auth, requireRole('patient'), limits.write, async (req, res) => {
  const db = await lock()
  const professionalId = str(req.params.professionalId, 60)
  const existing = db.favorites.find(f => f.userId === req.user.id && f.professionalId === professionalId)
  if (existing) db.favorites = db.favorites.filter(f => f.id !== existing.id)
  else db.favorites.push({ id: id('fav'), userId: req.user.id, professionalId, createdAt: now() })
  await commit(db)
  res.json({ favorite: !existing })
})
app.get('/api/favorites', auth, async (req, res) => {
  const db = await read()
  res.json(db.favorites.filter(f => f.userId === req.user.id).map(f => f.professionalId))
})
app.post('/api/reports', auth, limits.write, async (req, res) => {
  const targetType = ['professional', 'patient', 'booking', 'review'].includes(req.body?.targetType) ? req.body.targetType : ''
  const targetId = str(req.body?.targetId, 60)
  const reason = str(req.body?.reason, 200)
  if (!targetType || !targetId || !reason) return res.status(400).json({ error: 'Συμπλήρωσε τα απαραίτητα στοιχεία' })
  const report = { id: id('rpt'), reporterId: req.user.id, targetType, targetId, reason, details: str(req.body?.details, 2000), status: 'open', createdAt: now() }
  await mutate(db => db.reports.push(report))
  res.json(report)
})


/* ------------------------------------------------------------------ *
 * Live events / browser notifications / calendar / support
 * ------------------------------------------------------------------ */
app.get('/api/live', auth, async (req,res)=>{
  res.setHeader('Content-Type','text/event-stream')
  res.setHeader('Cache-Control','no-cache, no-transform')
  res.setHeader('Connection','keep-alive')
  res.flushHeaders?.()
  if(!liveClients.has(req.user.id)) liveClients.set(req.user.id,new Set())
  liveClients.get(req.user.id).add(res)
  res.write(`event: ready\ndata: ${JSON.stringify({ok:true,at:now()})}\n\n`)
  const ping=setInterval(()=>{try{res.write(`: ping ${Date.now()}\n\n`)}catch{}},25000)
  req.on('close',()=>{clearInterval(ping);const set=liveClients.get(req.user.id);set?.delete(res);if(set?.size===0)liveClients.delete(req.user.id)})
})

function bookingForUser(db,user,bid){
  const b=db.bookings.find(x=>x.id===bid); if(!b)return null
  if(user.role==='admin')return b
  if(user.role==='patient'&&b.patientId===user.id)return b
  if(user.role==='professional'){const p=db.professionals.find(x=>x.userId===user.id);if(p&&b.professionalId===p.id)return b}
  return null
}
app.get('/api/bookings/:id/calendar.ics', auth, async (req,res)=>{
  const db=await read();const b=bookingForUser(db,req.user,req.params.id);if(!b)return res.status(404).send('Not found')
  if(!['accepted','completed'].includes(b.status))return res.status(400).send('Η επίσκεψη δεν έχει επιβεβαιωθεί')
  const p=db.professionals.find(x=>x.id===b.professionalId);const proName=db.users.find(u=>u.id===p?.userId)?.name||'MELEO Professional'
  const start=new Date(`${b.date}T${b.time}:00`);const end=new Date(start.getTime()+60*60000)
  const fmt=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z')
  const esc=v=>String(v||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;')
  const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//MELEO//Care Booking//EL','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:${b.id}@meleo.gr`,`DTSTAMP:${fmt(new Date())}`,`DTSTART:${fmt(start)}`,`DTEND:${fmt(end)}`,`SUMMARY:${esc('MELEO · '+b.service)}`,`DESCRIPTION:${esc('Επίσκεψη με '+proName+' · '+statusLabelServer(b.status))}`,`LOCATION:${esc(b.address)}`,'END:VEVENT','END:VCALENDAR'].join('\r\n')
  res.setHeader('Content-Type','text/calendar; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename="meleo-${b.id}.ics"`);res.send(ics)
})
function statusLabelServer(s){return ({accepted:'Επιβεβαιωμένη',completed:'Ολοκληρώθηκε'})[s]||s}

app.get('/api/support/tickets', auth, async (req,res)=>{
  const db=await read();const rows=req.user.role==='admin'?db.supportTickets:db.supportTickets.filter(t=>t.userId===req.user.id)
  res.json(rows.slice().sort((a,b)=>String(b.updatedAt||b.createdAt).localeCompare(String(a.updatedAt||a.createdAt))))
})
app.post('/api/support/tickets', auth, limits.write, async (req,res)=>{
  const subject=str(req.body?.subject,160),category=str(req.body?.category,60)||'general',text=str(req.body?.text,3000)
  if(!subject||!text)return res.status(400).json({error:'Συμπλήρωσε θέμα και μήνυμα'})
  const ticket={id:id('sup'),userId:req.user.id,subject,category,status:'open',priority:'normal',messages:[{id:id('sm'),fromRole:req.user.role,fromName:req.user.name,text,createdAt:now()}],createdAt:now(),updatedAt:now()}
  await mutate(db=>{db.supportTickets.push(ticket);const admins=db.users.filter(u=>u.role==='admin'&&!u.deletedAt);for(const a of admins)notify(db,a.id,'support','Νέο αίτημα υποστήριξης',`${req.user.name} · ${subject}`)})
  res.json(ticket)
})
app.post('/api/support/tickets/:id/message', auth, limits.write, async (req,res)=>{
  const text=str(req.body?.text,3000);if(!text)return res.status(400).json({error:'Γράψε μήνυμα'})
  const db=await lock();const t=db.supportTickets.find(x=>x.id===req.params.id);if(!t)return res.status(404).json({error:'Δεν βρέθηκε ticket'})
  if(req.user.role!=='admin'&&t.userId!==req.user.id)return res.status(403).json({error:'Δεν επιτρέπεται'})
  t.messages.push({id:id('sm'),fromRole:req.user.role,fromName:req.user.name,text,createdAt:now()});t.updatedAt=now();if(t.status==='closed')t.status='open'
  const target=req.user.role==='admin'?t.userId:db.users.find(u=>u.role==='admin'&&!u.deletedAt)?.id
  notify(db,target,'support','Νέα απάντηση υποστήριξης',`${t.subject} · ${text.slice(0,120)}`);await commit(db);res.json(t)
})
app.patch('/api/support/tickets/:id', auth, requireRole('admin'), limits.write, async (req,res)=>{
  const status=['open','pending','closed'].includes(req.body?.status)?req.body.status:null;const priority=['low','normal','high','urgent'].includes(req.body?.priority)?req.body.priority:null
  const db=await lock();const t=db.supportTickets.find(x=>x.id===req.params.id);if(!t)return res.status(404).json({error:'Δεν βρέθηκε ticket'})
  if(status)t.status=status;if(priority)t.priority=priority;t.updatedAt=now();audit(db,req.user.id,'admin.support_update',{ticketId:t.id,status:t.status,priority:t.priority});await commit(db);res.json(t)
})

/* ------------------------------------------------------------------ *
 * Admin
 * ------------------------------------------------------------------ */
app.get('/api/admin/stats', auth, requireRole('admin'), async (_req, res) => {
  const db = await read()
  const today = new Date()
  const sinceDays = d => new Date(today.getTime() - d * 86400000)
  const professionals = db.professionals, bookings = db.bookings
  const users = db.users.filter(u => !u.deletedAt)
  const completed = bookings.filter(b => b.status === 'completed')
  const finalValue = b => Number(b.agreedPrice ?? b.price ?? 0)
  const completedGmv = completed.reduce((a, b) => a + finalValue(b), 0)

  const activePros = professionals.filter(p => p.subscriptionStatus === 'active')
  const premium = activePros.filter(p => p.subscriptionPlan === 'premium')
  const basic = activePros.filter(p => p.subscriptionPlan === 'basic')
  // ΜΟΝΑΔΙΚΗ πηγή εσόδων: μηνιαίες συνδρομές επαγγελματιών.
  const subscriptionMrr = activePros.reduce((a, p) => a + Number(p.subscriptionPrice || 0), 0)
  const monthKey = new Date().toISOString().slice(0,7)
  const monthPayments = db.payments.filter(x => String(x.createdAt||'').slice(0,7)===monthKey)
  const collectedRevenue = monthPayments.filter(x=>x.status==='paid').reduce((a,x)=>a+Number(x.amount||0),0)
  const failedRevenue = monthPayments.filter(x=>x.status==='failed').reduce((a,x)=>a+Number(x.amount||0),0)
  const failedPayments = monthPayments.filter(x=>x.status==='failed').length

  const byStatus = ['pending', 'clarification', 'quoted', 'accepted', 'completed', 'cancelled']
    .reduce((o, k) => (o[k] = bookings.filter(b => b.status === k).length, o), {})
  const group = (arr, keyFn) => Object.entries(arr.reduce((o, x) => { const k = keyFn(x); o[k] = (o[k] || 0) + 1; return o }, {}))
    .map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
  const series = (arr, field) => Array.from({ length: 14 }, (_, i) => {
    const key = new Date(today.getTime() - (13 - i) * 86400000).toISOString().slice(0, 10)
    return { date: key, count: arr.filter(x => String(x[field] || '').slice(0, 10) === key).length }
  })
  const activeBookings = bookings.filter(b => !['cancelled'].includes(b.status))
  const conversion = (n,d) => d ? Number((n/d*100).toFixed(1)) : 0
  const uniquePatientsWithBooking = new Set(bookings.map(b=>b.patientId)).size
  const repeatPatients = [...new Set(bookings.map(b=>b.patientId))].filter(pid=>bookings.filter(b=>b.patientId===pid).length>1).length
  const reviews = db.reviews || []
  const avgRating = reviews.length ? Number((reviews.reduce((a,r)=>a+Number(r.rating||0),0)/reviews.length).toFixed(2)) : 0
  const verifiedPros = professionals.filter(p=>p.verified)
  const suspendedUsers = users.filter(u=>u.accountStatus==='suspended').length
  const active30 = users.filter(u => { const t=Date.parse(u.lastLoginAt||u.createdAt||0); return Number.isFinite(t)&&t>=sinceDays(30).getTime() }).length

  res.json({
    accounts: {
      total: users.length, patients: users.filter(u => u.role === 'patient').length,
      professionals: users.filter(u => u.role === 'professional').length, admins: users.filter(u => u.role === 'admin').length,
      new7: users.filter(u => new Date(u.createdAt) >= sinceDays(7)).length,
      new30: users.filter(u => new Date(u.createdAt) >= sinceDays(30)).length,
      unverifiedEmail: users.filter(u => !u.emailVerified && u.role !== 'admin').length,
      deletionPending: users.filter(u => u.deletionPending).length
    },
    professionals: {
      total: professionals.length, verified: professionals.filter(p => p.verified).length,
      publiclyVisible: professionals.filter(isPubliclyVisible).length,
      pendingVerification: db.verificationRequests.filter(v => v.status === 'pending').length,
      basic: basic.length, premium: premium.length, featured: professionals.filter(p => p.featured).length,
      pastDue: professionals.filter(p => p.subscriptionStatus === 'past_due').length,
      churned: professionals.filter(p => p.subscriptionStatus === 'cancelled').length
    },
    bookings: { total: bookings.length, ...byStatus, completedGmv, avgValue: completed.length ? completedGmv / completed.length : 0 },
    // Το GMV είναι όγκος αγοράς, ΟΧΙ έσοδο της MELEO.
    revenue: { subscriptionMrr, subscriptionArr: subscriptionMrr * 12, collectedRevenue, failedRevenue, failedPayments, outstanding: professionals.filter(p=>p.subscriptionStatus==='past_due').reduce((a,p)=>a+Number(p.subscriptionPrice||0),0), platformMonthlyRevenue: collectedRevenue, marketplaceGmv: completedGmv },
    marketplace: {
      active30, suspendedUsers, uniquePatientsWithBooking, repeatPatients, totalReviews: reviews.length, avgRating,
      verificationRate: conversion(verifiedPros.length, professionals.length),
      bookingCompletionRate: conversion(completed.length, activeBookings.length),
      requestToAcceptedRate: conversion(bookings.filter(b=>['accepted','completed'].includes(b.status)).length, bookings.length),
      reviewCoverage: conversion(reviews.length, completed.length),
      patientActivationRate: conversion(uniquePatientsWithBooking, users.filter(u=>u.role==='patient').length),
      premiumShare: conversion(premium.length, activePros.length)
    },
    specialties: group(professionals, p => p.specialty || 'Χωρίς ειδικότητα'),
    cities: group(professionals, p => p.city || 'Μη ορισμένη'),
    registrations14: series(users, 'createdAt'),
    bookings14: series(bookings, 'createdAt')
  })
})

app.get('/api/admin/members', auth, requireRole('admin'), async (_req, res) => {
  const db = await read()
  res.json(db.users.filter(u => u.role !== 'admin').map(u => {
    const p = db.professionals.find(x => x.userId === u.id)
    const verification = db.verificationRequests.filter(v => v.userId === u.id).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0]
    let lifecycleStatus = ''
    if (u.deletionPending) lifecycleStatus = 'deletion_pending'
    else if (u.role === 'professional') {
      if (p?.verified) lifecycleStatus = 'approved'
      else if (verification?.status === 'pending') lifecycleStatus = 'pending_verification'
      else if (verification?.status === 'rejected') lifecycleStatus = 'verification_rejected'
      else if (!subscriptionAllowsVisibility(p?.subscriptionStatus, p)) lifecycleStatus = 'awaiting_subscription'
      else if (!profileBasicsComplete(p)) lifecycleStatus = 'profile_incomplete'
      else lifecycleStatus = 'verification_required'
    }
    return {
      ...publicUser(u), deleted: Boolean(u.deletedAt), specialty: p?.specialty || '', verified: Boolean(p?.verified),
      verificationStatus: verification?.status || '', verificationRequestId: verification?.id || '', lifecycleStatus,
      onboardingStage: p?.onboardingStage || '', onboardingCompleted: Boolean(p?.onboardingCompleted),
      subscriptionPlan: p?.subscriptionPlan || '', subscriptionStatus: p?.subscriptionStatus || '',
      subscriptionPrice: Number(p?.subscriptionPrice || 0), billingMode: p?.billingMode || '',
      currentPeriodEnd: p?.currentPeriodEnd || null, city: p?.city || '', rating: p?.rating || 0, professionalId: p?.id || '',
      accountStatus: u.accountStatus || 'active', suspendedAt: u.suspendedAt || null, suspensionReason: u.suspensionReason || '',
      featured: Boolean(p?.featured), reviews: Number(p?.reviews||0), createdAt: u.createdAt, lastLoginAt: u.lastLoginAt || null
    }
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
})


app.patch('/api/admin/members/:id/action', auth, requireRole('admin'), limits.write, async (req,res)=>{
  const action = str(req.body?.action, 40)
  const reason = str(req.body?.reason, 500)
  const db = await lock()
  const u = db.users.find(x=>x.id===req.params.id && x.role!=='admin' && !x.deletedAt)
  if(!u) return res.status(404).json({error:'Δεν βρέθηκε μέλος'})
  const p = db.professionals.find(x=>x.userId===u.id)
  if(action==='suspend'){
    u.accountStatus='suspended'; u.suspendedAt=now(); u.suspensionReason=reason||'Χειροκίνητη αναστολή από Admin'
    if(p) p.adminSuspended=true
    db.sessions = db.sessions.filter(x=>x.userId!==u.id)
  } else if(action==='reactivate'){
    u.accountStatus='active'; u.suspendedAt=null; u.suspensionReason=''
    if(p) p.adminSuspended=false
  } else if(action==='verify' && p){
    p.verified=true; p.onboardingStage='approved'; p.manualVerification=true; p.manualVerificationAt=now(); p.manualVerificationReason=reason
    let v=db.verificationRequests.filter(v=>v.userId===u.id).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))[0]
    if(!v){v={id:id('vr'),userId:u.id,status:'approved',licenseNumber:'',notes:'Χειροκίνητη επαλήθευση από Admin',createdAt:now()};db.verificationRequests.push(v)}
    v.status='approved';v.reviewedAt=now();v.reviewerId=req.user.id;v.adminNote=reason||'Χειροκίνητη επαλήθευση από Admin'
  } else if(action==='unverify' && p){
    p.verified=false; p.onboardingStage='verification_required'; p.manualVerification=false; p.manualUnverifiedAt=now(); p.manualVerificationReason=reason
  } else if(action==='feature' && p){
    if(p.subscriptionPlan!=='premium' || p.subscriptionStatus!=='active') return res.status(400).json({error:'Featured επιτρέπεται μόνο σε ενεργό PREMIUM επαγγελματία'})
    p.featured=true
  } else if(action==='unfeature' && p){
    p.featured=false
  } else return res.status(400).json({error:'Μη έγκυρη ενέργεια'})
  audit(db, req.user.id, 'admin.member_action', {userId:u.id, professionalId:p?.id||null, action, reason})
  await commit(db)
  res.json({ok:true})
})

app.get('/api/admin/audit', auth, requireRole('admin'), async (req,res)=>{
  const db=await read(); const limit=Math.min(500,Math.max(20,Number(req.query.limit)||150))
  const userMap=new Map(db.users.map(u=>[u.id,u]))
  res.json(db.auditLog.slice(-limit).reverse().map(x=>({...x,actorName:userMap.get(x.actorId)?.name||'System',actorEmail:userMap.get(x.actorId)?.email||''})))
})

app.get('/api/admin/insights', auth, requireRole('admin'), async (_req,res)=>{
  const db=await read(); const t=Date.now(); const days=n=>t-n*86400000
  const period=(arr,field,n)=>arr.filter(x=>Date.parse(x[field]||0)>=days(n)).length
  const proMap=new Map(db.professionals.map(p=>[p.id,p]))
  const topPros=db.professionals.map(p=>{
    const bs=db.bookings.filter(b=>b.professionalId===p.id); const completed=bs.filter(b=>b.status==='completed')
    const u=db.users.find(u=>u.id===p.userId); const an=db.professionalAnalytics.find(a=>a.professionalId===p.id)||{}
    return {id:p.id,name:u?.name||'',specialty:p.specialty||'',plan:p.subscriptionPlan||'',verified:!!p.verified,rating:Number(p.rating||0),reviews:Number(p.reviews||0),requests:bs.length,completed:completed.length,profileViews:Number(an.profileViews||0),impressions:Number(an.impressions||0)}
  }).sort((a,b)=>b.completed-a.completed || b.requests-a.requests).slice(0,10)
  const signupByRole=['patient','professional'].map(role=>({role,count:db.users.filter(u=>u.role===role&&!u.deletedAt).length,new30:db.users.filter(u=>u.role===role&&!u.deletedAt&&Date.parse(u.createdAt)>=days(30)).length}))
  const bookingStatus=Object.entries(db.bookings.reduce((o,b)=>(o[b.status]=(o[b.status]||0)+1,o),{})).map(([name,count])=>({name,count}))
  const reviewDist=[5,4,3,2,1].map(stars=>({stars,count:db.reviews.filter(r=>Number(r.rating)===stars).length}))
  res.json({topPros,signupByRole,bookingStatus,reviewDist,newUsers7:period(db.users,'createdAt',7),newUsers30:period(db.users,'createdAt',30),newBookings7:period(db.bookings,'createdAt',7),newBookings30:period(db.bookings,'createdAt',30)})
})

app.get('/api/admin/bookings', auth, requireRole('admin'), async (_req, res) => {
  const db = await read()
  res.json(db.bookings.map(b => {
    const p = db.professionals.find(x => x.id === b.professionalId)
    return {
      ...b,
      notes: decryptSensitive(b.notes),
      professionalName: db.users.find(u => u.id === p?.userId)?.name || '',
      patientName: db.users.find(u => u.id === b.patientId)?.name || '',
      specialty: p?.specialty || '', plan: p?.subscriptionPlan || ''
    }
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
})

app.get('/api/admin/subscriptions', auth, requireRole('admin'), async (_req, res) => {
  const db = await read()
  res.json({
    subscriptions: db.subscriptions.map(s => {
      const p = db.professionals.find(x => x.id === s.professionalId)
      const u = db.users.find(x => x.id === p?.userId)
      return { ...s, professionalName: u?.name || '', email: u?.email || '' }
    }).sort((a, b) => String(b.updatedAt || b.startedAt).localeCompare(String(a.updatedAt || a.startedAt))),
    payments: db.payments.slice(-200).reverse()
  })
})

app.get('/api/admin/verifications', auth, requireRole('admin'), async (_req, res) => {
  const db = await read()
  res.json(db.verificationRequests.map(v => {
    const u = db.users.find(x => x.id === v.userId)
    const p = db.professionals.find(x => x.userId === v.userId)
    const documents = db.verificationDocuments.filter(d => (v.documentIds||[]).includes(d.id) || d.userId===v.userId)
    return { ...v, documents: documents.map(({userId,...d})=>d), documentCount: documents.length, name: u?.name || '', email: u?.email || '', phone: u?.phone || '', specialty: p?.specialty || '', subscriptionPlan: p?.subscriptionPlan || '', subscriptionStatus: p?.subscriptionStatus || '', city: p?.city || '' }
  }).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))))
})

app.get('/api/admin/verification-documents/:id', auth, requireRole('admin'), async (req,res)=>{
  const db=await read(); const doc=db.verificationDocuments.find(x=>x.id===req.params.id)
  if(!doc) return res.status(404).json({error:'Δεν βρέθηκε δικαιολογητικό'})
  try {
    const decrypted=decryptFileBuffer(fs.readFileSync(secureFilePath(doc.id)))
    res.setHeader('Content-Type',doc.mime||'application/octet-stream')
    res.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(doc.name||'document')}`)
    res.setHeader('Cache-Control','no-store, private')
    await mutate(d=>audit(d, req.user.id, 'verification.document_viewed', {documentId:doc.id}))
    res.end(decrypted)
  } catch { res.status(500).json({error:'Αδυναμία ανάγνωσης δικαιολογητικού'}) }
})

app.patch('/api/admin/verifications/:id', auth, requireRole('admin'), async (req, res) => {
  const status = ['approved', 'rejected', 'pending'].includes(req.body?.status) ? req.body.status : null
  if (!status) return res.status(400).json({ error: 'Μη έγκυρη κατάσταση' })
  const db = await lock()
  const v = db.verificationRequests.find(x => x.id === req.params.id)
  if (!v) return res.status(404).json({ error: 'Δεν βρέθηκε' })
  v.status = status
  v.reviewedAt = now()
  v.reviewerId = req.user.id
  v.adminNote = str(req.body?.adminNote, 1000)
  const p = db.professionals.find(x => x.userId === v.userId)
  const u = db.users.find(x => x.id === v.userId)
  if (p) {
    if (status === 'approved') { p.verified = true; p.onboardingStage = 'approved' }
    if (status === 'rejected') { p.verified = false; p.onboardingStage = 'verification_rejected' }
  }
  notify(db, v.userId, 'verification', status === 'approved' ? 'Το προφίλ σου εγκρίθηκε' : 'Η αίτηση επαλήθευσης απορρίφθηκε', v.adminNote || '')
  audit(db, req.user.id, 'verification.decision', { requestId: v.id, status })
  await commit(db)
  if (u && status !== 'pending') mail.verificationDecision(u.email, u.name.split(' ')[0], status === 'approved', v.adminNote).catch(() => {})
  res.json(v)
})

app.get('/api/admin/reports', auth, requireRole('admin'), async (_req, res) => {
  const db = await read()
  res.json(db.reports.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
})
app.patch('/api/admin/reports/:id', auth, requireRole('admin'), async (req, res) => {
  const db = await lock()
  const r = db.reports.find(x => x.id === req.params.id)
  if (!r) return res.status(404).json({ error: 'Δεν βρέθηκε' })
  r.status = ['open', 'investigating', 'resolved', 'dismissed'].includes(req.body?.status) ? req.body.status : r.status
  r.adminNote = str(req.body?.adminNote, 1000)
  r.updatedAt = now()
  await commit(db)
  res.json(r)
})

// Χειροκίνητος συγχρονισμός συνδρομής από τον admin (π.χ. αν χαθεί webhook).
app.post('/api/admin/professionals/:id/sync-subscription', auth, requireRole('admin'), async (req, res, next) => {
  const p = (await read()).professionals.find(x => x.id === req.params.id)
  if (!p) return res.status(404).json({ error: 'Δεν βρέθηκε' })
  try { res.json({ professional: (await refreshSubscription(p)) || p }) } catch (err) { next(err) }
})

/* ------------------------------------------------------------------ *
 * 404 / error handling / static
 * ------------------------------------------------------------------ */
app.use('/api', (_req, res) => res.status(404).json({ error: 'Δεν βρέθηκε το endpoint' }))

const dist = path.join(root, 'dist')
if (fs.existsSync(dist)) {
  app.use(express.static(dist, {
    maxAge: '1h',
    setHeaders: (res, filePath) => { if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache') }
  }))
  // Express 5: το '*' δεν είναι πλέον έγκυρο path pattern — χρησιμοποιούμε RegExp.
  app.get(/.*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')))
} else {
  app.get('/', (_req, res) => res.json({ service: 'MELEO API', status: 'online', version: '4.0.0', note: 'Τρέξε `npm run build` για να εξυπηρετηθεί και το frontend από αυτό το process.' }))
}

app.use((err, _req, res, _next) => {
  console.error('[MELEO] Σφάλμα:', err?.message || err)
  const status = Number(err?.statusCode || err?.status || 500)
  const isCardError = err?.type === 'StripeCardError'
  res.status(status >= 400 && status < 600 ? status : 500).json({
    error: isCardError
      ? (err.message || 'Η κάρτα απορρίφθηκε.')
      : (config.isProd ? 'Παρουσιάστηκε σφάλμα. Δοκίμασε ξανά ή επικοινώνησε με την υποστήριξη.' : String(err?.message || err))
  })
})

/* ------------------------------------------------------------------ *
 * Εκκίνηση
 * ------------------------------------------------------------------ */
const SWEEP_INTERVAL_MS = 30 * 60 * 1000

async function main() {
  const store = await initDb()
  await ensureAdmin()

  const server = app.listen(config.port, () => {
    console.log(`[MELEO] API http://localhost:${config.port} · env=${config.env} · db=${store.driver} · payments=${config.stripeEnabled ? 'stripe' : (config.demoCheckout ? 'demo' : 'disabled')} · mail=${config.mailEnabled}`)
    if (!store.multiInstanceSafe) {
      console.warn('[MELEO] Προσοχή: JSON driver — ΕΝΑ instance μόνο. Για server όρισε DATABASE_URL (PostgreSQL).')
    }
  })

  const sweeper = setInterval(() => { runSweep().then(()=>retryPendingDeletions()).catch(err => console.error('[MELEO] sweep:', err.message)) }, SWEEP_INTERVAL_MS)
  retryPendingDeletions().catch(err=>console.error('[MELEO] deletion retry boot:',err.message))
  sweeper.unref()

  let closing = false
  const shutdown = async sig => {
    if (closing) return
    closing = true
    console.log(`[MELEO] ${sig} — τερματισμός…`)
    clearInterval(sweeper)
    server.close(async () => {
      try { await closeStore() } catch { /* ignore */ }
      process.exit(0)
    })
    // Αν κάποια σύνδεση κολλήσει, μη μείνει το process ζωντανό για πάντα.
    setTimeout(() => process.exit(0), 10000).unref()
  }
  for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { void shutdown(sig) })
}

process.on('unhandledRejection', err => console.error('[MELEO] unhandledRejection:', err))

main().catch(err => {
  console.error('[MELEO] Η εκκίνηση απέτυχε:', err?.message || err)
  process.exit(1)
})
