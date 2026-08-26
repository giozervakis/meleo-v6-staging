/*
 * MELEO v6.3.0
 *
 * Booking core HTTP routes.
 *
 * Owns booking creation and authenticated booking listing only.
 *
 * Booking state transitions, communication, recovery,
 * reviews, unread state and calendar export remain separate
 * application concerns during incremental modularization.
 */

export function registerBookingCoreRoutes(
  app,
  deps
) {
  const {
    auth,
    requireConsumer,
    requireVerifiedEmail,
    limits,
    str,
    isDate,
    isTime,
    Professionals,
    allowsVisibility,
    id,
    Bookings,
    Notifications,
    audit
  } = deps


app.post('/api/bookings',auth,requireConsumer,requireVerifiedEmail,limits.write,async(req,res)=>{const pid=str(req.body.professionalId,80),service=str(req.body.service,160),date=str(req.body.date,20),time=str(req.body.time,10);if(!pid||!service||!isDate(date)||!isTime(time))return res.status(400).json({error:'Συμπλήρωσε υπηρεσία, ημερομηνία και ώρα.'});const p=await Professionals.byId(pid);if(!p||!p.verified||!allowsVisibility(p))return res.status(404).json({error:'Ο επαγγελματίας δεν είναι διαθέσιμος.'});if(p.userId===req.user.id)return res.status(400).json({error:'Δεν μπορείς να δημιουργήσεις αίτημα προς το δικό σου επαγγελματικό προφίλ.'});const bid=id('bkg');const b=await Bookings.create({id:bid,patientId:req.user.id,professionalId:pid,service,date,time,address:str(req.body.address,300),notes:str(req.body.notes,3000),repeat:str(req.body.repeat,120)||'Μία φορά',price:p.price});await Notifications.create(p.userId,'booking','Νέο αίτημα επίσκεψης',`${req.user.name} · ${service}`);await audit(req.user.id,'booking.create',{bookingId:bid,professionalId:pid});res.json({booking:b})})


app.get('/api/bookings',auth,async(req,res)=>res.json(await Bookings.listForUser(req.user,req.query)))
}
