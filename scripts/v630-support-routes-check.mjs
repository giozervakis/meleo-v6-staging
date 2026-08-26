import fs from 'node:fs'

function assert(
  condition,
  message
) {
  if (!condition) {
    throw new Error(message)
  }
}

const app =
  fs.readFileSync(
    'server/relational/app.js',
    'utf8'
  )

const moduleSource =
  fs.readFileSync(
    'server/routes/support.routes.js',
    'utf8'
  )

assert(
  app.includes(
    "import { registerSupportRoutes } from '../routes/support.routes.js'"
  ),
  'Support route import missing'
)

assert(
  app.includes(
    'registerSupportRoutes('
  ),
  'Support registration missing'
)

const routes = [
  "app.get('/api/support/tickets'",
  "app.post('/api/support/tickets'",
  "app.post('/api/support/tickets/:id/message'",
  "app.patch('/api/support/tickets/:id'"
]

for (
  const route of routes
) {
  assert(
    !app.includes(route),
    `Support route remains application-owned: ${route}`
  )

  assert(
    moduleSource.includes(route),
    `Support route missing from module: ${route}`
  )
}

assert(
  moduleSource.includes(
    "pagination(req.query,{defaultLimit:20,maxLimit:100})"
  ),
  'Support pagination contract changed'
)

assert(
  moduleSource.includes(
    "req.user.role==='admin'?'true':'t.user_id=$1'"
  ),
  'Support ticket authorization changed'
)

assert(
  moduleSource.includes(
    "req.user.role!=='admin'&&t.user_id!==req.user.id"
  ),
  'Support message authorization changed'
)

assert(
  moduleSource.includes(
    "requireRole('admin')"
  ),
  'Support status admin authorization changed'
)

assert(
  moduleSource.includes(
    'Notifications.create('
  ),
  'Support notification integration changed'
)

assert(
  moduleSource.includes(
    "INSERT INTO support_tickets"
  ),
  'Support ticket persistence changed'
)

assert(
  moduleSource.includes(
    "INSERT INTO support_messages"
  ),
  'Support message persistence changed'
)

assert(
  moduleSource.includes(
    "UPDATE support_tickets SET status=$1,updated_at=now() WHERE id=$2"
  ),
  'Support status persistence changed'
)

assert(
  app.includes(
    "app.use('/api/admin'"
  ),
  'Admin middleware boundary changed'
)

console.log(
  'MELEO v6.3.0 Support routes architecture check: OK'
)

console.log(
  '[PASS] 4 Support routes modular'
)

console.log(
  '[PASS] user/admin ticket authorization preserved'
)

console.log(
  '[PASS] ticket/message persistence preserved'
)

console.log(
  '[PASS] support notification integration preserved'
)

console.log(
  '[PASS] admin status authorization preserved'
)

console.log(
  '[PASS] admin middleware boundary preserved'
)
