// MELEO — κεντρική διαχείριση ρυθμίσεων & έλεγχοι ασφαλείας κατά την εκκίνηση.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const root = path.resolve(__dirname, '..')

// Φόρτωση .env (Node >= 20.12) χωρίς εξωτερική εξάρτηση.
try {
  const envFile = path.join(root, '.env')
  if (fs.existsSync(envFile) && typeof process.loadEnvFile === 'function') process.loadEnvFile(envFile)
} catch { /* το .env είναι προαιρετικό */ }

const bool = (v, dflt = false) => (v == null || v === '' ? dflt : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase()))

const NODE_ENV = process.env.NODE_ENV || 'development'
const isProd = NODE_ENV === 'production'
const isStaging = NODE_ENV === 'staging'
const isHosted = isProd || isStaging

export const config = {
  env: NODE_ENV,
  isProd,
  isStaging,
  isHosted,
  port: Number(process.env.PORT || 8787),
  appUrl: (process.env.APP_URL || (process.env.RENDER_EXTERNAL_HOSTNAME ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` : `http://localhost:5173`)).replace(/\/+$/, ''),
  trustProxy: bool(process.env.TRUST_PROXY, isHosted),
  dataDir: process.env.DATA_DIR || path.join(root, 'data'),

  // ----- Βάση δεδομένων -----
  // Με DATABASE_URL χρησιμοποιείται PostgreSQL (υποχρεωτικό σε production).
  // Χωρίς αυτό, πέφτουμε σε τοπικό JSON αρχείο μόνο για development.
  databaseUrl: process.env.DATABASE_URL || '',
  databaseSsl: bool(process.env.DATABASE_SSL, false),
  databasePoolMax: Number(process.env.DATABASE_POOL_MAX || 10),

  // ----- Redis (shared cache / rate limiting for multi-instance deployment) -----
  redis: {
    url: process.env.REDIS_URL || '',
    required: bool(process.env.REDIS_REQUIRED, isProd || isStaging),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'meleo:v51:',
    connectTimeoutMs: Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 2500)
  },

  // ----- Observability / worker -----
  observability: {
    metricsToken: process.env.OBSERVABILITY_TOKEN || '',
    slowRequestMs: Number(process.env.SLOW_REQUEST_MS || 1000)
  },

  // ----- Verification document object storage -----
  // development: local encrypted files, production v5.3: private S3-compatible bucket.
  storage: {
    driver: (process.env.STORAGE_DRIVER || (isProd ? 's3' : 'local')).toLowerCase(),
    endpoint: (process.env.S3_ENDPOINT || '').replace(/\/+$/, ''),
    region: process.env.S3_REGION || 'eu-central-1',
    bucket: process.env.S3_BUCKET || '',
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    signedUrlTtlSeconds: Math.min(300, Math.max(30, Number(process.env.SIGNED_DOCUMENT_URL_TTL_SECONDS || 120))),
    signedUrlMaxTtlSeconds: 300
  },

  // ----- Πληρωμές (Stripe) -----
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    priceBasic: process.env.STRIPE_PRICE_BASIC || '',
    pricePremium: process.env.STRIPE_PRICE_PREMIUM || '',
    automaticTax: bool(process.env.STRIPE_AUTOMATIC_TAX, false),
    collectTaxId: bool(process.env.STRIPE_COLLECT_TAX_ID, true),
    portalEnabled: bool(process.env.STRIPE_PORTAL_ENABLED, true)
  },

  // ----- Email -----
  mail: {
    resendKey: process.env.RESEND_API_KEY || '',
    from: process.env.MAIL_FROM || 'MELEO <no-reply@meleo.gr>',
    supportEmail: process.env.SUPPORT_EMAIL || 'support@meleo.gr'
  },

  // ----- Admin -----
  admin: {
    email: (process.env.ADMIN_EMAIL || 'admin@meleo.gr').toLowerCase(),
    password: process.env.ADMIN_PASSWORD || '',
    totpSecret: process.env.ADMIN_TOTP_SECRET || '',
    ipAllowlist: String(process.env.ADMIN_IP_ALLOWLIST || '').split(',').map(x=>x.trim()).filter(Boolean),
    sessionTtlHours: Math.min(24, Math.max(1, Number(process.env.ADMIN_SESSION_TTL_HOURS || 8))),
    bindUserAgent: bool(process.env.ADMIN_BIND_USER_AGENT, true)
  },

  // ----- Λειτουργικές σημαίες -----
  seedDemo: bool(process.env.SEED_DEMO, !isProd),
  demoAuth: bool(process.env.DEMO_AUTH, !isProd),
  demoCheckout: bool(process.env.DEMO_CHECKOUT, !isProd),

  // E2E test mode. It may be enabled in development/staging only.
  // Production readiness validation hard-fails if E2E_MODE is enabled.
  e2eMode: bool(process.env.E2E_MODE, false),

  // ----- Νομικά -----
  legal: {
    company: process.env.LEGAL_COMPANY_NAME || '',
    vatNumber: process.env.LEGAL_VAT_NUMBER || '',
    address: process.env.LEGAL_ADDRESS || '',
    termsVersion: process.env.TERMS_VERSION || '2026-08-17',
    dpoEmail: process.env.DPO_EMAIL || process.env.SUPPORT_EMAIL || 'privacy@meleo.gr'
  },

  security: {
    sensitiveDataKey: process.env.SENSITIVE_DATA_KEY || '',
    verificationStorageDir: process.env.VERIFICATION_STORAGE_DIR || path.join(root, 'secure_uploads'),
    subscriptionGraceDays: Number(process.env.SUBSCRIPTION_GRACE_DAYS || 3)
  },

  // Γενικός αριθμός επείγουσας ανάγκης (ισχύει σε όλη την ΕΕ).
  emergencyNumber: process.env.EMERGENCY_NUMBER || '112'
}

config.databaseDriver = config.databaseUrl ? 'postgres' : 'json'
config.stripeEnabled = Boolean(config.stripe.secretKey)
config.mailEnabled = Boolean(config.mail.resendKey)
// Το demo checkout δεν επιτρέπεται ΠΟΤΕ σε production.
config.demoCheckout = config.demoCheckout && !isProd
config.demoAuth = config.demoAuth && !isProd
config.seedDemo = config.seedDemo && !isProd

/**
 * Σκληροί έλεγχοι πριν ανοίξει η πλατφόρμα στο κοινό.
 * Σε production, λείπουσες κρίσιμες ρυθμίσεις ΣΤΑΜΑΤΟΥΝ την εκκίνηση
 * αντί να αφήσουν την εφαρμογή να τρέξει σε ανασφαλή κατάσταση.
 */
export function assertProductionReady() {
  const fatal = []
  const warn = []

  if (config.isProd) {
    if (config.e2eMode) fatal.push('E2E_MODE must NEVER be enabled in production.')
    if (bool(process.env.SEED_DEMO, false)) fatal.push('SEED_DEMO must NEVER be enabled in production.')
    if (bool(process.env.DEMO_AUTH, false)) fatal.push('DEMO_AUTH must NEVER be enabled in production.')
    if (bool(process.env.DEMO_CHECKOUT, false)) fatal.push('DEMO_CHECKOUT must NEVER be enabled in production.')
    if (String(process.env.PAYMENTS_MODE || '').trim().toLowerCase() === 'demo') fatal.push('PAYMENTS_MODE=demo is forbidden in production.')
    if (!config.appUrl.startsWith('https://')) fatal.push('APP_URL: απαιτείται δημόσιο https URL (π.χ. https://meleo.gr).')
    if (!config.databaseUrl) fatal.push('DATABASE_URL: σε production απαιτείται PostgreSQL. Ο JSON driver δεν υποστηρίζεται (δεν αντέχει πολλά instances ούτε ασφαλή backups).')
    if (config.redis.required && !config.redis.url) fatal.push('REDIS_URL: απαιτείται στο production v5.1 για shared rate limiting/cache μεταξύ πολλαπλών instances.')
    if (!config.redis.url) warn.push('REDIS_URL: δεν έχει οριστεί — θα χρησιμοποιηθεί PostgreSQL fallback για rate limiting/cache.')
    if (!config.stripe.secretKey) fatal.push('STRIPE_SECRET_KEY: χωρίς αυτό δεν μπορεί να γίνει καμία πραγματική χρέωση.')
    if (config.stripe.secretKey.startsWith('sk_test')) warn.push('STRIPE_SECRET_KEY: χρησιμοποιείται TEST key σε production — δεν θα εισπραχθούν πραγματικά χρήματα.')
    if (!config.stripe.webhookSecret) fatal.push('STRIPE_WEBHOOK_SECRET: χωρίς επαλήθευση webhook οι συνδρομές δεν ενημερώνονται αξιόπιστα.')
    if (!config.admin.password || config.admin.password.length < 12) fatal.push('ADMIN_PASSWORD: απαιτείται ισχυρός κωδικός (>= 12 χαρακτήρες) για τον λογαριασμό admin.')
    if (!config.admin.totpSecret || config.admin.totpSecret.length < 16) fatal.push('ADMIN_TOTP_SECRET: απαιτείται TOTP secret για 2FA του Admin.')
    if (!config.admin.ipAllowlist.length) warn.push('ADMIN_IP_ALLOWLIST: δεν έχει οριστεί. Το admin παραμένει προστατευμένο με TOTP + throttling, αλλά χωρίς IP restriction.')
    if (!config.security.sensitiveDataKey || config.security.sensitiveDataKey.length < 32) fatal.push('SENSITIVE_DATA_KEY: απαιτείται μυστικό >=32 χαρακτήρων για κρυπτογράφηση ευαίσθητων πεδίων.')
    if (config.storage.driver !== 's3') fatal.push('STORAGE_DRIVER: στο production v5.3 απαιτείται s3 για shared private verification-document storage.')
    if (config.storage.driver === 's3' && (!config.storage.endpoint || !config.storage.bucket || !config.storage.accessKeyId || !config.storage.secretAccessKey)) fatal.push('S3_ENDPOINT/S3_BUCKET/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY: απαιτούνται όλα για object storage.')
    if (!config.observability.metricsToken) warn.push('OBSERVABILITY_TOKEN: /api/metrics θα παραμένει κλειστό σε production χωρίς token.')
    if (!config.mail.resendKey) warn.push('RESEND_API_KEY: δεν στέλνονται emails (επιβεβαίωση, reset κωδικού, ειδοποιήσεις).')
    if (!config.legal.company || !config.legal.vatNumber) warn.push('LEGAL_COMPANY_NAME / LEGAL_VAT_NUMBER: απαιτούνται στοιχεία παρόχου στους Όρους Χρήσης (ν. ηλεκτρονικού εμπορίου).')
    if (!config.stripe.priceBasic || !config.stripe.pricePremium) warn.push('STRIPE_PRICE_BASIC / STRIPE_PRICE_PREMIUM: χωρίς σταθερά Price IDs δημιουργούνται inline τιμές — δουλεύει, αλλά δυσκολεύει τα reports στο Stripe.')
    if (!config.stripe.automaticTax) warn.push('STRIPE_AUTOMATIC_TAX=false: ο ΦΠΑ δεν υπολογίζεται αυτόματα. Επιβεβαίωσε τη φορολογική μεταχείριση με τον λογιστή σου.')
  }

  if (warn.length) console.warn('\n[MELEO] Προειδοποιήσεις εκκίνησης:\n' + warn.map(x => '  ! ' + x).join('\n'))
  if (fatal.length) {
    console.error('\n[MELEO] Η εκκίνηση σε production ΣΤΑΜΑΤΗΣΕ. Λείπουν κρίσιμες ρυθμίσεις:\n' + fatal.map(x => '  ✗ ' + x).join('\n') + '\n')
    process.exit(1)
  }
}
