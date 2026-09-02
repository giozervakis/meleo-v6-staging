import {
  isTransientPostgresError
} from '../server/relational/pool.js'


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


const transientCodes = [
  '08000',
  '08001',
  '08003',
  '08004',
  '08006',
  '08007',
  '08P01',
  '57P01',
  '57P02',
  '57P03',
  '53300'
]


for(
  const code of transientCodes
){
  check(
    isTransientPostgresError({
      code
    }) === true,
    `${code} classified transient`
  )
}


const transientSystemCodes = [
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  'ENETUNREACH',
  'EHOSTUNREACH'
]


for(
  const code of transientSystemCodes
){
  check(
    isTransientPostgresError({
      code
    }) === true,
    `${code} classified transient`
  )
}


const nonTransientCodes = [
  '23505',
  '23503',
  '23502',
  '22P02',
  '42501',
  '42P01',
  '57014',
  '40001',
  '40P01'
]


for(
  const code of nonTransientCodes
){
  check(
    isTransientPostgresError({
      code
    }) === false,
    `${code} not classified as connection transient`
  )
}


check(
  isTransientPostgresError(
    new Error(
      'connection terminated unexpectedly'
    )
  ) === true,
  'connection-terminated message classified transient'
)


check(
  isTransientPostgresError(
    new Error(
      'socket hang up'
    )
  ) === true,
  'socket hang-up message classified transient'
)


check(
  isTransientPostgresError(
    new Error(
      'duplicate key value violates unique constraint'
    )
  ) === false,
  'business/data error message not classified transient'
)


check(
  isTransientPostgresError(null) === false,
  'null is not transient'
)


if(failures.length){
  console.error('')
  console.error(
    `MELEO D10G.2 PostgreSQL transient classifier: ${failures.length} failure(s)`
  )
  process.exit(1)
}


console.log('')
console.log(
  'MELEO D10G.2 PostgreSQL transient classifier self-test: OK'
)