import fs from 'node:fs'

const app =
  fs.readFileSync(
    'server/relational/app.js',
    'utf8'
  )

const module =
  fs.readFileSync(
    'server/routes/favorites.routes.js',
    'utf8'
  )


function assert(
  condition,
  message
) {
  if (!condition) {
    throw new Error(message)
  }
}


const expected = [
  [
    'POST',
    '/api/favorites/:professionalId'
  ],
  [
    'GET',
    '/api/favorites'
  ]
]


function collect(
  source
) {
  const regex =
    /\bapp\s*\.\s*(get|post|put|patch|delete)\s*\(\s*(['"`])([^'"`]+)\2/g

  return [
    ...source.matchAll(
      regex
    )
  ].map(
    match => [
      match[1].toUpperCase(),
      match[3]
    ]
  )
}


const appRoutes =
  collect(app)

const moduleRoutes =
  collect(module)


for (
  const [
    method,
    path
  ] of expected
) {
  assert(
    moduleRoutes.filter(
      route =>
        route[0] === method &&
        route[1] === path
    ).length === 1,
    `${method} ${path}: module ownership missing`
  )

  assert(
    appRoutes.filter(
      route =>
        route[0] === method &&
        route[1] === path
    ).length === 0,
    `${method} ${path}: still application-owned`
  )
}


assert(
  module.includes(
    'registerFavoritesRoutes'
  ),
  'Favorites registrar missing'
)


for (
  const dependency of [
    'auth',
    'requireConsumer',
    'limits',
    'one',
    'sql',
    'id',
    'many'
  ]
) {
  assert(
    module.includes(
      dependency
    ),
    `Favorites dependency missing: ${dependency}`
  )
}


assert(
  module.includes(
    'SELECT id FROM favorites WHERE user_id=$1 AND professional_id=$2'
  ),
  'Favorites existence lookup lost'
)


assert(
  module.includes(
    'DELETE FROM favorites WHERE id=$1'
  ),
  'Favorites delete behavior lost'
)


assert(
  module.includes(
    'INSERT INTO favorites(id,user_id,professional_id)'
  ),
  'Favorites insert behavior lost'
)


assert(
  module.includes(
    'SELECT professional_id FROM favorites WHERE user_id=$1 ORDER BY created_at DESC'
  ),
  'Favorites list ordering lost'
)


console.log(
  'MELEO v6.3.0 favorites routes architecture check: OK'
)

console.log(
  '[PASS] favorite toggle modular'
)

console.log(
  '[PASS] favorite listing modular'
)

console.log(
  '[PASS] toggle SQL contract preserved'
)

console.log(
  '[PASS] favorite ordering preserved'
)



/*
 * Part 4A-8C:
 * Care Team is now independently modular.
 * Favorites must not own the Care Team route.
 */
const careTeamModule =
  fs.readFileSync(
    'server/routes/care-team.routes.js',
    'utf8'
  )

assert(
  careTeamModule.includes(
    'const favs='
  ) ||
  careTeamModule.includes(
    'const favs ='
  ),
  'Care Team favorite-derived logic missing from Care Team module'
)

assert(
  careTeamModule.includes(
    'Professionals.byId'
  ),
  'Care Team professional lookup missing from Care Team module'
)

assert(
  careTeamModule.includes(
    'allowsVisibility'
  ),
  'Care Team visibility policy missing from Care Team module'
)

assert(
  careTeamModule.includes(
    'meleoTrustForProfessional'
  ),
  'Care Team trust integration missing from Care Team module'
)



assert(
  careTeamModule.includes(
    "app.get('/api/care-team'"
  ),
  'Care Team modular route missing'
)

assert(
  !module.includes(
    "app.get('/api/care-team'"
  ),
  'Favorites module unexpectedly owns Care Team'
)

console.log(
  '[PASS] Care Team remains independently application-owned'
)
