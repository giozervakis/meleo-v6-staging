import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const sourceDatabaseUrl=
  String(
    process.env.DATABASE_URL ||
    ''
  ).trim()

if(!sourceDatabaseUrl){
  throw new Error(
    'D10F PostgreSQL integration requires DATABASE_URL'
  )
}

const sourceUrl=
  new URL(
    sourceDatabaseUrl
  )

const allowedHosts=
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
    `D10F integration refuses non-local database host: ${sourceUrl.hostname}`
  )
}

if(
  process.env.NODE_ENV===
  'production'
){
  throw new Error(
    'D10F integration refuses NODE_ENV=production'
  )
}


const token=
  crypto
    .randomUUID()
    .replace(/-/g,'')

const databaseName=
  `meleo_d10f_${token}`

const runtimeTable=
  `d10f_runtime_${token}`

const quotedRuntimeTable=
  `"${runtimeTable}"`

const migrationFiles=
  fs
    .readdirSync(
      path.resolve(
        'migrations'
      )
    )
    .filter(
      name=>
        /^\d+.*\.sql$/.test(
          name
        )
    )
    .sort()


let failed=false
let productionDbLoaded=false
let closeProductionPool=null
let runtimeSql=null
let runtimeTx=null
let runtimeGetPool=null


function pass(message){
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
    failed=true

    throw new Error(
      `[FAIL] ${message}`
    )
  }

  pass(message)
}


function adminDatabaseUrl(){
  const url=
    new URL(
      sourceDatabaseUrl
    )

  /*
   * Connect to the standard maintenance database rather than
   * the shared MELEO development database.
   */
  url.pathname=
    '/postgres'

  return url.toString()
}


function isolatedDatabaseUrl(){
  const url=
    new URL(
      sourceDatabaseUrl
    )

  url.pathname=
    `/${databaseName}`

  return url.toString()
}


async function withAdminClient(fn){
  const client=
    new pg.Client({
      connectionString:
        adminDatabaseUrl()
    })

  await client.connect()

  try{
    return await fn(client)
  }
  finally{
    await client.end()
  }
}


async function dropIsolatedDatabase(){
  await withAdminClient(
    async client=>{

      /*
       * Defensive cleanup. No other application should ever
       * use this UUID-named integration database.
       */
      await client.query(
        `
          SELECT pg_terminate_backend(pid)
          FROM pg_stat_activity
          WHERE datname=$1
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


async function rowCount(
  where='TRUE',
  params=[]
){
  const result=
    await runtimeSql(
      `
        SELECT count(*)::int AS n
        FROM ${quotedRuntimeTable}
        WHERE ${where}
      `,
      params
    )

  return result.rows[0].n
}


try{

  /*
   * --------------------------------------------------------
   * Create completely fresh per-run PostgreSQL database.
   * --------------------------------------------------------
   */

  await withAdminClient(
    async client=>{

      await client.query(
        `CREATE DATABASE "${databaseName}"`
      )

    }
  )

  pass(
    'isolated PostgreSQL test database created'
  )


  /*
   * Production pool reads DATABASE_URL through config.js.
   * Set the isolated target before importing production code.
   */
  process.env.DATABASE_URL=
    isolatedDatabaseUrl()

  const productionDb=
    await import(
      '../../server/relational/pool.js'
    )

  productionDbLoaded=true

  const {
    migrate,
    getPool,
    sql,
    tx,
    closePool
  }=
    productionDb

  runtimeSql=sql
  runtimeTx=tx
  runtimeGetPool=getPool
  closeProductionPool=closePool


  /*
   * --------------------------------------------------------
   * Real production migrations against a blank DB.
   * --------------------------------------------------------
   */

  await migrate()

  const ledger=
    await runtimeSql(
      `
        SELECT
          name,
          checksum

        FROM schema_migrations

        ORDER BY name
      `
    )

  check(
    ledger.rows.length===
      migrationFiles.length,
    'fresh database applies every migration exactly once'
  )

  check(
    ledger.rows
      .map(row=>row.name)
      .join('|')===
    migrationFiles.join('|'),
    'migration ledger exactly matches migration files'
  )

  check(
    ledger.rows.every(
      row=>
        /^[a-f0-9]{64}$/.test(
          String(
            row.checksum ||
            ''
          )
        )
    ),
    'migration ledger stores SHA-256 checksums'
  )


  /*
   * Runtime migration idempotency.
   */
  await migrate()

  const ledgerAfterSecondRun=
    await runtimeSql(
      `
        SELECT
          name,
          checksum

        FROM schema_migrations

        ORDER BY name
      `
    )

  check(
    ledgerAfterSecondRun.rows.length===
      migrationFiles.length,
    'second migration run does not add ledger rows'
  )

  check(
    ledgerAfterSecondRun.rows
      .map(row=>row.name)
      .join('|')===
    migrationFiles.join('|'),
    'second migration run preserves exact ledger'
  )

  pass(
    'production migration runner is runtime-idempotent'
  )


  /*
   * --------------------------------------------------------
   * Core production schema proof.
   * --------------------------------------------------------
   */

  const productionSchema=
    await runtimeSql(
      `
        SELECT
          to_regclass('public.users')
            AS users,

          to_regclass('public.professionals')
            AS professionals,

          to_regclass('public.bookings')
            AS bookings,

          to_regclass('public.background_jobs')
            AS background_jobs
      `
    )

  check(
    Boolean(
      productionSchema.rows[0].users &&
      productionSchema.rows[0].professionals &&
      productionSchema.rows[0].bookings &&
      productionSchema.rows[0].background_jobs
    ),
    'core production tables exist after real migrations'
  )


  /*
   * --------------------------------------------------------
   * Dedicated disposable runtime table.
   * --------------------------------------------------------
   */

  await runtimeSql(
    `
      CREATE TABLE ${quotedRuntimeTable}(
        id text PRIMARY KEY,
        value text NOT NULL
      )
    `
  )

  pass(
    'isolated runtime table created'
  )


  /*
   * --------------------------------------------------------
   * COMMIT proof.
   * --------------------------------------------------------
   */

  await runtimeTx(
    async client=>{

      await client.query(
        `
          INSERT INTO ${quotedRuntimeTable}(
            id,
            value
          )
          VALUES(
            $1,
            $2
          )
        `,
        [
          'commit-1',
          'persisted'
        ]
      )

    }
  )

  check(
    await rowCount(
      'id=$1',
      ['commit-1']
    )===1,
    'transaction COMMIT persists writes'
  )


  /*
   * --------------------------------------------------------
   * ROLLBACK proof.
   * --------------------------------------------------------
   */

  const rollbackMarker=
    new Error(
      'D10F_EXPECTED_ROLLBACK'
    )

  try{

    await runtimeTx(
      async client=>{

        await client.query(
          `
            INSERT INTO ${quotedRuntimeTable}(
              id,
              value
            )
            VALUES(
              $1,
              $2
            )
          `,
          [
            'rollback-1',
            'must-disappear'
          ]
        )

        throw rollbackMarker
      }
    )

    throw new Error(
      'rollback transaction unexpectedly completed'
    )

  }
  catch(error){

    if(
      error!==
      rollbackMarker
    ){
      throw error
    }

  }

  check(
    await rowCount(
      'id=$1',
      ['rollback-1']
    )===0,
    'transaction ROLLBACK removes failed write'
  )


  /*
   * --------------------------------------------------------
   * Multi-write atomic rollback.
   * --------------------------------------------------------
   */

  const multiRollback=
    new Error(
      'D10F_EXPECTED_MULTI_ROLLBACK'
    )

  try{

    await runtimeTx(
      async client=>{

        await client.query(
          `
            INSERT INTO ${quotedRuntimeTable}
              (id,value)
            VALUES
              ($1,$2)
          `,
          [
            'atomic-a',
            'A'
          ]
        )

        await client.query(
          `
            INSERT INTO ${quotedRuntimeTable}
              (id,value)
            VALUES
              ($1,$2)
          `,
          [
            'atomic-b',
            'B'
          ]
        )

        throw multiRollback
      }
    )

  }
  catch(error){

    if(
      error!==
      multiRollback
    ){
      throw error
    }

  }

  check(
    await rowCount(
      'id = ANY($1::text[])',
      [[
        'atomic-a',
        'atomic-b'
      ]]
    )===0,
    'multi-write failure leaves no partial transaction state'
  )


  /*
   * --------------------------------------------------------
   * Pool health after rollback.
   * --------------------------------------------------------
   */

  await runtimeTx(
    async client=>{

      await client.query(
        `
          INSERT INTO ${quotedRuntimeTable}
            (id,value)
          VALUES
            ($1,$2)
        `,
        [
          'after-rollback',
          'healthy'
        ]
      )

    }
  )

  check(
    await rowCount(
      'id=$1',
      ['after-rollback']
    )===1,
    'pool remains healthy after rollback'
  )


  /*
   * --------------------------------------------------------
   * Concurrent PostgreSQL sessions.
   * --------------------------------------------------------
   */

  const pool=
    runtimeGetPool()

  const [
    clientA,
    clientB
  ]=
    await Promise.all([
      pool.connect(),
      pool.connect()
    ])

  try{

    const [
      pidA,
      pidB
    ]=
      await Promise.all([
        clientA.query(
          'SELECT pg_backend_pid() AS pid'
        ),
        clientB.query(
          'SELECT pg_backend_pid() AS pid'
        )
      ])

    check(
      pidA.rows[0].pid!==
      pidB.rows[0].pid,
      'pool provides distinct concurrent PostgreSQL sessions'
    )

    await Promise.all([

      clientA.query(
        `
          INSERT INTO ${quotedRuntimeTable}
            (id,value)
          VALUES
            ($1,$2)
        `,
        [
          'concurrent-a',
          'A'
        ]
      ),

      clientB.query(
        `
          INSERT INTO ${quotedRuntimeTable}
            (id,value)
          VALUES
            ($1,$2)
        `,
        [
          'concurrent-b',
          'B'
        ]
      )

    ])

  }
  finally{

    clientA.release()
    clientB.release()

  }

  check(
    await rowCount(
      'id = ANY($1::text[])',
      [[
        'concurrent-a',
        'concurrent-b'
      ]]
    )===2,
    'concurrent PostgreSQL clients persist independent writes'
  )

}
catch(error){

  failed=true

  console.error(
    error?.stack ||
    String(error)
  )

}
finally{

  /*
   * Close production pool BEFORE DROP DATABASE.
   */
  if(
    productionDbLoaded &&
    closeProductionPool
  ){
    try{
      await closeProductionPool()
      pass(
        'production PostgreSQL pool closed'
      )
    }
    catch(error){
      failed=true

      console.error(
        '[FAIL] pool close failed:',
        error?.stack ||
        String(error)
      )
    }
  }


  /*
   * Always remove the per-run database.
   */
  try{

    await dropIsolatedDatabase()

    const existence=
      await withAdminClient(
        async client=>
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

    if(
      existence.rowCount===0
    ){
      pass(
        'isolated PostgreSQL test database cleanup verified'
      )
    }
    else{
      failed=true

      console.error(
        '[FAIL] isolated PostgreSQL test database survived cleanup'
      )
    }

  }
  catch(error){

    failed=true

    console.error(
      '[FAIL] isolated database cleanup failed:',
      error?.stack ||
      String(error)
    )

  }

}


if(failed){
  process.exitCode=1
}
else{

  console.log('')
  console.log(
    'MELEO D10F.2 real PostgreSQL integration: OK'
  )

}
