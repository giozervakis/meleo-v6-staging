import assert from 'node:assert/strict'
import {
  createBillingService
} from '../server/services/billing.service.js'

const BASIC_PRICE=
  'price_test_basic'

const PREMIUM_PRICE=
  'price_test_premium'

const professional={
  id:'p_test',
  userId:'u_test',
  subscriptionPlan:'basic',
  subscriptionStatus:'pending',
  subscriptionSince:null,
  onboardingStage:'plan',
  pastDueSince:null
}

const depsBase={
  getStripe(){
    return null
  },

  Users:{
    async byId(){
      return {
        id:'u_test',
        email:'test@example.invalid',
        name:'Test'
      }
    },

    async update(){
      throw new Error(
        'Users.update must not be called'
      )
    }
  },

  Notifications:{
    async create(){
      throw new Error(
        'Notification must not be emitted'
      )
    }
  },

  mail:{
    subscriptionActive(){
      throw new Error(
        'Mail must not be emitted'
      )
    },

    paymentFailed(){
      return Promise.resolve()
    }
  },

  async sql(){
    throw new Error(
      'Global sql mutation must not be used'
    )
  },

  async one(){
    return null
  },

  id(prefix){
    return `${prefix}_test`
  },

  now(){
    return '2026-09-01T00:00:00.000Z'
  },

  PLANS:{
    basic:{price:9.99},
    premium:{price:14.99}
  },

  isPlan(plan){
    return (
      plan==='basic' ||
      plan==='premium'
    )
  },

  mapStripeStatus(status){
    return status==='active'
      ? 'active'
      : 'pending'
  },

  priceIdFor(plan){
    return plan==='premium'
      ? PREMIUM_PRICE
      : BASIC_PRICE
  }
}


let txCalls=0

const unknownService=
  createBillingService({
    ...depsBase,

    Professionals:{
      async byUser(){
        return {
          ...professional
        }
      },

      async byId(){
        return {
          ...professional
        }
      },

      async update(){
        throw new Error(
          'Professionals.update must not be called'
        )
      }
    },

    async tx(){
      txCalls++

      throw new Error(
        'Transaction must not start for unknown Stripe Price'
      )
    }
  })


const unknownPriceSubscription={
  id:'sub_unknown',
  status:'active',

  metadata:{
    meleoUserId:'u_test',
    plan:'premium'
  },

  items:{
    data:[
      {
        price:{
          id:'price_attacker_controlled',
          unit_amount:1499
        },

        current_period_end:
          1780000000
      }
    ]
  }
}


await assert.rejects(
  ()=>
    unknownService.applyStripeSubscription(
      unknownPriceSubscription,
      true
    ),

  error=>{
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
  txCalls,
  0,
  'Unknown price must fail before DB transaction'
)

console.log(
  '[PASS] unknown Price ID + metadata premium + 1499 rejected'
)


// ----------------------------------------------------------
// Positive PREMIUM path
// ----------------------------------------------------------

const queries=[]

let finalProfessional={
  ...professional,
  subscriptionPlan:'premium',
  subscriptionPrice:14.99,
  subscriptionStatus:'active',
  featured:true,
  stripeSubscriptionId:'sub_premium',
  currentPeriodEnd:
    new Date(
      1780000000*1000
    ).toISOString(),
  onboardingStage:'profile'
}

const positiveService=
  createBillingService({
    ...depsBase,

    Professionals:{
      async byUser(){
        return {
          ...professional
        }
      },

      async byId(){
        return {
          ...finalProfessional
        }
      },

      async update(){
        throw new Error(
          'Professionals.update split write must not be used'
        )
      }
    },

    async tx(fn){
      txCalls++

      const client={
        async query(query,params=[]){
          queries.push({
            query:String(query),
            params
          })

          if(
            String(query).includes(
              'FROM professionals'
            ) &&
            String(query).includes(
              'FOR UPDATE'
            )
          ){
            return {
              rows:[
                {
                  id:'p_test',
                  user_id:'u_test',
                  subscription_since:null,
                  onboarding_stage:'plan',
                  past_due_since:null
                }
              ]
            }
          }

          return {
            rows:[]
          }
        }
      }

      return fn(client)
    }
  })


const premiumSubscription={
  id:'sub_premium',
  status:'active',

  metadata:{
    meleoUserId:'u_test',
    plan:'basic'
  },

  items:{
    data:[
      {
        price:{
          id:PREMIUM_PRICE,
          unit_amount:1
        },

        current_period_end:
          1780000000
      }
    ]
  }
}


const result=
  await positiveService.applyStripeSubscription(
    premiumSubscription,
    false
  )

assert.equal(
  result.subscriptionPlan,
  'premium'
)

assert.equal(
  result.subscriptionPrice,
  14.99
)

assert.equal(
  result.featured,
  true
)

const professionalWrite=
  queries.find(
    q=>
      /UPDATE\s+professionals/.test(
        q.query
      )
  )

assert.ok(
  professionalWrite,
  'Valid subscription must update professional in transaction'
)

assert.equal(
  professionalWrite.params[1],
  'premium'
)

assert.equal(
  professionalWrite.params[2],
  14.99
)

assert.equal(
  professionalWrite.params[7],
  true
)

const ledgerWrite=
  queries.find(
    q=>
      /INSERT\s+INTO\s+subscriptions/.test(
        q.query
      )
  )

assert.ok(
  ledgerWrite,
  'Valid subscription must update ledger in same transaction'
)

console.log(
  '[PASS] configured PREMIUM Price ID grants PREMIUM regardless of metadata/amount'
)

console.log(
  '[PASS] professional state + subscription ledger use transaction client'
)

console.log(
  'MELEO D10B runtime billing integrity self-test: OK'
)
