/*
 * MELEO v6.3.0
 *
 * Booking review HTTP route.
 *
 * Owns post-completion patient review creation,
 * professional rating aggregation and review notification.
 *
 * Extracted byte-safely from relational/app.js.
 */

export function registerBookingReviewRoutes(
  app,
  deps
) {
  const {
    auth,
    requireConsumer,
    limits,
    Bookings,
    canReviewBooking,
    str,
    tx,
    id,
    Professionals,
    Notifications
  } = deps


app.post('/api/bookings/:id/review',auth,requireConsumer,limits.write,async(req,res)=>{const b=await Bookings.byId(req.params.id);if(!b||!canReviewBooking(req.user,b))return res.status(400).json({error:'Αξιολόγηση επιτρέπεται μόνο μετά από ολοκληρωμένη επίσκεψη.'});const rating=Math.max(1,Math.min(5,Math.round(Number(req.body.rating)||0))),comment=str(req.body.comment,1000);const p=await Professionals.byId(b.professionalId);try{await tx(async c=>{await c.query(`INSERT INTO reviews(id,booking_id,patient_id,professional_id,rating,comment) VALUES($1,$2,$3,$4,$5,$6)`,[id('rev'),b.id,req.user.id,b.professionalId,rating,comment]);await c.query(`UPDATE professionals SET reviews_count=(SELECT count(*) FROM reviews WHERE professional_id=$1),rating=(SELECT coalesce(avg(rating),0) FROM reviews WHERE professional_id=$1),updated_at=now() WHERE id=$1`,[b.professionalId]);await Notifications.create(p.userId,'review','Νέα αξιολόγηση',`${rating}/5 ⭐`,{},c)})}catch(err){if(err.code==='23505')return res.status(409).json({error:'Η επίσκεψη έχει ήδη αξιολογηθεί.'});throw err}res.json({ok:true})})

}
