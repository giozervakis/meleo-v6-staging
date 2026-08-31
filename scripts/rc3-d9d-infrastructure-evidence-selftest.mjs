import fs from 'node:fs'
import assert from 'node:assert/strict'

const tls=
  fs.readFileSync(
    'scripts/tls-readiness.mjs',
    'utf8'
  )

const infra=
  fs.readFileSync(
    'scripts/infrastructure-readiness.mjs',
    'utf8'
  )

const goNoGo=
  fs.readFileSync(
    'scripts/release-go-no-go.mjs',
    'utf8'
  )

const pkg=
  JSON.parse(
    fs.readFileSync(
      'package.json',
      'utf8'
    )
  )

assert.ok(
  tls.includes(
    "version:packageInfo.version"
  )
)

assert.ok(
  !tls.includes(
    "version:'5.7.0'"
  )
)

assert.ok(
  infra.includes(
    'reports/infrastructure-readiness.json'
  )
)

assert.ok(
  infra.includes(
    'REDIS_URL missing'
  )
)

assert.ok(
  infra.includes(
    'S3_ENDPOINT missing'
  )
)

assert.ok(
  infra.includes(
    'S3_ENDPOINT must use HTTPS'
  )
)

assert.ok(
  infra.includes(
    'Redis connectivity check failed'
  )
)

assert.ok(
  infra.includes(
    'S3 endpoint connectivity check failed'
  )
)

assert.ok(
  goNoGo.includes(
    "['infrastructure','reports/infrastructure-readiness.json']"
  )
)

assert.equal(
  pkg.scripts?.['release:infrastructure'],
  'node scripts/infrastructure-readiness.mjs'
)

console.log(
  'RC3-D9-D infrastructure evidence self-test: PASS'
)

console.log(
  'Release GO/NO-GO now requires live Redis/S3 infrastructure evidence.'
)
