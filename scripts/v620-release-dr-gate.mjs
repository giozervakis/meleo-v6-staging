import fs from 'node:fs'
import { spawnSync } from 'node:child_process'

const production =
  process.env.NODE_ENV === 'production'

function fail(message) {
  console.error('')
  console.error(
    '[MELEO RELEASE DR GATE] BLOCKED'
  )
  console.error(
    message
  )
  process.exit(1)
}

function run(script) {
  const result =
    spawnSync(
      process.execPath,
      [script],
      {
        stdio:'inherit',
        env:process.env
      }
    )

  if (
    result.status !== 0
  ) {
    fail(
      `${script} failed`
    )
  }
}

function readJson(file) {
  if (
    !fs.existsSync(file)
  ) {
    fail(
      `Required DR evidence missing: ${file}`
    )
  }

  try {
    return JSON.parse(
      fs.readFileSync(
        file,
        'utf8'
      )
    )
  }
  catch {
    fail(
      `Invalid DR evidence JSON: ${file}`
    )
  }
}


console.log('')
console.log(
  '=============================================='
)

console.log(
  ' MELEO v6.2.0 RELEASE DR GATE'
)

console.log(
  '=============================================='
)


// ------------------------------------------------------------
// Re-evaluate current evidence.
// ------------------------------------------------------------

run(
  'scripts/v620-dr-evidence-gate.mjs'
)

run(
  'scripts/v620-dr-evidence-sign.mjs'
)


const evidence =
  readJson(
    'reports/dr-evidence-gate-latest.json'
  )

const manifest =
  readJson(
    'reports/dr-evidence-manifest.json'
  )


if (
  evidence.ok !== true
) {
  fail(
    'DR evidence gate is not GREEN'
  )
}


if (
  evidence.backup?.reportedSuccess !== true
) {
  fail(
    'Latest database backup is not successful'
  )
}


if (
  evidence.backup?.artifact?.declared !== true ||
  evidence.backup?.artifact?.exists !== true
) {
  fail(
    'Latest backup artifact is missing'
  )
}


if (
  evidence.backup?.artifact?.checksumMatches !== true
) {
  fail(
    'Latest backup checksum is invalid'
  )
}


if (
  evidence.restore?.reportedSuccess !== true
) {
  fail(
    'Latest restore drill is not successful'
  )
}


if (
  evidence.restore?.backupIntegrityVerified !== true
) {
  fail(
    'Restore drill did not verify backup integrity'
  )
}


if (
  evidence.restore?.withinRto !== true
) {
  fail(
    'Restore drill exceeded configured RTO'
  )
}


// ------------------------------------------------------------
// Production adds stronger requirements.
// ------------------------------------------------------------

if (production) {

  if (
    evidence.backup?.offsite?.required !== true
  ) {
    fail(
      'Production release requires off-site backup policy'
    )
  }

  if (
    evidence.backup?.offsite?.verified !== true
  ) {
    fail(
      'Production release requires a verified remote backup'
    )
  }

  if (
    !process.env.DR_EVIDENCE_SIGNING_KEY ||
    process.env.DR_EVIDENCE_SIGNING_KEY.length < 32
  ) {
    fail(
      'Production release requires DR_EVIDENCE_SIGNING_KEY >= 32 characters'
    )
  }

  if (
    !String(
      manifest.algorithm || ''
    )
      .toUpperCase()
      .includes('HMAC')
  ) {
    fail(
      'Production DR evidence must use HMAC signing'
    )
  }

  const unsigned =
    (manifest.files || [])
      .filter(
        item =>
          !item.signature
      )

  if (
    unsigned.length
  ) {
    fail(
      'Production DR evidence contains unsigned files'
    )
  }
}


console.log('')
console.log(
  '[PASS] backup evidence'
)

console.log(
  '[PASS] backup checksum'
)

console.log(
  '[PASS] restore drill'
)

console.log(
  '[PASS] recovery RTO'
)

if (production) {
  console.log(
    '[PASS] verified off-site backup'
  )

  console.log(
    '[PASS] signed DR evidence'
  )
}
else {
  console.log(
    '[INFO] development mode: off-site/signature production enforcement deferred'
  )
}


console.log('')
console.log(
  '=============================================='
)

console.log(
  ' MELEO RELEASE DR GATE: GREEN'
)

console.log(
  '=============================================='
)
