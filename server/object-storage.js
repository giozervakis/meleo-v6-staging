import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { config } from './config.js'

const hex = b => Buffer.from(b).toString('hex')
const sha256 = v => crypto.createHash('sha256').update(v).digest('hex')
const hmac = (key, data, enc) => crypto.createHmac('sha256', key).update(data).digest(enc)
const encPath = p => p.split('/').map(x => encodeURIComponent(x)).join('/')

function amzDates(date = new Date()) {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, '')
  return { amz: iso, day: iso.slice(0, 8) }
}

function signingKey(secret, day, region, service = 's3') {
  const kDate = hmac('AWS4' + secret, day)
  const kRegion = hmac(kDate, region)
  const kService = hmac(kRegion, service)
  return hmac(kService, 'aws4_request')
}

function s3Url(key = '') {
  const endpoint = new URL(config.storage.endpoint)
  const base = endpoint.pathname.replace(/\/$/, '')
  const objectPath = [base, config.storage.bucket, key ? encPath(key) : ''].filter(Boolean).join('/')
  endpoint.pathname = '/' + objectPath.replace(/^\/+/, '')
  endpoint.search = ''
  return endpoint
}

async function s3Request(method, key = '', body = Buffer.alloc(0), extraHeaders = {}) {
  const url = s3Url(key)
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(body || '')
  const payloadHash = sha256(payload)
  const { amz, day } = amzDates()
  const headers = {
    host: url.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amz,
    ...Object.fromEntries(Object.entries(extraHeaders).map(([k, v]) => [k.toLowerCase(), String(v)]))
  }
  const names = Object.keys(headers).sort()
  const canonicalHeaders = names.map(n => `${n}:${String(headers[n]).trim()}\n`).join('')
  const signedHeaders = names.join(';')
  const canonicalRequest = [method, url.pathname, '', canonicalHeaders, signedHeaders, payloadHash].join('\n')
  const scope = `${day}/${config.storage.region}/s3/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', amz, scope, sha256(canonicalRequest)].join('\n')
  const signature = hmac(signingKey(config.storage.secretAccessKey, day, config.storage.region), stringToSign, 'hex')
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${config.storage.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  let res

  try {
    res = await fetch(
      url,
      {
        method,
        headers,
        body: ['GET', 'HEAD'].includes(method) ? undefined : payload,
        signal: AbortSignal.timeout(
          config.storage.requestTimeoutMs
        )
      }
    )
  } catch (error) {
    if (
      error?.name === 'TimeoutError' ||
      error?.name === 'AbortError'
    ) {
      const timeoutError =
        new Error(
          `S3 ${method} timeout`
        )

      timeoutError.code =
        'S3_REQUEST_TIMEOUT'

      throw timeoutError
    }

    throw error
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const err = new Error(`S3 ${method} failed: ${res.status} ${text.slice(0, 300)}`)
    err.status = res.status
    throw err
  }
  return res
}

function localPath(key) {
  const root = path.resolve(config.security.verificationStorageDir)
  const full = path.resolve(root, key)
  if (!full.startsWith(root + path.sep) && full !== root) throw new Error('Invalid storage key')
  return full
}

export function verificationObjectKey(docId) {
  const d = new Date()
  const yyyy = String(d.getUTCFullYear())
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `verification/${yyyy}/${mm}/${docId}.bin`
}

export function profilePhotoObjectKey(userId, version=1) {
  const safeUserId = String(userId || '')
    .replace(/[^a-zA-Z0-9_-]/g, '')

  const safeVersion = Math.max(
    1,
    Number(version) || 1
  )

  return `profile-photos/${safeUserId}/v${safeVersion}.bin`
}

export async function putVerificationObject(key, encryptedBuffer) {
  if (config.storage.driver === 's3') {
    await s3Request('PUT', key, encryptedBuffer, { 'content-type': 'application/octet-stream' })
    return
  }
  const file = localPath(key)
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 })
  await fs.writeFile(file, encryptedBuffer, { mode: 0o600 })
}

export async function getVerificationObject(key) {
  if (config.storage.driver === 's3') {
    const res = await s3Request('GET', key)
    return Buffer.from(await res.arrayBuffer())
  }
  return fs.readFile(localPath(key))
}

export async function deleteVerificationObject(key) {
  if (config.storage.driver === 's3') {
    await s3Request('DELETE', key)
    return
  }
  await fs.rm(localPath(key), { force: true })
}

export async function storageReady() {
  if (config.storage.driver === 'local') {
    try {
      await fs.mkdir(config.security.verificationStorageDir, { recursive: true, mode: 0o700 })
      await fs.access(config.security.verificationStorageDir)
      return true
    } catch { return false }
  }
  try {
    await s3Request('HEAD', '')
    return true
  } catch { return false }
}

export function createTemporaryDocumentSignature(documentId, expiresAtMs) {
  const data = `${documentId}.${expiresAtMs}`
  return crypto.createHmac('sha256', config.security.sensitiveDataKey).update(data).digest('base64url')
}

export function verifyTemporaryDocumentSignature(documentId, expiresAtMs, signature) {
  const exp = Number(expiresAtMs)
  if (!Number.isFinite(exp) || exp < Date.now() || exp > Date.now() + config.storage.signedUrlMaxTtlSeconds * 1000) return false
  const expected = createTemporaryDocumentSignature(documentId, exp)
  try { return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature || ''))) } catch { return false }
}
