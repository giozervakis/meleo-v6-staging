/*
 * MELEO v6.3.0
 *
 * Booking recovery HTTP routes.
 *
 * Owns:
 *   GET  /api/bookings/:id/recovery-candidates
 *   POST /api/bookings/:id/recover
 *
 * Review and calendar concerns remain independently owned.
 */

export function registerBookingRecoveryRoutes(
  app,
  deps
) {
  const {
    auth,
    requireConsumer,
    requireVerifiedEmail,
    limits,
    str,
    id,
    Bookings,
    Professionals,
    allowsVisibility,
    audit
  } = deps

app.get('/api/bookings/:id/recovery-candidates',auth,requireConsumer,async(req,res)=>{const b=await Bookings.byId(req.params.id);if(!b||b.patientId!==req.user.id)return res.status(404).json({error:'Not found'});if(b.status!=='cancelled')return res.status(400).json({error:'Οι εναλλακτικές προτάσεις εμφανίζονται μετά την ακύρωση του αιτήματος.'});const pick=[];const seen=new Set([b.professionalId]);const add=result=>{for(const p of result.items||[]){if(seen.has(p.id))continue;seen.add(p.id);pick.push(p);if(pick.length>=3)break}};if(b.city) add(await Professionals.search({specialty:b.specialty,service:b.service,location:b.city,page:1,limit:20}));if(pick.length<3)add(await Professionals.search({specialty:b.specialty,service:b.service,page:1,limit:20}));res.json({items:pick.slice(0,3)})})
app.post('/api/bookings/:id/recover',auth,requireConsumer,requireVerifiedEmail,limits.write,async(req,res)=>{const b=await Bookings.byId(req.params.id);if(!b||b.patientId!==req.user.id)return res.status(404).json({error:'Not found'});if(b.status!=='cancelled')return res.status(400).json({error:'Το αρχικό αίτημα πρέπει να είναι ακυρωμένο.'});const professionalId=str(req.body.professionalId,80);const p=await Professionals.byId(professionalId);if(!p||p.id===b.professionalId||!p.verified||!allowsVisibility(p)||p.specialty!==b.specialty||!(p.services||[]).includes(b.service))return res.status(400).json({error:'Ο επαγγελματίας δεν είναι διαθέσιμος για το ίδιο αίτημα.'});const bid=id('bkg');const created=await Bookings.create({id:bid,patientId:req.user.id,professionalId:p.id,service:b.service,date:b.date,time:b.time,address:b.address,notes:b.notes,repeat:b.repeat,price:p.price,recoveryParentId:b.id},{
  userId:p.userId,
  type:'booking',
  title:'Νέο αίτημα επίσκεψης',
  body:`${req.user.name} · ${b.service}`,
  options:{
    priority:'high',
    actionType:'booking',
    actionId:bid,
    actionUrl:'/professional'
  }
});await audit(req.user.id,'booking.recovery',{bookingId:bid,recoveryParentId:b.id,professionalId:p.id});res.json({booking:created})})
}
