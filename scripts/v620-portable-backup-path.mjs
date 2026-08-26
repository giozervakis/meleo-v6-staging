import fs from 'node:fs'
import path from 'node:path'

const backupFile =
  'scripts/backup-db.mjs'

const restoreFile =
  'scripts/restore-drill.mjs'


function clean(text) {
  return String(text)
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
}


function save(file,text) {

  const out =
    clean(text)
      .split('\n')
      .map(
        line =>
          line.replace(
            /[ \t]+$/,
            ''
          )
      )
      .join('\n')
      .replace(/\n*$/, '') +
    '\n'

  fs.writeFileSync(
    file,
    out,
    'utf8'
  )
}


function fail(message) {
  console.error(
    '[FAIL]',
    message
  )

  process.exit(1)
}


// ============================================================
// BACKUP ENGINE
// ============================================================

let backup =
  clean(
    fs.readFileSync(
      backupFile,
      'utf8'
    )
  )


/*
 * Store an evidence path that is portable across:
 *
 *   Windows host
 *   Docker bind mount
 *   Linux backup worker
 *
 * When the backup lives under process.cwd(), store a
 * cwd-relative path such as:
 *
 *   backups/meleo-....dump
 *
 * instead of a container-specific:
 *
 *   /work/backups/meleo-....dump
 */

if (
  !backup.includes(
    'function portableEvidencePath'
  )
) {

  const anchor =
`function redactDatabaseUrl(url) {`

  const helper =
`function portableEvidencePath(file) {

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


function redactDatabaseUrl(url) {`

  if (!backup.includes(anchor)) {
    fail(
      'Could not locate backup path helper anchor.'
    )
  }

  backup =
    backup.replace(
      anchor,
      helper
    )
}


/*
 * Existing report:
 *
 * file: path.resolve(output)
 *
 * becomes:
 *
 * file: portableEvidencePath(output)
 */

if (
  backup.includes(
    'file:\n      path.resolve(output)'
  )
) {

  backup =
    backup.replace(
`file:
      path.resolve(output)`,
`file:
      portableEvidencePath(
        output
      )`
    )
}
else if (
  !backup.includes(
    'portableEvidencePath(\n        output'
  )
) {
  fail(
    'Could not locate backup report file field.'
  )
}


save(
  backupFile,
  backup
)

console.log(
  '[PASS] backup evidence path is now portable'
)


// ============================================================
// RESTORE ENGINE
// ============================================================

let restore =
  clean(
    fs.readFileSync(
      restoreFile,
      'utf8'
    )
  )


/*
 * path.resolve(relative evidence path) already does exactly
 * what we need.
 *
 * Add an explicit normalized variable so the intent is
 * deterministic and self-documenting.
 */

if (
  !restore.includes(
    'const resolvedBackupPath'
  )
) {

  const blockRegex =
    /const backup =\n[\s\S]*?\n\n\nif \(\n  !backup \|\|/

  const match =
    restore.match(
      blockRegex
    )

  if (!match) {
    fail(
      'Could not locate restore backup path block.'
    )
  }

  const old =
    match[0]

  const replaced =
    old.replace(
      /\n\n\nif \(\n  !backup \|\|$/,
`
const resolvedBackupPath =
  path.resolve(
    backup
  )


if (
  !resolvedBackupPath ||`
    )

  restore =
    restore.replace(
      old,
      replaced
    )

  restore =
    restore.replace(
`!fs.existsSync(
    backup
  )`,
`!fs.existsSync(
    resolvedBackupPath
  )`
  )

  restore =
    restore.replace(
'`Backup file not found: ${backup}`',
'`Backup file not found: ${resolvedBackupPath}`'
  )


  /*
   * SHA-256 and pg_restore must use the normalized path.
   */
  restore =
    restore.replace(
`sha256(
    backup
  )`,
`sha256(
    resolvedBackupPath
  )`
  )

  restore =
    restore.replace(
`target,
    backup
  ],`,
`target,
    resolvedBackupPath
  ],`
  )


  /*
   * Report the resolved restore source without assuming
   * the original evidence was absolute.
   */
  restore =
    restore.replace(
`backup:
      path.resolve(
        backup
      ),`,
`backup:
      resolvedBackupPath,`
  )
}


save(
  restoreFile,
  restore
)

console.log(
  '[PASS] restore engine resolves portable evidence paths'
)


// ============================================================
// STRUCTURAL VALIDATION
// ============================================================

const finalBackup =
  fs.readFileSync(
    backupFile,
    'utf8'
  )

const finalRestore =
  fs.readFileSync(
    restoreFile,
    'utf8'
  )


if (
  !finalBackup.includes(
    'portableEvidencePath'
  )
) {
  fail(
    'Portable evidence helper missing.'
  )
}


if (
  !finalRestore.includes(
    'resolvedBackupPath'
  )
) {
  fail(
    'Resolved restore path missing.'
  )
}


console.log(
  '[PASS] portable backup/restore contract installed'
)
