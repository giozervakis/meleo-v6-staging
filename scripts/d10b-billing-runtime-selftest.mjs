import assert from 'node:assert/strict'
import {
  createBillingService
} from '../server/services/billing.service.js'

const BASIC_PRICE =
  'price_test_basic'

const PREMIUM_PRICE =
  'price_test_premium'

const professional = {
  id: 'p_test',
  userId: 'u_test',
  subscriptionPlan: 'basic',
  subscriptionStatus: 'pending',
  subscriptionSince: null,
  onboardingStage: 'plan',
  pastDueSince: null
}

let updateCalls = 0
let sqlCalls = 0

const service =
  createBillingService({
    getStripe() {
      return null
    },

    Users: {
      async byId() {
        return {
          id: 'u_test',
          email: 'test@example.invalid',
          name: 'Test'
        }
      },

      async update() {
        throw new Error(
          'Users.update must not be called'
        )
      }
    },

    Professionals: {
      async byUser(id) {
        assert.equal(id, 'u_test')
        return {
          ...professional
        }
      },

      async update() {
        updateCalls++
        throw new Error(
          'Professional state must not mutate for unknown Stripe Price'
        )
      }
    },

    Notifications: {
      async create() {
        throw new Error(
          'Notification must not be emitted'
        )
      }
    },

    mail: {
      subscriptionActive() {
        throw new Error(
          'Mail must not be emitted'
        )
      }
    },

    async sql() {
      sqlCalls++
      throw new Error(
        'DB write must not happen'
      )
    },

    async one(query) {
      if (
        String(query).includes(
          'last_stripe_event_created'
        )
      ) {
        return null
      }

      return null
    },

    id(prefix) {
      return `${prefix}_test`
    },

    now() {
      return '2026-09-01T00:00:00.000Z'
    },

    PLANS: {
      basic: {
        price: 9.99
      },

      premium: {
        price: 14.99
      }
    },

    isPlan(plan) {
      return (
        plan === 'basic' ||
        plan === 'premium'
      )
    },

    mapStripeStatus(status) {
      return status === 'active'
        ? 'active'
        : 'pending'
    },

    priceIdFor(plan) {
      return plan === 'premium'
        ? PREMIUM_PRICE
        : BASIC_PRICE
    }
  })

const unknownPriceSubscription = {
  id: 'sub_unknown',
  status: 'active',

  metadata: {
    meleoUserId: 'u_test',

    /*
     * Deliberately malicious/conflicting metadata.
     * This must NOT grant PREMIUM.
     */
    plan: 'premium'
  },

  items: {
    data: [
      {
        price: {
          id: 'price_attacker_controlled',

          /*
           * Deliberately equal to PREMIUM monetary price.
           * This must NOT grant PREMIUM.
           */
          unit_amount: 1499
        },

        current_period_end:
          1780000000
      }
    ]
  }
}

await assert.rejects(
  () =>
    service.applyStripeSubscription(
      unknownPriceSubscription,
      true
    ),

  error => {
    assert.equal(
      error?.code,
      'STRIPE_UNKNOWN_PRICE'
    )

    assert.equal(
      error?.stripeSubscriptionId,
      'sub_unknown'
    )

    assert.equal(
      error?.stripePriceId,
      'price_attacker_controlled'
    )

    return true
  }
)

assert.equal(
  updateCalls,
  0,
  'Professional must not mutate'
)

assert.equal(
  sqlCalls,
  0,
  'Subscription ledger must not mutate'
)

console.log(
  '[PASS] unknown Price ID + metadata premium + 1499 rejected'
)


const premiumSubscription = {
  id: 'sub_premium',
  status: 'active',

  metadata: {
    meleoUserId: 'u_test',

    /*
     * Deliberately conflicting metadata.
     * Price ID must win.
     */
    plan: 'basic'
  },

  items: {
    data: [
      {
        price: {
          id: PREMIUM_PRICE,
          unit_amount: 1
        },

        current_period_end:
          1780000000
      }
    ]
  }
}

/*
 * Fresh service with writable mocks
 * for the valid-price positive case.
 */
let premiumPatch = null
let premiumLedger = null

const positiveService =
  createBillingService({
    getStripe() {
      return null
    },

    Users: {
      async byId() {
        return {
          id: 'u_test',
          email: 'test@example.invalid',
          name: 'Test'
        }
      },

      async update() {}
    },

    Professionals: {
      async byUser() {
        return {
          ...professional
        }
      },

      async update(id, patch) {
        premiumPatch = {
          id,
          ...patch
        }

        return {
          ...professional,
          ...patch
        }
      }
    },

    Notifications: {
      async create() {}
    },

    mail: {
      subscriptionActive() {
        return Promise.resolve()
      }
    },

    async sql(query, params) {
      premiumLedger = {
        query,
        params
      }
    },

    async one(query) {
      if (
        String(query).includes(
          'last_stripe_event_created'
        )
      ) {
        return null
      }

      return null
    },

    id(prefix) {
      return `${prefix}_test`
    },

    now() {
      return '2026-09-01T00:00:00.000Z'
    },

    PLANS: {
      basic: {
        price: 9.99
      },

      premium: {
        price: 14.99
      }
    },

    isPlan(plan) {
      return (
        plan === 'basic' ||
        plan === 'premium'
      )
    },

    mapStripeStatus(status) {
      return status === 'active'
        ? 'active'
        : 'pending'
    },

    priceIdFor(plan) {
      return plan === 'premium'
        ? PREMIUM_PRICE
        : BASIC_PRICE
    }
  })

await positiveService.applyStripeSubscription(
  premiumSubscription,
  false
)

assert.equal(
  premiumPatch?.subscriptionPlan,
  'premium'
)

assert.equal(
  premiumPatch?.subscriptionPrice,
  14.99
)

assert.equal(
  premiumPatch?.featured,
  true
)

assert.ok(
  premiumLedger,
  'Valid Stripe subscription must update ledger'
)

console.log(
  '[PASS] configured PREMIUM Price ID grants PREMIUM regardless of metadata/amount'
)

console.log(
  'MELEO D10B runtime billing integrity self-test: OK'
)
