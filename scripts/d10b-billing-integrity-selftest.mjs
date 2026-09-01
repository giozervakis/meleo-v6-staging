import assert from 'node:assert/strict'
import fs from 'node:fs'

const payments =
  fs.readFileSync(
    new URL('../server/payments.js', import.meta.url),
    'utf8'
  )

const billing =
  fs.readFileSync(
    new URL(
      '../server/services/billing.service.js',
      import.meta.url
    ),
    'utf8'
  )

const reconciliation =
  fs.readFileSync(
    new URL(
      '../server/stripe-reconciliation.js',
      import.meta.url
    ),
    'utf8'
  )

const app =
  fs.readFileSync(
    new URL(
      '../server/relational/app.js',
      import.meta.url
    ),
    'utf8'
  )

const runtimeBillingSources = [
  ['payments', payments],
  ['billing service', billing],
  ['reconciliation', reconciliation]
]

for (const [name, source] of runtimeBillingSources) {

  assert.equal(
    /amount\s*===\s*1499/.test(source),
    false,
    `${name}: amount 1499 must never select PREMIUM`
  )

  assert.equal(
    /amount\s*===\s*999/.test(source),
    false,
    `${name}: amount 999 must never select BASIC`
  )

  assert.equal(
    source.includes('STRIPE_UNKNOWN_PRICE'),
    true,
    `${name}: unknown Stripe Price ID must fail closed`
  )
}

assert.equal(
  payments.includes(
    'priceId === config.stripe.pricePremium'
  ),
  true,
  'payments: PREMIUM must derive from configured Stripe Price ID'
)

assert.equal(
  payments.includes(
    'priceId === config.stripe.priceBasic'
  ),
  true,
  'payments: BASIC must derive from configured Stripe Price ID'
)

assert.equal(
  billing.includes(
    "priceId===priceIdFor('premium')"
  ),
  true,
  'billing service: PREMIUM must derive from priceIdFor'
)

assert.equal(
  billing.includes(
    "priceId===priceIdFor('basic')"
  ),
  true,
  'billing service: BASIC must derive from priceIdFor'
)

assert.equal(
  app.includes('priceIdFor'),
  true,
  'app: priceIdFor dependency must be wired'
)

assert.equal(
  reconciliation.includes(
    'priceId === config.stripe.pricePremium'
  ),
  true,
  'reconciliation: PREMIUM must derive from configured Price ID'
)

assert.equal(
  reconciliation.includes(
    'priceId === config.stripe.priceBasic'
  ),
  true,
  'reconciliation: BASIC must derive from configured Price ID'
)

/*
 * Metadata may still legitimately carry:
 *   - meleoUserId
 *   - meleoProfessionalId
 *   - plan as Stripe metadata for observability
 *
 * But it MUST NOT be trusted as authoritative subscription-plan
 * resolution in these runtime paths.
 */
assert.equal(
  /return\s+subscription\.metadata\.plan/.test(
    reconciliation
  ),
  false,
  'reconciliation must not trust subscription metadata as plan authority'
)

assert.equal(
  /isPlan\(sub\.metadata\?\.plan\)/.test(
    billing
  ),
  false,
  'billing service must not trust subscription metadata as plan authority'
)

assert.equal(
  /const\s+fromMeta\s*=/.test(
    payments
  ),
  false,
  'payments must not trust metadata before Stripe Price ID'
)

/*
 * Critical regression proof:
 *
 * Presence of unit_amount 1499 or 999 by itself must not
 * establish plan identity anywhere in authoritative runtime code.
 */
for (const [name, source] of runtimeBillingSources) {

  const amountPlanPatterns = [
    /unit_amount[\s\S]{0,120}1499[\s\S]{0,120}premium/i,
    /1499[\s\S]{0,120}premium/i,
    /unit_amount[\s\S]{0,120}999[\s\S]{0,120}basic/i,
    /999[\s\S]{0,120}basic/i
  ]

  for (const pattern of amountPlanPatterns) {
    assert.equal(
      pattern.test(source),
      false,
      `${name}: monetary value must not establish plan identity`
    )
  }
}

console.log(
  'MELEO D10B billing integrity self-test: OK'
)
