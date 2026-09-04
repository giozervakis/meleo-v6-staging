/*
 * MELEO v6.3.0
 *
 * Care Team HTTP route.
 *
 * Owns:
 *   GET /api/care-team
 *
 * Reads Favorites and completed Bookings as cross-domain
 * inputs. Professional visibility and MELEO Trust remain
 * shared policies injected by the application.
 */

export function registerCareTeamRoutes(
  app,
  deps
) {
  const {
    auth,
    many,
    one,
    Professionals,
    allowsVisibility,
    meleoTrustForProfessional
  } = deps


app.get('/api/care-team',auth,async(req,res)=>{
  if(!['patient','professional'].includes(req.user.role))return res.status(403).json({error:'Δεν επιτρέπεται.'})
  const favs=await many('SELECT professional_id "professionalId" FROM favorites WHERE user_id=$1 ORDER BY created_at DESC',[req.user.id])
  const items=[]
  for(const f of favs){
    const p=await Professionals.byId(f.professionalId)
    if(!p||!p.verified||p.adminSuspended||!allowsVisibility(p))continue
    const last=await one(`SELECT id,service,visit_date "date",visit_time "time",address,status,agreed_price "agreedPrice" FROM bookings WHERE patient_id=$1 AND professional_id=$2 AND status='completed' ORDER BY visit_date DESC,visit_time DESC,created_at DESC LIMIT 1`,[req.user.id,p.id])
    const trust=await meleoTrustForProfessional(p.id)
    items.push({...p,trust,lastCompleted:last||null})
  }
  res.json({items})
})

}
