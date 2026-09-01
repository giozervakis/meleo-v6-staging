import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename =
  fileURLToPath(import.meta.url)

const __dirname =
  path.dirname(__filename)

const root =
  path.resolve(__dirname, '..')


const read =
  relative =>
    fs.readFileSync(
      path.join(root, relative),
      'utf8'
    )


let failed = false


function check(condition, message) {
  if (condition) {
    console.log('[PASS] ' + message)
    return
  }

  console.error('[FAIL] ' + message)
  failed = true
}


const source =
  read(
    'server/routes/support.routes.js'
  )


const pkg =
  JSON.parse(
    read('package.json')
  )


const start =
  source.indexOf(
    "app.post('/api/support/tickets/:id/message'"
  )


const end =
  source.indexOf(
    "app.patch('/api/support/tickets/:id'",
    start
  )


const reply =
  start >= 0 && end > start
    ? source.slice(start, end)
    : ''


check(
  start >= 0 && end > start,
  'support reply endpoint exists'
)


check(
  reply.includes(
    "req.user.role!=='admin'&&t.user_id!==req.user.id"
  ),
  'support reply authorization preserved'
)


check(
  reply.includes(
    'await tx(async c=>{'
  ),
  'support reply uses database transaction'
)


check(
  reply.includes(
    'await c.query(`INSERT INTO support_messages'
  ),
  'support message insert uses transaction client'
)


check(
  reply.includes(
    "await c.query('UPDATE support_tickets SET updated_at=now() WHERE id=$1',[t.id])"
  ),
  'ticket updated_at write uses transaction client'
)


check(
  reply.includes(
    'await Notifications.create('
  ),
  'support notification remains present'
)


check(
  /Notifications\.create\([^;]+,\{\},c\)/.test(
    reply
  ),
  'support notification receives same transaction client'
)


check(
  (
    reply.match(
      /Notifications\.create\(/g
    ) || []
  ).length === 1,
  'support reply contains exactly one notification write'
)


check(
  !reply.includes(
    'await sql(`INSERT INTO support_messages'
  ),
  'standalone message insert removed'
)


check(
  !reply.includes(
    "await sql('UPDATE support_tickets SET updated_at=now()"
  ),
  'standalone ticket timestamp update removed'
)


check(
  reply.includes(
    "req.user.role==='admin'?t.user_id:req.user.id"
  ),
  'notification recipient behavior preserved'
)


check(
  reply.includes(
    "'support','Νέα απάντηση υποστήριξης',text.slice(0,180)"
  ),
  'notification type/title/body behavior preserved'
)


const txPos =
  reply.indexOf(
    'await tx(async c=>{'
  )

const insertPos =
  reply.indexOf(
    'INSERT INTO support_messages'
  )

const updatePos =
  reply.indexOf(
    'UPDATE support_tickets SET updated_at=now()'
  )

const notificationPos =
  reply.indexOf(
    'Notifications.create('
  )

const commitBoundary =
  reply.indexOf(
    ')});res.json({ok:true})'
  )


check(
  txPos >= 0 &&
  insertPos > txPos &&
  updatePos > insertPos &&
  notificationPos > updatePos &&
  commitBoundary > notificationPos,
  'message -> ticket update -> notification execute in one tx'
)


check(
  pkg.scripts?.['support-message-integrity-check'] ===
    'node scripts/d10e-support-message-integrity-selftest.mjs',
  'D10E.1 package script exists'
)


check(
  pkg.scripts?.['ci:gate']?.includes(
    'npm run booking-review-integrity-check && npm run support-message-integrity-check'
  ),
  'D10E.1 is chained after D10D.9'
)


if (failed) {
  console.error(
    '\nMELEO D10E.1 support message integrity self-test: FAILED'
  )

  process.exit(1)
}


console.log(
  '\nMELEO D10E.1 support message integrity self-test: OK'
)
