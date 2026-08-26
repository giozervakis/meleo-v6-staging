import fs from 'node:fs'

const files = {
  config: 'server/config.js',
  pool: 'server/relational/pool.js',
  redis: 'server/redis.js',
  env: '.env.example'
}

const backups = {
  config: 'server/config.js.v612.bak',
  pool: 'server/relational/pool.js.v612.bak',
  redis: 'server/redis.js.v612.bak'
}

function fail(message) {
  console.error('[FAIL]', message)
  process.exit(1)
}

function cleanText(text) {
  return String(text)
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n+$/, '\n')
}

function readUtf8(file) {
  return cleanText(fs.readFileSync(file, 'utf8'))
}

function writeUtf8(file, text) {
  fs.writeFileSync(file, cleanText(text), {
    encoding: 'utf8'
  })
}

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source

  if (!source.includes(before)) {
    fail(`Could not locate ${label}`)
  }

  return source.replace(before, after)
}


// ============================================================
// 1. RESTORE pristine JS files from pre-v6.1.2 backups
// ============================================================

for (const [key, backup] of Object.entries(backups)) {
  if (!fs.existsSync(backup)) {
    fail(`Missing backup: ${backup}`)
  }

  writeUtf8(files[key], readUtf8(backup))
}

console.log('[PASS] Restored pristine pre-v6.1.2 JS files')


// ============================================================
// 2. CONFIG
// ============================================================

let config = readUtf8(files.config)

config = replaceOnce(
  config,
  `  databasePoolMax: Number(process.env.DATABASE_POOL_MAX || 10),`,
  `  databasePoolMax: Number(process.env.DATABASE_POOL_MAX || 10),
  databaseConnectionTimeoutMs: Number(process.env.DATABASE_CONNECTION_TIMEOUT_MS || 5000),
  databaseIdleTimeoutMs: Number(process.env.DATABASE_IDLE_TIMEOUT_MS || 30000),
  databaseStatementTimeoutMs: Number(process.env.DATABASE_STATEMENT_TIMEOUT_MS || 15000),
  databaseQueryTimeoutMs: Number(process.env.DATABASE_QUERY_TIMEOUT_MS || 20000),`,
  'database timeout configuration'
)

config = replaceOnce(
  config,
  `    connectTimeoutMs: Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 2500)`,
  `    connectTimeoutMs: Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 2500),
    commandTimeoutMs: Number(process.env.REDIS_COMMAND_TIMEOUT_MS || 3000)`,
  'Redis command timeout configuration'
)

writeUtf8(files.config, config)

console.log('[PASS] server/config.js')


// ============================================================
// 3. POSTGRESQL POOL
// ============================================================

let pool = readUtf8(files.pool)

pool = replaceOnce(
  pool,
  `    max: Math.max(5, config.databasePoolMax || 10),
    ssl: needsSsl ? { rejectUnauthorized:false } : undefined,
    application_name:'meleo-v5'`,
  `    max: Math.max(5, config.databasePoolMax || 10),
    connectionTimeoutMillis: Math.max(1000, config.databaseConnectionTimeoutMs || 5000),
    idleTimeoutMillis: Math.max(5000, config.databaseIdleTimeoutMs || 30000),
    statement_timeout: Math.max(1000, config.databaseStatementTimeoutMs || 15000),
    query_timeout: Math.max(1000, config.databaseQueryTimeoutMs || 20000),
    keepAlive: true,
    allowExitOnIdle: false,
    ssl: needsSsl ? { rejectUnauthorized:false } : undefined,
    application_name:'meleo-v6'`,
  'PostgreSQL pool configuration'
)

writeUtf8(files.pool, pool)

console.log('[PASS] server/relational/pool.js')


// ============================================================
// 4. REDIS COMMAND TIMEOUT
// ============================================================

let redis = readUtf8(files.redis)

redis = replaceOnce(
  redis,
`function rawCommand(args, targetSocket = socket) {
  return new Promise((resolve, reject) => {
    if (!targetSocket || targetSocket.destroyed) return reject(new Error('Redis not connected'))
    pending.push({ resolve, reject })
    targetSocket.write(encodeCommand(args))
  })
}`,
`function rawCommand(args, targetSocket = socket) {
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
      item.reject(new Error('Redis command timeout'))

      // Redis RESP replies are ordered. Once one command times out,
      // reset the connection so a late reply cannot be associated
      // with the next pending command.
      try {
        targetSocket.destroy(
          new Error('Redis command timeout')
        )
      } catch {}
    }, Math.max(
      500,
      config.redis.commandTimeoutMs || 3000
    ))

    pending.push(item)

    try {
      targetSocket.write(
        encodeCommand(args)
      )
    } catch (err) {
      const index = pending.indexOf(item)

      if (index !== -1) {
        pending.splice(index, 1)
      }

      item.reject(err)
    }
  })
}`,
  'Redis rawCommand'
)

writeUtf8(files.redis, redis)

console.log('[PASS] server/redis.js')


// ============================================================
// 5. ENV EXAMPLE
// ============================================================

if (fs.existsSync(files.env)) {
  let env = readUtf8(files.env)

  const marker =
    '# ---------- MELEO v6.1.2 resilience ----------'

  // Remove a previous partially-added block first.
  env = env.replace(
    /\n?# ---------- MELEO v6\.1\.2 resilience ----------\nDATABASE_CONNECTION_TIMEOUT_MS=.*\nDATABASE_IDLE_TIMEOUT_MS=.*\nDATABASE_STATEMENT_TIMEOUT_MS=.*\nDATABASE_QUERY_TIMEOUT_MS=.*\nREDIS_COMMAND_TIMEOUT_MS=.*\n?/g,
    '\n'
  )

  env = cleanText(env)

  env += `
${marker}
DATABASE_CONNECTION_TIMEOUT_MS=5000
DATABASE_IDLE_TIMEOUT_MS=30000
DATABASE_STATEMENT_TIMEOUT_MS=15000
DATABASE_QUERY_TIMEOUT_MS=20000
REDIS_COMMAND_TIMEOUT_MS=3000
`

  writeUtf8(files.env, env)

  console.log('[PASS] .env.example')
}


// ============================================================
// 6. ENCODING SAFETY
// ============================================================

for (const file of [
  files.config,
  files.pool,
  files.redis,
  files.env
]) {
  if (!fs.existsSync(file)) continue

  const bytes = fs.readFileSync(file)

  if (
    bytes.length >= 3 &&
    bytes[0] === 0xEF &&
    bytes[1] === 0xBB &&
    bytes[2] === 0xBF
  ) {
    fail(`UTF-8 BOM detected: ${file}`)
  }

  const text = bytes.toString('utf8')

  if (
    text.includes('Ξ±Ο€') ||
    text.includes('β€”') ||
    text.includes('ΞΞ')
  ) {
    fail(`Possible mojibake detected: ${file}`)
  }
}

console.log('[PASS] UTF-8 without BOM')
console.log('[PASS] No newly detected mojibake')
console.log('')
console.log('MELEO v6.1.2 clean resilience patch applied.')
