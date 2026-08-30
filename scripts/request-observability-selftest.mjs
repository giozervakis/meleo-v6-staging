import fs from 'node:fs'
import assert from 'node:assert/strict'

import {
  requestId
} from '../server/logger.js'

const middleware =
  fs.readFileSync(
    new URL(
      '../server/request-observability.js',
      import.meta.url
    ),
    'utf8'
  )

const app =
  fs.readFileSync(
    new URL(
      '../server/relational/app.js',
      import.meta.url
    ),
    'utf8'
  )

assert.equal(
  requestId(
    'client-req-123456'
  ),
  'client-req-123456',
  'valid incoming request IDs must be preserved'
)

const generated =
  requestId(
    'bad id'
  )

assert.match(
  generated,
  /^[0-9a-f-]{36}$/i,
  'invalid incoming request IDs must be replaced'
)

for (
  const marker
  of [
    'req.id =',
    'req.requestId =',
    "'X-Request-Id'",
    "'http.request.started'",
    "'http.request.completed'",
    'durationMs',
    'statusCode',
    'outcome'
  ]
) {
  assert.ok(
    middleware.includes(
      marker
    ),
    `missing request observability marker: ${marker}`
  )
}

assert.ok(
  app.includes(
    "import { requestObservability } from '../request-observability.js'"
  ),
  'relational app must import request observability middleware'
)

assert.ok(
  app.includes(
    'app.use(requestObservability)'
  ),
  'relational app must install request observability middleware'
)

console.log(
  'MELEO RC3-C1 request observability self-test: OK'
)