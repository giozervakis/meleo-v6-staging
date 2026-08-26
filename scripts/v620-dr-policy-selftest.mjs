import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  spawnSync
} from 'node:child_process'

function run(env) {
  return spawnSync(
    process.execPath,
    [
      'scripts/v620-dr-policy-check.mjs'
    ],
    {
      cwd:
        process.cwd(),

      env: {
        ...process.env,
        ...env
      },

      encoding:
        'utf8'
    }
  )
}

function expectFail(label, env) {
  const r = run(env)

  if (r.status === 0) {
    console.error(
      `[FAIL] ${label} was accepted`
    )

    process.exit(1)
  }

  console.log(
    `[PASS] ${label} rejected`
  )
}

function expectPass(label, env) {
  const r = run(env)

  if (r.status !== 0) {
    console.error(
      r.stdout
    )

    console.error(
      r.stderr
    )

    console.error(
      `[FAIL] ${label} rejected`
    )

    process.exit(1)
  }

  console.log(
    `[PASS] ${label} accepted`
  )
}

const safe = {
  NODE_ENV:
    'production',

  DR_OFFSITE_REQUIRED:
    'true',

  DR_OFFSITE_PROVIDER:
    's3',

  DR_OFFSITE_BUCKET:
    'meleo-production-backups',

  DR_EVIDENCE_SIGNING_KEY:
    '0123456789abcdef0123456789abcdef',

  DR_BACKUP_MAX_AGE_HOURS:
    '24',

  DR_RESTORE_MAX_AGE_HOURS:
    '168',

  DR_MAX_RTO_SECONDS:
    '900'
}

expectPass(
  'safe production DR policy',
  safe
)

expectFail(
  'production without off-site requirement',
  {
    ...safe,
    DR_OFFSITE_REQUIRED:
      'false'
  }
)

expectFail(
  'production without bucket',
  {
    ...safe,
    DR_OFFSITE_BUCKET:
      ''
  }
)

expectFail(
  'production with weak evidence key',
  {
    ...safe,
    DR_EVIDENCE_SIGNING_KEY:
      'short'
  }
)

expectFail(
  'unbounded backup age',
  {
    ...safe,
    DR_BACKUP_MAX_AGE_HOURS:
      '999'
  }
)

expectFail(
  'unbounded restore age',
  {
    ...safe,
    DR_RESTORE_MAX_AGE_HOURS:
      '9999'
  }
)

expectFail(
  'unbounded RTO',
  {
    ...safe,
    DR_MAX_RTO_SECONDS:
      '99999'
  }
)

console.log('')
console.log(
  'MELEO DR policy self-test: ALL TESTS PASSED'
)
