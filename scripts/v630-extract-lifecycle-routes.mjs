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


function findCallEnd(
  source,
  start
) {
  const open =
    source.indexOf(
      '(',
      start
    )

  if (
    open === -1
  ) {
    fail(
      'Could not find route opening parenthesis'
    )
  }

  let depth = 0
  let quote = null
  let escape = false
  let templateExpressionDepth = 0

  for (
    let i = open;
    i < source.length;
    i++
  ) {
    const ch =
      source[i]

    const next =
      source[i + 1]


    if (escape) {
      escape = false
      continue
    }


    if (quote) {

      if (
        ch === '\\'
      ) {
        escape = true
        continue
      }


      if (
        quote === '`' &&
        ch === '$' &&
        next === '{'
      ) {
        templateExpressionDepth++
        i++
        continue
      }


      if (
        quote === '`' &&
        templateExpressionDepth > 0
      ) {
        if (
          ch === '{'
        ) {
          templateExpressionDepth++
        }
        else if (
          ch === '}'
        ) {
          templateExpressionDepth--
        }

        continue
      }


      if (
        ch === quote
      ) {
        quote = null
      }

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


    if (
      ch === '('
    ) {
      depth++
    }
    else if (
      ch === ')'
    ) {
      depth--

      if (
        depth === 0
      ) {
        let end =
          i + 1

        while (
          end < source.length &&
          /[ \t]/.test(
            source[end]
          )
        ) {
          end++
        }

        if (
          source[end] === ';'
        ) {
          end++
        }

        while (
          end < source.length &&
          (
            source[end] === '\r' ||
            source[end] === '\n'
          )
        ) {
          end++
        }

        return end
      }
    }
  }


  fail(
    'Could not find end of /api/ready route'
  )
}


// ------------------------------------------------------------
// Preconditions
// ------------------------------------------------------------

if (
  source.includes(
    "registerLifecycleRoutes"
  )
) {
  fail(
    'registerLifecycleRoutes already present — refusing duplicate extraction'
  )
}


const readyStart =
  source.indexOf(
    "app.get('/api/ready'"
  )


if (
  readyStart === -1
) {
  fail(
    '/api/ready route not found in relational app'
  )
}


const readyEnd =
  findCallEnd(
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
  !readyRoute.includes(
    '/api/ready'
  )
) {
  fail(
    'Extracted block does not contain /api/ready'
  )
}


if (
  readyRoute.includes(
    '/api/live'
  )
) {
  fail(
    'Extraction accidentally captured /api/live'
  )
}


// ------------------------------------------------------------
// Dependency sanity.
//
// These are the known readiness dependencies discovered in
// Part 4A-3 precheck.
// ------------------------------------------------------------

for (
  const token of [
    'SELECT 1',
    'redisPing',
    'storageReady'
  ]
) {
  if (
    !readyRoute.includes(
      token
    )
  ) {
    console.log(
      `[INFO] readiness route does not reference ${token}`
    )
  }
}


// ------------------------------------------------------------
// Convert existing app.get route into module-owned route.
//
// Existing implementation stays byte-for-byte semantically the
// same. Only ownership changes.
// ------------------------------------------------------------

const moduleSource =
`/*
 * MELEO v6.3.0
 * Lifecycle / readiness routes.
 *
 * /api/live intentionally remains in relational/app.js until
 * the realtime LISTEN/NOTIFY + SSE lifecycle is extracted as a
 * dedicated subsystem.
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
  moduleSource
    .replace(
      /\r\n/g,
      '\n'
    )
    .replace(
      /\n*$/,
      '\n'
    ),
  'utf8'
)


// ------------------------------------------------------------
// Remove original route.
// ------------------------------------------------------------

source =
  source.slice(
    0,
    readyStart
  ) +
  source.slice(
    readyEnd
  )


// ------------------------------------------------------------
// Add lifecycle import.
// ------------------------------------------------------------

const systemImport =
  "import { registerSystemRoutes } from '../routes/system.routes.js'"


if (
  !source.includes(
    systemImport
  )
) {
  fail(
    'registerSystemRoutes import not found'
  )
}


const lifecycleImport =
  "import { registerLifecycleRoutes } from '../routes/lifecycle.routes.js'"


source =
  source.replace(
    systemImport,
    systemImport +
    '\n' +
    lifecycleImport
  )


// ------------------------------------------------------------
// Register lifecycle routes where /api/ready previously lived.
//
// This preserves middleware/route ordering.
// ------------------------------------------------------------

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
    readyStart
  )


// ------------------------------------------------------------
// Safety assertions
// ------------------------------------------------------------

if (
  source.includes(
    "app.get('/api/ready'"
  )
) {
  fail(
    'Original /api/ready route still exists in app.js'
  )
}


if (
  !source.includes(
    "app.get('/api/live'"
  )
) {
  fail(
    '/api/live disappeared — realtime route must remain untouched'
  )
}


if (
  !source.includes(
    'registerLifecycleRoutes('
  )
) {
  fail(
    'Lifecycle registration missing'
  )
}


// ------------------------------------------------------------
// Normalize EOF.
// ------------------------------------------------------------

source =
  source
    .replace(
      /\r\n/g,
      '\n'
    )
    .replace(
      /\n*$/,
      '\n'
    )


fs.writeFileSync(
  appFile,
  source,
  'utf8'
)


console.log(
  '[PASS] /api/ready extracted'
)

console.log(
  '[PASS] lifecycle.routes.js created'
)

console.log(
  '[PASS] registration preserves original route position'
)

console.log(
  '[PASS] /api/live remains in relational app'
)
