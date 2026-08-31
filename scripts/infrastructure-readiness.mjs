import fs from 'node:fs'
import net from 'node:net'
import tls from 'node:tls'

if (
  process.loadEnvFile &&
  fs.existsSync('.env')
) {
  process.loadEnvFile('.env')
}

const packageInfo =
  JSON.parse(
    fs.readFileSync(
      'package.json',
      'utf8'
    )
  )

const failures = []
const checks = {}

function parsedEndpoint(value, defaultPort) {
  try {
    const u = new URL(value)

    return {
      protocol:u.protocol,
      hostname:u.hostname,
      port:Number(
        u.port ||
        defaultPort
      )
    }
  }
  catch {
    return null
  }
}

function connectTcp({
  hostname,
  port,
  secure=false,
  timeout=7000
}) {
  return new Promise(resolve => {
    let settled=false

    function finish(result) {
      if(settled) return
      settled=true
      resolve(result)
    }

    const socket =
      secure
        ? tls.connect({
            host:hostname,
            port,
            servername:hostname,
            rejectUnauthorized:true
          })
        : net.connect({
            host:hostname,
            port
          })

    socket.setTimeout(timeout)

    socket.once(
      secure ? 'secureConnect' : 'connect',
      () => {
        finish({
          ok:true,
          secure,
          authorized:
            secure
              ? Boolean(socket.authorized)
              : null
        })

        socket.end()
      }
    )

    socket.once(
      'error',
      err => {
        finish({
          ok:false,
          error:err.message
        })
      }
    )

    socket.once(
      'timeout',
      () => {
        socket.destroy()

        finish({
          ok:false,
          error:'connection timeout'
        })
      }
    )
  })
}


// ------------------------------------------------------------
// Redis connectivity
// ------------------------------------------------------------

const redisUrl =
  String(
    process.env.REDIS_URL ||
    ''
  ).trim()

if(!redisUrl) {
  failures.push(
    'REDIS_URL missing'
  )
}
else {
  const redis =
    parsedEndpoint(
      redisUrl,
      redisUrl.startsWith('rediss:')
        ? 6380
        : 6379
    )

  if(!redis) {
    failures.push(
      'REDIS_URL invalid'
    )
  }
  else {
    const secure =
      redis.protocol === 'rediss:'

    const result =
      await connectTcp({
        hostname:redis.hostname,
        port:redis.port,
        secure
      })

    checks.redis = {
      host:redis.hostname,
      port:redis.port,
      secure,
      ...result
    }

    if(!result.ok) {
      failures.push(
        'Redis connectivity check failed: '+
        String(result.error || 'unknown')
      )
    }

    if(
      secure &&
      result.ok &&
      result.authorized !== true
    ) {
      failures.push(
        'Redis TLS connection is not authorized'
      )
    }
  }
}


// ------------------------------------------------------------
// S3 endpoint connectivity
// ------------------------------------------------------------

const s3Endpoint =
  String(
    process.env.S3_ENDPOINT ||
    ''
  ).trim()

if(!s3Endpoint) {
  failures.push(
    'S3_ENDPOINT missing'
  )
}
else {
  const endpoint =
    parsedEndpoint(
      s3Endpoint,
      s3Endpoint.startsWith('https:')
        ? 443
        : 80
    )

  if(!endpoint) {
    failures.push(
      'S3_ENDPOINT invalid'
    )
  }
  else {
    if(
      endpoint.protocol !== 'https:'
    ) {
      failures.push(
        'S3_ENDPOINT must use HTTPS'
      )
    }

    const result =
      await connectTcp({
        hostname:endpoint.hostname,
        port:endpoint.port,
        secure:
          endpoint.protocol === 'https:'
      })

    checks.storage = {
      host:endpoint.hostname,
      port:endpoint.port,
      protocol:endpoint.protocol,
      ...result
    }

    if(!result.ok) {
      failures.push(
        'S3 endpoint connectivity check failed: '+
        String(result.error || 'unknown')
      )
    }

    if(
      endpoint.protocol === 'https:' &&
      result.ok &&
      result.authorized !== true
    ) {
      failures.push(
        'S3 TLS connection is not authorized'
      )
    }
  }
}


// ------------------------------------------------------------
// Required storage identity
// ------------------------------------------------------------

for(const key of [
  'S3_BUCKET',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY'
]) {
  if(
    !String(
      process.env[key] ||
      ''
    ).trim()
  ) {
    failures.push(
      key+' missing'
    )
  }
}


// ------------------------------------------------------------
// Report
// ------------------------------------------------------------

const report = {
  version:
    packageInfo.version,

  checkedAt:
    new Date().toISOString(),

  checks,

  failures,

  passed:
    failures.length === 0
}

fs.mkdirSync(
  'reports',
  {
    recursive:true
  }
)

fs.writeFileSync(
  'reports/infrastructure-readiness.json',
  JSON.stringify(
    report,
    null,
    2
  )+'\n',
  'utf8'
)

console.log(
  'MELEO v'+
  packageInfo.version+
  ' infrastructure readiness: '+
  (
    report.passed
      ? 'PASS'
      : 'FAIL'
  )
)

if(
  failures.length
) {
  for(
    const failure
    of failures
  ) {
    console.error(
      ' - '+failure
    )
  }
}

process.exitCode =
  report.passed
    ? 0
    : 1
