import fs from 'node:fs'
import assert from 'node:assert/strict'

const pkg=
  JSON.parse(
    fs.readFileSync(
      'package.json',
      'utf8'
    )
  )

const preflight=
  fs.readFileSync(
    'scripts/release-preflight.mjs',
    'utf8'
  )

const goNoGo=
  fs.readFileSync(
    'scripts/release-go-no-go.mjs',
    'utf8'
  )

assert.equal(
  pkg.version,
  '7.0.0-rc.2'
)

assert.ok(
  preflight.includes(
    "JSON.parse(fs.readFileSync('package.json','utf8'))"
  )
)

assert.ok(
  preflight.includes(
    'version:packageInfo.version'
  )
)

assert.ok(
  preflight.includes(
    'MELEO v${packageInfo.version} production preflight'
  )
)

assert.ok(
  goNoGo.includes(
    "JSON.parse(fs.readFileSync('package.json','utf8'))"
  )
)

assert.ok(
  goNoGo.includes(
    'version:packageInfo.version'
  )
)

assert.ok(
  goNoGo.includes(
    'MELEO v${packageInfo.version} RELEASE DECISION'
  )
)

for(const stale of [
  "version:'5.7.0'",
  'MELEO v5.7 production preflight'
]){
  assert.ok(
    !preflight.includes(stale),
    'stale preflight identity remains: '+stale
  )
}

for(const stale of [
  "version:'6.2.1'",
  'MELEO v6.0 RELEASE DECISION'
]){
  assert.ok(
    !goNoGo.includes(stale),
    'stale go/no-go identity remains: '+stale
  )
}

assert.ok(
  pkg.scripts?.['release:preflight']
)

assert.ok(
  pkg.scripts?.['release:go-no-go:core']
)

assert.ok(
  pkg.scripts?.['release:production']
)

assert.ok(
  pkg.scripts?.['validate:production']
)

assert.ok(
  pkg.scripts?.['validate:production:selftest']
)

console.log(
  'RC3-D9-A production release identity self-test: PASS'
)

console.log(
  'Production release reports now inherit package version '+pkg.version
)
