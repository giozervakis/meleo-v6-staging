import {
  assertDrOffsiteProductionPolicy
} from '../server/dr-offsite-storage.js'


const keys = [
  'NODE_ENV',
  'DR_OFFSITE_REQUIRED',
  'DR_OFFSITE_PROVIDER',
  'DR_OFFSITE_ENDPOINT',
  'DR_OFFSITE_REGION',
  'DR_OFFSITE_BUCKET',
  'DR_OFFSITE_ACCESS_KEY_ID',
  'DR_OFFSITE_SECRET_ACCESS_KEY'
]


const original =
  Object.fromEntries(
    keys.map(
      key => [
        key,
        process.env[key]
      ]
    )
  )


function restore() {
  for (
    const key of keys
  ) {
    if (
      original[key] ==
      null
    ) {
      delete process.env[key]
    }
    else {
      process.env[key] =
        original[key]
    }
  }
}


function expectFailure(
  name,
  mutate
) {
  restore()

  process.env.NODE_ENV =
    'production'

  process.env.DR_OFFSITE_REQUIRED =
    'true'

  process.env.DR_OFFSITE_PROVIDER =
    's3'

  process.env.DR_OFFSITE_ENDPOINT =
    'https://example.invalid'

  process.env.DR_OFFSITE_REGION =
    'eu-central-1'

  process.env.DR_OFFSITE_BUCKET =
    'meleo-backups'

  process.env.DR_OFFSITE_ACCESS_KEY_ID =
    'test-access-key'

  process.env.DR_OFFSITE_SECRET_ACCESS_KEY =
    'test-secret-key'

  mutate()

  let failed =
    false

  try {
    assertDrOffsiteProductionPolicy()
  }
  catch {
    failed =
      true
  }

  if (!failed) {
    throw new Error(
      `Expected policy failure: ${name}`
    )
  }

  console.log(
    `[PASS] ${name}`
  )
}


try {
  restore()

  process.env.NODE_ENV =
    'production'

  process.env.DR_OFFSITE_REQUIRED =
    'true'

  process.env.DR_OFFSITE_PROVIDER =
    's3'

  process.env.DR_OFFSITE_ENDPOINT =
    'https://example.invalid'

  process.env.DR_OFFSITE_REGION =
    'eu-central-1'

  process.env.DR_OFFSITE_BUCKET =
    'meleo-backups'

  process.env.DR_OFFSITE_ACCESS_KEY_ID =
    'test-access-key'

  process.env.DR_OFFSITE_SECRET_ACCESS_KEY =
    'test-secret-key'

  assertDrOffsiteProductionPolicy()

  console.log(
    '[PASS] valid production off-site policy accepted'
  )


  expectFailure(
    'production without required=true rejected',
    () => {
      process.env.DR_OFFSITE_REQUIRED =
        'false'
    }
  )


  expectFailure(
    'production without provider rejected',
    () => {
      delete process.env.DR_OFFSITE_PROVIDER
    }
  )


  expectFailure(
    'production without endpoint rejected',
    () => {
      delete process.env.DR_OFFSITE_ENDPOINT
      delete process.env.S3_ENDPOINT
    }
  )


  expectFailure(
    'production without bucket rejected',
    () => {
      delete process.env.DR_OFFSITE_BUCKET
    }
  )


  expectFailure(
    'production without credentials rejected',
    () => {
      delete process.env.DR_OFFSITE_ACCESS_KEY_ID
      delete process.env.DR_OFFSITE_SECRET_ACCESS_KEY
      delete process.env.S3_ACCESS_KEY_ID
      delete process.env.S3_SECRET_ACCESS_KEY
    }
  )


  console.log('')
  console.log(
    'MELEO DR off-site policy self-test: ALL TESTS PASSED'
  )
}
finally {
  restore()
}
