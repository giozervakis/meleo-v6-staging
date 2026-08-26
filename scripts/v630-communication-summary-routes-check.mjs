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

const communication =
  fs.readFileSync(
    'server/routes/communication-summary.routes.js',
    'utf8'
  )


assert(
  app.includes(
    "import { registerCommunicationSummaryRoutes } from '../routes/communication-summary.routes.js'"
  ),
  'Communication registrar import missing'
)


assert(
  app.includes(
    'registerCommunicationSummaryRoutes('
  ),
  'Communication registrar invocation missing'
)


assert(
  !app.includes(
    "app.get('/api/communication/unread'"
  ) &&
  !app.includes(
    "app.get(\n  '/api/communication/unread'"
  ),
  'Communication unread remains application-owned'
)


assert(
  communication.includes(
    "app.get("
  ) &&
  communication.includes(
    '/api/communication/unread'
  ),
  'Communication unread route missing from module'
)


assert(
  communication.includes(
    'auth'
  ),
  'Authentication contract changed'
)


assert(
  communication.includes(
    'Promise.all'
  ),
  'Parallel unread aggregation changed'
)


assert(
  communication.includes(
    'Notifications.unreadCount(req.user.id)'
  ),
  'Notification unread calculation changed'
)


assert(
  communication.includes(
    'Bookings.unreadMessageCount(req.user.id)'
  ),
  'Booking-message unread calculation changed'
)


assert(
  communication.includes(
    'Number(notifications||0)'
  ) &&
  communication.includes(
    'Number(messages||0)'
  ),
  'Unread total calculation changed'
)


assert(
  communication.includes(
    'notifications,'
  ) &&
  communication.includes(
    'messages,'
  ) &&
  communication.includes(
    'total:'
  ),
  'Unread response shape changed'
)


console.log(
  'MELEO v6.3.0 Communication summary architecture check: OK'
)

console.log(
  '[PASS] communication unread modular'
)

console.log(
  '[PASS] authentication preserved'
)

console.log(
  '[PASS] notification unread aggregation preserved'
)

console.log(
  '[PASS] booking-message unread aggregation preserved'
)

console.log(
  '[PASS] total unread response preserved'
)
