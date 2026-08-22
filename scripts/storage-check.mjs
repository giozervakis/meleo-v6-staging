import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'meleo-storage-check-'))
process.env.NODE_ENV = 'development'
process.env.STORAGE_DRIVER = 'local'
process.env.VERIFICATION_STORAGE_DIR = dir
process.env.SENSITIVE_DATA_KEY = 'storage-check-development-key-123456789012345'
const { verificationObjectKey, putVerificationObject, getVerificationObject, deleteVerificationObject, storageReady, createTemporaryDocumentSignature, verifyTemporaryDocumentSignature } = await import('../server/object-storage.js')
const key = verificationObjectKey('doc_selftest')
const body = crypto.randomBytes(128)
if (!await storageReady()) throw new Error('local storage readiness failed')
await putVerificationObject(key, body)
const got = await getVerificationObject(key)
if (!got.equals(body)) throw new Error('object round-trip mismatch')
const exp = Date.now() + 60_000
const sig = createTemporaryDocumentSignature('doc_selftest', exp)
if (!verifyTemporaryDocumentSignature('doc_selftest', exp, sig)) throw new Error('temporary signature verification failed')
if (verifyTemporaryDocumentSignature('doc_other', exp, sig)) throw new Error('signature accepted for wrong document')
await deleteVerificationObject(key)
await fs.rm(dir, { recursive: true, force: true })
console.log('MELEO v5.3 storage self-test: OK')
