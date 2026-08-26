import fs from 'node:fs'

const app =
  fs.readFileSync(
    'server/relational/app.js',
    'utf8'
  )

const module =
  fs.readFileSync(
    'server/routes/care-team.routes.js',
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


assert(
  module.includes(
    "app.get('/api/care-team'"
  ),
  'Care Team route missing from module'
)


assert(
  !app.includes(
    "app.get('/api/care-team'"
  ),
  'Care Team route still application-owned'
)


for (
  const dependency of [
    'auth',
    'many',
    'one',
    'Professionals',
    'allowsVisibility',
    'meleoTrustForProfessional'
  ]
) {
  assert(
    module.includes(
      dependency
    ),
    `Care Team dependency missing: ${dependency}`
  )
}


assert(
  module.includes(
    "['patient','professional'].includes(req.user.role)"
  ),
  'Care Team authorization contract changed'
)


assert(
  module.includes(
    'SELECT professional_id "professionalId" FROM favorites WHERE user_id=$1 ORDER BY created_at DESC'
  ),
  'Care Team Favorites ordering/read lost'
)


assert(
  module.includes(
    'Professionals.byId'
  ),
  'Care Team professional lookup lost'
)


assert(
  module.includes(
    'p.adminSuspended'
  ) &&
  module.includes(
    'allowsVisibility(p)'
  ),
  'Care Team visibility policy lost'
)


assert(
  module.includes(
    "status='completed'"
  ),
  'Care Team completed-booking constraint lost'
)


assert(
  module.includes(
    'ORDER BY date DESC,time DESC,created_at DESC LIMIT 1'
  ),
  'Care Team last-completed booking ordering lost'
)


assert(
  module.includes(
    'meleoTrustForProfessional(p.id)'
  ),
  'Care Team trust calculation lost'
)


assert(
  app.includes(
    'async function meleoTrustForProfessional'
  ),
  'Shared MELEO Trust helper moved prematurely'
)


/*
 * Trust is demonstrably shared by other application consumers,
 * therefore Part 4A-8C does not take ownership of it.
 */
const trustReferences =
  (
    app.match(
      /meleoTrustForProfessional/g
    ) || []
  ).length

assert(
  trustReferences >= 4,
  `Shared trust-helper references unexpectedly reduced: ${trustReferences}`
)


console.log(
  'MELEO v6.3.0 Care Team routes architecture check: OK'
)

console.log(
  '[PASS] Care Team route modular'
)

console.log(
  '[PASS] patient/professional authorization preserved'
)

console.log(
  '[PASS] Favorites + completed-booking reads preserved'
)

console.log(
  '[PASS] professional visibility policy preserved'
)

console.log(
  '[PASS] MELEO Trust remains shared and dependency-injected'
)
