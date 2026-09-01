import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  canViewBooking,
  canEditBooking,
  canViewPatientContact,
  canReviewBooking
} from '../server/relational/authorization.js'


const booking={
  id:'bkg_test',
  patientId:'patient_1',
  professionalId:'pro_1',
  status:'completed'
}

const professional={
  id:'pro_1',
  userId:'professional_1'
}

const patient={
  id:'patient_1',
  role:'patient'
}

const assignedProfessional={
  id:'professional_1',
  role:'professional'
}

const unrelatedPatient={
  id:'patient_2',
  role:'patient'
}

const unrelatedProfessional={
  id:'professional_2',
  role:'professional'
}

const admin={
  id:'admin_1',
  role:'admin'
}

const collisionProfessional={
  id:'patient_1',
  role:'professional'
}


/* legitimate edit principals */

assert.equal(
  canEditBooking(
    patient,
    booking,
    professional
  ),
  true
)

assert.equal(
  canEditBooking(
    assignedProfessional,
    booking,
    professional
  ),
  true
)

assert.equal(
  canEditBooking(
    admin,
    booking,
    professional
  ),
  true
)


/* unauthorized principals */

assert.equal(
  canEditBooking(
    unrelatedPatient,
    booking,
    professional
  ),
  false
)

assert.equal(
  canEditBooking(
    unrelatedProfessional,
    booking,
    professional
  ),
  false
)


/*
 * Regression proof:
 *
 * Legacy VIEW semantics allow a professional account whose
 * user id equals patientId to view under the broad ownership
 * condition.
 *
 * EDIT must NOT inherit that permission.
 */

assert.equal(
  canViewBooking(
    collisionProfessional,
    booking,
    professional
  ),
  true
)

assert.equal(
  canEditBooking(
    collisionProfessional,
    booking,
    professional
  ),
  false
)


/* adjacent policies stay intact */

assert.equal(
  canViewPatientContact(
    assignedProfessional,
    booking,
    professional
  ),
  true
)

assert.equal(
  canViewPatientContact(
    unrelatedProfessional,
    booking,
    professional
  ),
  false
)

assert.equal(
  canReviewBooking(
    patient,
    booking
  ),
  true
)

assert.equal(
  canReviewBooking(
    assignedProfessional,
    booking
  ),
  false
)


/* canEditBooking must never delegate back to VIEW */

const authorizationSource=
  fs.readFileSync(
    new URL(
      '../server/relational/authorization.js',
      import.meta.url
    ),
    'utf8'
  )

assert.equal(
  /canEditBooking[\s\S]{0,500}return\s+canViewBooking\s*\(/.test(
    authorizationSource
  ),
  false,
  'canEditBooking must remain independent of canViewBooking'
)

console.log(
  'MELEO D10C booking authorization self-test: OK'
)
