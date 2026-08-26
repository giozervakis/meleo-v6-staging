import {
  spawnSync
} from 'node:child_process'

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'


if (
  process.loadEnvFile &&
  fs.existsSync('.env')
) {
  process.loadEnvFile('.env')
}


const VERSION = '6.2.0'

const productionUrl =
  String(
    process.env.DATABASE_URL ||
    ''
  ).trim()

const target =
  String(
    process.env.RESTORE_DATABASE_URL ||
    ''
  ).trim()

const allowed =
  String(
    process.env.ALLOW_RESTORE_DRILL ||
    ''
  )
  .trim()
  .toUpperCase() ===
  'YES'

const rtoMinutes =
  Math.max(
    1,
    Number(
      process.env.BACKUP_RTO_MINUTES ||
      30
    )
  )


function fail(message) {

  console.error(
    `[MELEO DR] ${message}`
  )

  process.exit(1)
}


function sha256(file) {

  const hash =
    crypto.createHash(
      'sha256'
    )

  const fd =
    fs.openSync(
      file,
      'r'
    )

  try {

    const buffer =
      Buffer.allocUnsafe(
        1024 * 1024
      )

    let bytes

    do {

      bytes =
        fs.readSync(
          fd,
          buffer,
          0,
          buffer.length,
          null
        )

      if (bytes > 0) {

        hash.update(
          buffer.subarray(
            0,
            bytes
          )
        )
      }

    } while (bytes > 0)

  }
  finally {

    fs.closeSync(fd)
  }

  return hash.digest('hex')
}


function run(
  command,
  args,
  options = {}
) {

  const result =
    spawnSync(
      command,
      args,
      {
        encoding:'utf8',
        ...options
      }
    )


  if (
    result.error?.code ===
    'ENOENT'
  ) {

    fail(
      `${command} not found. Install PostgreSQL client tools.`
    )
  }


  if (
    result.status !== 0
  ) {

    if (
      result.stdout
    ) {
      console.error(
        result.stdout
      )
    }

    if (
      result.stderr
    ) {
      console.error(
        result.stderr
      )
    }

    fail(
      `${command} failed with exit code ${result.status ?? 'unknown'}.`
    )
  }


  return result
}


function safeIdentity(url) {

  try {

    const u =
      new URL(url)

    return {
      host:
        u.host,

      database:
        u.pathname
          .replace(
            /^\//,
            ''
          )
    }

  }
  catch {

    return {
      host:'unknown'
    }
  }
}


if (!allowed) {

  fail(
    'Safety stop: set ALLOW_RESTORE_DRILL=YES explicitly.'
  )
}


if (!target) {

  fail(
    'RESTORE_DATABASE_URL missing.'
  )
}


if (
  productionUrl &&
  target === productionUrl
) {

  fail(
    'Refusing restore drill: RESTORE_DATABASE_URL equals DATABASE_URL.'
  )
}


let backupReport

try {

  backupReport =
    JSON.parse(
      fs.readFileSync(
        'reports/backup-latest.json',
        'utf8'
      )
    )

}
catch {

  fail(
    'reports/backup-latest.json missing or invalid.'
  )
}


const backup =
  path.resolve(
    process.env.RESTORE_BACKUP_FILE ||
    backupReport?.backup?.file ||
    backupReport?.file ||
    ''
  )
const resolvedBackupPath =
  path.resolve(
    backup
  )


if (
  !resolvedBackupPath ||
  !fs.existsSync(
    resolvedBackupPath
  )
) {

  fail(
    `Backup file not found: ${resolvedBackupPath}`
  )
}


const expectedChecksum =
  String(
    backupReport?.backup?.sha256 ||
    ''
  )
  .trim()
  .toLowerCase()


if (
  !expectedChecksum
) {

  fail(
    'Backup metadata does not contain SHA-256 checksum.'
  )
}


const actualChecksum =
  sha256(
    resolvedBackupPath
  )


if (
  actualChecksum !==
  expectedChecksum
) {

  fail(
    'Backup SHA-256 integrity validation FAILED.'
  )
}


console.log(
  '[PASS] Backup SHA-256 verified'
)


const started =
  Date.now()


run(
  'pg_restore',
  [
    '--clean',
    '--if-exists',
    '--no-owner',
    '--no-acl',
    '--exit-on-error',
    '--dbname',
    target,
    resolvedBackupPath
  ],
  {
    stdio:'inherit'
  }
)


const verificationSql =
  `
SELECT json_build_object(
  'users',
  (
    SELECT count(*)::int
    FROM users
  ),
  'professionals',
  (
    SELECT count(*)::int
    FROM professionals
  ),
  'bookings',
  (
    SELECT count(*)::int
    FROM bookings
  ),
  'subscriptions',
  (
    SELECT count(*)::int
    FROM subscriptions
  ),
  'backgroundJobs',
  (
    SELECT count(*)::int
    FROM background_jobs
  )
)::text;
`


const verification =
  run(
    'psql',
    [
      target,
      '-X',
      '-A',
      '-t',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      verificationSql
    ]
  )


const raw =
  String(
    verification.stdout ||
    ''
  ).trim()


let counts

try {

  counts =
    JSON.parse(raw)

}
catch {

  fail(
    `Restore verification returned invalid JSON: ${raw}`
  )
}


const requiredCounts = [
  'users',
  'professionals',
  'bookings',
  'subscriptions',
  'backgroundJobs'
]


for (
  const key
  of requiredCounts
) {

  if (
    !Number.isFinite(
      Number(
        counts[key]
      )
    )
  ) {

    fail(
      `Restore verification missing valid count: ${key}`
    )
  }
}


const durationSeconds =
  Number(
    (
      (
        Date.now() -
        started
      ) /
      1000
    ).toFixed(3)
  )


const rtoPassed =
  durationSeconds <=
  (
    rtoMinutes *
    60
  )


const report = {

  version:
    VERSION,

  checkedAt:
    new Date()
      .toISOString(),

  passed:
    rtoPassed,

  backup:{
    file:
      backup,

    sha256:
      actualChecksum,

    integrityVerified:
      true
  },

  target:
    safeIdentity(
      target
    ),

  verification:{
    schemaVerified:
      true,

    coreTablesVerified:
      true,

    counts
  },

  recovery:{
    durationSeconds,

    targetRtoMinutes:
      rtoMinutes,

    rtoPassed
  }
}


fs.mkdirSync(
  'reports',
  {
    recursive:true
  }
)


fs.writeFileSync(
  'reports/restore-drill.json',
  JSON.stringify(
    report,
    null,
    2
  ) + '\n',
  'utf8'
)


fs.writeFileSync(
  'reports/restore-drill-latest.json',
  JSON.stringify(
    report,
    null,
    2
  ) + '\n',
  'utf8'
)


console.log(
  ''
)

console.log(
  `Restore drill: ${rtoPassed ? 'PASS' : 'FAIL'}`
)

console.log(
  'Restore seconds:',
  durationSeconds
)

console.log(
  'RTO target:',
  `${rtoMinutes} minutes`
)

console.log(
  'Core table counts:',
  counts
)


if (
  !rtoPassed
) {
  process.exitCode = 1
}
