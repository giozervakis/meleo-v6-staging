import assert from 'node:assert/strict'
import fs from 'node:fs'

const app =
  fs.readFileSync(
    'server/relational/app.js',
    'utf8'
  )

const learning =
  fs.readFileSync(
    'server/services/smart-learning.service.js',
    'utf8'
  )

const normalizer =
  fs.readFileSync(
    'server/services/smart-request-normalizer.js',
    'utf8'
  )

function pass(message) {
  console.log('[PASS]', message)
}

assert.match(
  app,
  /createSmartLearningService/
)

pass(
  'app composes smart learning service'
)

assert.doesNotMatch(
  app,
  /async function ensureSmartLearningSchema\s*\(/
)

assert.match(
  learning,
  /async function ensureSmartLearningSchema\s*\(/
)

pass(
  'learning schema implementation is service-owned'
)

assert.doesNotMatch(
  app,
  /\b(?:let|var)\s+smartLearningSchemaReady\s*=/
)

assert.match(
  learning,
  /let smartLearningSchemaReady\s*=\s*false/
)

pass(
  'learning readiness state moved with schema ownership'
)

assert.match(
  learning,
  /CREATE TABLE IF NOT EXISTS smart_request_learning/
)

assert.match(
  learning,
  /CREATE INDEX IF NOT EXISTS smart_request_learning_status_idx/
)

assert.match(
  learning,
  /CREATE INDEX IF NOT EXISTS smart_request_learning_occurrences_idx/
)

pass(
  'smart learning DDL semantics preserved'
)

assert.match(
  learning,
  /\bsql\b/
)

assert.doesNotMatch(
  learning,
  /normalizeSmartRequest/
)

pass(
  'learning service owns only persistence responsibility'
)

assert.doesNotMatch(
  app,
  /function normalizeSmartRequest\s*\(/
)

assert.match(
  normalizer,
  /export function normalizeSmartRequest\s*\(/
)

pass(
  'request normalization moved to pure module'
)

assert.doesNotMatch(
  normalizer,
  /\bsql\b/
)

assert.doesNotMatch(
  normalizer,
  /smartLearningSchemaReady/
)

assert.doesNotMatch(
  normalizer,
  /ensureSmartLearningSchema/
)

pass(
  'normalizer has no persistence dependency'
)

const routeIndex =
  app.indexOf(
    'registerSmartRequestRoutes('
  )

assert.ok(
  routeIndex >= 0
)

const routeWindow =
  app.slice(
    routeIndex,
    routeIndex + 650
  )

assert.match(
  routeWindow,
  /ensureSmartLearningSchema/
)

assert.match(
  routeWindow,
  /normalizeSmartRequest/
)

pass(
  'smart-request route DI contract preserved'
)

const composeIndex =
  app.indexOf(
    'createSmartLearningService({'
  )

assert.ok(
  composeIndex >= 0 &&
  composeIndex < routeIndex
)

pass(
  'learning service composed before route registration'
)

console.log('')
console.log(
  'MELEO D10L.20 smart request / learning split extraction self-test: OK'
)
