/*
 * MELEO booking lifecycle state machine.
 *
 * This module is the authoritative source for valid booking
 * status transitions.
 *
 * Terminal states:
 *   completed
 *   cancelled
 */

export const BOOKING_STATUSES =
  Object.freeze([
    'pending',
    'clarification',
    'quoted',
    'accepted',
    'completed',
    'cancelled'
  ])


const TRANSITIONS =
  Object.freeze({

    pending:
      Object.freeze([
        'clarification',
        'quoted',
        'accepted',
        'cancelled'
      ]),

    clarification:
      Object.freeze([
        'quoted',
        'accepted',
        'cancelled'
      ]),

    quoted:
      Object.freeze([
        'pending',
        'accepted',
        'cancelled'
      ]),

    accepted:
      Object.freeze([
        'completed',
        'cancelled'
      ]),

    completed:
      Object.freeze([]),

    cancelled:
      Object.freeze([])
  })


export function isBookingStatus(
  value
){
  return BOOKING_STATUSES
    .includes(value)
}


export function canTransitionBooking(
  fromStatus,
  toStatus
){
  if(
    !isBookingStatus(fromStatus) ||
    !isBookingStatus(toStatus)
  ){
    return false
  }

  return TRANSITIONS[
    fromStatus
  ].includes(
    toStatus
  )
}


export function bookingTransitionResult(
  fromStatus,
  toStatus
){
  if(!isBookingStatus(fromStatus)){
    return {
      ok:false,
      code:'BOOKING_CURRENT_STATUS_INVALID'
    }
  }

  if(!isBookingStatus(toStatus)){
    return {
      ok:false,
      code:'BOOKING_TARGET_STATUS_INVALID'
    }
  }

  if(fromStatus===toStatus){
    return {
      ok:false,
      code:'BOOKING_STATUS_NOOP'
    }
  }

  if(
    fromStatus==='completed' ||
    fromStatus==='cancelled'
  ){
    return {
      ok:false,
      code:'BOOKING_STATUS_TERMINAL'
    }
  }

  if(
    !canTransitionBooking(
      fromStatus,
      toStatus
    )
  ){
    return {
      ok:false,
      code:'BOOKING_TRANSITION_INVALID'
    }
  }

  return {
    ok:true,
    code:null
  }
}


export function canUserTransitionBooking({
  user,
  booking,
  professional,
  toStatus
}){
  if(
    !user ||
    !booking ||
    !professional
  ){
    return false
  }

  const lifecycle=
    bookingTransitionResult(
      booking.status,
      toStatus
    )

  if(!lifecycle.ok){
    return false
  }

  if(user.role==='admin'){
    return true
  }

  const isPatient=
    user.role==='patient' &&
    booking.patientId===user.id

  if(isPatient){
    return toStatus==='cancelled'
  }

  const isProfessional=
    user.role==='professional' &&
    professional.userId===user.id

  if(!isProfessional){
    return false
  }

  return [
    'clarification',
    'quoted',
    'accepted',
    'completed',
    'cancelled'
  ].includes(
    toStatus
  )
}
