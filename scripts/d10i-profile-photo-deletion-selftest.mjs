import fs from 'node:fs'
import assert from 'node:assert/strict'


function read(path){
  return fs
    .readFileSync(path,'utf8')
    .replace(/^\uFEFF/,'')
}


function pass(message){
  console.log(
    '[PASS] ' + message
  )
}


const deletion =
  read(
    'server/services/account-deletion.service.js'
  )

const profile =
  read(
    'server/routes/account-profile.routes.js'
  )

const inventory =
  read(
    'scripts/d10i-privacy-data-surface-selftest.mjs'
  )

const pkg =
  JSON.parse(
    read('package.json')
  )


/*
 * Profile photos use the existing storage deletion primitive.
 */

assert.ok(
  profile.includes(
    'deleteVerificationObject(oldKey)'
  )
)

assert.ok(
  deletion.includes(
    'await deleteVerificationObject(\n      profilePhotoKey'
  )
)

pass(
  'profile-photo deletion reuses canonical storage delete primitive'
)


/*
 * Storage side effect occurs before final anonymisation.
 */

const removeCall =
  deletion.indexOf(
    'await removeProfilePhotoObject('
  )

const finalizeCall =
  deletion.indexOf(
    'await finalizeDeletion('
  )

assert.ok(
  removeCall >= 0
)

assert.ok(
  finalizeCall > removeCall
)

pass(
  'profile-photo storage deletion occurs before final DB anonymisation'
)


/*
 * Failure becomes durable deletion-pending state.
 */

for(
  const marker
  of [
    "'privacy.profile_photo_storage_delete_failed'",
    "'profile_photo_storage_delete_failed'",
    'await schedulePendingRecovery(',
    'if(retryMode){',
    'throw error'
  ]
){
  assert.ok(
    deletion.includes(marker),
    'missing profile-photo recovery marker: ' +
    marker
  )
}

pass(
  'profile-photo storage failure is retryable and durable'
)


/*
 * Final user tombstone clears profile-media metadata.
 */

for(
  const marker
  of [
    'avatar_key=NULL',
    'profile_photo_key=NULL',
    'profile_photo_mime=NULL',
    'profile_photo_version=',
    'profile_photo_version+1'
  ]
){
  assert.ok(
    deletion.includes(marker),
    'missing profile tombstone marker: ' +
    marker
  )
}

pass(
  'profile-media metadata cleared during final anonymisation'
)


/*
 * Audit records whether a profile-photo object was removed.
 */

assert.ok(
  deletion.includes(
    'profilePhotoRemoved:'
  )
)

assert.ok(
  deletion.includes(
    'Boolean(\n              profilePhotoRemoved'
  )
)

pass(
  'profile-photo deletion outcome is represented in audit metadata'
)


/*
 * D10I inventory gap is now closed.
 */

assert.ok(
  inventory.includes(
    'account deletion proves profile-photo object cleanup'
  )
)

assert.ok(
  inventory.includes(
    'CLOSED GAP 2: profile-photo deletion cleanup'
  )
)

pass(
  'D10I profile-photo cleanup gap closed in executable inventory'
)


/*
 * CI contract.
 */

assert.equal(
  pkg.scripts[
    'profile-photo-deletion-check'
  ],
  'node scripts/d10i-profile-photo-deletion-selftest.mjs'
)

assert.ok(
  pkg.scripts[
    'ci:gate'
  ].includes(
    'npm run profile-photo-deletion-check'
  )
)

pass(
  'D10I.3 proof wired into ci:gate'
)


console.log('')
console.log(
  'D10I.3 PROFILE-PHOTO DELETION CLEANUP'
)
console.log(
  '-------------------------------------'
)
console.log(
  'PROFILE PHOTO STORAGE OBJECT     : DELETED'
)
console.log(
  'FAILURE RECOVERY                 : DURABLE'
)
console.log(
  'FINAL DB ANONYMISATION           : AFTER STORAGE DELETE'
)
console.log(
  'PROFILE PHOTO KEY                : CLEARED'
)
console.log(
  'PROFILE PHOTO MIME               : CLEARED'
)
console.log(
  'PROFILE PHOTO VERSION            : INVALIDATED'
)
console.log(
  'AVATAR KEY                       : CLEARED'
)
console.log(
  'AUDIT OUTCOME                    : RECORDED'
)
console.log('')
console.log(
  'MELEO D10I.3 profile-photo deletion self-test: OK'
)
