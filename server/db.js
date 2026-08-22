// MELEO — πρόσβαση στα δεδομένα.
//
// Το φυσικό storage βρίσκεται στο store.js (PostgreSQL σε production, JSON
// αρχείο τοπικά). Εδώ ζει η λογική που χρησιμοποιούν τα endpoints:
//
//   await read()        → φρέσκο snapshot για ανάγνωση
//   await lock()        → snapshot ΜΕ κλειδί εγγραφής (transaction)
//   await commit(db)    → οριστικοποίηση των αλλαγών
//   await mutate(fn)    → lock + fn(db) + commit σε ένα βήμα
//
// Κανόνας: κάθε async εργασία (π.χ. κλήση Stripe) ΠΡΕΠΕΙ να ολοκληρώνεται
// ΠΡΙΝ το lock(), ώστε το transaction να κρατά όσο λιγότερο γίνεται.
import crypto from 'node:crypto'
import { AsyncLocalStorage } from 'node:async_hooks'
import { config } from './config.js'
import { initStore, snapshot, begin, replaceAll, closeStore, storeInfo, emptyDb, COLLECTIONS } from './store.js'

export { storeInfo, closeStore, COLLECTIONS }

export const now = () => new Date().toISOString()
export const id = (p = 'id') => `${p}_${crypto.randomUUID()}`

export const hash = (password, salt = crypto.randomBytes(16).toString('hex')) => {
  const key = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${key}`
}
export const verifyPassword = (password, stored) => {
  try {
    const [salt, key] = String(stored || '').split(':')
    if (!salt || !key) return false
    const test = crypto.scryptSync(password, salt, 64).toString('hex')
    return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(test, 'hex'))
  } catch { return false }
}
export const sha256 = v => crypto.createHash('sha256').update(String(v)).digest('hex')

/* ------------------------------------------------------------------ *
 * Transactions ανά αίτημα
 * ------------------------------------------------------------------ */

const als = new AsyncLocalStorage()
const txnByDb = new WeakMap()

/** Express middleware: δίνει σε κάθε αίτημα δικό του transaction context. */
export function requestContext(req, res, next) {
  const ctx = { txn: null }
  als.run(ctx, () => {
    res.on('finish', () => { void releaseContext(ctx) })
    res.on('close', () => { void releaseContext(ctx) })
    next()
  })
}

async function releaseContext(ctx) {
  const txn = ctx.txn
  if (!txn) return
  ctx.txn = null
  txnByDb.delete(txn.db)
  // Ο handler τερμάτισε χωρίς commit (π.χ. early return σε validation error):
  // ακυρώνουμε το transaction ώστε να μη μείνει κλειδωμένη η βάση.
  try { await txn.rollback() } catch (err) { console.error('[MELEO] rollback error:', err.message) }
}

/** Φρέσκο snapshot. Μέσα σε ενεργό transaction επιστρέφει το ίδιο αντικείμενο. */
export async function read() {
  const ctx = als.getStore()
  if (ctx?.txn) return ctx.txn.db
  return snapshot()
}

/**
 * Snapshot με κλειδί εγγραφής.
 *
 * Μέσα στο ίδιο αίτημα οι κλήσεις μοιράζονται ΤΟ ΙΔΙΟ transaction: αν ένας
 * handler κάνει lock() και μετά καλέσει κάτι που κάνει mutate(), όλα γράφονται
 * μαζί. Αν ο handler τερματίσει χωρίς commit, το transaction ακυρώνεται.
 */
export async function lock() {
  const ctx = als.getStore()
  if (ctx?.txn) return ctx.txn.db
  const txn = await begin()
  txnByDb.set(txn.db, txn)
  if (ctx) ctx.txn = txn
  return txn.db
}

/** Οριστικοποίηση. Δέχεται το αντικείμενο που επέστρεψε το lock(). */
export async function commit(db) {
  const ctx = als.getStore()
  const txn = (ctx?.txn && (!db || ctx.txn.db === db)) ? ctx.txn : txnByDb.get(db)
  if (!txn) {
    // Το transaction έχει ήδη κλείσει (π.χ. από εμφωλευμένο mutate) ή τρέχουμε
    // σε κώδικα εκκίνησης: γράφουμε τις αλλαγές με δικό μας transaction.
    await replaceAll(db)
    return db
  }
  if (ctx?.txn === txn) ctx.txn = null
  txnByDb.delete(txn.db)
  await txn.commit(db || txn.db)
  return db || txn.db
}

/** lock + fn + commit. */
export async function mutate(fn) {
  const db = await lock()
  const result = await fn(db)
  await commit(db)
  return result
}

/* ------------------------------------------------------------------ *
 * Seed & migrations
 * ------------------------------------------------------------------ */

const demoSeed = () => {
  const db = emptyDb()
  db.users.push(
    { id: 'u_patient', role: 'patient', name: 'Γιώργος Demo', email: 'patient@meleo.gr', password: hash('demo123'), phone: '6900000000', emailVerified: true, acceptedTermsAt: now(), createdAt: now() },
    { id: 'u_nurse1', role: 'professional', name: 'Μαρία Κωνσταντίνου', email: 'maria@meleo.gr', password: hash('demo123'), phone: '6901111111', emailVerified: true, acceptedTermsAt: now(), createdAt: now() },
    { id: 'u_nurse2', role: 'professional', name: 'Νίκος Στεφανάκης', email: 'nikos@meleo.gr', password: hash('demo123'), phone: '6902222222', emailVerified: true, acceptedTermsAt: now(), createdAt: now() }
  )
  db.professionals.push(
    { id: 'p1', userId: 'u_nurse1', title: 'Νοσηλεύτρια', specialty: 'Νοσηλευτική', verified: true, featured: true, rating: 0, reviews: 0, distance: 1.2, city: 'Ηράκλειο', area: 'Κέντρο', region: 'Κρήτη', countryCode: 'gr', latitude: 35.3387, longitude: 25.1442, serviceRadiusKm: 18, subscriptionPlan: 'premium', subscriptionPrice: 14.99, subscriptionStatus: 'active', billingMode: 'demo', onboardingCompleted: true, onboardingStage: 'approved', subscriptionSince: now(), available: 'Σήμερα', bio: 'Εξειδίκευση στη μετεγχειρητική φροντίδα και ασφαλή κατ’ οίκον υποστήριξη.', languages: ['Ελληνικά', 'Αγγλικά'], credentials: ['Πτυχίο Νοσηλευτικής', 'BLS / Πρώτες Βοήθειες'], responseTime: 'συνήθως σε 8 λεπτά', years: 9, price: 25, pricingMode: 'from', services: ['Απλή νοσηλευτική επίσκεψη', 'Χορήγηση αγωγής', 'Περιποίηση τραύματος', 'Φροντίδα καθετήρα', 'Μετεγχειρητική φροντίδα'], availability: ['09:00', '11:30', '18:00', '20:30'] },
    { id: 'p2', userId: 'u_nurse2', title: 'Φυσικοθεραπευτής', specialty: 'Φυσικοθεραπεία', verified: true, featured: false, rating: 0, reviews: 0, distance: 2.0, city: 'Ηράκλειο', area: 'Ατσαλένιο', region: 'Κρήτη', countryCode: 'gr', latitude: 35.3295, longitude: 25.1549, serviceRadiusKm: 20, subscriptionPlan: 'basic', subscriptionPrice: 9.99, subscriptionStatus: 'active', billingMode: 'demo', onboardingCompleted: true, onboardingStage: 'approved', subscriptionSince: now(), available: 'Αύριο', bio: 'Κατ’ οίκον φυσικοθεραπεία και εξατομικευμένα προγράμματα λειτουργικής αποκατάστασης.', languages: ['Ελληνικά', 'Αγγλικά'], credentials: ['Πτυχίο Φυσικοθεραπείας'], responseTime: 'συνήθως σε 14 λεπτά', years: 7, price: 30, pricingMode: 'from', services: ['Κατ’ οίκον φυσικοθεραπεία', 'Μετεγχειρητική αποκατάσταση', 'Κινησιοθεραπεία'], availability: ['08:30', '12:00', '17:00'] }
  )
  db.professionalAnalytics.push(
    { id: 'pa_p1', professionalId: 'p1', impressions: 183, profileViews: 41, phoneClicks: 12, updatedAt: now() },
    { id: 'pa_p2', professionalId: 'p2', impressions: 96, profileViews: 24, phoneClicks: 5, updatedAt: now() }
  )
  return db
}

/** Συμπλήρωση πεδίων, καθαρισμός παλαιού schema, ids όπου λείπουν. */
function migrate(db) {
  for (const k of COLLECTIONS) if (!Array.isArray(db[k])) db[k] = []

  db.users = db.users.map(u => ({
    emailVerified: u.emailVerified ?? false,
    acceptedTermsAt: u.acceptedTermsAt ?? null,
    termsVersion: u.termsVersion ?? null,
    stripeCustomerId: u.stripeCustomerId ?? null,
    deletedAt: u.deletedAt ?? null,
    deletionPending: u.deletionPending ?? false,
    deletionRequestedAt: u.deletionRequestedAt ?? null,
    lastTotpStep: u.lastTotpStep ?? null,
    accountStatus: u.accountStatus ?? 'active',
    suspendedAt: u.suspendedAt ?? null,
    suspensionReason: u.suspensionReason ?? '',
    lastLoginAt: u.lastLoginAt ?? null,
    ...u
  }))

  db.professionals = db.professionals.map(p => {
    // Το μοντέλο εσόδων άλλαξε: ΔΕΝ υπάρχει προμήθεια ανά επίσκεψη.
    const { commissionRate, platformFee, ...rest } = p
    return {
      billingMode: rest.billingMode ?? (rest.subscriptionStatus === 'active' ? 'demo' : null),
      showPhone: rest.showPhone ?? true,
      showEmail: rest.showEmail ?? true,
      preferPlatformContact: rest.preferPlatformContact ?? false,
      adminSuspended: rest.adminSuspended ?? false,
      stripeSubscriptionId: rest.stripeSubscriptionId ?? null,
      currentPeriodEnd: rest.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: rest.cancelAtPeriodEnd ?? false,
      languages: Array.isArray(rest.languages) ? rest.languages : ['Ελληνικά'],
      credentials: Array.isArray(rest.credentials) ? rest.credentials : [],
      services: Array.isArray(rest.services) ? rest.services : [],
      availability: Array.isArray(rest.availability) ? rest.availability : [],
      ...rest
    }
  })

  db.bookings = db.bookings.map(b => {
    const { platformFee, commissionRate, ...rest } = b
    return { ...rest, messages: Array.isArray(rest.messages) ? rest.messages : [], proposedPrice: rest.proposedPrice ?? null }
  })

  // Παλαιό schema: τα favorites ήταν strings 'userId:professionalId'.
  db.favorites = db.favorites.map(f => {
    if (f && typeof f === 'object') return f
    const [userId, professionalId] = String(f).split(':')
    return { id: id('fav'), userId, professionalId, createdAt: now() }
  })

  // Κάθε εγγραφή χρειάζεται id: είναι το primary key στην Postgres.
  for (const c of COLLECTIONS) {
    db[c] = db[c].filter(x => x && typeof x === 'object').map(x => (x.id ? x : { ...x, id: id(c.slice(0, 3)) }))
  }

  return sweep(db)
}

/** Καθαρισμός ληγμένων συνεδριών, tokens και παλαιών webhook events. */
export function sweep(db) {
  const t = Date.now()
  db.sessions = db.sessions.filter(s => !s.expiresAt || new Date(s.expiresAt).getTime() > t)
  db.tokens = db.tokens.filter(x => new Date(x.expiresAt).getTime() > t && !x.usedAt)
  if (db.webhookEvents.length > 2000) db.webhookEvents = db.webhookEvents.slice(-2000)
  if (db.auditLog.length > 5000) db.auditLog = db.auditLog.slice(-5000)
  const analyticsCutoff=t-14*86400000
  db.analyticsEvents = (db.analyticsEvents||[]).filter(x => new Date(x.createdAt||0).getTime() > analyticsCutoff)
  return db
}

/** Εκκίνηση storage: schema, seed, migrations. Καλείται μία φορά στο boot. */
export async function initDb() {
  await initStore(config.seedDemo ? demoSeed() : emptyDb())
  const db = await lock()
  migrate(db)
  await commit(db)
  return storeInfo()
}

export function audit(db, actorId, action, meta = {}) {
  db.auditLog.push({ id: id('log'), actorId: actorId || null, action, meta, at: now() })
  if (db.auditLog.length > 5000) db.auditLog = db.auditLog.slice(-5000)
}

export function publicUser(u) {
  const { password, stripeCustomerId, ...safe } = u
  return safe
}

/** Δημιουργεί/ενημερώνει τον λογαριασμό admin από τα environment variables. */
export async function ensureAdmin() {
  const email = config.admin.email
  const password = config.admin.password || (config.isProd ? '' : 'admin123')
  if (!password) return
  const db = await lock()
  const existing = db.users.find(u => u.email === email)
  if (existing) {
    existing.role = 'admin'
    if (config.admin.password) existing.password = hash(config.admin.password)
  } else {
    db.users.push({ id: 'u_admin', role: 'admin', name: 'MELEO Admin', email, password: hash(password), phone: '', emailVerified: true, acceptedTermsAt: now(), createdAt: now() })
  }
  await commit(db)
}

/** Περιοδικός καθαρισμός σε live server. */
export async function runSweep() {
  const db = await lock()
  sweep(db)
  await commit(db)
}
