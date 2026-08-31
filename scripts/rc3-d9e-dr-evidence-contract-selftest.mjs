import fs from 'node:fs'
import assert from 'node:assert/strict'

const restore=
  fs.readFileSync(
    'scripts/restore-drill.mjs',
    'utf8'
  )

const evidence=
  fs.readFileSync(
    'scripts/v620-dr-evidence-gate.mjs',
    'utf8'
  )

const releaseDr=
  fs.readFileSync(
    'scripts/v620-release-dr-gate.mjs',
    'utf8'
  )

const goNoGo=
  fs.readFileSync(
    'scripts/release-go-no-go.mjs',
    'utf8'
  )

assert.ok(
  restore.includes(
    "'reports/restore-drill-latest.json'"
  )
)

assert.ok(
  !restore.includes(
    "'reports/restore-drill.json'"
  )
)

assert.ok(
  evidence.includes(
    "'restore-drill-latest.json'"
  )
)

assert.ok(
  goNoGo.includes(
    "'reports/restore-drill-latest.json'"
  )
)

assert.ok(
  !goNoGo.includes(
    "'reports/restore-drill.json'"
  )
)

assert.ok(
  evidence.includes(
    'backup?.backup?.offsite'
  )
)

assert.ok(
  evidence.includes(
    'Backup evidence is stale:'
  )
)

assert.ok(
  evidence.includes(
    'Restore-drill evidence is stale:'
  )
)

assert.ok(
  evidence.includes(
    'Backup artifact SHA-256 does not match backup evidence'
  )
)

assert.ok(
  evidence.includes(
    'Restore RTO exceeded:'
  )
)

assert.ok(
  evidence.includes(
    'Restore drill used a backup with a different SHA-256'
  )
)

assert.ok(
  releaseDr.includes(
    'packageInfo.version'
  )
)

assert.ok(
  !releaseDr.includes(
    'MELEO v6.2.0 RELEASE DR GATE'
  )
)

console.log(
  'RC3-D9-E DR evidence contract self-test: PASS'
)

console.log(
  'Backup, restore, off-site and release evidence now share one canonical contract.'
)
