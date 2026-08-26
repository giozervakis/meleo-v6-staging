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

const workflow =
  read(
    '.github/workflows/dr-automation.yml'
  )

const pkg =
  JSON.parse(
    read(
      'package.json'
    )
  )

const gitignore =
  read(
    '.gitignore'
  )

const releaseGate =
  read(
    'scripts/v620-release-dr-gate.mjs'
  )


assert(
  workflow.includes(
    "cron: '17 2 * * *'"
  ),
  'daily backup schedule missing'
)

assert(
  workflow.includes(
    "cron: '43 3 * * 0'"
  ),
  'weekly restore schedule missing'
)

assert(
  workflow.includes(
    "vars.DR_AUTOMATION_ENABLED == 'true'"
  ),
  'safe automation activation gate missing'
)

assert(
  workflow.includes(
    'npm run backup:db'
  ),
  'backup automation missing'
)

assert(
  workflow.includes(
    'npm run restore:drill'
  ),
  'restore automation missing'
)

assert(
  workflow.includes(
    'npm run release:dr-gate'
  ),
  'release DR verification missing'
)

assert(
  workflow.includes(
    'DR_EVIDENCE_SIGNING_KEY'
  ),
  'DR evidence signing secret missing'
)

assert(
  workflow.includes(
    'DR_OFFSITE_BUCKET'
  ),
  'off-site backup secret contract missing'
)

assert(
  pkg.scripts[
    'release:go-no-go'
  ]?.includes(
    'release:dr-gate'
  ),
  'go/no-go does not enforce DR gate'
)

assert(
  pkg.scripts[
    'release:production'
  ]?.includes(
    'release:dr-gate'
  ),
  'production release command does not enforce DR'
)

assert(
  gitignore
    .split(/\r?\n/)
    .includes(
      'backups/'
    ),
  'backups directory is not protected by gitignore'
)

assert(
  releaseGate.includes(
    'withinRto'
  ),
  'RTO enforcement missing'
)

assert(
  releaseGate.includes(
    'offsite?.verified'
  ),
  'production off-site enforcement missing'
)

assert(
  releaseGate.includes(
    'DR_EVIDENCE_SIGNING_KEY'
  ),
  'production evidence-signature enforcement missing'
)


console.log(
  'MELEO v6.2.0 automated DR architecture check: OK'
)
