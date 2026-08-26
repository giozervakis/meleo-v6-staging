import fs from 'node:fs'

const appFile =
  'server/relational/app.js'

const lifecycleFile =
  'server/routes/lifecycle.routes.js'

let source =
  fs.readFileSync(
    appFile,
    'utf8'
  )
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')


function fail(message) {
  console.error(
    '[FAIL]',
    message
  )

  process.exit(1)
}


function findRouteEnd(
  text,
  start
) {
  const open =
    text.indexOf(
      '(',
      start
    )

  if (open === -1) {
    fail(
      'Could not locate /api/ready opening parenthesis'
    )
  }

  let paren = 0
  let brace = 0
  let bracket = 0

  let quote = null
  let escaped = false

  let lineComment = false
  let blockComment = false

  for (
    let i = open;
    i < text.length;
    i++
  ) {
    const ch =
      text[i]

    const next =
      text[i + 1]


    if (lineComment) {
      if (ch === '\n') {
        lineComment = false
      }

      continue
    }


    if (blockComment) {
      if (
        ch === '*' &&
        next === '/'
      ) {
        blockComment = false
        i++
      }

      continue
    }


    if (quote) {

      if (escaped) {
        escaped = false
        continue
      }

      if (ch === '\\') {
        escaped = true
        continue
      }

      if (ch === quote) {
        quote = null
      }

      continue
    }


    if (
      ch === '/' &&
      next === '/'
    ) {
      lineComment = true
      i++
      continue
    }


    if (
      ch === '/' &&
      next === '*'
    ) {
      blockComment = true
      i++
      continue
    }


    if (
      ch === "'" ||
      ch === '"' ||
      ch === '`'
    ) {
      quote = ch
      continue
    }


    if (ch === '(') paren++
    else if (ch === ')') paren--
    else if (ch === '{') brace++
    else if (ch === '}') brace--
    else if (ch === '[') bracket++
    else if (ch === ']') bracket--


    if (
      paren === 0 &&
      brace === 0 &&
      bracket === 0 &&
      i > open
    ) {
      let end =
        i + 1

      while (
        end < text.length &&
        /[ \t]/.test(
          text[end]
        )
      ) {
        end++
      }

      if (
        text[end] === ';'
      ) {
        end++
      }

      while (
        end < text.length &&
        (
          text[end] === '\r' ||
          text[end] === '\n'
        )
      ) {
        end++
      }

      return end
    }
  }


  fail(
    'Could not locate complete /api/ready route'
  )
}


// ============================================================
// PRECONDITIONS
// ============================================================

if (
  source.includes(
    'registerLifecycleRoutes'
  )
) {
  fail(
    'registerLifecycleRoutes already exists in restored app.js'
  )
}


const readyStart =
  source.indexOf(
    "app.get('/api/ready'"
  )


if (
  readyStart < 0
) {
  fail(
    '/api/ready not found in restored app.js'
  )
}


const readyEnd =
  findRouteEnd(
    source,
    readyStart
  )


const readyRoute =
  source
    .slice(
      readyStart,
      readyEnd
    )
    .trim()


if (
  !readyRoute.startsWith(
    "app.get('/api/ready'"
  )
) {
  fail(
    'Extracted route has invalid start'
  )
}


if (
  readyRoute.includes(
    "app.get('/api/live'"
  )
) {
  fail(
    'Parser captured /api/live accidentally'
  )
}


for (
  const required of [
    'SELECT 1',
    'redisPing',
    'storageReady'
  ]
) {
  if (
    !readyRoute.includes(
      required
    )
  ) {
    fail(
      `/api/ready lost required dependency: ${required}`
    )
  }
}


// ============================================================
// CREATE LIFECYCLE MODULE
// ============================================================

const lifecycle =
`/*
 * MELEO v6.3.0
 *
 * Lifecycle / readiness routes.
 *
 * Part 4A-3 moves only /api/ready.
 * /api/live remains with the realtime subsystem until the
 * LISTEN/NOTIFY + SSE lifecycle is modularized atomically.
 */

export function registerLifecycleRoutes(
  app,
  deps
) {
  const {
    config,
    one,
    getPool,
    redisPing,
    storageReady,
    queueStats,
    APP_VERSION,
    RELEASE_CHANNEL
  } = deps

  ${readyRoute
    .split('\n')
    .join('\n  ')}
}
`


fs.writeFileSync(
  lifecycleFile,
  lifecycle
    .replace(/\r\n/g, '\n')
    .replace(/\n*$/, '\n'),
  'utf8'
)


// ============================================================
// IMPORT
// ============================================================

const systemImport =
  "import { registerSystemRoutes } from '../routes/system.routes.js'"

const lifecycleImport =
  "import { registerLifecycleRoutes } from '../routes/lifecycle.routes.js'"


if (
  !source.includes(
    systemImport
  )
) {
  fail(
    'registerSystemRoutes import missing'
  )
}


source =
  source.replace(
    systemImport,
    `${systemImport}\n${lifecycleImport}`
  )


// ============================================================
// ATOMIC ROUTE REPLACEMENT
//
// IMPORTANT:
// We replace the original [readyStart, readyEnd] range directly.
//
// We DO NOT remove the block first and then reuse stale indexes.
// ============================================================

const registration =
`registerLifecycleRoutes(
  app,
  {
    config,
    one,
    getPool,
    redisPing,
    storageReady,
    queueStats,
    APP_VERSION,
    RELEASE_CHANNEL
  }
)

`


source =
  source.slice(
    0,
    readyStart
  ) +
  registration +
  source.slice(
    readyEnd
  )


// ============================================================
// SAFETY
// ============================================================

if (
  source.includes(
    "app.get('/api/ready'"
  )
) {
  fail(
    '/api/ready still owned by app.js'
  )
}


if (
  !source.includes(
    "app.get('/api/live'"
  )
) {
  fail(
    '/api/live disappeared'
  )
}


if (
  !source.includes(
    'LISTEN meleo_live'
  )
) {
  fail(
    'LISTEN meleo_live disappeared'
  )
}


if (
  !source.includes(
    'UNLISTEN meleo_live'
  )
) {
  fail(
    'UNLISTEN meleo_live disappeared'
  )
}


if (
  !source.includes(
    'metricsText'
  )
) {
  fail(
    'metricsText token was corrupted'
  )
}


source =
  source
    .replace(/\r\n/g, '\n')
    .replace(/\n*$/, '\n')


fs.writeFileSync(
  appFile,
  source,
  'utf8'
)


console.log(
  '[PASS] Atomic /api/ready extraction complete'
)

console.log(
  '[PASS] No stale index reuse'
)

console.log(
  '[PASS] metricsText preserved'
)

console.log(
  '[PASS] /api/live preserved'
)
