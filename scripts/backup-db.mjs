import {
  spawnSync
} from 'node:child_process'

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { uploadBackupOffsite } from '../server/dr-offsite-storage.js'

if (
  process.loadEnvFile &&
  fs.existsSync('.env')
) {
  process.loadEnvFile('.env')
}


const VERSION = '6.2.0'

const databaseUrl =
  String(
    process.env.DATABASE_URL ||
    ''
  ).trim()

const backupDir =
  path.resolve(
    process.env.BACKUP_DIR ||
    'backups'
  )

const retentionDays =
  Math.max(
    1,
    Number(
      process.env.BACKUP_RETENTION_DAYS ||
      14
    )
  )

const retentionCount =
  Math.max(
    2,
    Number(
      process.env.BACKUP_RETENTION_COUNT ||
      30
    )
  )

const rpoHours =
  Math.max(
    1,
    Number(
      process.env.BACKUP_RPO_HOURS ||
      24
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


function portableEvidencePath(file) {

  const absolute =
    path.resolve(file)

  const cwd =
    path.resolve(
      process.cwd()
    )

  const relative =
    path.relative(
      cwd,
      absolute
    )

  /*
   * If file is inside cwd, use relative path.
   * Otherwise retain the absolute path.
   */
  if (
    relative &&
    !relative.startsWith('..') &&
    !path.isAbsolute(relative)
  ) {
    return relative
      .split(path.sep)
      .join('/')
  }

  return absolute
}


function redactDatabaseUrl(url) {

  try {

    const parsed =
      new URL(url)

    return {
      protocol:
        parsed.protocol,
      host:
        parsed.host,
      database:
        parsed.pathname
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


function cleanOldBackups() {

  const files =
    fs.readdirSync(
      backupDir
    )
    .filter(
      name =>
        /^meleo-.*\.dump$/.test(
          name
        )
    )
    .map(
      name => {

        const file =
          path.join(
            backupDir,
            name
          )

        const stat =
          fs.statSync(file)

        return {
          file,
          name,
          mtimeMs:
            stat.mtimeMs
        }
      }
    )
    .sort(
      (a,b) =>
        b.mtimeMs -
        a.mtimeMs
    )


  const cutoff =
    Date.now() -
    (
      retentionDays *
      24 *
      60 *
      60 *
      1000
    )


  const removals =
    files.filter(
      (entry,index) =>
        index >= retentionCount ||
        entry.mtimeMs < cutoff
    )


  for (
    const entry
    of removals
  ) {

    try {

      fs.unlinkSync(
        entry.file
      )

      const checksumFile =
        `${entry.file}.sha256`

      if (
        fs.existsSync(
          checksumFile
        )
      ) {
        fs.unlinkSync(
          checksumFile
        )
      }

      console.log(
        '[MELEO DR] retention removed:',
        entry.name
      )

    }
    catch (err) {

      console.warn(
        '[MELEO DR] retention cleanup failed:',
        entry.name,
        err?.message ||
        String(err)
      )
    }
  }


  return {
    retained:
      files.length -
      removals.length,

    removed:
      removals.length
  }
}


if (!databaseUrl) {
  fail(
    'DATABASE_URL missing.'
  )
}


fs.mkdirSync(
  backupDir,
  {
    recursive:true
  }
)

fs.mkdirSync(
  'reports',
  {
    recursive:true
  }
)


const started =
  Date.now()

const createdAt =
  new Date()
    .toISOString()

const stamp =
  createdAt.replace(
    /[:.]/g,
    '-'
  )

const output =
  path.join(
    backupDir,
    `meleo-${stamp}.dump`
  )


const fd =
  fs.openSync(
    output,
    'w'
  )


console.log(
  '[MELEO DR] starting PostgreSQL backup'
)


let result

try {

  result =
    spawnSync(
      'pg_dump',
      [
        '--format=custom',
        '--no-owner',
        '--no-acl',
        '--dbname',
        databaseUrl
      ],
      {
        stdio:[
          'ignore',
          fd,
          'inherit'
        ]
      }
    )

}
finally {

  fs.closeSync(fd)
}


if (
  result?.error?.code ===
  'ENOENT'
) {

  try {
    fs.unlinkSync(output)
  }
  catch {}

  fail(
    'pg_dump not found. Install PostgreSQL client tools on the backup host.'
  )
}


if (
  result.status !== 0
) {

  try {
    fs.unlinkSync(output)
  }
  catch {}

  fail(
    `pg_dump failed with exit code ${result.status ?? 'unknown'}.`
  )
}


const stat =
  fs.statSync(
    output
  )


if (
  stat.size <= 0
) {
  fail(
    'Backup file is empty.'
  )
}


const checksum =
  sha256(
    output
  )


fs.writeFileSync(
  `${output}.sha256`,
  `${checksum}  ${path.basename(output)}\n`,
  'utf8'
)


const retention =
  cleanOldBackups()


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


let offsite

try {
  offsite =
    await uploadBackupOffsite({
      file:output,
      checksum
    })

  if (
    offsite.verified
  ) {
    console.log(
      '[PASS] Off-site backup verified'
    )

    console.log(
      'Remote object:',
      offsite.objectKey
    )
  }
  else {
    console.log(
      '[INFO] Off-site backup not required/configured in this environment'
    )
  }
}
catch (err) {
  console.error(
    '[FAIL] Off-site backup failed:',
    err?.message || String(err)
  )

  process.exitCode = 1
  throw err
}


const report = {

  version:
    VERSION,

  type:
    'postgresql-custom-backup',

  createdAt,

  passed:true,

  backup:{
    file:
      portableEvidencePath(
        output
      ),

    sizeBytes:
      stat.size,

    sha256:
      checksum,

    format:
      'custom',

    compressed:
      true,

    offsite,
  },

  database:
    redactDatabaseUrl(
      databaseUrl
    ),

  policy:{
    rpoHours,
    retentionDays,
    retentionCount
  },

  retention,

  durationSeconds
}


fs.writeFileSync(
  'reports/backup-latest.json',
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
  'MELEO database backup: PASS'
)

console.log(
  'File:',
  output
)

console.log(
  'Size:',
  stat.size,
  'bytes'
)

console.log(
  'SHA-256:',
  checksum
)

console.log(
  'Duration:',
  durationSeconds,
  'seconds'
)
