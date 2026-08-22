import crypto from 'node:crypto'
import { config } from './config.js'

export function escapeHtml(value='') {
  return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))
}

function key() {
  if (!config.security.sensitiveDataKey) return null
  return crypto.createHash('sha256').update(config.security.sensitiveDataKey).digest()
}

export function encryptSensitive(value='') {
  const raw=String(value||'')
  if (!raw) return ''
  const k=key(); if(!k) return raw
  const iv=crypto.randomBytes(12)
  const cipher=crypto.createCipheriv('aes-256-gcm',k,iv)
  const enc=Buffer.concat([cipher.update(raw,'utf8'),cipher.final()])
  const tag=cipher.getAuthTag()
  return `enc:v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`
}

export function decryptSensitive(value='') {
  const raw=String(value||'')
  if (!raw.startsWith('enc:v1:')) return raw
  const k=key(); if(!k) return ''
  try {
    const [, , ivB64, tagB64, dataB64]=raw.split(':')
    const decipher=crypto.createDecipheriv('aes-256-gcm',k,Buffer.from(ivB64,'base64'))
    decipher.setAuthTag(Buffer.from(tagB64,'base64'))
    return Buffer.concat([decipher.update(Buffer.from(dataB64,'base64')),decipher.final()]).toString('utf8')
  } catch { return '' }
}

function base32Decode(input='') {
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const clean=String(input).replace(/=+$/,'').toUpperCase().replace(/[^A-Z2-7]/g,'')
  let bits=''; for(const c of clean){const v=alphabet.indexOf(c); if(v>=0) bits+=v.toString(2).padStart(5,'0')}
  const out=[]; for(let i=0;i+8<=bits.length;i+=8) out.push(parseInt(bits.slice(i,i+8),2))
  return Buffer.from(out)
}

function totpAt(secret, step) {
  const key=base32Decode(secret)
  if(!key.length) return ''
  const b=Buffer.alloc(8); b.writeBigUInt64BE(BigInt(step))
  const h=crypto.createHmac('sha1',key).update(b).digest()
  const offset=h[h.length-1]&0x0f
  const code=((h[offset]&0x7f)<<24)|(h[offset+1]<<16)|(h[offset+2]<<8)|h[offset+3]
  return String(code%1_000_000).padStart(6,'0')
}

export function matchTotpStep(secret, code) {
  const c=String(code||'').replace(/\s/g,'')
  if(!/^\d{6}$/.test(c) || !secret) return null
  const step=Math.floor(Date.now()/30000)
  for(let drift=-1;drift<=1;drift++) {
    const candidate=step+drift
    if(totpAt(secret,candidate)===c) return candidate
  }
  return null
}

export function verifyTotp(secret, code) {
  return matchTotpStep(secret, code) !== null
}
