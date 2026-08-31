import { spawn, spawnSync } from 'node:child_process'

/*
 * Render staging launcher refuses production explicitly.
 * This prevents a staging startup command from becoming an
 * accidental production entry point through dashboard/config drift.
 */
if (
  String(process.env.NODE_ENV || '')
    .trim()
    .toLowerCase() === 'production' ||
  String(process.env.MELEO_DEPLOYMENT_ENV || '')
    .trim()
    .toLowerCase() === 'production'
) {
  console.error(
    '[MELEO Render staging] REFUSED: staging launcher cannot run production.'
  )
  process.exit(1)
}

const children = []
let stopping = false

function start(label, args) {
  const child = spawn(
    process.execPath,
    args,
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        INSTANCE_ID:
          process.env.INSTANCE_ID ||
          `render-staging-${label}`
      }
    }
  )

  children.push(child)

  child.on('exit', (code, signal) => {
    if (stopping) return

    console.error(
      `[MELEO Render staging] ${label} exited`,
      { code, signal }
    )

    shutdown(code ?? 1)
  })

  return child
}

function shutdown(code = 0) {
  if (stopping) return

  stopping = true

  for (const c of children) {
    try {
      c.kill('SIGTERM')
    } catch {}
  }

  setTimeout(
    () => process.exit(code),
    1500
  ).unref()
}

process.on(
  'SIGTERM',
  () => shutdown(0)
)

process.on(
  'SIGINT',
  () => shutdown(0)
)

/*
 * --------------------------------------------------
 * TEMPORARY STAGING E2E RESET
 * --------------------------------------------------
 *
 * Runs only when:
 *   NODE_ENV=staging
 *   E2E_MODE=1
 *   RUN_E2E_RESET_ON_BOOT=1
 *
 * Remove this block after the staging database
 * has been repaired.
 */

if (
  process.env.NODE_ENV === 'staging' &&
  process.env.E2E_MODE === '1' &&
  process.env.RUN_E2E_RESET_ON_BOOT === '1'
) {
  console.log(
    '[MELEO Render staging] running one-time E2E database reset'
  )

  const result = spawnSync(
    process.execPath,
    ['scripts/e2e-reset-staging.mjs'],
    {
      stdio: 'inherit',
      env: process.env
    }
  )

  if (result.status !== 0) {
    console.error(
      '[MELEO Render staging] E2E reset failed'
    )

    process.exit(
      result.status || 1
    )
  }

  console.log(
    '[MELEO Render staging] E2E reset completed successfully'
  )
}

console.log(
  '[MELEO Render staging] starting API + background worker in one free Web Service'
)

start(
  'api',
  ['server/index.js']
)

// Give API/migrations a short head start before
// the worker opens its own pool.
setTimeout(
  () => {
    if (!stopping) {
      start(
        'worker',
        ['server/worker.js']
      )
    }
  },
  5000
)