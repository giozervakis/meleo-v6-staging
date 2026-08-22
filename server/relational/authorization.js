export function canViewBooking(user, booking, professional){
  if(!user||!booking)return false
  if(user.role==='admin')return true
  if(user.role==='patient')return booking.patientId===user.id
  if(user.role==='professional')return professional?.userId===user.id
  return false
}
export function canEditBooking(user, booking, professional){ return canViewBooking(user,booking,professional) }
export function canViewPatientContact(user, booking, professional){
  if(!user||!booking)return false
  return user.role==='admin'||(user.role==='professional'&&professional?.userId===user.id)
}
export function canReviewBooking(user, booking){ return user?.role==='patient'&&booking?.patientId===user.id&&booking?.status==='completed' }
