import fs from 'node:fs'
import assert from 'node:assert/strict'

const pool =
  fs.readFileSync(
    'server/relational/pool.js',
    'utf8'
  )

const config =
  fs.readFileSync(
    'server/config.js',
    'utf8'
  )

assert.ok(
  !pool.includes('rejectUnauthorized:false') &&
  !pool.includes('rejectUnauthorized: false'),
  'PostgreSQL TLS must never disable certificate verification'
)

for (const token of [
  'databaseTlsOptions(',
  'rejectUnauthorized:true',
  'databaseSslCaPem',
  'databaseSslCaFile',
  "'sslmode'",
  "'sslrootcert'",
  "'sslcert'",
  "'sslkey'"
]) {
  assert.ok(
    pool.includes(token) ||
    config.includes(token),
    `Database TLS invariant missing: ${token}`
  )
}

assert.ok(
  config.includes('DATABASE_SSL_CA_FILE') &&
  config.includes('DATABASE_SSL_CA_PEM'),
  'Trusted custom CA configuration is missing'
)

assert.ok(
  config.includes('DATABASE_SSL_REJECT_UNAUTHORIZED=false') &&
  config.includes('fatal.push'),
  'Production must reject insecure certificate verification overrides'
)

assert.ok(
  /sslmode=\(\?:disable\|allow\|prefer\)/.test(config),
  'Production must reject insecure libpq sslmode values'
)

assert.ok(
  pool.includes("['require',") ||
  pool.includes("'require',"),
  'sslmode=require must enable verified TLS'
)

assert.ok(
  pool.includes("'verify-ca'") &&
  pool.includes("'verify-full'"),
  'verify-ca and verify-full must enable verified TLS'
)

console.log(
  'MELEO PostgreSQL TLS certificate verification self-test: OK'
)