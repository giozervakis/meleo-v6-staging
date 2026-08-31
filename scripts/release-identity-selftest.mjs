import fs from 'node:fs'
import assert from 'node:assert/strict'

const pkg =
  JSON.parse(
    fs.readFileSync(
      'package.json',
      'utf8'
    )
  )

const lock =
  JSON.parse(
    fs.readFileSync(
      'package-lock.json',
      'utf8'
    )
  )

const vite =
  fs.readFileSync(
    'vite.config.ts',
    'utf8'
  )

const frontendVersion =
  fs.readFileSync(
    'src/version.ts',
    'utf8'
  )

const manifest =
  fs.readFileSync(
    'scripts/release-manifest.mjs',
    'utf8'
  )

assert.equal(
  pkg.version,
  '7.0.0-rc.2'
)

assert.equal(
  lock.version,
  pkg.version
)

assert.equal(
  lock.packages?.['']?.version,
  pkg.version
)

assert.ok(
  pkg.version.includes('-rc.')
)

assert.ok(
  vite.includes('__MELEO_BUILD_SHA__') &&
  vite.includes('RENDER_GIT_COMMIT') &&
  vite.includes('GIT_COMMIT')
)

assert.ok(
  frontendVersion.includes('BUILD_SHA') &&
  frontendVersion.includes('BUILD_SHA_SHORT')
)

assert.ok(
  manifest.includes('version:packageInfo.version') &&
  manifest.includes("packageInfo.version.includes('-rc.')?'release-candidate':'production'") &&
  manifest.includes('gitCommit()')
)

for (const stale of [
  "version:'6.2.1'",
  "channel:'production'",
  'release-manifest-v6.2.1.json',
  'MELEO v6.0 release manifest'
]) {
  assert.ok(
    !manifest.includes(stale),
    `Stale release identity remains: ${stale}`
  )
}

console.log(
  `MELEO release/version traceability self-test: OK · v${pkg.version}`
)