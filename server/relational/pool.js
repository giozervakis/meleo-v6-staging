import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { config, root } from '../config.js'

const scryptAsync = promisify(crypto.scrypt)
let pool

export function getPool(){
  if(pool) return pool
  if(!config.databaseUrl) throw new Error('DATABASE_URL απαιτείται για το relational backend')
  const needsSsl = /[?&]sslmode=require/.test(config.databaseUrl) || config.databaseSsl
  pool = new pg.Pool({
    connectionString: config.databaseUrl,
    max: Math.max(5, config.databasePoolMax || 10),
    ssl: needsSsl ? { rejectUnauthorized:false } : undefined,
    application_name:'meleo-v5'
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

export async function migrate(){
  const dir=path.join(root,'migrations')
  const files=fs.readdirSync(dir).filter(x=>/^\d+.*\.sql$/.test(x)).sort()
  for(const name of files){
    const ddl=fs.readFileSync(path.join(dir,name),'utf8')
    await sql(ddl)
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
    id:row.id, role:row.role, name:row.name, email:row.email, phone:row.phone,
    emailVerified:row.email_verified, acceptedTermsAt:row.accepted_terms_at,
    termsVersion:row.terms_version, accountStatus:row.account_status,
    createdAt:row.created_at, lastLoginAt:row.last_login_at
  }
}
