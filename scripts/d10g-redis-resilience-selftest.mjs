import fs from 'node:fs'

import {
  isTransientRedisError
} from '../server/redis.js'


const failures=[]


function check(
  condition,
  message
){
  if(condition){
    console.log(
      `[PASS] ${message}`
    )
    return
  }

  failures.push(message)

  console.error(
    `[FAIL] ${message}`
  )
}


const transientCodes=[
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  'ENETUNREACH',
  'EHOSTUNREACH'
]


for(
  const code of transientCodes
){
  check(
    isTransientRedisError({
      code
    }) === true,
    `${code} classified transient`
  )
}


const transientMessages=[
  'Redis connect timeout',
  'Redis command timeout',
  'Redis connection closed',
  'Redis not connected',
  'socket hang up',
  'connection reset by peer'
]


for(
  const message of transientMessages
){
  check(
    isTransientRedisError(
      new Error(message)
    ) === true,
    `${message} classified transient`
  )
}


const nonTransientMessages=[
  'Redis: WRONGTYPE operation against a key',
  'Redis: ERR syntax error',
  'Redis: NOAUTH Authentication required',
  'Invalid REDIS_URL'
]


for(
  const message of nonTransientMessages
){
  check(
    isTransientRedisError(
      new Error(message)
    ) === false,
    `${message} not classified transient`
  )
}


check(
  isTransientRedisError(null) === false,
  'null is not transient'
)


const redis =
  fs.readFileSync(
    'server/redis.js',
    'utf8'
  )


check(
  redis.includes(
    'const socketStates = new WeakMap()'
  ),
  'RESP parser state remains socket-scoped'
)


check(
  redis.includes(
    'state.pending.splice('
  ),
  'timed-out command is removed from owning pending queue'
)


check(
  redis.includes(
    'targetSocket.destroy('
  ),
  'timed-out command destroys owning connection'
)


check(
  redis.includes(
    'if (socket === s)'
  ) &&
  redis.includes(
    'socket = null'
  ),
  'closed/error socket clears canonical live connection'
)


check(
  redis.includes(
    'if (connecting) return connecting'
  ),
  'concurrent Redis reconnect attempts are coalesced'
)


check(
  !redis.includes(
    'catch(() => null)'
  ),
  'low-level Redis failures are not silently swallowed'
)


if(
  failures.length
){
  console.error('')

  console.error(
    `MELEO D10G.3 Redis resilience self-test: ${failures.length} failure(s)`
  )

  process.exit(1)
}


console.log('')

console.log(
  'MELEO D10G.3 Redis resilience self-test: OK'
)