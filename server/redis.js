// MELEO v5.1 — lightweight Redis client using Node's built-in TCP/TLS.
// No runtime dependency is required. Supports the small command subset MELEO needs.
import net from 'node:net'
import tls from 'node:tls'
import { config } from './config.js'

const encoder = new TextEncoder()
let socket = null
let connecting = null
let authenticated = false

const TRANSIENT_REDIS_SYSTEM_CODES =
  new Set([
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'EPIPE',
    'ENETUNREACH',
    'EHOSTUNREACH'
  ])


export function isTransientRedisError(
  error
){
  if(!error){
    return false
  }


  const code =
    String(
      error.code ||
      ''
    ).toUpperCase()


  if(
    TRANSIENT_REDIS_SYSTEM_CODES.has(
      code
    )
  ){
    return true
  }


  const message =
    String(
      error.message ||
      error
    ).toLowerCase()


  return [
    'redis connect timeout',
    'redis command timeout',
    'redis connection closed',
    'redis not connected',
    'socket hang up',
    'connection reset by peer',
    'read econnreset',
    'write epipe'
  ].some(
    marker =>
      message.includes(
        marker
      )
  )
}

/*
 * RESP state must belong to the TCP socket that owns it.
 *
 * A timed-out connection may emit close/error after a replacement
 * connection has already been created. Global buffers/queues would
 * therefore allow the old socket to reject or consume commands that
 * belong to the new socket.
 */
const socketStates = new WeakMap()

function stateFor(targetSocket) {
  if (!targetSocket) return null

  let state = socketStates.get(targetSocket)

  if (!state) {
    state = {
      buffer: Buffer.alloc(0),
      pending: []
    }

    socketStates.set(targetSocket, state)
  }

  return state
}

function encodeCommand(args) {
  const parts = [`*${args.length}\r\n`]
  for (const arg of args) {
    const s = String(arg ?? '')
    const bytes = Buffer.from(s)
    parts.push(`$${bytes.length}\r\n`, bytes, '\r\n')
  }
  return Buffer.concat(parts.map(x => Buffer.isBuffer(x) ? x : Buffer.from(x)))
}

function parseResp(buf, offset = 0) {
  if (offset >= buf.length) return null
  const type = String.fromCharCode(buf[offset])
  const lineEnd = buf.indexOf('\r\n', offset + 1)
  if (lineEnd < 0) return null
  const line = buf.subarray(offset + 1, lineEnd).toString()
  if (type === '+' || type === '-' || type === ':') {
    const value = type === ':' ? Number(line) : line
    return { value, isError: type === '-', next: lineEnd + 2 }
  }
  if (type === '$') {
    const len = Number(line)
    if (len === -1) return { value: null, next: lineEnd + 2 }
    const start = lineEnd + 2, end = start + len
    if (buf.length < end + 2) return null
    return { value: buf.subarray(start, end).toString(), next: end + 2 }
  }
  if (type === '*') {
    const count = Number(line)
    if (count === -1) return { value: null, next: lineEnd + 2 }
    let pos = lineEnd + 2
    const arr = []
    for (let i = 0; i < count; i++) {
      const item = parseResp(buf, pos)
      if (!item) return null
      if (item.isError) return item
      arr.push(item.value)
      pos = item.next
    }
    return { value: arr, next: pos }
  }
  throw new Error(`Unsupported Redis RESP type: ${type}`)
}

function consume(targetSocket) {
  const state = stateFor(targetSocket)
  if (!state) return

  while (state.pending.length) {
    let parsed

    try {
      parsed = parseResp(state.buffer)
    } catch (err) {
      const item = state.pending.shift()
      item.reject(err)
      state.buffer = Buffer.alloc(0)
      continue
    }

    if (!parsed) break

    state.buffer =
      state.buffer.subarray(
        parsed.next
      )

    const item =
      state.pending.shift()

    if (parsed.isError) {
      item.reject(
        new Error(
          `Redis: ${parsed.value}`
        )
      )
    } else {
      item.resolve(
        parsed.value
      )
    }
  }
}

function rejectPending(
  targetSocket,
  err
) {
  const state = stateFor(targetSocket)
  if (!state) return

  while (state.pending.length) {
    state.pending
      .shift()
      .reject(err)
  }

  state.buffer =
    Buffer.alloc(0)
}

async function connect() {
  if (!config.redis.url) throw new Error('REDIS_URL is not configured')
  if (socket && !socket.destroyed && authenticated) return socket
  if (connecting) return connecting
  connecting = new Promise((resolve, reject) => {
    let url
    try { url = new URL(config.redis.url) } catch { reject(new Error('Invalid REDIS_URL')); return }
    const secure = url.protocol === 'rediss:'
    const opts = { host: url.hostname, port: Number(url.port || 6379), servername: secure ? url.hostname : undefined }
    const s = secure ? tls.connect(opts) : net.createConnection(opts)
    const timer = setTimeout(() => s.destroy(new Error('Redis connect timeout')), config.redis.connectTimeoutMs)
    s.setNoDelay(true)
    stateFor(s)

    s.on('data', chunk => {
      const state = stateFor(s)

      state.buffer =
        Buffer.concat([
          state.buffer,
          chunk
        ])

      consume(s)
    })

    s.on('error', err => {
      clearTimeout(timer)

      if (socket === s) {
        socket = null
        authenticated = false
      }

      rejectPending(
        s,
        err
      )
    })

    s.on('close', () => {
      clearTimeout(timer)

      if (socket === s) {
        socket = null
        authenticated = false
      }

      rejectPending(
        s,
        new Error(
          'Redis connection closed'
        )
      )
    })
    const ready = async () => {
      clearTimeout(timer); socket = s; authenticated = false
      try {
        if (url.username) await rawCommand(['AUTH', decodeURIComponent(url.username), decodeURIComponent(url.password || '')], s)
        else if (url.password) await rawCommand(['AUTH', decodeURIComponent(url.password)], s)
        if (url.pathname && url.pathname !== '/') await rawCommand(['SELECT', url.pathname.slice(1)], s)
        authenticated = true
        resolve(s)
      } catch (err) { s.destroy(); reject(err) }
    }
    if (secure) s.once('secureConnect', ready); else s.once('connect', ready)
  }).finally(() => { connecting = null })
  return connecting
}

function rawCommand(args, targetSocket = socket) {
  return new Promise((resolve, reject) => {
    if (!targetSocket || targetSocket.destroyed) {
      return reject(new Error('Redis not connected'))
    }

    let settled = false
    let timer

    const item = {
      resolve(value) {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(value)
      },

      reject(err) {
        if (settled) return
        settled = true
        clearTimeout(timer)
        reject(err)
      }
    }

    timer = setTimeout(() => {
      const state =
        stateFor(
          targetSocket
        )

      const index =
        state
          ? state.pending.indexOf(item)
          : -1

      if (index !== -1) {
        state.pending.splice(
          index,
          1
        )
      }

      item.reject(
        new Error(
          'Redis command timeout'
        )
      )

      /*
       * RESP replies are ordered per TCP connection.
       * Destroy only this timed-out socket. Its eventual close/error
       * handlers can reject only commands owned by this same socket.
       */
      try {
        targetSocket.destroy(
          new Error(
            'Redis command timeout'
          )
        )
      } catch {}
    }, Math.max(
      500,
      config.redis.commandTimeoutMs || 3000
    ))

    const state =
      stateFor(
        targetSocket
      )

    state.pending.push(
      item
    )

    try {
      targetSocket.write(
        encodeCommand(args)
      )
    } catch (err) {
      const index =
        state.pending.indexOf(
          item
        )

      if (index !== -1) {
        state.pending.splice(
          index,
          1
        )
      }

      item.reject(err)
    }
  })
}

export async function redisCommand(...args) {
  await connect()
  return rawCommand(args)
}

export async function redisPing() {
  if (!config.redis.url) return false
  return (await redisCommand('PING')) === 'PONG'
}

// Atomic fixed-window limiter. Returns {count, ttlMs}.
export async function redisRateLimit(key, windowMs) {
  const lua = `local c=redis.call('INCR',KEYS[1]); if c==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end; local ttl=redis.call('PTTL',KEYS[1]); return {c,ttl}`
  const out = await redisCommand('EVAL', lua, 1, key, Math.max(1000, Number(windowMs) || 60000))
  return { count: Number(out?.[0] || 0), ttlMs: Math.max(0, Number(out?.[1] || 0)) }
}

export async function redisGetJson(key) {
  const raw = await redisCommand('GET', key)
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

export async function redisSetJson(key, value, ttlSeconds) {
  await redisCommand('SETEX', key, Math.max(1, Math.floor(ttlSeconds)), JSON.stringify(value))
}

export async function closeRedis() {
  if (!socket || socket.destroyed) return
  try { await rawCommand(['QUIT']) } catch {}
  try { socket.end() } catch {}
  socket = null; authenticated = false
}
