import fs from 'node:fs'

const read = path =>
  fs.readFileSync(path, 'utf8')
    .replace(/^\\uFEFF/, '')
    .replace(/\\r\\n/g, '\\n')

const app =
  read('server/relational/app.js')

const favorites =
  read('server/routes/favorites.routes.js')

const smart =
  read('server/routes/smart-request.routes.js')

const migration =
  read('migrations/001_relational_schema.sql')

const pkg =
  JSON.parse(
    read('package.json')
  )

const checks = []

function check(condition, message) {
  if (!condition) {
    console.error('[FAIL]', message)
    process.exitCode = 1
  }
  else {
    console.log('[PASS]', message)
  }

  checks.push({
    condition,
    message
  })
}


// ----------------------------------------------------------
// Favorites schema protection
// ----------------------------------------------------------

check(
  migration.includes(
    'CREATE TABLE IF NOT EXISTS favorites ('
  ) &&
  migration.includes(
    'UNIQUE(user_id, professional_id)'
  ),
  'favorites unique user/professional constraint exists'
)


// ----------------------------------------------------------
// Favorites dependency contract
// ----------------------------------------------------------

const favRegStart =
  app.indexOf(
    'registerFavoritesRoutes('
  )

const favRegEnd =
  app.indexOf(
    'registerCareTeamRoutes(',
    favRegStart
  )

const favReg =
  (
    favRegStart >= 0 &&
    favRegEnd > favRegStart
  )
    ? app.slice(
        favRegStart,
        favRegEnd
      )
    : ''

check(
  favReg.includes(
    '    tx,'
  ),
  'favorites receives transaction dependency'
)

check(
  favorites.includes(
    '    tx,'
  ),
  'favorites route declares transaction dependency'
)


// ----------------------------------------------------------
// Favorites concurrency safety
// ----------------------------------------------------------

const favoritePostStart =
  favorites.indexOf(
    "app.post('/api/favorites/:professionalId'"
  )

const favoriteGetStart =
  favorites.indexOf(
    "app.get('/api/favorites'",
    favoritePostStart
  )

const favoritePost =
  (
    favoritePostStart >= 0 &&
    favoriteGetStart > favoritePostStart
  )
    ? favorites.slice(
        favoritePostStart,
        favoriteGetStart
      )
    : ''

check(
  favoritePost.includes(
    'await tx(async c=>{'
  ),
  'favorites toggle uses database transaction'
)

check(
  favoritePost.includes(
    'pg_advisory_xact_lock'
  ),
  'favorites toggle serializes same user/professional pair'
)

check(
  favoritePost.includes(
    'hashtextextended($1,0)'
  ),
  'favorites advisory lock derives from parameterized pair key'
)

check(
  favoritePost.includes(
    'DELETE FROM favorites WHERE user_id=$1 AND professional_id=$2 RETURNING id'
  ),
  'favorites removal is pair-scoped and transactional'
)

check(
  favoritePost.includes(
    'await c.query('
  ),
  'favorites writes use transaction client'
)

check(
  favoritePost.includes(
    'INSERT INTO favorites(id,user_id,professional_id) VALUES($1,$2,$3)'
  ),
  'favorites insert preserved'
)

check(
  !favoritePost.includes(
    'SELECT id FROM favorites'
  ),
  'race-prone favorites pre-read removed'
)

check(
  !favoritePost.includes(
    'await sql('
  ),
  'favorites standalone SQL writes removed'
)


// ----------------------------------------------------------
// Smart schema protection
// ----------------------------------------------------------

check(
  app.includes(
    'normalized_text text NOT NULL UNIQUE'
  ),
  'smart-request normalized text unique constraint exists'
)


// ----------------------------------------------------------
// Smart dependency contract
// ----------------------------------------------------------

const smartRegStart =
  app.indexOf(
    'registerSmartRequestRoutes('
  )

const smartRegEnd =
  app.indexOf(
    'registerSupportRoutes(',
    smartRegStart
  )

const smartReg =
  (
    smartRegStart >= 0 &&
    smartRegEnd > smartRegStart
  )
    ? app.slice(
        smartRegStart,
        smartRegEnd
      )
    : ''

check(
  smartReg.includes(
    '    tx,'
  ),
  'smart-request receives transaction dependency'
)

check(
  smart.includes(
    '    tx,'
  ),
  'smart-request route declares transaction dependency'
)


// ----------------------------------------------------------
// Smart unmatched atomic upsert
// ----------------------------------------------------------

const unmatchedStart =
  smart.indexOf(
    "'/api/smart-request/unmatched'"
  )

const learnedStart =
  smart.indexOf(
    "'/api/smart-request/learned-match'",
    unmatchedStart
  )

const unmatched =
  (
    unmatchedStart >= 0 &&
    learnedStart > unmatchedStart
  )
    ? smart.slice(
        unmatchedStart,
        learnedStart
      )
    : ''

check(
  unmatched.includes(
    'INSERT INTO smart_request_learning'
  ),
  'smart unmatched insert exists'
)

check(
  unmatched.includes(
    'ON CONFLICT(normalized_text)'
  ),
  'smart unmatched uses normalized-text upsert'
)

check(
  unmatched.includes(
    'occurrences='
  ) &&
  unmatched.includes(
    'smart_request_learning.occurrences+1'
  ),
  'smart unmatched increments occurrences atomically'
)

check(
  unmatched.includes(
    'RETURNING occurrences'
  ),
  'smart unmatched returns authoritative occurrence count'
)

check(
  !unmatched.includes(
    'SELECT *'
  ),
  'race-prone smart unmatched pre-read removed'
)

check(
  !unmatched.includes(
    'await sql('
  ),
  'smart unmatched split SQL writes removed'
)


// ----------------------------------------------------------
// Smart admin review atomicity
// ----------------------------------------------------------

const reviewStart =
  smart.indexOf(
    "'/api/admin/smart-requests/:id'"
  )

const review =
  reviewStart >= 0
    ? smart.slice(
        reviewStart
      )
    : ''

const reviewTx =
  review.indexOf(
    'await tx('
  )

const reviewUpdate =
  review.indexOf(
    'UPDATE smart_request_learning'
  )

const reviewAudit =
  review.indexOf(
    'await audit('
  )

check(
  reviewTx >= 0,
  'smart admin review uses database transaction'
)

check(
  reviewUpdate > reviewTx,
  'smart admin review update occurs inside transaction'
)

check(
  reviewAudit > reviewUpdate,
  'smart admin review audit follows update'
)

check(
  review.includes(
    '            c\n          )'
  ),
  'smart admin review audit receives transaction client'
)

check(
  !review.includes(
    'await sql('
  ),
  'smart admin review standalone SQL update removed'
)


// ----------------------------------------------------------
// Package / CI
// ----------------------------------------------------------

check(
  pkg.scripts?.['favorites-smart-request-integrity-check'] ===
    'node scripts/d10e-favorites-smart-request-integrity-selftest.mjs',
  'D10E.3 package script exists'
)

const gate =
  pkg.scripts?.['ci:gate'] || ''

check(
  gate.includes(
    'npm run verification-integrity-check && npm run favorites-smart-request-integrity-check'
  ),
  'D10E.3 is chained after D10E.2'
)


// ----------------------------------------------------------
// Final
// ----------------------------------------------------------

if (
  checks.every(
    x => x.condition
  )
) {
  console.log('')
  console.log(
    'MELEO D10E.3 favorites / smart-request integrity self-test: OK'
  )
}
else {
  process.exitCode = 1
}
