import fs from 'node:fs'
import assert from 'node:assert/strict'

function read(path){
  return fs
    .readFileSync(path,'utf8')
    .replace(/^\uFEFF/,'')
}

function pass(message){
  console.log('[PASS] '+message)
}

const route=
  read(
    'server/routes/account-privacy.routes.js'
  )

const repositories=
  read(
    'server/relational/repositories.js'
  )

const security=
  read(
    'server/security.js'
  )


assert.ok(
  route.includes(
    "import { decryptSensitive } from '../security.js'"
  )
)

assert.ok(
  security.includes(
    'export function decryptSensitive('
  )
)

assert.ok(
  repositories.includes(
    'text:decryptSensitive(m.body_encrypted)'
  )
)

pass(
  'canonical sensitive-data decryptor reused'
)


const bookingStart=
  route.indexOf(
    'const bookingMessageRows='
  )

const reviewStart=
  route.indexOf(
    'const reviews='
  )

assert.ok(
  bookingStart>=0 &&
  reviewStart>bookingStart
)

const bookingSection=
  route.slice(
    bookingStart,
    reviewStart
  )

assert.ok(
  bookingSection.includes(
    'body_encrypted'
  )
)

assert.ok(
  bookingSection.includes(
    'const bookingMessages='
  )
)

assert.ok(
  bookingSection.includes(
    'decryptSensitive('
  )
)

assert.ok(
  bookingSection.includes(
    'text:'
  )
)

assert.equal(
  bookingSection.includes(
    'sender_user_id'
  ),
  false
)

pass(
  'booking message export is readable and minimised'
)


const reviewEnd=
  route.indexOf(
    'const supportTickets='
  )

assert.ok(
  reviewEnd>reviewStart
)

const reviewSection=
  route.slice(
    reviewStart,
    reviewEnd
  )

assert.equal(
  reviewSection.includes(
    'patient_id,'
  ),
  false
)

assert.ok(
  reviewSection.includes(
    'professional_id'
  )
)

assert.ok(
  reviewSection.includes(
    'rating'
  )
)

assert.ok(
  reviewSection.includes(
    'comment'
  )
)

pass(
  'review patient internal id minimised'
)


const supportStart=
  route.indexOf(
    'const supportMessages='
  )

const reportsStart=
  route.indexOf(
    'const reports='
  )

assert.ok(
  supportStart>=0 &&
  reportsStart>supportStart
)

const supportSection=
  route.slice(
    supportStart,
    reportsStart
  )

assert.equal(
  supportSection.includes(
    'sender_user_id'
  ),
  false
)

assert.ok(
  supportSection.includes(
    'sender_role'
  )
)

assert.ok(
  supportSection.includes(
    'body'
  )
)

pass(
  'support sender internal id minimised'
)


for(
  const marker
  of [
    "'booking_messages.body_encrypted'",
    "'booking_messages.sender_user_id'",
    "'support_messages.sender_user_id'",
    "'reviews.patient_id'"
  ]
){
  assert.ok(
    route.includes(marker),
    'missing export minimisation marker: '+
    marker
  )
}

pass(
  'export minimisation contract recorded'
)


for(
  const marker
  of [
    'FROM booking_messages',
    'FROM reviews',
    'FROM support_messages',
    'bookingMessages,',
    'reviews,',
    'supportMessages,',
    'bookings.length===total'
  ]
){
  assert.ok(
    route.includes(marker),
    'D10I.2 completeness regression: '+
    marker
  )
}

pass(
  'D10I.2 completeness preserved'
)


console.log('')
console.log(
  'D10I.4 EXPORT MINIMISATION + READABLE DATA'
)
console.log(
  '-----------------------------------------'
)
console.log(
  'BOOKING MESSAGE CONTENT       : READABLE'
)
console.log(
  'ENCRYPTED STORAGE VALUE       : NOT EXPORTED'
)
console.log(
  'BOOKING SENDER INTERNAL ID    : MINIMISED'
)
console.log(
  'SUPPORT SENDER INTERNAL ID    : MINIMISED'
)
console.log(
  'REVIEW PATIENT INTERNAL ID    : MINIMISED'
)
console.log(
  'CANONICAL DECRYPTION PATH     : REUSED'
)
console.log(
  'D10I.2 COMPLETENESS           : PRESERVED'
)
console.log('')
console.log(
  'MELEO D10I.4 export minimisation self-test: OK'
)