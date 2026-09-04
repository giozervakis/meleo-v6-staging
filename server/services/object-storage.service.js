import {
  verificationObjectKey,
  profilePhotoObjectKey,
  putVerificationObject,
  getVerificationObject,
  deleteVerificationObject,
  storageReady,
  createTemporaryDocumentSignature,
  verifyTemporaryDocumentSignature
} from '../object-storage.js'

export function createObjectStorageService() {
  return Object.freeze({
    verificationObjectKey,
    profilePhotoObjectKey,
    putVerificationObject,
    getVerificationObject,
    deleteVerificationObject,
    storageReady,
    createTemporaryDocumentSignature,
    verifyTemporaryDocumentSignature
  })
}
