// MELEO — συνδρομές επαγγελματιών μέσω Stripe.
//
// Μοντέλο εσόδων: ΜΟΝΟ μηνιαία συνδρομή επαγγελματία (BASIC / PREMIUM).
// Δεν υπάρχει προμήθεια ή χρέωση ανά επίσκεψη — τα χρήματα της επίσκεψης
// δεν περνούν ποτέ από την πλατφόρμα.
//
// Κάρτα + Google Pay: το Stripe Checkout εμφανίζει αυτόματα Google Pay / Apple Pay
// όταν η συσκευή/browser τα υποστηρίζει και το `card` είναι ενεργό payment method.
// Δεν χρειάζεται ξεχωριστή υλοποίηση wallet.
import Stripe from 'stripe'
import { config } from './config.js'
import { lock, commit, id, now, audit } from './db.js'
import { mail } from './mail.js'

export const PLANS = {
  basic: {
    id: 'basic', name: 'BASIC', price: 9.99, currency: 'EUR', interval: 'month', recommended: false,
    features: ['Δημόσιο επαγγελματικό προφίλ', 'Αιτήματα και διαχείριση κρατήσεων', 'Περιοχή & ακτίνα εξυπηρέτησης', 'Βασικά στατιστικά']
  },
  premium: {
    id: 'premium', name: 'PREMIUM', price: 14.99, currency: 'EUR', interval: 'month', recommended: true,
    features: ['Όλα τα BASIC', 'Σήμανση «Προτεινόμενος»', 'Προτεραιότητα στην κατάταξη αποτελεσμάτων', 'Advanced profile analytics']
  }
}
export const isPlan = p => Object.prototype.hasOwnProperty.call(PLANS, p)

let stripe = null
export function getStripe() {
  if (!config.stripeEnabled) return null
  if (!stripe) stripe = new Stripe(config.stripe.secretKey, { apiVersion: '2025-06-30.basil', maxNetworkRetries: 2, timeout: 20000 })
  return stripe
}

const priceIdFor = plan => (plan === 'premium' ? config.stripe.pricePremium : config.stripe.priceBasic)

/** Line item: σταθερό Price ID αν υπάρχει, διαφορετικά inline τιμή (λειτουργεί χωρίς setup στο Dashboard). */
function lineItemFor(plan) {
  const configured = priceIdFor(plan)
  if (configured) return { price: configured, quantity: 1 }
  const p = PLANS[plan]
  return {
    quantity: 1,
    price_data: {
      currency: 'eur',
      unit_amount: Math.round(p.price * 100),
      recurring: { interval: 'month' },
      product_data: { name: `MELEO Professional ${p.name}`, metadata: { plan } }
    }
  }
}

/** Αντιστοίχιση κατάστασης Stripe → εσωτερική κατάσταση συνδρομής. */
function mapStatus(stripeStatus) {
  switch (stripeStatus) {
    case 'active':
    case 'trialing': return 'active'
    case 'past_due': return 'past_due'
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
    case 'paused': return 'cancelled'
    default: return 'pending'            // incomplete: αναμονή ολοκλήρωσης πληρωμής
  }
}
/** Ένας επαγγελματίας είναι δημόσια ορατός μόνο με ενεργή συνδρομή ΚΑΙ εγκεκριμένη επαλήθευση. */
export const subscriptionAllowsVisibility = (status, professional=null) => {
  if (status === 'active') return true
  if (status !== 'past_due') return false
  const since = professional?.pastDueSince ? new Date(professional.pastDueSince).getTime() : Date.now()
  const graceMs = Math.max(0, config.security.subscriptionGraceDays) * 86400000
  return Date.now() - since <= graceMs
}

function planFromSubscription(sub) {
  const priceId = String(
    sub?.items?.data?.[0]?.price?.id || ''
  )

  if (
    config.stripe.pricePremium &&
    priceId === config.stripe.pricePremium
  ) {
    return 'premium'
  }

  if (
    config.stripe.priceBasic &&
    priceId === config.stripe.priceBasic
  ) {
    return 'basic'
  }

  const error = new Error(
    'Unknown Stripe subscription Price ID'
  )
  error.code = 'STRIPE_UNKNOWN_PRICE'
  error.stripeSubscriptionId = sub?.id || null
  error.stripePriceId = priceId || null
  throw error
}

export async function ensureCustomer(user) {
  const s = getStripe()
  if (!s) return null
  if (user.stripeCustomerId) return user.stripeCustomerId
  const customer = await s.customers.create({
    email: user.email,
    name: user.name,
    phone: user.phone || undefined,
    metadata: { meleoUserId: user.id }
  })
  const db = await lock()
  const u = db.users.find(x => x.id === user.id)
  if (u) u.stripeCustomerId = customer.id
  await commit(db)
  return customer.id
}

/** Δημιουργεί Stripe Checkout Session (κάρτα, Google Pay, Apple Pay) για μηνιαία συνδρομή. */
export async function createCheckoutSession({ user, professional, plan }) {
  const s = getStripe()
  if (!s) throw new Error('Ο πάροχος πληρωμών δεν έχει ρυθμιστεί.')
  const customerId = await ensureCustomer(user)
  const session = await s.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [lineItemFor(plan)],
    payment_method_types: ['card'], // περιλαμβάνει αυτόματα Google Pay / Apple Pay
    locale: 'el',
    allow_promotion_codes: true,
    billing_address_collection: 'required',
    tax_id_collection: config.stripe.collectTaxId ? { enabled: true } : undefined,
    automatic_tax: config.stripe.automaticTax ? { enabled: true } : undefined,
    client_reference_id: user.id,
    subscription_data: { metadata: { plan, meleoUserId: user.id, meleoProfessionalId: professional.id } },
    metadata: { plan, meleoUserId: user.id, meleoProfessionalId: professional.id },
    success_url: `${config.appUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.appUrl}/?checkout=cancel`
  })
  return { url: session.url, sessionId: session.id }
}

/** Εφαρμόζει την κατάσταση μιας συνδρομής Stripe στο προφίλ του επαγγελματία. */
export async function applySubscription(sub, { notify = false } = {}) {
  const db = await lock()
  const userId = sub.metadata?.meleoUserId
  const professional = db.professionals.find(p =>
    (userId && p.userId === userId) ||
    p.stripeSubscriptionId === sub.id ||
    (sub.customer && db.users.find(u => u.id === p.userId)?.stripeCustomerId === sub.customer)
  )
  if (!professional) return null

  const plan = planFromSubscription(sub)
  const status = mapStatus(sub.status)
  const periodEnd = sub.items?.data?.[0]?.current_period_end ?? sub.current_period_end

  professional.subscriptionPlan = plan
  professional.subscriptionPrice = PLANS[plan].price
  professional.subscriptionStatus = status
  professional.stripeStatus = sub.status
  if (status === 'past_due' && !professional.pastDueSince) professional.pastDueSince = now()
  if (status === 'active') professional.pastDueSince = null
  professional.stripeSubscriptionId = sub.id
  professional.billingMode = 'stripe'
  professional.cancelAtPeriodEnd = Boolean(sub.cancel_at_period_end)
  professional.currentPeriodEnd = periodEnd ? new Date(periodEnd * 1000).toISOString() : null
  // Η σήμανση «Προτεινόμενος» είναι εμπορική και ισχύει μόνο με ενεργό PREMIUM.
  professional.featured = plan === 'premium' && subscriptionAllowsVisibility(status, professional)
  if (status === 'active' && !professional.subscriptionSince) professional.subscriptionSince = now()
  if (status === 'active' && (!professional.onboardingStage || professional.onboardingStage === 'plan')) professional.onboardingStage = 'profile'

  const existing = db.subscriptions.find(x => x.stripeSubscriptionId === sub.id)
  const record = {
    id: existing?.id || id('sub'),
    professionalId: professional.id,
    stripeSubscriptionId: sub.id,
    plan, price: PLANS[plan].price, status, stripeStatus: sub.status,
    billingMode: 'stripe',
    startedAt: existing?.startedAt || now(),
    currentPeriodEnd: professional.currentPeriodEnd,
    cancelAtPeriodEnd: professional.cancelAtPeriodEnd,
    updatedAt: now()
  }
  if (existing) Object.assign(existing, record); else db.subscriptions.push(record)

  const user = db.users.find(u => u.id === professional.userId)
  if (notify && status === 'active' && user) {
    db.notifications.push({ id: id('ntf'), userId: user.id, type: 'subscription', title: `Η συνδρομή ${plan.toUpperCase()} είναι ενεργή`, text: `${PLANS[plan].price.toFixed(2)}€/μήνα`, read: false, createdAt: now() })
    mail.subscriptionActive(user.email, user.name, plan.toUpperCase(), PLANS[plan].price.toFixed(2)).catch(() => {})
  }
  audit(db, professional.userId, 'subscription.sync', { plan, status, stripeStatus: sub.status })
  await commit(db)
  return professional
}

/** Fallback μετά την επιστροφή από το Checkout, αν το webhook δεν έχει φτάσει ακόμη. */
export async function syncCheckoutSession(sessionId, user) {
  const s = getStripe()
  if (!s) return null
  const session = await s.checkout.sessions.retrieve(sessionId, { expand: ['subscription', 'subscription.items.data.price'] })
  if (session.client_reference_id && user && session.client_reference_id !== user.id) throw new Error('Η συνεδρία πληρωμής δεν αντιστοιχεί στον λογαριασμό.')
  if (!session.subscription) return null
  const sub = typeof session.subscription === 'string'
    ? await s.subscriptions.retrieve(session.subscription)
    : session.subscription
  return await applySubscription(sub, { notify: true })
}

export async function refreshSubscription(professional) {
  const s = getStripe()
  if (!s || !professional?.stripeSubscriptionId) return null
  const sub = await s.subscriptions.retrieve(professional.stripeSubscriptionId)
  return await applySubscription(sub)
}

/** Πύλη διαχείρισης: αλλαγή κάρτας, ακύρωση, τιμολόγια/αποδείξεις. */
export async function createPortalSession(user) {
  const s = getStripe()
  if (!s) throw new Error('Ο πάροχος πληρωμών δεν έχει ρυθμιστεί.')
  const customerId = await ensureCustomer(user)
  const session = await s.billingPortal.sessions.create({ customer: customerId, return_url: `${config.appUrl}/?billing=return`, locale: 'el' })
  return session.url
}

/** Αλλαγή πακέτου με proration μέσα στην ίδια συνδρομή. */
export async function changePlan(professional, plan) {
  const s = getStripe()
  if (!s || !professional.stripeSubscriptionId) throw new Error('Δεν υπάρχει ενεργή συνδρομή Stripe.')
  const sub = await s.subscriptions.retrieve(professional.stripeSubscriptionId)
  const item = sub.items.data[0]
  const updated = await s.subscriptions.update(sub.id, {
    items: [{ id: item.id, ...lineItemFor(plan) }],
    proration_behavior: 'create_prorations',
    cancel_at_period_end: false,
    metadata: { ...sub.metadata, plan }
  })
  return await applySubscription(updated)
}

export async function cancelSubscription(professional, { immediately = false } = {}) {
  const s = getStripe()
  if (!s || !professional.stripeSubscriptionId) throw new Error('Δεν υπάρχει ενεργή συνδρομή Stripe.')
  const sub = immediately
    ? await s.subscriptions.cancel(professional.stripeSubscriptionId)
    : await s.subscriptions.update(professional.stripeSubscriptionId, { cancel_at_period_end: true })
  return await applySubscription(sub)
}

export async function resumeSubscription(professional) {
  const s = getStripe()
  if (!s || !professional.stripeSubscriptionId) throw new Error('Δεν υπάρχει ενεργή συνδρομή Stripe.')
  const sub = await s.subscriptions.update(professional.stripeSubscriptionId, { cancel_at_period_end: false })
  return await applySubscription(sub)
}

async function recordInvoice(invoice, status) {
  const db = await lock()
  if (db.payments.some(p => p.invoiceId === invoice.id && p.status === status)) return
  const professional = db.professionals.find(p => p.stripeSubscriptionId === (invoice.subscription || invoice.parent?.subscription_details?.subscription))
    || db.professionals.find(p => db.users.find(u => u.id === p.userId)?.stripeCustomerId === invoice.customer)
  db.payments.push({
    id: id('pay'),
    professionalId: professional?.id || null,
    invoiceId: invoice.id,
    amount: (invoice.amount_paid ?? invoice.amount_due ?? 0) / 100,
    currency: (invoice.currency || 'eur').toUpperCase(),
    status,
    provider: 'stripe',
    hostedInvoiceUrl: invoice.hosted_invoice_url || null,
    createdAt: now()
  })
  if (status === 'failed' && professional) {
    const user = db.users.find(u => u.id === professional.userId)
    db.notifications.push({ id: id('ntf'), userId: professional.userId, type: 'billing', title: 'Αποτυχία πληρωμής συνδρομής', text: 'Ενημέρωσε τον τρόπο πληρωμής για να παραμείνει ενεργό το προφίλ σου.', read: false, createdAt: now() })
    if (user) mail.paymentFailed(user.email, user.name).catch(() => {})
  }
  await commit(db)
}

/** Επεξεργασία webhook. Το event έχει ήδη επαληθευτεί με signature στο index.js. */
export async function handleWebhookEvent(event) {
  // Idempotency με πραγματικό lifecycle. Ένα event θεωρείται duplicate μόνο
  // αφού έχει ολοκληρωθεί επιτυχώς. Failed events επιτρέπεται να επαναληφθούν.
  {
    const db = await lock()
    const existing = db.webhookEvents.find(x => (x?.id || x) === event.id)
    if (existing?.status === 'completed') return { duplicate: true }
    if (existing?.status === 'processing' && Date.now() - new Date(existing.lastAttemptAt || existing.at || 0).getTime() < 5*60*1000) return { duplicate: true, processing: true }
    if (existing) {
      existing.status = 'processing'; existing.attempts = Number(existing.attempts || 0) + 1; existing.lastAttemptAt = now(); existing.error = null
    } else {
      db.webhookEvents.push({ id: event.id, type: event.type, status: 'processing', attempts: 1, at: now(), lastAttemptAt: now(), error: null })
    }
    if (db.webhookEvents.length > 2000) db.webhookEvents = db.webhookEvents.slice(-2000)
    await commit(db)
  }

  try {
    const s = getStripe()
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        if (session.mode === 'subscription' && session.subscription) {
          const sub = await s.subscriptions.retrieve(String(session.subscription))
          await applySubscription(sub, { notify: true })
        }
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed': {
        await applySubscription(event.data.object, { notify: event.type === 'customer.subscription.created' })
        break
      }
      case 'invoice.paid':
      case 'invoice.payment_succeeded': await recordInvoice(event.data.object, 'paid'); break
      case 'invoice.payment_failed': await recordInvoice(event.data.object, 'failed'); break
      default: break
    }
    const db = await lock(); const rec = db.webhookEvents.find(x => x.id === event.id)
    if (rec) { rec.status='completed'; rec.completedAt=now(); rec.error=null }
    await commit(db)
    return { handled: true }
  } catch (err) {
    const db = await lock(); const rec = db.webhookEvents.find(x => x.id === event.id)
    if (rec) { rec.status='failed'; rec.error=String(err?.message || err).slice(0,500); rec.failedAt=now() }
    await commit(db)
    throw err
  }
}
