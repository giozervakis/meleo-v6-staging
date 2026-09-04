import fs from 'node:fs'

const read=
  path=>
    fs.readFileSync(
      path,
      'utf8'
    )
      .replace(/^\\uFEFF/,'')
      .replace(/\\r\\n/g,'\\n')


function check(condition,message){
  if(!condition){
    console.error(
      '[FAIL]',
      message
    )

    process.exitCode=1
    return
  }

  console.log(
    '[PASS]',
    message
  )
}


const app=
  read(
    'server/relational/app.js'
  )

const repositories=
  read(
    'server/relational/repositories.js'
  )

const pkg=
  JSON.parse(
    read(
      'package.json'
    )
  )


// ==========================================================
// createToken
// ==========================================================

const tokenService=
  fs.readFileSync(
    'server/services/one-time-token.service.js',
    'utf8'
  )

const createTokenStart=
  tokenService.indexOf(
    'async function createToken('
  )

const consumeTokenStart=
  tokenService.indexOf(
    'async function consumeToken(',
    createTokenStart
  )

const createToken=
  (
    createTokenStart>=0 &&
    consumeTokenStart>createTokenStart
  )
    ? tokenService.slice(
        createTokenStart,
        consumeTokenStart
      )
    : ''


check(
  createToken.length>0,
  'createToken isolated'
)

check(
  createToken.includes(
    'await tx('
  ),
  'createToken uses transaction'
)

check(
  createToken.includes(
    'await client.query('
  ),
  'createToken uses transaction client'
)

check(
  createToken.includes(
    'DELETE FROM one_time_tokens'
  ),
  'createToken old-token delete preserved'
)

check(
  createToken.includes(
    'INSERT INTO one_time_tokens('
  ),
  'createToken new-token insert preserved'
)

check(
  !createToken.includes(
    'await sql('
  ),
  'createToken split global SQL removed'
)

const tokenDelete=
  createToken.indexOf(
    'DELETE FROM one_time_tokens'
  )

const tokenInsert=
  createToken.indexOf(
    'INSERT INTO one_time_tokens('
  )

check(
  tokenDelete>=0 &&
  tokenInsert>tokenDelete,
  'createToken delete-before-insert behavior preserved'
)


// ==========================================================
// Notifications.read
// ==========================================================

const notificationsStart=
  repositories.indexOf(
    'export const Notifications={'
  )

const notificationReadStart=
  repositories.indexOf(
    'async read(notificationId,userId){',
    notificationsStart
  )

const notificationReadAllStart=
  repositories.indexOf(
    'async readAll(userId){',
    notificationReadStart
  )

const notificationRead=
  repositories.slice(
    notificationReadStart,
    notificationReadAllStart
  )


check(
  notificationRead.includes(
    'return tx('
  ),
  'notification read uses transaction'
)

check(
  notificationRead.includes(
    'UPDATE notifications'
  ),
  'notification read state update preserved'
)

check(
  notificationRead.includes(
    'INSERT INTO live_events('
  ),
  'notification read live event preserved'
)

check(
  notificationRead.includes(
    'SELECT pg_notify('
  ),
  'notification read live publish preserved'
)

check(
  !notificationRead.includes(
    'await one('
  ) &&
  !notificationRead.includes(
    'await sql('
  ),
  'notification read split global writes removed'
)

check(
  (
    notificationRead.match(
      /client\.query\s*\(/g
    )||
    []
  ).length>=3,
  'notification read uses same tx client for all local effects'
)


// ==========================================================
// Notifications.readAll
// ==========================================================

const notificationRepositoryEnd=
  repositories.indexOf(
    'function bookingFromJoinedRow(',
    notificationReadAllStart
  )

const notificationReadAll=
  repositories.slice(
    notificationReadAllStart,
    notificationRepositoryEnd
  )


check(
  notificationReadAll.includes(
    'return tx('
  ),
  'notification read-all uses transaction'
)

check(
  notificationReadAll.includes(
    'UPDATE notifications'
  ),
  'notification read-all state update preserved'
)

check(
  notificationReadAll.includes(
    'INSERT INTO live_events('
  ),
  'notification read-all live event preserved'
)

check(
  notificationReadAll.includes(
    'SELECT pg_notify('
  ),
  'notification read-all live publish preserved'
)

check(
  !notificationReadAll.includes(
    'await one('
  ) &&
  !notificationReadAll.includes(
    'await sql('
  ),
  'notification read-all split global writes removed'
)

check(
  (
    notificationReadAll.match(
      /client\.query\s*\(/g
    )||
    []
  ).length>=3,
  'notification read-all uses same tx client for all local effects'
)


// ==========================================================
// Bookings.markMessagesRead
// ==========================================================

const markStart=
  repositories.indexOf(
    'async markMessagesRead('
  )

const bookingUpdateStart=
  repositories.indexOf(
    'async update(id,patch){',
    markStart
  )

const markMessagesRead=
  repositories.slice(
    markStart,
    bookingUpdateStart
  )


check(
  markMessagesRead.includes(
    'return tx('
  ),
  'message read receipt uses transaction'
)

check(
  markMessagesRead.includes(
    'UPDATE booking_messages'
  ),
  'message read-state update preserved'
)

check(
  markMessagesRead.includes(
    'INSERT INTO live_events('
  ),
  'message read live event preserved'
)

check(
  markMessagesRead.includes(
    'SELECT pg_notify('
  ),
  'message read live publish preserved'
)

check(
  !markMessagesRead.includes(
    'await many('
  ) &&
  !markMessagesRead.includes(
    'await one('
  ) &&
  !markMessagesRead.includes(
    'await sql('
  ),
  'message read split global writes removed'
)

check(
  (
    markMessagesRead.match(
      /client\.query\s*\(/g
    )||
    []
  ).length>=3,
  'message read uses same tx client for all local effects'
)


// ==========================================================
// D10E.10 external boundaries remain untouched
// ==========================================================

const webhookStart=
  app.indexOf(
    "app.post('/api/webhooks/stripe'"
  )

const expressJsonStart=
  app.indexOf(
    'app.use(express.json(',
    webhookStart
  )

const webhook=
  app.slice(
    webhookStart,
    expressJsonStart
  )


check(
  webhook.includes(
    's.subscriptions.retrieve('
  ),
  'Stripe webhook external retrieval remains outside local transaction rewrite'
)

check(
  webhook.includes(
    'UPDATE webhook_events'
  ),
  'webhook lifecycle remains available for D10E.10 audit'
)


// ==========================================================
// Package
// ==========================================================

check(
  pkg.scripts?.[
    'direct-sql-integrity-check'
  ] ===
    'node scripts/d10e-direct-sql-integrity-selftest.mjs',
  'D10E.9A package script exists'
)

const gate=
  pkg.scripts?.[
    'ci:gate'
  ]||
  ''

const notificationGate=
  gate.indexOf(
    'npm run notification-consistency-check'
  )

const directSqlGate=
  gate.indexOf(
    'npm run direct-sql-integrity-check'
  )

check(
  notificationGate>=0 &&
  directSqlGate>notificationGate,
  'D10E.9A chained after D10E.8'
)


if(!process.exitCode){
  console.log('')

  console.log(
    'MELEO D10E.9A direct SQL integrity self-test: OK'
  )
}
