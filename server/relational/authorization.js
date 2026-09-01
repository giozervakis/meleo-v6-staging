export function canViewBooking(user, booking, professional){
  if(!user||!booking)return false
  if(user.role==='admin')return true

  if(
    ['patient','professional'].includes(user.role) &&
    booking.patientId===user.id
  ){
    return true
  }

  if(
    user.role==='professional' &&
    professional?.userId===user.id
  ){
    return true
  }

  return false
}

export function canEditBooking(user, booking, professional){
  if(!user||!booking)return false

  if(user.role==='admin'){
    return true
  }

  if(
    user.role==='patient' &&
    booking.patientId===user.id
  ){
    return true
  }

  if(
    user.role==='professional' &&
    professional?.userId===user.id
  ){
    return true
  }

  return false
}

export function canViewPatientContact(user, booking, professional){
  if(!user||!booking)return false

  return user.role==='admin' ||
    (
      user.role==='professional' &&
      professional?.userId===user.id
    )
}

export function canReviewBooking(user, booking){
  return ['patient','professional'].includes(user?.role) &&
    booking?.patientId===user.id &&
    booking?.status==='completed'
}