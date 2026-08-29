import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { config, root } from '../config.js'

const scryptAsync = promisify(crypto.scrypt)
let pool

function databaseSslMode(databaseUrl){
  try{
    const url=new URL(databaseUrl)
    return String(
      url.searchParams.get('sslmode')||''
    ).toLowerCase()
  }catch{
    return ''
  }
}

function databaseConnectionString(databaseUrl){
  try{
    const url=new URL(databaseUrl)

    /*
     * node-postgres may replace an explicit ssl object when sslmode/sslrootcert
     * are present in the connection string. TLS policy is therefore resolved
     * by MELEO and these libpq SSL query parameters are removed before Pool
     * construction.
     */
    for(const key of [
      'sslmode',
      'sslrootcert',
      'sslcert',
      'sslkey'
    ]){
      url.searchParams.delete(key)
    }

    return url.toString()
  }catch{
    return databaseUrl
  }
}

function databaseCa(){
  if(config.databaseSslCaPem){
    return String(config.databaseSslCaPem)
      .replace(/\\n/g,'\n')
  }

  if(config.databaseSslCaFile){
    return fs.readFileSync(
      path.resolve(
        root,
        config.databaseSslCaFile
      ),
      'utf8'
    )
  }

  return undefined
}

export function databaseTlsOptions(
  databaseUrl=config.databaseUrl
){
  const sslMode=
    databaseSslMode(databaseUrl)

  const needsSsl=
    config.databaseSsl ||
    [
      'require',
      'verify-ca',
      'verify-full'
    ].includes(sslMode)

  if(!needsSsl){
    return undefined
  }

  const ca=databaseCa()

  return {
    rejectUnauthorized:true,
    ...(ca ? {ca} : {})
  }
}

export function getPool(){
  if(pool) return pool
  if(!config.databaseUrl) throw new Error('DATABASE_URL απαιτείται για το relational backend')

  pool = new pg.Pool({
    connectionString: databaseConnectionString(config.databaseUrl),
    max: Math.max(5, config.databasePoolMax || 10),
    connectionTimeoutMillis: Math.max(1000, config.databaseConnectionTimeoutMs || 5000),
    idleTimeoutMillis: Math.max(5000, config.databaseIdleTimeoutMs || 30000),
    statement_timeout: Math.max(1000, config.databaseStatementTimeoutMs || 15000),
    query_timeout: Math.max(1000, config.databaseQueryTimeoutMs || 20000),
    keepAlive: true,
    allowExitOnIdle: false,
    ssl: databaseTlsOptions(),
    application_name:'meleo-v6'
  })
  pool.on('error', err=>console.error('[MELEO v5] pg pool error:',err.message))
  return pool
}

export async function sql(text, params=[]){ return getPool().query(text,params) }
export async function one(text, params=[]){ const {rows}=await sql(text,params); return rows[0]||null }
export async function many(text, params=[]){ const {rows}=await sql(text,params); return rows }
export async function tx(fn){
  const client=await getPool().connect()
  try{ await client.query('BEGIN'); const out=await fn(client); await client.query('COMMIT'); return out }
  catch(err){ try{await client.query('ROLLBACK')}catch{} throw err }
  finally{ client.release() }
}

export const now=()=>new Date().toISOString()
export const id=(prefix='id')=>`${prefix}_${crypto.randomUUID()}`
export const sha256=v=>crypto.createHash('sha256').update(String(v)).digest('hex')

export async function hashPassword(password, salt=crypto.randomBytes(16).toString('hex')){
  const key = await scryptAsync(String(password), salt, 64)
  return `${salt}:${Buffer.from(key).toString('hex')}`
}
export async function verifyPassword(password, stored){
  try{
    const [salt,key]=String(stored||'').split(':'); if(!salt||!key)return false
    const test=Buffer.from(await scryptAsync(String(password),salt,64))
    const expected=Buffer.from(key,'hex')
    return expected.length===test.length && crypto.timingSafeEqual(expected,test)
  }catch{return false}
}

const MIGRATION_LOCK_KEY = 1886349651

function migrationChecksum(contents){
  return crypto.createHash('sha256').update(contents,'utf8').digest('hex')
}

async function ensureMigrationLedger(client){
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      checksum char(64) NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `)
}

async function readAppliedMigrations(client){
  const {rows}=await client.query(
    'SELECT name, checksum FROM schema_migrations ORDER BY name'
  )
  return new Map(rows.map(row=>[row.name,row.checksum]))
}

async function bootstrapMigrationLedger(client, files, dir){
  const applied=await readAppliedMigrations(client)
  if(applied.size>0)return applied

  const {rows}=await client.query(`
    SELECT
      to_regclass('public.users') AS users_table,
      to_regclass('public.professionals') AS professionals_table
  `)

  const hasLegacySchema=Boolean(
    rows[0]?.users_table ||
    rows[0]?.professionals_table
  )

  if(!hasLegacySchema)return applied

  for(const name of files){
    const ddl=fs.readFileSync(path.join(dir,name),'utf8')
    await client.query(
      `
        INSERT INTO schema_migrations(name, checksum)
        VALUES ($1,$2)
        ON CONFLICT (name) DO NOTHING
      `,
      [name,migrationChecksum(ddl)]
    )
  }

  return readAppliedMigrations(client)
}

export async function migrate(){
  const dir=path.join(root,'migrations')
  const files=fs.readdirSync(dir).filter(x=>/^\d+.*\.sql$/.test(x)).sort()
  const client=await getPool().connect()
  let locked=false

  try{
    await client.query('SELECT pg_advisory_lock($1)',[MIGRATION_LOCK_KEY])
    locked=true

    await ensureMigrationLedger(client)
    const applied=await bootstrapMigrationLedger(client,files,dir)

    for(const name of files){
      const ddl=fs.readFileSync(path.join(dir,name),'utf8')
      const checksum=migrationChecksum(ddl)
      const recorded=applied.get(name)

      if(recorded){
        if(recorded!==checksum){
          throw new Error(`Migration checksum mismatch for ${name}`)
        }
        continue
      }

      await client.query('BEGIN')
      try{
        await client.query(ddl)
        await client.query(
          `
            INSERT INTO schema_migrations(name, checksum)
            VALUES ($1,$2)
          `,
          [name,checksum]
        )
        await client.query('COMMIT')
        applied.set(name,checksum)
      }catch(err){
        try{await client.query('ROLLBACK')}catch{}
        throw err
      }
    }
  }finally{
    if(locked){
      try{
        await client.query(
          'SELECT pg_advisory_unlock($1)',
          [MIGRATION_LOCK_KEY]
        )
      }catch{}
    }
    client.release()
  }
}

export async function closePool(){ if(pool){await pool.end();pool=null} }

export function pagination(q, {defaultLimit=20,maxLimit=100}={}){
  const page=Math.max(1,Number(q.page)||1)
  const limit=Math.min(maxLimit,Math.max(1,Number(q.limit)||defaultLimit))
  return {page,limit,offset:(page-1)*limit}
}

export function publicUser(row){
  if(!row)return null

  return {
    id:row.id,
    role:row.role,
    name:row.name,
    email:row.email,
    phone:row.phone,

    emailVerified:row.email_verified,
    acceptedTermsAt:row.accepted_terms_at,
    termsVersion:row.terms_version,
    accountStatus:row.account_status,

    avatarKey:row.avatar_key||null,

    profilePhotoKey:row.profile_photo_key||null,
    profilePhotoVersion:Number(row.profile_photo_version||0),

    profilePhotoUrl:row.profile_photo_key
      ? `/api/profile-photo/${encodeURIComponent(row.id)}?v=${Number(row.profile_photo_version||0)}`
      : null,

    createdAt:row.created_at,
    lastLoginAt:row.last_login_at
  }
}
