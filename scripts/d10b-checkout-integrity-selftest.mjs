import assert from 'node:assert/strict'
import fs from 'node:fs'

const payments =
  fs.readFileSync(
    new URL(
      '../server/payments.js',
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

const routes =
  fs.readFileSync(
    new URL(
      '../server/routes/professional-billing.routes.js',
      import.meta.url
    ),
    'utf8'
  )

const helpers = [
  ['payments', payments],
  ['relational app', app]
]

for (const [name, source] of helpers) {

  assert.equal(
    source.includes(
      'STRIPE_PRICE_NOT_CONFIGURED'
    ),
    true,
    `${name}: missing Price ID must fail closed`
  )

  assert.equal(
    source.includes(
      'STRIPE_INVALID_PLAN'
    ),
    true,
    `${name}: invalid plan must fail closed`
  )

  assert.equal(
    source.includes(
      'price_data:'
    ),
    false,
    `${name}: inline Stripe price_data is forbidden`
  )

  assert.equal(
    source.includes(
      "if(plan==='premium')return config.stripe.pricePremium"
    ) ||
    source.includes(
      "if (plan === 'premium') return config.stripe.pricePremium"
    ),
    true,
    `${name}: PREMIUM must map to configured Price ID`
  )

  assert.equal(
    source.includes(
      "if(plan==='basic')return config.stripe.priceBasic"
    ) ||
    source.includes(
      "if (plan === 'basic') return config.stripe.priceBasic"
    ),
    true,
    `${name}: BASIC must map to configured Price ID`
  )
}

/*
 * The real checkout route must still obtain its subscription
 * line item from the hardened helper.
 */
assert.equal(
  routes.includes(
    'line_items:[lineItemFor(plan)]'
  ),
  true,
  'professional checkout must use hardened lineItemFor'
)

/*
 * Upgrade and downgrade already use configured Stripe Price IDs.
 */
assert.equal(
  routes.includes(
    "const configured=priceIdFor('premium')"
  ),
  true,
  'PREMIUM upgrade must use configured Price ID'
)

assert.equal(
  routes.includes(
    "const configured=priceIdFor('basic')"
  ),
  true,
  'BASIC downgrade must use configured Price ID'
)

/*
 * No subscription code may silently default an invalid plan to BASIC.
 */
assert.equal(
  payments.includes(
    "plan === 'premium' ? config.stripe.pricePremium : config.stripe.priceBasic"
  ),
  false,
  'payments priceIdFor must not default arbitrary plans to BASIC'
)

assert.equal(
  app.includes(
    "plan==='premium'?config.stripe.pricePremium:config.stripe.priceBasic"
  ),
  false,
  'relational priceIdFor must not default arbitrary plans to BASIC'
)

console.log(
  'MELEO D10B checkout integrity self-test: OK'
)
