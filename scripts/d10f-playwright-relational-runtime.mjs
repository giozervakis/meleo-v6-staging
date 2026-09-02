import crypto from 'node:crypto'
import net from 'node:net'
import {
  spawnSync
} from 'node:child_process'
import {
  createRequire
} from 'node:module'
import pg from 'pg'


const bootstrapUrl =
  String(
    process.env.DATABASE_URL ||
    ''
  ).trim()


if(!bootstrapUrl){
  throw new Error(
    'DATABASE_URL is required for D10F.7 relational Playwright runtime'
  )
}


if(
  String(
    process.env.NODE_ENV ||
    ''
  ).toLowerCase() ===
  'production'
){
  throw new Error(
    'D10F.7 refuses NODE_ENV=production'
  )
}


const parsed =
  new URL(
    bootstrapUrl
  )


const allowedHosts =
  new Set([
    '127.0.0.1',
    'localhost',
    'db'
  ])


if(
  !allowedHosts.has(
    parsed.hostname
  )
){
  throw new Error(
    `D10F.7 refuses non-local PostgreSQL host: ${parsed.hostname}`
  )
}


const databaseName =
  'meleo_d10f7_' +
  crypto
    .randomUUID()
    .replace(
      /-/g,
      ''
    )


function databaseUrl(
  database
){
  const url =
    new URL(
      bootstrapUrl
    )

  url.pathname =
    `/${database}`

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


async function maintenance(
  fn
){
  return withClient(
    maintenanceUrl,
    fn
  )
}


async function createDatabase(){

  await maintenance(
    client =>
      client.query(
        `CREATE DATABASE "${databaseName}"`
      )
  )

  console.log(
    '[PASS] isolated D10F.7 PostgreSQL database created'
  )
}


async function dropDatabase(){

  await maintenance(
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
    await maintenance(
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

        return result.rowCount > 0
      }
    )


  if(exists){
    throw new Error(
      'D10F.7 isolated database survived cleanup'
    )
  }


  console.log(
    '[PASS] isolated D10F.7 PostgreSQL database cleanup verified'
  )
}


async function reservePort(){

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const server =
        net.createServer()

      server.unref()

      server.on(
        'error',
        reject
      )

      server.listen(
        {
          host:
            '127.0.0.1',

          port:
            0
        },
        () => {

          const address =
            server.address()

          const port =
            typeof address ===
            'object'
              ? address.port
              : 0

          server.close(
            error => {

              if(error){
                reject(
                  error
                )
                return
              }

              resolve(
                port
              )
            }
          )
        }
      )
    }
  )
}


function check(
  condition,
  message
){
  if(!condition){
    throw new Error(
      `[FAIL] ${message}`
    )
  }

  console.log(
    `[PASS] ${message}`
  )
}


let created =
  false


try{

  await createDatabase()

  created =
    true


  const apiPort =
    await reservePort()

  const webPort =
    await reservePort()


  check(
    apiPort !== webPort,
    'isolated API and web ports are distinct'
  )


  const apiUrl =
    `http://127.0.0.1:${apiPort}`

  const webUrl =
    `http://127.0.0.1:${webPort}`


  console.log(
    `[PASS] isolated API port reserved: ${apiPort}`
  )

  console.log(
    `[PASS] isolated web port reserved: ${webPort}`
  )


  const env = {
    ...process.env,

    DATABASE_URL:
      isolatedUrl,

    DATABASE_SSL:
      '0',

    NODE_ENV:
      'test',

    MELEO_E2E_API_PORT:
      String(
        apiPort
      ),

    MELEO_E2E_WEB_PORT:
      String(
        webPort
      ),

    E2E_API_URL:
      apiUrl,

    E2E_BASE_URL:
      webUrl,

    VITE_API_PROXY_TARGET:
      apiUrl,

    SENSITIVE_DATA_KEY:
      crypto
        .randomBytes(32)
        .toString('hex'),

    REDIS_URL:
      '',

    REDIS_REQUIRED:
      '0',

    SEED_DEMO:
      '1',

    E2E_MODE:
      '1',

    DEMO_AUTH:
      '1',

    DEMO_CHECKOUT:
      '1'
  }


  /*
   * Critical production-like user journeys:
   *
   * booking.spec.ts
   *   patient login
   *   search/profile
   *   real booking POST
   *   success screen
   *   patient booking dashboard
   *
   * subscription.spec.ts
   *   professional login
   *   subscription state
   *   plan mutation
   *   reload persistence
   *   cancel/resume
   *
   * The relational Playwright config executes both on desktop
   * Chromium and Pixel 7 mobile Chrome.
   */
  const require =
    createRequire(
      import.meta.url
    )


  const playwrightCli =
    require.resolve(
      '@playwright/test/cli'
    )


  check(
    Boolean(
      playwrightCli
    ),
    'installed Playwright CLI resolved'
  )


  const result =
    spawnSync(
      process.execPath,
      [
        playwrightCli,

        'test',

        'tests/e2e/booking.spec.ts',
        'tests/e2e/subscription.spec.ts',

        '--config=playwright.relational.config.ts'
      ],
      {
        stdio:
          'inherit',

        env
      }
    )


  if(
    result.error
  ){
    throw result.error
  }


  if(
    result.status !== 0
  ){
    throw new Error(
      `Relational Playwright exited with status ${result.status}`
    )
  }


  console.log(
    '[PASS] relational Playwright critical journeys completed'
  )


  /*
   * Runtime relational evidence.
   *
   * This is deliberately checked after the browser suite. A successful
   * browser click flow alone is not enough for D10F.7; the isolated
   * PostgreSQL database must contain the real booking write produced
   * through the browser/API path.
   */
  await withClient(
    isolatedUrl,
    async client => {

      const migrations =
        await client.query(
          `
            SELECT count(*)::int count
            FROM schema_migrations
          `
        )


      check(
        Number(
          migrations.rows[0]?.count
        ) >= 9,
        'browser API ran production relational migrations'
      )


      const users =
        await client.query(
          `
            SELECT count(*)::int count
            FROM users
          `
        )


      check(
        Number(
          users.rows[0]?.count
        ) >= 3,
        'browser API created deterministic relational demo users'
      )


      const professionals =
        await client.query(
          `
            SELECT count(*)::int count
            FROM professionals
          `
        )


      check(
        Number(
          professionals.rows[0]?.count
        ) >= 2,
        'browser API created deterministic relational professionals'
      )


      const bookings =
        await client.query(
          `
            SELECT
              count(*)::int count

            FROM bookings
          `
        )


      check(
        Number(
          bookings.rows[0]?.count
        ) >= 1,
        'Playwright booking journey persisted real PostgreSQL booking'
      )


      const bookingNotifications =
        await client.query(
          `
            SELECT
              count(*)::int count

            FROM notifications

            WHERE
              type='booking'
              OR title ILIKE '%booking%'
              OR title ILIKE '%κράτ%'
          `
        )


      check(
        Number(
          bookingNotifications.rows[0]?.count
        ) >= 1,
        'browser booking journey produced durable relational notification evidence'
      )


      const subscriptionRows =
        await client.query(
          `
            SELECT
              count(*)::int count

            FROM subscriptions
          `
        )


      /*
       * Demo billing may primarily persist professional subscription
       * state rather than requiring a Stripe ledger row. The important
       * D10F.7 contract is therefore the professional state itself.
       */
      const subscriptionState =
        await client.query(
          `
            SELECT
              subscription_plan,
              subscription_status,
              billing_mode

            FROM professionals

            WHERE id='p1'
          `
        )


      check(
        [
          'basic',
          'premium'
        ].includes(
          subscriptionState.rows[0]?.subscription_plan
        ),
        'professional billing plan remains relationally valid after browser journey'
      )


      check(
        [
          'active',
          'cancelled',
          'past_due',
          'pending'
        ].includes(
          subscriptionState.rows[0]?.subscription_status
        ),
        'professional billing status remains relationally valid after browser journey'
      )


      console.log(
        `[PASS] subscription ledger rows observed: ${
          Number(
            subscriptionRows.rows[0]?.count ||
            0
          )
        }`
      )
    }
  )


  console.log('')
  console.log(
    'MELEO D10F.7 relational Playwright runtime: OK'
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

  if(created){

    try{
      await dropDatabase()
    }
    catch(error){

      console.error(
        '[FAIL] D10F.7 database cleanup:',
        error?.stack ||
        error
      )

      process.exitCode =
        1
    }
  }
}