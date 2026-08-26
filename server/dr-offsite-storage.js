import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

function bool(value, fallback = false) {
  if (
    value == null ||
    value === ''
  ) {
    return fallback
  }

  return [
    '1',
    'true',
    'yes',
    'on'
  ].includes(
    String(value)
      .trim()
      .toLowerCase()
  )
}

function clean(value) {
  return String(value || '').trim()
}

function sha256Hex(value) {
  return crypto
    .createHash('sha256')
    .update(value)
    .digest('hex')
}

function hmac(key, value, encoding) {
  return crypto
    .createHmac('sha256', key)
    .update(value)
    .digest(encoding)
}

function encodePathPart(value) {
  return encodeURIComponent(value)
    .replace(/%2F/gi, '/')
    .replace(/[!'()*]/g, c =>
      '%' +
      c
        .charCodeAt(0)
        .toString(16)
        .toUpperCase()
    )
}

function getConfig() {
  const provider =
    clean(
      process.env.DR_OFFSITE_PROVIDER
    ).toLowerCase()

  const required =
    bool(
      process.env.DR_OFFSITE_REQUIRED,
      false
    )

  const endpoint =
    clean(
      process.env.DR_OFFSITE_ENDPOINT ||
      process.env.S3_ENDPOINT
    ).replace(/\/+$/, '')

  const region =
    clean(
      process.env.DR_OFFSITE_REGION ||
      process.env.S3_REGION ||
      'eu-central-1'
    )

  const bucket =
    clean(
      process.env.DR_OFFSITE_BUCKET
    )

  const accessKeyId =
    clean(
      process.env.DR_OFFSITE_ACCESS_KEY_ID ||
      process.env.S3_ACCESS_KEY_ID
    )

  const secretAccessKey =
    clean(
      process.env.DR_OFFSITE_SECRET_ACCESS_KEY ||
      process.env.S3_SECRET_ACCESS_KEY
    )

  const prefix =
    clean(
      process.env.DR_OFFSITE_PREFIX ||
      'database-backups'
    )
      .replace(/^\/+/, '')
      .replace(/\/+$/, '')

  const forcePathStyle =
    bool(
      process.env.DR_OFFSITE_FORCE_PATH_STYLE,
      true
    )

  const timeoutMs =
    Math.max(
      5000,
      Number(
        process.env.DR_OFFSITE_TIMEOUT_MS ||
        30000
      )
    )

  return {
    provider,
    required,
    endpoint,
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    prefix,
    forcePathStyle,
    timeoutMs
  }
}

export function drOffsiteConfigured() {
  const c = getConfig()

  return Boolean(
    c.endpoint &&
    c.bucket &&
    c.accessKeyId &&
    c.secretAccessKey
  )
}

function signingKey(
  secret,
  date,
  region,
  service
) {
  const kDate =
    hmac(
      Buffer.from(
        'AWS4' + secret,
        'utf8'
      ),
      date
    )

  const kRegion =
    hmac(
      kDate,
      region
    )

  const kService =
    hmac(
      kRegion,
      service
    )

  return hmac(
    kService,
    'aws4_request'
  )
}

function awsDate(date = new Date()) {
  return date
    .toISOString()
    .replace(/[:-]|\.\d{3}/g, '')
}

function dateStamp(amzDate) {
  return amzDate.slice(0, 8)
}

function buildTarget(
  endpoint,
  bucket,
  objectKey,
  forcePathStyle
) {
  const base =
    new URL(endpoint)

  const encodedKey =
    encodePathPart(objectKey)

  if (forcePathStyle) {
    const basePath =
      base.pathname
        .replace(/\/+$/, '')

    base.pathname =
      `${basePath}/${encodeURIComponent(bucket)}/${encodedKey}`

    return base
  }

  base.hostname =
    `${bucket}.${base.hostname}`

  base.pathname =
    `/${encodedKey}`

  return base
}

async function signedRequest({
  method,
  objectKey,
  body = Buffer.alloc(0),
  contentType =
    'application/octet-stream'
}) {
  const c = getConfig()

  if (!drOffsiteConfigured()) {
    throw new Error(
      'DR off-site storage is not fully configured'
    )
  }

  const target =
    buildTarget(
      c.endpoint,
      c.bucket,
      objectKey,
      c.forcePathStyle
    )

  const now =
    new Date()

  const amzDate =
    awsDate(now)

  const stamp =
    dateStamp(amzDate)

  const payloadHash =
    sha256Hex(body)

  const host =
    target.host

  const canonicalUri =
    target.pathname

  const canonicalQuery =
    target.searchParams
      .toString()

  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`

  const signedHeaders =
    'host;x-amz-content-sha256;x-amz-date'

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n')

  const scope =
    `${stamp}/${c.region}/s3/aws4_request`

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    sha256Hex(canonicalRequest)
  ].join('\n')

  const signature =
    hmac(
      signingKey(
        c.secretAccessKey,
        stamp,
        c.region,
        's3'
      ),
      stringToSign,
      'hex'
    )

  const authorization =
    'AWS4-HMAC-SHA256 ' +
    `Credential=${c.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, ` +
    `Signature=${signature}`

  const controller =
    new AbortController()

  const timer =
    setTimeout(
      () =>
        controller.abort(
          new Error(
            'DR off-site request timeout'
          )
        ),
      c.timeoutMs
    )

  timer.unref?.()

  try {
    const headers = {
      Authorization:
        authorization,

      'x-amz-date':
        amzDate,

      'x-amz-content-sha256':
        payloadHash
    }

    if (
      method === 'PUT'
    ) {
      headers['Content-Type'] =
        contentType
    }

    const response =
      await fetch(
        target,
        {
          method,
          headers,
          body:
            method === 'PUT'
              ? body
              : undefined,
          signal:
            controller.signal
        }
      )

    if (!response.ok) {
      const detail =
        await response
          .text()
          .catch(() => '')

      throw new Error(
        `DR off-site ${method} failed: HTTP ${response.status}` +
        (
          detail
            ? ` · ${detail.slice(0, 300)}`
            : ''
        )
      )
    }

    return {
      response,
      url:
        target.toString()
    }
  }
  finally {
    clearTimeout(timer)
  }
}

function objectKeyFor(
  file,
  prefix
) {
  const name =
    path.basename(file)

  const year =
    new Date()
      .getUTCFullYear()

  return [
    prefix,
    String(year),
    name
  ]
    .filter(Boolean)
    .join('/')
}

export async function uploadBackupOffsite({
  file,
  checksum
}) {
  const c = getConfig()

  const configured =
    drOffsiteConfigured()

  if (!configured) {
    if (c.required) {
      throw new Error(
        'DR_OFFSITE_REQUIRED=true but remote backup storage is incomplete'
      )
    }

    return {
      required:
        c.required,

      configured:false,
      verified:false,

      provider:
        c.provider || null,

      bucket:
        c.bucket || null,

      objectKey:null,

      checksumObjectKey:null
    }
  }

  const body =
    fs.readFileSync(file)

  const stat =
    fs.statSync(file)

  const objectKey =
    objectKeyFor(
      file,
      c.prefix
    )

  const checksumObjectKey =
    `${objectKey}.sha256`

  const checksumBody =
    Buffer.from(
      `${checksum}  ${path.basename(file)}\n`,
      'utf8'
    )

  await signedRequest({
    method:'PUT',
    objectKey,
    body
  })

  await signedRequest({
    method:'PUT',
    objectKey:
      checksumObjectKey,
    body:
      checksumBody,
    contentType:
      'text/plain; charset=utf-8'
  })

  const head =
    await signedRequest({
      method:'HEAD',
      objectKey
    })

  const remoteLength =
    Number(
      head.response.headers.get(
        'content-length'
      )
    )

  if (
    Number.isFinite(remoteLength) &&
    remoteLength !== stat.size
  ) {
    throw new Error(
      `Remote backup size mismatch: local=${stat.size}, remote=${remoteLength}`
    )
  }

  const checksumHead =
    await signedRequest({
      method:'HEAD',
      objectKey:
        checksumObjectKey
    })

  if (
    !checksumHead.response.ok
  ) {
    throw new Error(
      'Remote checksum object verification failed'
    )
  }

  return {
    required:
      c.required,

    configured:true,
    verified:true,

    provider:
      c.provider ||
      's3-compatible',

    bucket:
      c.bucket,

    objectKey,

    checksumObjectKey,

    sizeBytes:
      stat.size,

    remoteSizeBytes:
      Number.isFinite(remoteLength)
        ? remoteLength
        : null,

    sha256:
      checksum,

    uploadedAt:
      new Date().toISOString()
  }
}

export function assertDrOffsiteProductionPolicy() {
  const c = getConfig()

  if (
    process.env.NODE_ENV !==
    'production'
  ) {
    return
  }

  if (!c.required) {
    throw new Error(
      'Production requires DR_OFFSITE_REQUIRED=true'
    )
  }

  if (!c.provider) {
    throw new Error(
      'Production requires DR_OFFSITE_PROVIDER'
    )
  }

  if (!drOffsiteConfigured()) {
    throw new Error(
      'Production DR off-site storage configuration is incomplete'
    )
  }
}
