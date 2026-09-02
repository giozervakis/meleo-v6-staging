import crypto from 'node:crypto'
import pg from 'pg'

const sourceDatabaseUrl =
  String(
    process.env.DATABASE_URL ||
    ''
  ).trim()

if(!sourceDatabaseUrl){
  throw new Error(
    'DATABASE_URL is required for D10F.5'
  )
}

if(
  String(
    process.env.NODE_ENV ||
    ''
  ).toLowerCase()==='production'
){
  throw new Error(
    'D10F.5 refuses NODE_ENV=production'
  )
}


const sourceUrl =
  new URL(
    sourceDatabaseUrl
  )

const allowedHosts =
  new Set([
    '127.0.0.1',
    'localhost',
    'db'
  ])

if(
  !allowedHosts.has(
    sourceUrl.hostname
  )
){
  throw new Error(
    `D10F.5 refuses non-local PostgreSQL host: ${sourceUrl.hostname}`
  )
}


const databaseName =
  'meleo_d10f5_' +
  crypto
    .randomUUID()
    .replace(/-/g,'')


function databaseUrl(name){

  const url =
    new URL(
      sourceDatabaseUrl
    )

  url.pathname =
    `/${name}`

  return url.toString()
}


const maintenanceUrl =
  databaseUrl(
    'postgres'
  )

const isolatedUrl =
  databaseUrl(
    databaseName
  )


function check(
  condition,
  message,
  detail=''
){

  if(!condition){

    throw new Error(
      '[FAIL] ' +
      message +
      (
        detail
          ? ` — ${detail}`
          : ''
      )
    )
  }

  console.log(
    `[PASS] ${message}`
  )
}


async function withClient(
  connectionString,
  fn
){

  const client =
    new pg.Client({
      connectionString
    })

  await client.connect()

  try{
    return await fn(
      client
    )
  }
  finally{
    await client.end()
  }
}


async function admin(fn){

  return withClient(
    maintenanceUrl,
    fn
  )
}


async function createDatabase(){

  await admin(
    client =>
      client.query(
        `CREATE DATABASE "${databaseName}"`
      )
  )

  console.log(
    '[PASS] isolated D10F.5 PostgreSQL database created'
  )
}


async function dropDatabase(){

  await admin(
    async client => {

      await client.query(
        `
          SELECT
            pg_terminate_backend(pid)

          FROM pg_stat_activity

          WHERE
            datname=$1
            AND pid<>pg_backend_pid()
        `,
        [
          databaseName
        ]
      )

      await client.query(
        `DROP DATABASE IF EXISTS "${databaseName}"`
      )
    }
  )

  const exists =
    await admin(
      async client => {

        const result =
          await client.query(
            `
              SELECT 1
              FROM pg_database
              WHERE datname=$1
            `,
            [
              databaseName
            ]
          )

        return result.rowCount>0
      }
    )

  check(
    !exists,
    'isolated D10F.5 database cleanup verified'
  )
}


const suffix =
  crypto
    .randomUUID()
    .replace(/-/g,'')

const professionalUserId =
  `d10f5_user_${suffix}`

const professionalId =
  `d10f5_pro_${suffix}`

const stripeCustomerId =
  `cus_d10f5_${suffix}`

const stripeSubscriptionId =
  `sub_d10f5_${suffix}`

const invoiceId =
  `in_d10f5_${suffix}`


let closePool =
  null

let sql =
  null

let one =
  null

let tx =
  null

let migrate =
  null

let id =
  null

let now =
  null


try{

  await createDatabase()

  /*
   * Production modules must bind to the isolated database.
   */
  process.env.DATABASE_URL =
    isolatedUrl

  process.env.DATABASE_SSL =
    '0'

  process.env.DATABASE_POOL_MAX =
    '8'

  process.env.NODE_ENV =
    'test'

  process.env.REDIS_URL =
    ''

  process.env.REDIS_REQUIRED =
    '0'

  process.env.SENSITIVE_DATA_KEY =
    crypto
      .randomBytes(32)
      .toString('hex')


  const poolModule =
    await import(
      '../../server/relational/pool.js'
    )

  ;({
    sql,
    one,
    tx,
    migrate,
    closePool,
    id,
    now
  } = poolModule)


  const repositories =
    await import(
      '../../server/relational/repositories.js'
    )

  const {
    Users,
    Professionals,
    Notifications
  } = repositories


  const {
    createBillingService
  } =
    await import(
      '../../server/services/billing.service.js'
    )


  check(
    typeof createBillingService===
      'function',
    'production billing service loaded'
  )


  await migrate()

  check(
    true,
    'production migrations completed on isolated database'
  )


  /*
   * ----------------------------------------------------------
   * Deterministic production-shaped fixture.
   * ----------------------------------------------------------
   */

  await sql(
    `
      INSERT INTO users(
        id,
        role,
        name,
        email,
        phone,
        password_hash,
        email_verified,
        accepted_terms_at
      )
      VALUES(
        $1,
        'professional',
        'D10F5 Professional',
        $2,
        '',
        'd10f5-non-login-hash',
        true,
        now()
      )
    `,
    [
      professionalUserId,
      `${professionalUserId}@test.invalid`
    ]
  )


  await sql(
    `
      INSERT INTO professionals(
        id,
        user_id,
        title,
        specialty,
        verified,
        subscription_status,
        subscription_plan,
        subscription_price,
        billing_mode,
        onboarding_completed,
        onboarding_stage
      )
      VALUES(
        $1,
        $2,
        'D10F5 Professional',
        'Νοσηλευτική',
        true,
        'pending',
        'basic',
        9.99,
        'stripe',
        true,
        'profile'
      )
    `,
    [
      professionalId,
      professionalUserId
    ]
  )


  check(
    true,
    'billing fixture created'
  )


  /*
   * ----------------------------------------------------------
   * Deterministic fake Stripe boundary.
   *
   * This fake proves Stripe contract semantics without performing
   * any network request or requiring Stripe credentials.
   * ----------------------------------------------------------
   */

  const stripeCalls = {
    customerCreate:0,
    customerCreateOptions:[]
  }


  const fakeStripe = {

    customers:{

      async create(
        payload,
        options
      ){

        stripeCalls.customerCreate++

        stripeCalls
          .customerCreateOptions
          .push({
            payload,
            options
          })

        return {
          id:
            stripeCustomerId
        }
      }
    }
  }


  const mailCalls = {
    subscriptionActive:0,
    paymentFailed:0
  }


  const fakeMail = {

    subscriptionActive(){

      mailCalls.subscriptionActive++

      return Promise.resolve()
    },

    paymentFailed(){

      mailCalls.paymentFailed++

      return Promise.resolve()
    }
  }


  const PLANS = {
    basic:{
      price:9.99
    },

    premium:{
      price:14.99
    }
  }


  function isPlan(value){

    return (
      value==='basic' ||
      value==='premium'
    )
  }


  function priceIdFor(plan){

    if(plan==='basic'){
      return 'price_d10f5_basic'
    }

    if(plan==='premium'){
      return 'price_d10f5_premium'
    }

    return null
  }


  function mapStripeStatus(status){

    if(
      status==='active' ||
      status==='trialing'
    ){
      return 'active'
    }

    if(status==='past_due'){
      return 'past_due'
    }

    if(
      [
        'canceled',
        'unpaid',
        'incomplete_expired',
        'paused'
      ].includes(
        status
      )
    ){
      return 'cancelled'
    }

    return 'pending'
  }


  const billing =
    createBillingService({
      getStripe:
        ()=>fakeStripe,

      Users,
      Professionals,
      Notifications,
      mail:
        fakeMail,

      sql,
      one,
      tx,
      id,
      now,

      PLANS,
      isPlan,
      mapStripeStatus,
      priceIdFor
    })


  check(
    typeof billing.ensureStripeCustomer===
      'function' &&
    typeof billing.applyStripeSubscription===
      'function' &&
    typeof billing.recordInvoice===
      'function',
    'canonical billing contracts are available'
  )


  // ==========================================================
  // A. STRIPE CUSTOMER IDEMPOTENCY CONTRACT
  // ==========================================================

  console.log('')
  console.log(
    'D10F.5.A — Stripe customer idempotency'
  )


  const userBefore =
    await one(
      `
        SELECT *
        FROM users
        WHERE id=$1
      `,
      [
        professionalUserId
      ]
    )


  const customerFirst =
    await billing.ensureStripeCustomer(
      userBefore
    )


  check(
    customerFirst===
      stripeCustomerId,
    'first customer provisioning returns fake Stripe customer'
  )


  check(
    stripeCalls.customerCreate===1,
    'first provisioning performs exactly one Stripe customer create'
  )


  check(
    stripeCalls
      .customerCreateOptions?.[0]
      ?.options
      ?.idempotencyKey===
      `meleo.customer.${professionalUserId}`,
    'Stripe customer uses deterministic per-user idempotency key'
  )


  const persistedCustomer =
    await one(
      `
        SELECT
          stripe_customer_id

        FROM users

        WHERE id=$1
      `,
      [
        professionalUserId
      ]
    )


  check(
    persistedCustomer?.stripe_customer_id===
      stripeCustomerId,
    'Stripe customer id is persisted locally'
  )


  const userAfter =
    await one(
      `
        SELECT *
        FROM users
        WHERE id=$1
      `,
      [
        professionalUserId
      ]
    )


  const customerSecond =
    await billing.ensureStripeCustomer(
      userAfter
    )


  check(
    customerSecond===
      stripeCustomerId,
    'repeat provisioning reuses persisted Stripe customer'
  )


  check(
    stripeCalls.customerCreate===1,
    'repeat provisioning performs no second Stripe create'
  )


  // ==========================================================
  // B. AUTHORITATIVE WEBHOOK ORDERING
  // ==========================================================

  console.log('')
  console.log(
    'D10F.5.B — subscription webhook ordering'
  )


  function stripeSubscription({
    plan,
    status,
    periodEnd,
    cancelAtPeriodEnd=false
  }){

    return {
      id:
        stripeSubscriptionId,

      status,

      cancel_at_period_end:
        cancelAtPeriodEnd,

      metadata:{
        meleoUserId:
          professionalUserId
      },

      items:{
        data:[
          {
            price:{
              id:
                priceIdFor(
                  plan
                )
            },

            current_period_end:
              periodEnd
          }
        ]
      }
    }
  }


  const newEventSubscription =
    stripeSubscription({
      plan:'premium',
      status:'active',
      periodEnd:4102444800
    })


  await billing.applyStripeSubscription(
    newEventSubscription,
    true,
    {
      eventCreated:200,
      eventId:'evt_d10f5_new'
    }
  )


  const authoritativeProfessional =
    await one(
      `
        SELECT
          subscription_plan,
          subscription_status,
          stripe_subscription_id,
          featured

        FROM professionals

        WHERE id=$1
      `,
      [
        professionalId
      ]
    )


  check(
    authoritativeProfessional
      ?.subscription_plan===
      'premium' &&
    authoritativeProfessional
      ?.subscription_status===
      'active' &&
    authoritativeProfessional
      ?.stripe_subscription_id===
      stripeSubscriptionId &&
    authoritativeProfessional
      ?.featured===
      true,
    'newer Stripe subscription state becomes authoritative'
  )


  const authoritativeLedger =
    await one(
      `
        SELECT
          plan,
          status,
          last_stripe_event_created,
          last_stripe_event_id

        FROM subscriptions

        WHERE stripe_subscription_id=$1
      `,
      [
        stripeSubscriptionId
      ]
    )


  check(
    authoritativeLedger?.plan===
      'premium' &&
    authoritativeLedger?.status===
      'active' &&
    Number(
      authoritativeLedger
        ?.last_stripe_event_created
    )===200 &&
    authoritativeLedger
      ?.last_stripe_event_id===
      'evt_d10f5_new',
    'subscription ledger records authoritative Stripe event'
  )


  /*
   * Deliver a strictly older event after the newer event.
   * It must not overwrite current local state.
   */
  const staleSubscription =
    stripeSubscription({
      plan:'basic',
      status:'past_due',
      periodEnd:4100000000
    })


  await billing.applyStripeSubscription(
    staleSubscription,
    true,
    {
      eventCreated:100,
      eventId:'evt_d10f5_stale'
    }
  )


  const afterStale =
    await one(
      `
        SELECT
          subscription_plan,
          subscription_status,
          featured

        FROM professionals

        WHERE id=$1
      `,
      [
        professionalId
      ]
    )


  check(
    afterStale?.subscription_plan===
      'premium' &&
    afterStale?.subscription_status===
      'active' &&
    afterStale?.featured===
      true,
    'older Stripe event cannot overwrite newer subscription state'
  )


  const ledgerAfterStale =
    await one(
      `
        SELECT
          plan,
          status,
          last_stripe_event_created,
          last_stripe_event_id

        FROM subscriptions

        WHERE stripe_subscription_id=$1
      `,
      [
        stripeSubscriptionId
      ]
    )


  check(
    ledgerAfterStale?.plan===
      'premium' &&
    ledgerAfterStale?.status===
      'active' &&
    Number(
      ledgerAfterStale
        ?.last_stripe_event_created
    )===200 &&
    ledgerAfterStale
      ?.last_stripe_event_id===
      'evt_d10f5_new',
    'stale event leaves ordering ledger unchanged'
  )


  // ==========================================================
  // C. DUPLICATE EVENT IDEMPOTENCY
  // ==========================================================

  console.log('')
  console.log(
    'D10F.5.C — duplicate event idempotency'
  )


  const subscriptionNotificationsBefore =
    await one(
      `
        SELECT
          count(*)::int count

        FROM notifications

        WHERE
          user_id=$1
          AND type='subscription'
      `,
      [
        professionalUserId
      ]
    )


  const mailBeforeDuplicate =
    mailCalls.subscriptionActive


  await billing.applyStripeSubscription(
    newEventSubscription,
    true,
    {
      eventCreated:200,
      eventId:'evt_d10f5_new'
    }
  )


  const subscriptionNotificationsAfter =
    await one(
      `
        SELECT
          count(*)::int count

        FROM notifications

        WHERE
          user_id=$1
          AND type='subscription'
      `,
      [
        professionalUserId
      ]
    )


  check(
    Number(
      subscriptionNotificationsAfter
        ?.count ||
      0
    )===
    Number(
      subscriptionNotificationsBefore
        ?.count ||
      0
    ),
    'duplicate Stripe event creates no second durable notification'
  )


  check(
    mailCalls.subscriptionActive===
      mailBeforeDuplicate,
    'duplicate Stripe event sends no second activation mail'
  )


  // ==========================================================
  // D. SUBSCRIPTION TRANSACTION ROLLBACK
  // ==========================================================

  console.log('')
  console.log(
    'D10F.5.D — subscription local atomic rollback'
  )


  const notificationsBeforeRollback =
    await one(
      `
        SELECT
          count(*)::int count

        FROM notifications

        WHERE
          user_id=$1
          AND type='subscription'
      `,
      [
        professionalUserId
      ]
    )


  let rollbackError =
    null


  try{

    await billing.applyStripeSubscription(
      stripeSubscription({
        plan:'basic',
        status:'active',
        periodEnd:4200000000
      }),
      true,
      {
        eventCreated:300,
        eventId:'evt_d10f5_rollback'
      },
      async ()=>{
        throw new Error(
          'D10F5_INJECTED_LOCAL_MUTATION_FAILURE'
        )
      }
    )

  }
  catch(error){

    rollbackError =
      error
  }


  check(
    rollbackError?.message===
      'D10F5_INJECTED_LOCAL_MUTATION_FAILURE',
    'injected local billing mutation failure is observed'
  )


  const professionalAfterRollback =
    await one(
      `
        SELECT
          subscription_plan,
          subscription_status,
          featured

        FROM professionals

        WHERE id=$1
      `,
      [
        professionalId
      ]
    )


  check(
    professionalAfterRollback
      ?.subscription_plan===
      'premium' &&
    professionalAfterRollback
      ?.subscription_status===
      'active' &&
    professionalAfterRollback
      ?.featured===
      true,
    'subscription state rolls back when caller local mutation fails'
  )


  const ledgerAfterRollback =
    await one(
      `
        SELECT
          plan,
          status,
          last_stripe_event_created,
          last_stripe_event_id

        FROM subscriptions

        WHERE stripe_subscription_id=$1
      `,
      [
        stripeSubscriptionId
      ]
    )


  check(
    ledgerAfterRollback?.plan===
      'premium' &&
    ledgerAfterRollback?.status===
      'active' &&
    Number(
      ledgerAfterRollback
        ?.last_stripe_event_created
    )===200 &&
    ledgerAfterRollback
      ?.last_stripe_event_id===
      'evt_d10f5_new',
    'subscription ledger rolls back with professional state'
  )


  const notificationsAfterRollback =
    await one(
      `
        SELECT
          count(*)::int count

        FROM notifications

        WHERE
          user_id=$1
          AND type='subscription'
      `,
      [
        professionalUserId
      ]
    )


  check(
    Number(
      notificationsAfterRollback
        ?.count ||
      0
    )===
    Number(
      notificationsBeforeRollback
        ?.count ||
      0
    ),
    'rolled-back subscription mutation leaves no durable notification'
  )


  // ==========================================================
  // E. INVOICE PAID / FAILED AUTHORITY
  // ==========================================================

  console.log('')
  console.log(
    'D10F.5.E — invoice paid/failed ordering'
  )


  const invoice = {
    id:
      invoiceId,

    subscription:
      stripeSubscriptionId,

    customer:
      stripeCustomerId,

    amount_due:
      1499,

    currency:
      'eur',

    hosted_invoice_url:
      'https://example.invalid/d10f5-invoice',

    metadata:{}
  }


  const failedResult =
    await billing.recordInvoice(
      invoice,
      'failed'
    )


  check(
    failedResult?.ignored===
      false,
    'initial failed invoice observation is recorded'
  )


  const failedPayment =
    await one(
      `
        SELECT
          status,
          amount,
          currency

        FROM payments

        WHERE
          invoice_id=$1
          AND status='failed'
      `,
      [
        invoiceId
      ]
    )


  check(
    failedPayment?.status===
      'failed' &&
    Number(
      failedPayment?.amount
    )===14.99 &&
    failedPayment?.currency===
      'EUR',
    'failed invoice persists canonical payment row'
  )


  const failureNotificationCount =
    await one(
      `
        SELECT
          count(*)::int count

        FROM notifications

        WHERE
          user_id=$1
          AND type='billing'
          AND title='Αποτυχία πληρωμής συνδρομής'
      `,
      [
        professionalUserId
      ]
    )


  check(
    Number(
      failureNotificationCount
        ?.count ||
      0
    )===1,
    'failed invoice creates one durable billing notification'
  )


  check(
    mailCalls.paymentFailed===1,
    'failed invoice sends failure mail post-commit'
  )


  const paidInvoice = {
    ...invoice,
    amount_paid:
      1499
  }


  const paidResult =
    await billing.recordInvoice(
      paidInvoice,
      'paid'
    )


  check(
    paidResult?.ignored===
      false,
    'paid invoice observation is accepted'
  )


  const paymentRowsAfterPaid =
    await sql(
      `
        SELECT
          status

        FROM payments

        WHERE invoice_id=$1

        ORDER BY status
      `,
      [
        invoiceId
      ]
    )


  check(
    paymentRowsAfterPaid.rowCount===1 &&
    paymentRowsAfterPaid.rows[0]?.status===
      'paid',
    'paid invoice atomically supersedes stale failed payment state'
  )


  /*
   * Re-deliver failure after paid.
   * It must be ignored and must not recreate failed state or
   * side effects.
   */
  const failureNotificationsBeforeStale =
    Number(
      (
        await one(
          `
            SELECT
              count(*)::int count

            FROM notifications

            WHERE
              user_id=$1
              AND type='billing'
              AND title='Αποτυχία πληρωμής συνδρομής'
          `,
          [
            professionalUserId
          ]
        )
      )?.count ||
      0
    )


  const mailBeforeStaleFailure =
    mailCalls.paymentFailed


  const staleFailedResult =
    await billing.recordInvoice(
      invoice,
      'failed'
    )


  check(
    staleFailedResult?.ignored===
      true &&
    staleFailedResult?.reason===
      'already_paid',
    'failed delivery after paid is explicitly ignored'
  )


  const finalPaymentRows =
    await sql(
      `
        SELECT
          status

        FROM payments

        WHERE invoice_id=$1
      `,
      [
        invoiceId
      ]
    )


  check(
    finalPaymentRows.rowCount===1 &&
    finalPaymentRows.rows[0]?.status===
      'paid',
    'stale failure cannot overwrite authoritative paid state'
  )


  const failureNotificationsAfterStale =
    Number(
      (
        await one(
          `
            SELECT
              count(*)::int count

            FROM notifications

            WHERE
              user_id=$1
              AND type='billing'
              AND title='Αποτυχία πληρωμής συνδρομής'
          `,
          [
            professionalUserId
          ]
        )
      )?.count ||
      0
    )


  check(
    failureNotificationsAfterStale===
      failureNotificationsBeforeStale,
    'ignored stale failure creates no duplicate notification'
  )


  check(
    mailCalls.paymentFailed===
      mailBeforeStaleFailure,
    'ignored stale failure sends no duplicate mail'
  )


  /*
   * Duplicate paid delivery must stay one payment row because
   * recordInvoice uses invoice/status UPSERT semantics.
   */
  await billing.recordInvoice(
    paidInvoice,
    'paid'
  )


  const afterDuplicatePaid =
    await one(
      `
        SELECT
          count(*)::int count

        FROM payments

        WHERE
          invoice_id=$1
          AND status='paid'
      `,
      [
        invoiceId
      ]
    )


  check(
    Number(
      afterDuplicatePaid?.count ||
      0
    )===1,
    'duplicate paid invoice delivery is idempotent'
  )


  // ==========================================================
  // F. FINAL CONTRACT INVARIANTS
  // ==========================================================

  console.log('')
  console.log(
    'D10F.5.F — final billing invariants'
  )


  check(
    stripeCalls.customerCreate===1,
    'fake Stripe boundary proves no unexpected customer API calls'
  )


  const finalLedger =
    await one(
      `
        SELECT
          plan,
          status,
          last_stripe_event_created,
          last_stripe_event_id

        FROM subscriptions

        WHERE stripe_subscription_id=$1
      `,
      [
        stripeSubscriptionId
      ]
    )


  check(
    finalLedger?.plan===
      'premium' &&
    finalLedger?.status===
      'active' &&
    Number(
      finalLedger
        ?.last_stripe_event_created
    )===200 &&
    finalLedger
      ?.last_stripe_event_id===
      'evt_d10f5_new',
    'final subscription state remains authoritative'
  )


  console.log('')
  console.log(
    'MELEO D10F.5 billing / Stripe contract runtime: OK'
  )

}
catch(error){

  console.error('')
  console.error(
    error?.stack ||
    error
  )

  process.exitCode =
    1
}
finally{

  try{

    if(closePool){
      await closePool()
    }

  }
  catch(error){

    console.error(
      '[FAIL] pool cleanup:',
      error?.message ||
      error
    )

    process.exitCode =
      1
  }


  try{

    await dropDatabase()

  }
  catch(error){

    console.error(
      '[FAIL] database cleanup:',
      error?.stack ||
      error
    )

    process.exitCode =
      1
  }
}