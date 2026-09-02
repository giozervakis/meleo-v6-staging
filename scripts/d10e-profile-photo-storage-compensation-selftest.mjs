import fs from 'node:fs'

const read=
  path=>
    fs.readFileSync(
      path,
      'utf8'
    )
      .replace(/^\\uFEFF/,'')
      .replace(/\\r\\n/g,'\\n')


function check(condition,message){

  if(!condition){

    console.error(
      '[FAIL]',
      message
    )

    process.exitCode=1
    return
  }

  console.log(
    '[PASS]',
    message
  )
}


const route=
  read(
    'server/routes/account-profile.routes.js'
  )

const pkg=
  JSON.parse(
    read(
      'package.json'
    )
  )


const uploadStart=
  route.indexOf(
    "app.post('/api/me/profile-photo'"
  )

const deleteStart=
  route.indexOf(
    "app.delete('/api/me/profile-photo'",
    uploadStart
  )

const upload=
  (
    uploadStart>=0 &&
    deleteStart>uploadStart
  )
    ? route.slice(
        uploadStart,
        deleteStart
      )
    : ''


check(
  upload.length>0,
  'profile photo upload route isolated'
)

check(
  upload.includes(
    'await putVerificationObject('
  ),
  'new profile object write preserved'
)

check(
  upload.includes(
    'await Users.update('
  ),
  'local profile persistence preserved'
)

check(
  upload.indexOf(
    'await putVerificationObject('
  ) <
  upload.indexOf(
    'await Users.update('
  ),
  'storage write remains before local persistence'
)

check(
  upload.includes(
    'catch(error)'
  ),
  'local persistence failure is caught'
)

check(
  upload.includes(
    'await deleteVerificationObject('
  ),
  'new object compensation exists'
)

check(
  upload.includes(
    'newKey'
  ),
  'new object key remains available for compensation'
)

const catchStart=
  upload.indexOf(
    'catch(error)'
  )

const oldDeleteStart=
  upload.lastIndexOf(
    'if(oldKey && oldKey!==newKey)'
  )

const catchBlock=
  (
    catchStart>=0 &&
    oldDeleteStart>catchStart
  )
    ? upload.slice(
        catchStart,
        oldDeleteStart
      )
    : ''

check(
  catchBlock.includes(
    'deleteVerificationObject('
  ) &&
  catchBlock.includes(
    'newKey'
  ),
  'failed local persistence deletes the new object'
)

check(
  catchBlock.includes(
    'throw error'
  ),
  'original local persistence error is rethrown'
)

check(
  oldDeleteStart>catchStart,
  'old object cleanup remains after successful local persistence'
)

check(
  upload.includes(
    'deleteVerificationObject(oldKey)'
  ),
  'old object cleanup preserved'
)

check(
  !upload.includes(
    'tx('
  ),
  'profile photo storage path does not open a DB transaction'
)

check(
  pkg.scripts?.[
    'profile-photo-storage-compensation-check'
  ] ===
    'node scripts/d10e-profile-photo-storage-compensation-selftest.mjs',
  'D10E.10B package script exists'
)

const gate=
  pkg.scripts?.[
    'ci:gate'
  ]||
  ''

const previous=
  gate.indexOf(
    'npm run stripe-customer-idempotency-check'
  )

const current=
  gate.indexOf(
    'npm run profile-photo-storage-compensation-check'
  )

check(
  previous>=0 &&
  current>previous,
  'D10E.10B chained after D10E.10A'
)


if(!process.exitCode){

  console.log('')

  console.log(
    'MELEO D10E.10B profile photo storage compensation self-test: OK'
  )
}
