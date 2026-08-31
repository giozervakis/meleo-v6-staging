import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const root = process.cwd()

function envNumber(name, fallback) {
  const n = Number(process.env[name])

  return Number.isFinite(n)
    ? n
    : fallback
}

function bool(value) {
  return [
    '1',
    'true',
    'yes',
    'on'
  ].includes(
    String(value || '')
      .trim()
      .toLowerCase()
  )
}

function ensureReports() {
  fs.mkdirSync(
    path.join(root, 'reports'),
    { recursive: true }
  )
}

function writeEvidence(value) {
  ensureReports()

  fs.writeFileSync(
    path.join(
      root,
      'reports',
      'dr-evidence-gate-latest.json'
    ),
    JSON.stringify(
      value,
      null,
      2
    ) + '\n',
    'utf8'
  )
}

function fail(message, extra = {}) {
  const evidence = {
    ok: false,
    checkedAt: new Date().toISOString(),
    message,
    ...extra
  }

  writeEvidence(evidence)

  console.error(
    `[FAIL] ${message}`
  )

  process.exit(1)
}

function readJson(file) {
  if (!fs.existsSync(file)) {
    fail(
      `Required DR evidence missing: ${
        path.relative(root, file)
      }`
    )
  }

  try {
    return JSON.parse(
      fs.readFileSync(
        file,
        'utf8'
      )
    )
  } catch (err) {
    fail(
      `Invalid DR evidence JSON: ${
        path.relative(root, file)
      }`,
      {
        error:
          err?.message ||
          String(err)
      }
    )
  }
}

function firstValue(obj, names) {
  for (const name of names) {
    if (
      obj &&
      obj[name] !== undefined &&
      obj[name] !== null
    ) {
      return obj[name]
    }
  }

  return undefined
}

function findTimestamp(obj) {
  return firstValue(
    obj,
    [
      'completedAt',
      'finishedAt',
      'timestamp',
      'createdAt',
      'generatedAt',
      'backupAt',
      'restoredAt',
      'checkedAt'
    ]
  )
}

function findSuccess(obj) {
  const value =
    firstValue(
      obj,
      [
        'ok',
        'success',
        'passed',
        'pass'
      ]
    )

  if (
    typeof value ===
    'boolean'
  ) {
    return value
  }

  const status =
    String(
      firstValue(
        obj,
        [
          'status',
          'result'
        ]
      ) || ''
    )
      .trim()
      .toLowerCase()

  if (
    [
      'ok',
      'passed',
      'pass',
      'success',
      'successful',
      'completed'
    ].includes(status)
  ) {
    return true
  }

  if (
    [
      'failed',
      'failure',
      'error'
    ].includes(status)
  ) {
    return false
  }

  return undefined
}

function ageHours(timestamp) {
  const t =
    Date.parse(
      String(timestamp || '')
    )

  if (!Number.isFinite(t)) {
    return Infinity
  }

  return (
    Date.now() - t
  ) / 3600000
}

function findNumber(obj, keys) {
  for (const key of keys) {
    const value =
      Number(
        obj?.[key]
      )

    if (Number.isFinite(value)) {
      return value
    }
  }

  return null
}

function sha256File(file) {
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

    while (true) {
      const bytes =
        fs.readSync(
          fd,
          buffer,
          0,
          buffer.length,
          null
        )

      if (!bytes) break

      hash.update(
        buffer.subarray(
          0,
          bytes
        )
      )
    }
  } finally {
    fs.closeSync(fd)
  }

  return hash.digest('hex')
}

function resolveArtifact(value) {
  if (!value) {
    return null
  }

  const raw =
    String(value)

  if (path.isAbsolute(raw)) {
    return path.normalize(raw)
  }

  return path.resolve(
    root,
    raw
  )
}


// ============================================================
// Evidence inputs
// ============================================================

const backupEvidenceFile =
  path.join(
    root,
    'reports',
    'backup-latest.json'
  )

const restoreEvidenceFile =
  path.join(
    root,
    'reports',
    'restore-drill-latest.json'
  )

const backup =
  readJson(
    backupEvidenceFile
  )

const restore =
  readJson(
    restoreEvidenceFile
  )


// ============================================================
// Policy
// ============================================================

const maxBackupAgeHours =
  envNumber(
    'DR_BACKUP_MAX_AGE_HOURS',
    24
  )

const maxRestoreAgeHours =
  envNumber(
    'DR_RESTORE_MAX_AGE_HOURS',
    168
  )

const maxRtoSeconds =
  envNumber(
    'DR_MAX_RTO_SECONDS',
    900
  )

const production =
  process.env.NODE_ENV ===
  'production'

const offsiteRequired =
  bool(
    process.env
      .DR_OFFSITE_REQUIRED
  )


// ============================================================
// Evidence age
// ============================================================

const backupTimestamp =
  findTimestamp(
    backup
  )

const restoreTimestamp =
  findTimestamp(
    restore
  )

if (!backupTimestamp) {
  fail(
    'backup-latest.json has no recognizable timestamp'
  )
}

if (!restoreTimestamp) {
  fail(
    'restore-drill-latest.json has no recognizable timestamp'
  )
}

const backupAge =
  ageHours(
    backupTimestamp
  )

const restoreAge =
  ageHours(
    restoreTimestamp
  )

if (
  backupAge >
  maxBackupAgeHours
) {
  fail(
    `Backup evidence is stale: ${
      backupAge.toFixed(2)
    }h > ${maxBackupAgeHours}h`
  )
}

if (
  restoreAge >
  maxRestoreAgeHours
) {
  fail(
    `Restore-drill evidence is stale: ${
      restoreAge.toFixed(2)
    }h > ${maxRestoreAgeHours}h`
  )
}


// ============================================================
// Reported success
// ============================================================

const backupSuccess =
  findSuccess(
    backup
  )

const restoreSuccess =
  findSuccess(
    restore
  )

if (backupSuccess !== true) {
  fail(
    'Latest database backup evidence does not explicitly report success'
  )
}

if (restoreSuccess !== true) {
  fail(
    'Latest restore drill evidence does not explicitly report success'
  )
}


// ============================================================
// REAL backup artifact
//
// v6.2 backup schema:
// backup.backup.file
// backup.backup.sizeBytes
// backup.backup.sha256
// ============================================================

const backupArtifact =
  firstValue(
    backup?.backup,
    [
      'file',
      'backupFile',
      'path',
      'artifact',
      'output'
    ]
  ) ??
  firstValue(
    backup,
    [
      'backupFile',
      'file',
      'path',
      'artifact',
      'output'
    ]
  )

if (!backupArtifact) {
  fail(
    'Backup evidence does not declare a backup artifact'
  )
}

const artifactPath =
  resolveArtifact(
    backupArtifact
  )

if (
  !artifactPath ||
  !fs.existsSync(
    artifactPath
  )
) {
  fail(
    `Declared backup artifact does not exist: ${backupArtifact}`
  )
}

const stat =
  fs.statSync(
    artifactPath
  )

if (!stat.isFile()) {
  fail(
    `Declared backup artifact is not a file: ${backupArtifact}`
  )
}

if (stat.size <= 0) {
  fail(
    'Declared backup artifact is empty'
  )
}

const actualArtifactSha256 =
  sha256File(
    artifactPath
  )

const declaredArtifactSha256 =
  String(
    firstValue(
      backup?.backup,
      [
        'sha256',
        'checksum',
        'hash'
      ]
    ) ??
    firstValue(
      backup,
      [
        'sha256',
        'checksum',
        'hash'
      ]
    ) ??
    ''
  )
    .trim()
    .toLowerCase()

if (!declaredArtifactSha256) {
  fail(
    'Backup evidence does not declare artifact SHA-256'
  )
}

if (
  actualArtifactSha256 !==
  declaredArtifactSha256
) {
  fail(
    'Backup artifact SHA-256 does not match backup evidence',
    {
      expected:
        declaredArtifactSha256,

      actual:
        actualArtifactSha256
    }
  )
}

const declaredSize =
  Number(
    backup?.backup
      ?.sizeBytes
  )

if (
  Number.isFinite(
    declaredSize
  ) &&
  declaredSize !==
    stat.size
) {
  fail(
    'Backup artifact size does not match backup evidence',
    {
      expectedBytes:
        declaredSize,

      actualBytes:
        stat.size
    }
  )
}


// ============================================================
// REAL restore RTO
//
// v6.2 restore schema:
// restore.recovery.durationSeconds
// restore.recovery.rtoPassed
// ============================================================

const rtoSeconds =
  findNumber(
    restore?.recovery,
    [
      'rtoSeconds',
      'durationSeconds',
      'restoreSeconds',
      'elapsedSeconds'
    ]
  ) ??
  findNumber(
    restore,
    [
      'rtoSeconds',
      'durationSeconds',
      'restoreSeconds',
      'elapsedSeconds'
    ]
  )

if (
  rtoSeconds === null
) {
  fail(
    'Restore evidence does not contain a measurable RTO'
  )
}

if (
  rtoSeconds >
  maxRtoSeconds
) {
  fail(
    `Restore RTO exceeded: ${rtoSeconds}s > ${maxRtoSeconds}s`,
    {
      rtoSeconds,
      maxRtoSeconds
    }
  )
}

if (
  restore?.recovery
    ?.rtoPassed === false
) {
  fail(
    'Restore evidence reports RTO failure'
  )
}


// ============================================================
// Restore must reference the same backup checksum
// ============================================================

const restoredSha256 =
  String(
    restore?.backup
      ?.sha256 ||
    ''
  )
    .trim()
    .toLowerCase()

const restoreIntegrity =
  restore?.backup
    ?.integrityVerified

if (
  restoredSha256 &&
  restoredSha256 !==
    actualArtifactSha256
) {
  fail(
    'Restore drill used a backup with a different SHA-256',
    {
      backupSha256:
        actualArtifactSha256,

      restoreSha256:
        restoredSha256
    }
  )
}

if (
  restoreIntegrity === false
) {
  fail(
    'Restore drill reports backup integrity failure'
  )
}


// ============================================================
// Off-site status
//
// Part 3C-B2 will populate concrete remote object evidence.
// Do NOT pretend that policy configuration means an upload happened.
// ============================================================

const offsite =
  backup?.backup?.offsite ||
  backup?.offsite ||
  null

const offsiteVerified =
  Boolean(
    offsite &&
    (
      offsite.verified === true ||
      offsite.uploaded === true
    ) &&
    offsite.objectKey
  )

if (
  production &&
  offsiteRequired &&
  !offsiteVerified
) {
  fail(
    'Production requires verified off-site backup evidence, but no verified remote object is recorded.'
  )
}


// ============================================================
// Final evidence
// ============================================================

const result = {
  ok:true,

  checkedAt:
    new Date()
      .toISOString(),

  policy:{
    maxBackupAgeHours,
    maxRestoreAgeHours,
    maxRtoSeconds,

    offsiteRequired:
      production &&
      offsiteRequired
  },

  backup:{
    timestamp:
      backupTimestamp,

    ageHours:
      Number(
        backupAge
          .toFixed(4)
      ),

    reportedSuccess:
      backupSuccess,

    artifact:{
      declared:true,

      file:
        String(
          backupArtifact
        )
          .replaceAll(
            '\\',
            '/'
          ),

      exists:true,

      sizeBytes:
        stat.size,

      declaredSizeBytes:
        Number.isFinite(
          declaredSize
        )
          ? declaredSize
          : null,

      sha256:
        actualArtifactSha256,

      checksumMatches:true,

      sizeMatches:
        Number.isFinite(
          declaredSize
        )
          ? declaredSize ===
            stat.size
          : null
    },

    offsite:{
      required:
        production &&
        offsiteRequired,

      verified:
        offsiteVerified,

      provider:
        offsite?.provider ||
        null,

      bucket:
        offsite?.bucket ||
        null,

      objectKey:
        offsite?.objectKey ||
        null
    }
  },

  restore:{
    timestamp:
      restoreTimestamp,

    ageHours:
      Number(
        restoreAge
          .toFixed(4)
      ),

    reportedSuccess:
      restoreSuccess,

    rtoSeconds,

    withinRto:true,

    backupIntegrityVerified:
      restoreIntegrity ===
      true,

    checksumMatchesBackup:
      restoredSha256
        ? restoredSha256 ===
          actualArtifactSha256
        : null,

    verification:
      restore?.verification ||
      null
  }
}

writeEvidence(
  result
)

console.log(
  JSON.stringify(
    result,
    null,
    2
  )
)

console.log('')
console.log(
  'MELEO DR evidence gate: GREEN'
)
