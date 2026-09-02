import crypto from 'node:crypto'
import net from 'node:net'
import {
  spawn
} from 'node:child_process'
import pg from 'pg'


const sourceDatabaseUrl =
  String(
    process.env.DATABASE_URL ||
    ''
  ).trim()


if(!sourceDatabaseUrl){
  throw new Error(
    'D10F.8A requires DATABASE_URL'
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
    'D10F.8A refuses NODE_ENV=production'
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
    `D10F.8A refuses non-local PostgreSQL host: ${sourceUrl.hostname}`
  )
}


const token =
  crypto
    .randomUUID()
    .replace(
      /-/g,
      ''
    )


const databaseName =
  `meleo_d10f8a_${token}`


let failed =
  false


let closeProductionPool =
  null


let runtimeSql =
  null


let runtimeTx =
  null


function pass(
  message
){
  console.log(
    '[PASS]',
    message
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

  pass(
    message
  )
}


function adminDatabaseUrl(){

  const url =
    new URL(
      sourceDatabaseUrl
    )

  url.pathname =
    '/postgres'

  return url.toString()
}


function isolatedDatabaseUrl(){

  const url =
    new URL(
      sourceDatabaseUrl
    )

  url.pathname =
    `/${databaseName}`

  return url.toString()
}


async function withAdminClient(
  fn
){

  const client =
    new pg.Client({
      connectionString:
        adminDatabaseUrl()
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


async function dropIsolatedDatabase(){

  await withAdminClient(
    async client=>{

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
}


async function reservePort(){

  return new Promise(
    (
      resolve,
      reject
    )=>{

      const server =
        net.createServer()

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
        ()=>{

          const address =
            server.address()

          const port =
            typeof address ===
            'object'
              ? address.port
              : 0

          server.close(
            error=>{

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


function runNodeModule(
  source,
  env,
  timeoutMs=10_000
){

  return new Promise(
    (
      resolve,
      reject
    )=>{

      const child =
        spawn(
          process.execPath,
          [
            '--input-type=module',
            '-e',
            source
          ],
          {
            cwd:
              process.cwd(),

            env: {
              ...process.env,
              ...env
            },

            stdio: [
              'ignore',
              'pipe',
              'pipe'
            ]
          }
        )


      let stdout =
        ''


      let stderr =
        ''


      child.stdout.on(
        'data',
        chunk=>{
          stdout +=
            chunk.toString()
        }
      )


      child.stderr.on(
        'data',
        chunk=>{
          stderr +=
            chunk.toString()
        }
      )


      const timer =
        setTimeout(
          ()=>{

            try{
              child.kill()
            }catch{}

            reject(
              new Error(
                `child timeout after ${timeoutMs}ms\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`
              )
            )
          },
          timeoutMs
        )


      child.on(
        'error',
        error=>{

          clearTimeout(
            timer
          )

          reject(
            error
          )
        }
      )


      child.on(
        'close',
        code=>{

          clearTimeout(
            timer
          )

          resolve({
            code,
            stdout,
            stderr
          })
        }
      )
    }
  )
}


const redisChildPreamble =
`
import path from 'node:path'
import {
  pathToFileURL
} from 'node:url'

const redisModule =
  await import(
    pathToFileURL(
      path.resolve(
        'server/redis.js'
      )
    ).href
  )
`


try{

  /*
   * ========================================================
   * ISOLATED POSTGRESQL DATABASE
   * ========================================================
   */

  await withAdminClient(
    client=>
      client.query(
        `CREATE DATABASE "${databaseName}"`
      )
  )


  pass(
    'isolated D10F.8A PostgreSQL database created'
  )


  process.env.DATABASE_URL =
    isolatedDatabaseUrl()


  process.env.DATABASE_SSL =
    '0'


  process.env.NODE_ENV =
    'test'


  const productionDb =
    await import(
      '../../server/relational/pool.js'
    )


  const {
    migrate,
    sql,
    tx,
    closePool
  } =
    productionDb


  runtimeSql =
    sql


  runtimeTx =
    tx


  closeProductionPool =
    closePool


  await migrate()


  pass(
    'production migrations completed in isolated database'
  )


  await runtimeSql(
    `
      CREATE TABLE d10f8a_failure_probe(

        id text PRIMARY KEY,

        value text NOT NULL

      )
    `
  )


  pass(
    'failure-injection probe table created'
  )


  /*
   * ========================================================
   * CASE 1
   *
   * REAL PostgreSQL constraint violation inside production tx().
   *
   * First INSERT succeeds.
   * Second INSERT violates primary key.
   * Entire transaction must disappear.
   * ========================================================
   */

  let constraintError =
    null


  try{

    await runtimeTx(
      async client=>{

        await client.query(
          `
            INSERT INTO d10f8a_failure_probe(
              id,
              value
            )
            VALUES(
              $1,
              $2
            )
          `,
          [
            'constraint-rollback',
            'first-write'
          ]
        )


        await client.query(
          `
            INSERT INTO d10f8a_failure_probe(
              id,
              value
            )
            VALUES(
              $1,
              $2
            )
          `,
          [
            'constraint-rollback',
            'duplicate-write'
          ]
        )
      }
    )

  }
  catch(error){

    constraintError =
      error
  }


  check(
    constraintError?.code ===
      '23505',
    'real PostgreSQL unique violation is injected'
  )


  const constraintRows =
    await runtimeSql(
      `
        SELECT count(*)::int n

        FROM d10f8a_failure_probe

        WHERE id='constraint-rollback'
      `
    )


  check(
    constraintRows.rows[0].n ===
      0,
    'database error rolls back earlier write in same transaction'
  )


  const healthyAfterConstraint =
    await runtimeSql(
      `
        SELECT 1::int AS ok
      `
    )


  check(
    healthyAfterConstraint.rows[0].ok ===
      1,
    'production PostgreSQL pool remains usable after constraint rollback'
  )


  /*
   * ========================================================
   * CASE 2
   *
   * REAL PostgreSQL statement timeout.
   *
   * Write occurs before pg_sleep().
   * Timeout must abort transaction.
   * Earlier write must disappear.
   * ========================================================
   */

  let timeoutError =
    null


  try{

    await runtimeTx(
      async client=>{

        await client.query(
          `
            SET LOCAL
              statement_timeout='100ms'
          `
        )


        await client.query(
          `
            INSERT INTO d10f8a_failure_probe(
              id,
              value
            )
            VALUES(
              $1,
              $2
            )
          `,
          [
            'timeout-rollback',
            'must-disappear'
          ]
        )


        await client.query(
          `
            SELECT pg_sleep(1)
          `
        )
      }
    )

  }
  catch(error){

    timeoutError =
      error
  }


  check(
    timeoutError?.code ===
      '57014',
    'real PostgreSQL statement timeout is injected'
  )


  const timeoutRows =
    await runtimeSql(
      `
        SELECT count(*)::int n

        FROM d10f8a_failure_probe

        WHERE id='timeout-rollback'
      `
    )


  check(
    timeoutRows.rows[0].n ===
      0,
    'statement timeout rolls back earlier transaction write'
  )


  const healthyAfterTimeout =
    await runtimeSql(
      `
        SELECT 42::int AS answer
      `
    )


  check(
    healthyAfterTimeout.rows[0].answer ===
      42,
    'production PostgreSQL pool recovers after statement timeout'
  )


  /*
   * ========================================================
   * CASE 3
   *
   * Standalone SQL failure must not poison pool.
   * ========================================================
   */

  let missingRelationError =
    null


  try{

    await runtimeSql(
      `
        SELECT *
        FROM d10f8a_table_that_does_not_exist
      `
    )

  }
  catch(error){

    missingRelationError =
      error
  }


  check(
    missingRelationError?.code ===
      '42P01',
    'real missing-relation query failure is injected'
  )


  const healthyAfterQueryFailure =
    await runtimeSql(
      `
        SELECT
          current_database() AS database
      `
    )


  check(
    healthyAfterQueryFailure.rows[0].database ===
      databaseName,
    'pool serves healthy query after standalone SQL failure'
  )


  /*
   * ========================================================
   * CASE 4
   *
   * Redis unavailable endpoint.
   *
   * Test production redis.js in a fresh Node process so config.js
   * reads the injected environment from process start.
   * ========================================================
   */

  /*
   * Deterministic unavailable Redis dependency.
   *
   * A fake TCP endpoint accepts the connection and immediately
   * closes it. This guarantees that the production Redis client
   * observes a concrete close/error lifecycle rather than relying
   * on OS-specific behavior for an unused port.
   */
  const unavailableServer =
    net.createServer(
      socket=>{

        socket.on(
          'error',
          ()=>{}
        )

        socket.destroy()
      }
    )


  await new Promise(
    (
      resolve,
      reject
    )=>{

      unavailableServer.once(
        'error',
        reject
      )

      unavailableServer.listen(
        {
          host:
            '127.0.0.1',

          port:
            0
        },
        resolve
      )
    }
  )


  const unavailableAddress =
    unavailableServer.address()


  const unavailablePort =
    typeof unavailableAddress ===
    'object'
      ? unavailableAddress.port
      : 0


  try{

    const unavailableChild =
      await runNodeModule(
        redisChildPreamble +
`
const {
  redisPing,
  closeRedis
} = redisModule

let failure = null

try{
  await redisPing()
}
catch(error){
  failure = error
}

if(!failure){
  throw new Error(
    'Redis unavailable endpoint unexpectedly succeeded'
  )
}

const failureMessage =
  String(
    failure.message ||
    failure
  ).trim()

if(!failureMessage){
  throw new Error(
    'Redis unavailable failure had no deterministic error'
  )
}

await closeRedis()

console.log(
  'D10F8A_REDIS_UNAVAILABLE_ERROR=' +
  failureMessage
)

console.log(
  'D10F8A_REDIS_UNAVAILABLE_OK'
)
`,
        {
          NODE_ENV:
            'test',

          REDIS_URL:
            `redis://127.0.0.1:${unavailablePort}`,

          REDIS_REQUIRED:
            '0',

          REDIS_CONNECT_TIMEOUT_MS:
            '500',

          REDIS_COMMAND_TIMEOUT_MS:
            '500'
        },
        8_000
      )


    check(
      unavailableChild.code ===
        0,
      `Redis unavailable child exits cleanly${
        unavailableChild.stderr
          ? `: ${unavailableChild.stderr.trim()}`
          : ''
      }`
    )


    check(
      unavailableChild.stdout.includes(
        'D10F8A_REDIS_UNAVAILABLE_OK'
      ),
      'Redis unavailable dependency returns controlled failure without process crash'
    )


    check(
      unavailableChild.stdout.includes(
        'D10F8A_REDIS_UNAVAILABLE_ERROR='
      ),
      'Redis unavailable dependency exposes deterministic error evidence'
    )

  }
  finally{

    await new Promise(
      resolve=>
        unavailableServer.close(
          ()=>resolve()
        )
    )
  }


  /*
   * ========================================================
   * CASE 5
   *
   * Redis command timeout + connection reset + reconnect.
   *
   * Fake RESP server behavior:
   *   connection #1 => accept PING but never reply
   *   connection #2 => reply PONG
   *
   * This proves the production client destroys the timed-out
   * socket and establishes a fresh connection for the next call.
   * ========================================================
   */

  let connectionCount =
    0


  const redisServer =
    net.createServer(
      socket=>{

        connectionCount++


        const connectionNumber =
          connectionCount


        socket.on(
          'error',
          ()=>{}
        )


        socket.on(
          'data',
          ()=>{

            if(
              connectionNumber >=
              2
            ){

              socket.write(
                '+PONG\r\n'
              )
            }
          }
        )
      }
    )


  await new Promise(
    (
      resolve,
      reject
    )=>{

      redisServer.once(
        'error',
        reject
      )


      redisServer.listen(
        {
          host:
            '127.0.0.1',

          port:
            0
        },
        resolve
      )
    }
  )


  const redisAddress =
    redisServer.address()


  const redisPort =
    typeof redisAddress ===
    'object'
      ? redisAddress.port
      : 0


  try{

    const timeoutRecoveryChild =
      await runNodeModule(
        redisChildPreamble +
`
const {
  redisPing,
  closeRedis
} = redisModule

let timeoutFailure = null

try{
  await redisPing()
}
catch(error){
  timeoutFailure = error
}

if(
  !timeoutFailure ||
  !String(
    timeoutFailure.message ||
    timeoutFailure
  ).includes(
    'Redis command timeout'
  )
){
  throw new Error(
    'Expected Redis command timeout was not observed'
  )
}

const recovered =
  await redisPing()

if(
  recovered !==
  true
){
  throw new Error(
    'Redis client did not recover on fresh connection'
  )
}

await closeRedis()

console.log(
  'D10F8A_REDIS_TIMEOUT_RECOVERY_OK'
)
`,
        {
          NODE_ENV:
            'test',

          REDIS_URL:
            `redis://127.0.0.1:${redisPort}`,

          REDIS_REQUIRED:
            '0',

          REDIS_CONNECT_TIMEOUT_MS:
            '500',

          REDIS_COMMAND_TIMEOUT_MS:
            '500'
        },
        12_000
      )


    check(
      timeoutRecoveryChild.code ===
        0,
      `Redis timeout/recovery child exits cleanly${
        timeoutRecoveryChild.stderr
          ? `: ${timeoutRecoveryChild.stderr.trim()}`
          : ''
      }`
    )


    check(
      timeoutRecoveryChild.stdout.includes(
        'D10F8A_REDIS_TIMEOUT_RECOVERY_OK'
      ),
      'Redis command timeout is followed by successful reconnect'
    )


    check(
      connectionCount >=
        2,
      'timed-out Redis connection is replaced by a new TCP connection'
    )

  }
  finally{

    await new Promise(
      resolve=>
        redisServer.close(
          ()=>resolve()
        )
    )
  }


  console.log('')
  console.log(
    'MELEO D10F.8A PostgreSQL + Redis failure injection runtime: OK'
  )

}
catch(error){

  failed =
    true


  console.error(
    error?.stack ||
    String(error)
  )

}
finally{

  /*
   * Always close production pool before database teardown.
   */
  if(
    closeProductionPool
  ){

    try{

      await closeProductionPool()

      pass(
        'production PostgreSQL pool closed'
      )

    }
    catch(error){

      failed =
        true

      console.error(
        '[FAIL] production pool cleanup:',
        error?.stack ||
        String(error)
      )
    }
  }


  /*
   * Always drop UUID-isolated DB.
   */
  try{

    await dropIsolatedDatabase()


    const existence =
      await withAdminClient(
        client=>
          client.query(
            `
              SELECT 1
              FROM pg_database
              WHERE datname=$1
            `,
            [
              databaseName
            ]
          )
      )


    check(
      existence.rowCount ===
        0,
      'isolated D10F.8A PostgreSQL database cleanup verified'
    )

  }
  catch(error){

    failed =
      true

    console.error(
      '[FAIL] isolated database cleanup:',
      error?.stack ||
      String(error)
    )
  }
}


if(
  failed
){
  process.exitCode =
    1
}