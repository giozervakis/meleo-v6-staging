import fs from 'node:fs'
import assert from 'node:assert/strict'

const app =
  fs.readFileSync(
    'server/relational/app.js',
    'utf8'
  )

const service =
  fs.readFileSync(
    'server/services/object-storage.service.js',
    'utf8'
  )

const infra =
  fs.readFileSync(
    'server/object-storage.js',
    'utf8'
  )

function pass(message) {
  console.log(
    '[PASS]',
    message
  )
}

assert.match(
  app,
  /object-storage\.service\.js/
)

assert.match(
  app,
  /createObjectStorageService\(\)/
)

pass(
  'app composes object-storage service'
)

assert.equal(
  app.includes(
    "from '../object-storage.js'"
  ),
  false
)

pass(
  'app no longer imports storage infrastructure directly'
)

assert.match(
  service,
  /from '\.\.\/object-storage\.js'/
)

assert.match(
  service,
  /export function createObjectStorageService/
)

pass(
  'service owns infrastructure boundary'
)

for (const name of [
  'verificationObjectKey',
  'profilePhotoObjectKey',
  'putVerificationObject',
  'getVerificationObject',
  'deleteVerificationObject',
  'storageReady',
  'createTemporaryDocumentSignature',
  'verifyTemporaryDocumentSignature'
]) {
  assert.match(
    service,
    new RegExp(
      '\\b' + name + '\\b'
    )
  )

  assert.match(
    app,
    new RegExp(
      '\\b' + name + '\\b'
    )
  )
}

pass(
  'historical storage dependency contract preserved'
)

for (const signal of [
  'export function verificationObjectKey',
  'export function profilePhotoObjectKey',
  'export async function putVerificationObject',
  'export async function getVerificationObject',
  'export async function deleteVerificationObject',
  'export async function storageReady',
  'export function createTemporaryDocumentSignature',
  'export function verifyTemporaryDocumentSignature'
]) {
  assert.ok(
    infra.includes(signal),
    'infrastructure implementation missing: ' +
      signal
  )
}

pass(
  'low-level storage implementation remains infrastructure-owned'
)

for (const routeSignal of [
  'registerSystemRoutes',
  'registerLifecycleRoutes',
  'registerAccountProfileRoutes',
  'registerAccountPrivacyRoutes',
  'registerProfessionalVerificationRoutes',
  'registerAdminVerificationRoutes'
]) {
  assert.match(
    app,
    new RegExp(
      '\\b' +
      routeSignal +
      '\\b'
    )
  )
}

pass(
  'storage-consuming route composition preserved'
)

assert.match(
  app,
  /storageReady/
)

assert.match(
  app,
  /profilePhotoObjectKey/
)

assert.match(
  app,
  /verificationObjectKey/
)

assert.match(
  app,
  /createTemporaryDocumentSignature/
)

assert.match(
  app,
  /verifyTemporaryDocumentSignature/
)

pass(
  'readiness/photo/verification/signature capabilities preserved'
)

console.log('')
console.log(
  'MELEO D10L.17 object-storage service extraction self-test: OK'
)
