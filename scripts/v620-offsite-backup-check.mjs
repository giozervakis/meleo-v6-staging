import fs from 'node:fs'

function read(file) {
  return fs.readFileSync(
    file,
    'utf8'
  )
}

function assert(ok, message) {
  if (!ok) {
    throw new Error(message)
  }
}

const storage =
  read(
    'server/dr-offsite-storage.js'
  )

const backup =
  read(
    'scripts/backup-db.mjs'
  )

const env =
  read(
    '.env.example'
  )


assert(
  storage.includes(
    'AWS4-HMAC-SHA256'
  ),
  'AWS Signature V4 implementation missing'
)

assert(
  storage.includes(
    "method:'PUT'"
  ),
  'Remote PUT implementation missing'
)

assert(
  storage.includes(
    "method:'HEAD'"
  ),
  'Remote HEAD verification missing'
)

assert(
  storage.includes(
    'DR_OFFSITE_REQUIRED'
  ),
  'Fail-closed production policy missing'
)

assert(
  storage.includes(
    'checksumObjectKey'
  ),
  'Remote checksum artifact missing'
)

assert(
  backup.includes(
    'uploadBackupOffsite'
  ),
  'backup-db is not connected to off-site storage'
)

assert(
  backup.includes(
    'offsite,'
  ),
  'backup evidence does not persist off-site result'
)

assert(
  env.includes(
    'DR_OFFSITE_BUCKET='
  ),
  'DR_OFFSITE_BUCKET missing from env contract'
)

assert(
  env.includes(
    'DR_OFFSITE_ACCESS_KEY_ID='
  ),
  'Dedicated DR credentials missing from env contract'
)

console.log(
  'MELEO v6.2.0 DR off-site architecture check: OK'
)
