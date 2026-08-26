/*
 * MELEO v6.3.0
 *
 * Professional directory and profile routes.
 *
 * Scope:
 * - public professional search
 * - public professional detail
 * - professional reviews
 * - authenticated professional profile update
 *
 * Verification, subscriptions, billing and realtime lifecycle
 * intentionally remain outside this module.
 */

export function registerProfessionalCoreRoutes(
  app,
  deps
) {
  const {
    Professionals,
    limits,
    allowsVisibility,
    meleoTrustForProfessional,
    pagination,
    many,
    one,
    sanitizeProfilePatch,
    auth,
    requireRole
  } = deps


  if (!app) {
    throw new Error(
      'registerProfessionalCoreRoutes requires an Express app'
    )
  }


  const required = {
    Professionals,
    limits,
    allowsVisibility,
    meleoTrustForProfessional,
    pagination,
    many,
    one,
    sanitizeProfilePatch,
    auth,
    requireRole
  }


  for (
    const [
      name,
      value
    ] of Object.entries(
      required
    )
  ) {
    if (
      value === undefined ||
      value === null
    ) {
      throw new Error(
        `registerProfessionalCoreRoutes missing dependency: ${name}`
      )
    }
  }


app.get('/api/professionals',async(req,res)=>{const result=await Professionals.search(req.query);res.json(result)})
app.get('/api/professionals/:id',limits.profile,async(req,res)=>{const p=await Professionals.byId(req.params.id);if(!p||!p.verified||p.adminSuspended||!allowsVisibility(p))return res.status(404).json({error:'Ο επαγγελματίας δεν είναι διαθέσιμος.'});const trust=await meleoTrustForProfessional(p.id);res.json({professional:{...p,trust}})})
app.get('/api/professionals/:id/reviews',async(req,res)=>{const {page,limit,offset}=pagination(req.query,{defaultLimit:10,maxLimit:50});const items=await many(`SELECT r.id,r.rating,r.comment,r.created_at "createdAt",u.name "patientName" FROM reviews r JOIN users u ON u.id=r.patient_id WHERE r.professional_id=$1 ORDER BY r.created_at DESC LIMIT $2 OFFSET $3`,[req.params.id,limit,offset]);const c=await one('SELECT count(*)::int total FROM reviews WHERE professional_id=$1',[req.params.id]);res.json({items,page,limit,total:c.total,totalPages:Math.ceil(c.total/limit)})})
app.put('/api/professional/profile',auth,requireRole('professional'),limits.write,async(req,res)=>{const p=await Professionals.byUser(req.user.id);const patch=sanitizeProfilePatch(req.body);if(Object.keys(patch).length)await Professionals.update(p.id,patch);const updated=await Professionals.byId(p.id);if(updated.specialty&&updated.title&&updated.city&&!['pending_verification','approved'].includes(updated.onboardingStage))await Professionals.update(p.id,{onboardingStage:'verification'});res.json({professional:await Professionals.byId(p.id)})})

}
