import fs from 'node:fs'
import assert from 'node:assert/strict'

const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
const launch=fs.readFileSync('scripts/launch-guard.mjs','utf8')
const manifest=fs.readFileSync('scripts/release-manifest.mjs','utf8')
const promotion=fs.readFileSync('scripts/final-release-promotion-gate.mjs','utf8')

assert.equal(pkg.version,'7.0.0-rc.2')

for(const stale of [
  "RELEASE_TAG!=='v6.2.1'",
  'release-manifest-v6.2.1.json',
  "version:'6.2.1'",
  'MELEO v6.0 launch guard',
  'v6.0 release evidence decision'
]){
  assert.ok(!launch.includes(stale),'stale launch guard identity: '+stale)
}

assert.ok(launch.includes('const expectedTag='))
assert.ok(launch.includes('packageInfo.version'))
assert.ok(launch.includes('release-manifest-v'))

assert.ok(
  manifest.includes(
    "packageInfo.version.includes('-rc.')?'release-candidate':'production'"
  )
)

for(const token of [
  '7.0.0-rc.2',
  'PROMOTE_RELEASE',
  'release-go-no-go decision is not GO',
  'release-go-no-go version does not match RC package version',
  'RC release manifest commit does not match Git HEAD',
  'reports/infrastructure-readiness.json',
  'reports/dr-evidence-gate-latest.json',
  'reports/dr-evidence-manifest.json',
  'targetVersion',
  '7.0.0',
  'No package version mutation was performed.'
]){
  assert.ok(promotion.includes(token),'promotion gate missing: '+token)
}

assert.ok(!promotion.includes("writeFileSync('package.json'"))

assert.equal(
  pkg.scripts?.['release:promotion-gate'],
  'node scripts/final-release-promotion-gate.mjs'
)

console.log('RC3-D9-F final release gate self-test: PASS')
console.log('RC promotion is blocked until fresh production evidence and explicit human approval exist.')
