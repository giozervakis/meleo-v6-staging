import assert from 'node:assert/strict'
import fs from 'node:fs'

const app =
  fs.readFileSync(
    'server/relational/app.js',
    'utf8'
  )

const service =
  fs.readFileSync(
    'server/services/one-time-token.service.js',
    'utf8'
  )

function pass(message) {
  console.log('[PASS]', message)
}

assert.match(
  app,
  /createOneTimeTokenService/
)

pass(
  'app composes one-time token service'
)

assert.doesNotMatch(
  app,
  /async function createToken\s*\(/
)

assert.doesNotMatch(
  app,
  /async function consumeToken\s*\(/
)

pass(
  'app no longer owns token lifecycle implementation'
)

assert.match(
  service,
  /async function createToken\s*\(/
)

assert.match(
  service,
  /async function consumeToken\s*\(/
)

pass(
  'service owns create and consume lifecycle'
)

for (const signal of [
  'one_time_tokens',
  'token_hash',
  'expires_at',
  'used_at',
  'FOR UPDATE'
]) {
  assert.equal(
    service.includes(signal),
    true,
    `missing token semantic: ${signal}`
  )
}

pass(
  'token persistence semantics preserved'
)

for (const dependency of [
  'newToken',
  'sha256',
  'tx',
  'id'
]) {
  assert.equal(
    service.includes(dependency),
    true,
    `missing DI dependency: ${dependency}`
  )
}

pass(
  'complete minimal DI preserved'
)

assert.match(
  service,
  /id\(['"]tok['"]\)/
)

pass(
  'token identifier generation preserved'
)

for (const forbidden of [
  'Users.',
  'Sessions.',
  'Professionals.',
  'Bookings.'
]) {
  assert.equal(
    service.includes(forbidden),
    false
  )
}

pass(
  'no unrelated domain-model dependency'
)

assert.match(
  service,
  /client=null/
)

assert.match(
  service,
  /return client\s*\?\s*consume\(client\)\s*:\s*tx\(consume\)/
)

pass(
  'optional transaction-client path preserved'
)

assert.match(
  app,
  /createToken,/
)

assert.match(
  app,
  /consumeToken,/
)

pass(
  'downstream route DI contract preserved'
)

const compose =
  app.indexOf(
    'createOneTimeTokenService({'
  )

const consumer =
  app.indexOf(
    'createToken,',
    compose + 1
  )

assert.ok(
  compose >= 0 &&
  consumer > compose
)

pass(
  'service composed before downstream consumer'
)

console.log('')
console.log(
  'MELEO D10L.21 one-time token service extraction self-test: OK'
)
