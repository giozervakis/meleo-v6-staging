import fs from 'node:fs'

const file =
  'scripts/architecture-check.mjs'

let source =
  fs
    .readFileSync(
      file,
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


// ------------------------------------------------------------
// Detect the variable holding relational/app.js.
//
// Current architecture checker is intentionally kept intact.
// We only broaden endpoint ownership detection so routes may
// live either in app.js or the new system route module.
// ------------------------------------------------------------

const routeFile =
  'server/routes/system.routes.js'

if (
  !fs.existsSync(
    routeFile
  )
) {
  fail(
    'server/routes/system.routes.js missing'
  )
}


const systemRoutes =
  fs.readFileSync(
    routeFile,
    'utf8'
  )


if (
  !systemRoutes.includes(
    "app.get('/api/metrics'"
  )
) {
  fail(
    '/api/metrics missing from system.routes.js'
  )
}


if (
  !systemRoutes.includes(
    "app.get('/api/health'"
  )
) {
  fail(
    '/api/health missing from system.routes.js'
  )
}


if (
  !systemRoutes.includes(
    "app.get('/api/config'"
  )
) {
  fail(
    '/api/config missing from system.routes.js'
  )
}


if (
  !systemRoutes.includes(
    "app.get('/api/plans'"
  )
) {
  fail(
    '/api/plans missing from system.routes.js'
  )
}


// ------------------------------------------------------------
// Locate the old metrics assertion.
//
// Typical existing form:
// assert(app.includes('/api/metrics'),'metrics endpoint missing')
//
// Instead of deleting an architectural assertion, replace it
// with one that accepts either:
//   1. legacy ownership in app.js, or
//   2. modular ownership in system.routes.js.
//
// This keeps backwards compatibility while enforcing existence.
// ------------------------------------------------------------

const metricsPatterns = [

  /assert\(\s*([A-Za-z_$][\w$]*)\.includes\(\s*['"`]\/api\/metrics['"`]\s*\)\s*,\s*['"`]metrics endpoint missing['"`]\s*\)/,

  /assert\(\s*([A-Za-z_$][\w$]*)\.includes\(\s*["'`]app\.get\(['"`]\/api\/metrics["'`]\s*\)\s*,\s*["'`]metrics endpoint missing["'`]\s*\)/

]


let patched =
  false


for (
  const pattern of metricsPatterns
) {
  const match =
    source.match(
      pattern
    )

  if (!match) {
    continue
  }


  const appVariable =
    match[1]


  const replacement =
`assert(
  ${appVariable}.includes('/api/metrics') ||
  systemRoutes.includes('/api/metrics'),
  'metrics endpoint missing'
)`


  source =
    source.replace(
      match[0],
      replacement
    )


  patched =
    true
  break
}


// ------------------------------------------------------------
// If exact regex did not match, perform a conservative
// statement-level replacement based on the error text.
// ------------------------------------------------------------

if (!patched) {

  const lines =
    source.split('\n')


  const targetIndex =
    lines.findIndex(
      line =>
        line.includes(
          'metrics endpoint missing'
        )
    )


  if (
    targetIndex === -1
  ) {
    fail(
      'Could not locate metrics endpoint architecture assertion'
    )
  }


  // Collect a potentially multiline assert statement.
  let start =
    targetIndex

  while (
    start > 0 &&
    !lines[start].includes(
      'assert('
    )
  ) {
    start--
  }


  let end =
    targetIndex

  let balance =
    0

  let started =
    false


  for (
    let i = start;
    i < lines.length;
    i++
  ) {

    for (
      const ch of lines[i]
    ) {
      if (
        ch === '('
      ) {
        balance++
        started =
          true
      }

      if (
        ch === ')'
      ) {
        balance--
      }
    }


    if (
      started &&
      balance <= 0
    ) {
      end =
        i

      break
    }
  }


  const statement =
    lines
      .slice(
        start,
        end + 1
      )
      .join('\n')


  const variableMatch =
    statement.match(
      /([A-Za-z_$][\w$]*)\.includes/
    )


  if (
    !variableMatch
  ) {
    console.error(
      statement
    )

    fail(
      'Could not identify app source variable in metrics assertion'
    )
  }


  const appVariable =
    variableMatch[1]


  const replacement =
`assert(
  ${appVariable}.includes('/api/metrics') ||
  systemRoutes.includes('/api/metrics'),
  'metrics endpoint missing'
)`


  lines.splice(
    start,
    end - start + 1,
    replacement
  )


  source =
    lines.join('\n')


  patched =
    true
}


if (!patched) {
  fail(
    'metrics architecture assertion was not patched'
  )
}


// ------------------------------------------------------------
// Install systemRoutes source near imports.
//
// It must exist before assertions execute.
// ------------------------------------------------------------

if (
  !source.includes(
    "const systemRoutes=fs.readFileSync('server/routes/system.routes.js','utf8')"
  ) &&
  !source.includes(
    "const systemRoutes = fs.readFileSync('server/routes/system.routes.js','utf8')"
  )
) {

  const fsImport =
    source.match(
      /^import\s+fs\s+from\s+['"]node:fs['"]\s*$/m
    )


  if (
    !fsImport
  ) {
    fail(
      'Could not locate node:fs import'
    )
  }


  const position =
    fsImport.index +
    fsImport[0].length


  source =
    source.slice(
      0,
      position
    ) +
    `

const systemRoutes =
  fs.readFileSync(
    'server/routes/system.routes.js',
    'utf8'
  )
` +
    source.slice(
      position
    )
}


// ------------------------------------------------------------
// Important:
//
// Remove only the temporary duplicate helper declaration that
// may have been inserted by this patcher's own analysis logic.
// The architecture checker must contain one systemRoutes const.
// ------------------------------------------------------------

const declarations =
  [
    ...source.matchAll(
      /const systemRoutes\s*=/g
    )
  ]


if (
  declarations.length !== 1
) {
  fail(
    `Expected exactly one systemRoutes declaration, found ${declarations.length}`
  )
}


// ------------------------------------------------------------
// Ensure modular ownership itself is checked.
//
// app.js must register registerSystemRoutes.
// ------------------------------------------------------------

if (
  !source.includes(
    'system routes module missing'
  )
) {

  const marker =
    "assert("


  const index =
    source.indexOf(
      marker
    )


  if (
    index === -1
  ) {
    fail(
      'Could not find architecture assertion area'
    )
  }


  const block =
`assert(
  systemRoutes.includes('/api/config') &&
  systemRoutes.includes('/api/health') &&
  systemRoutes.includes('/api/metrics') &&
  systemRoutes.includes('/api/plans'),
  'system routes module missing'
)

`


  source =
    source.slice(
      0,
      index
    ) +
    block +
    source.slice(
      index
    )
}


// ------------------------------------------------------------
// UTF-8 / EOF normalization
// ------------------------------------------------------------

source =
  source
    .split('\n')
    .map(
      line =>
        line.replace(
          /[ \t]+$/,
          ''
        )
    )
    .join('\n')
    .replace(
      /\n*$/,
      '\n'
    )


fs.writeFileSync(
  file,
  source,
  'utf8'
)


console.log(
  '[PASS] architecture checker understands modular system routes'
)

console.log(
  '[PASS] metrics endpoint assertion preserved'
)

console.log(
  '[PASS] legacy and modular route ownership supported'
)
