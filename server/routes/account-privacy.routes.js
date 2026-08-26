/*
 * MELEO v6.3.0
 *
 * Account security/privacy lifecycle routes.
 *
 * Dependency injected so the route module owns HTTP concerns
 * without becoming a second application monolith.
 */

export function registerAccountPrivacyRoutes(
  app,
  deps
) {
  const {
    auth,
    limits,
    Users,
    Sessions,
    Professionals,
    Bookings,
    Notifications,
    many,
    sql,
    tx,
    audit,
    publicUser,
    hashPassword,
    verifyPassword,
    passwordPolicy,
    passwordPolicyError,
    clearSessionCookie
  } = deps

  app.post('/api/me/change-password',auth,limits.password,async(req,res)=>{const u=await Users.byId(req.user.id);if(!await verifyPassword(String(req.body.currentPassword||''),u.password_hash))return res.status(400).json({error:'Ο τρέχων κωδικός δεν είναι σωστός.'});const np=String(req.body.newPassword||'');if(!passwordPolicy(np).valid)return res.status(400).json(passwordPolicyError);await Users.update(u.id,{password_hash:await hashPassword(np)});await Sessions.revokeUser(u.id);clearSessionCookie(res);res.json({ok:true})})

  app.get('/api/me/export',auth,async(req,res)=>{const u=await Users.byId(req.user.id),p=u.role==='professional'?await Professionals.byUser(u.id):null,b=await Bookings.listForUser(publicUser(u),{limit:100});res.json({exportedAt:now(),user:publicUser(u),professional:p,bookings:b.items})})

  app.delete('/api/me',auth,limits.password,async(req,res)=>{const u=await Users.byId(req.user.id);if(req.body.password&&!await verifyPassword(String(req.body.password),u.password_hash))return res.status(400).json({error:'Λάθος κωδικός.'});const p=u.role==='professional'?await Professionals.byUser(u.id):null;if(p?.stripeSubscriptionId&&getStripe()){try{await getStripe().subscriptions.cancel(p.stripeSubscriptionId)}catch(err){await Users.update(u.id,{deletion_pending:true,deletion_requested_at:now()});return res.status(202).json({ok:true,pending:true,message:'Η διαγραφή θα ολοκληρωθεί μόλις ακυρωθεί η συνδρομή.'})}}await Users.update(u.id,{deleted_at:now(),name:'Deleted User',phone:'',account_status:'suspended'});await Sessions.revokeUser(u.id);clearSessionCookie(res);res.json({ok:true})})
}
