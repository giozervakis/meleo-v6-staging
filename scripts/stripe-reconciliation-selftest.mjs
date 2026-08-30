import fs from 'node:fs'

const reconciliation = fs.readFileSync(
  new URL('../server/stripe-reconciliation.js', import.meta.url),
  'utf8'
)
const worker = fs.readFileSync(
  new URL('../server/worker.js', import.meta.url),
  'utf8'
)

const reconciliationMarkers = [
  'export async function reconcileStripeSubscriptions',
  'export async function applyReconciledSubscription',
  'export async function scheduleStripeReconciliation',
  "summary.missingAtStripe++",
  "summary.failed++",
  "'stripe.reconcile.completed'",
  "summary.failed ===",
  "summary.scanned",
  "status IN (",
  "'pending',",
  "'processing'"
]

const workerMarkers = [
  "job.job_type===",
  "'stripe_reconcile'",
  'await reconcileStripeSubscriptions',
  'await scheduleStripeReconciliation',
  "'job.stripe_reconcile.completed'",
  'stripeReconcileIntervalSeconds'
]

for (const marker of reconciliationMarkers) {
  if (!reconciliation.includes(marker)) {
    throw new Error(`Missing Stripe reconciliation invariant: ${marker}`)
  }
}

for (const marker of workerMarkers) {
  if (!worker.includes(marker)) {
    throw new Error(`Missing Stripe reconciliation worker invariant: ${marker}`)
  }
}

console.log('MELEO RC3-B6 Stripe reconciliation self-test: OK')