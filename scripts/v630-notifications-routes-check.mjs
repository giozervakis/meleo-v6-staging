import fs from 'node:fs'

const app =
  fs.readFileSync(
    'server/relational/app.js',
    'utf8'
  )

const module =
  fs.readFileSync(
    'server/routes/notifications.routes.js',
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
    'GET',
    '/api/notifications'
  ],
  [
    'PATCH',
    '/api/notifications/:id/read'
  ],
  [
    'PATCH',
    '/api/notifications/read-all'
  ]
]


function collectRoutes(
  source
) {
  const regex =
    /\bapp\s*\.\s*(get|post|put|patch|delete)\s*\(\s*(['"`])([^'"`]+)\2/g

  return [
    ...source.matchAll(regex)
  ].map(
    match => [
      match[1].toUpperCase(),
      match[3]
    ]
  )
}


const appRoutes =
  collectRoutes(app)

const moduleRoutes =
  collectRoutes(module)


for (
  const [
    method,
    path
  ] of expected
) {
  const moduleCount =
    moduleRoutes.filter(
      route =>
        route[0] === method &&
        route[1] === path
    ).length

  const appCount =
    appRoutes.filter(
      route =>
        route[0] === method &&
        route[1] === path
    ).length

  assert(
    moduleCount === 1,
    `${method} ${path}: expected exactly one module route`
  )

  assert(
    appCount === 0,
    `${method} ${path}: still application-owned`
  )
}


assert(
  module.includes(
    'registerNotificationRoutes'
  ),
  'notification route registrar missing'
)

assert(
  module.includes(
    'auth'
  ),
  'notification authorization dependency missing'
)

assert(
  module.includes(
    'Notifications.list'
  ),
  'Notifications.list behavior missing'
)

assert(
  module.includes(
    'Notifications.read'
  ),
  'Notifications.read behavior missing'
)

assert(
  module.includes(
    'Notifications.readAll'
  ),
  'Notifications.readAll behavior missing'
)


/*
 * The aggregate communication unread endpoint intentionally
 * remains outside this domain.
 */
assert(
  app.includes(
    "'/api/communication/unread'"
  ),
  'communication unread route moved prematurely'
)

assert(
  app.includes(
    'Notifications.unreadCount'
  ),
  'communication unread notification count coupling lost'
)

assert(
  app.includes(
    'Bookings.unreadMessageCount'
  ),
  'communication unread booking-message coupling lost'
)


console.log(
  'MELEO v6.3.0 notifications routes architecture check: OK'
)

console.log(
  '[PASS] notification list modular'
)

console.log(
  '[PASS] notification single-read modular'
)

console.log(
  '[PASS] notification read-all modular'
)

console.log(
  '[PASS] authentication preserved'
)

console.log(
  '[PASS] communication aggregate unread remains application-owned'
)
