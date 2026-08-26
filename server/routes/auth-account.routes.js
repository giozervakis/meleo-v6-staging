/*
 * MELEO v6.3.0
 *
 * Authentication, session and core account routes.
 *
 * Route handlers are intentionally dependency-injected.
 * Authentication primitives and application services remain
 * owned by the relational application composition root.
 */

export function registerAuthAccountRoutes(
  app,
  deps
) {
  const {
    config,
    limits,
    auth,
    requireVerifiedEmail,

    str,
    isEmail,
    passwordPolicy,
    passwordPolicyError,

    Users,
    Sessions,
    Professionals,

    hashPassword,
    verifyPassword,
    matchTotpStep,

    createToken,
    consumeToken,
    issueSession,
    clearSessionCookie,

    mail,
    audit,
    publicUser,

    id,
    now,
    sha256
  } = deps


  if (!app) {
    throw new Error(
      'registerAuthAccountRoutes requires an Express app'
    )
  }


  const required = {
    config,
    limits,
    auth,
    requireVerifiedEmail,

    str,
    isEmail,
    passwordPolicy,
    passwordPolicyError,

    Users,
    Sessions,
    Professionals,

    hashPassword,
    verifyPassword,
    matchTotpStep,

    createToken,
    consumeToken,
    issueSession,
    clearSessionCookie,

    mail,
    audit,
    publicUser,

    id,
    now,
    sha256
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
        `registerAuthAccountRoutes missing dependency: ${name}`
      )
    }
  }


  app.post('/api/auth/register',limits.register,async(req,res)=>{const role=req.body.role==='professional'?'professional':'patient',name=str(req.body.name,120),email=str(req.body.email,200).toLowerCase(),phone=str(req.body.phone,40),password=String(req.body.password||'');if(!name||!isEmail(email))return res.status(400).json({error:'Συμπλήρωσε σωστά όνομα και email.'});if(!passwordPolicy(password).valid)return res.status(400).json(passwordPolicyError);const existing=await Users.byEmail(email);if(existing){const roleLabel=existing.role==='professional'?'Επαγγελματίας':existing.role==='patient'?'Συνοδός / Ασθενής':'Διαχειριστής';const wantsProfessional=role==='professional';return res.status(409).json({error:wantsProfessional&&existing.role==='patient'?`Υπάρχει ήδη λογαριασμός MELEO με αυτό το email ως ${roleLabel}. Συνδέσου στον υπάρχοντα λογαριασμό σου και επίλεξε «Γίνε επαγγελματίας». Δεν χρειάζεται δεύτερος λογαριασμός.`:`Είσαι ήδη εγγεγραμμένος στη MELEO ως ${roleLabel} με αυτό το email. Συνδέσου στον υπάρχοντα λογαριασμό σου.`,code:'ACCOUNT_EXISTS',existingRole:existing.role})};const uid=id('usr');const u=await Users.create({id:uid,role,name,email,phone,passwordHash:await hashPassword(password),emailVerified:!config.mailEnabled,acceptedTermsAt:now(),termsVersion:config.legal.termsVersion});if(role==='professional')await Professionals.createForUser(uid);if(config.mailEnabled){const t=await createToken(uid,'verify_email',24*3600000);mail.verifyEmail(email,name,`${config.appUrl}/?verify_email=${encodeURIComponent(t)}`).catch(()=>{})}await issueSession(u,req,res);await audit(uid,'auth.register',{role});res.json({token:'cookie',user:publicUser(u),professional:role==='professional'?await Professionals.byUser(uid):null})})
  app.post('/api/auth/login',limits.login,limits.loginAccount,async(req,res)=>{const email=str(req.body.email,200).toLowerCase(),password=String(req.body.password||'');const u=await Users.byEmail(email);if(!u||!await verifyPassword(password,u.password_hash)){if(email===config.admin.email||u?.role==='admin')await audit(u?.id||null,'security.admin_login_failed',{ipHash:sha256(req.ip||''),uaHash:sha256(req.headers['user-agent']||'')});return res.status(401).json({error:'Λάθος email ή κωδικός.'});}if(u.account_status==='suspended'&&u.role!=='admin')return res.status(403).json({error:'Ο λογαριασμός έχει ανασταλεί.'});if(u.role==='admin'&&config.admin.totpSecret){const step=matchTotpStep(config.admin.totpSecret,req.body.totp);if(step==null){await audit(u.id,'security.admin_2fa_failed',{ipHash:sha256(req.ip||'')});return res.status(401).json({error:'Απαιτείται έγκυρος κωδικός 2FA.',requires2fa:true})}if(u.last_totp_step!=null&&Number(u.last_totp_step)>=step){await audit(u.id,'security.admin_2fa_replay',{ipHash:sha256(req.ip||'')});return res.status(401).json({error:'Ο κωδικός 2FA έχει ήδη χρησιμοποιηθεί.'})};await Users.update(u.id,{last_totp_step:step})}await Users.update(u.id,{last_login_at:now()});await issueSession(u,req,res);await audit(u.id,'auth.login',{});res.json({token:'cookie',user:publicUser(u),professional:u.role==='professional'?await Professionals.byUser(u.id):null})})
  app.post('/api/auth/logout',auth,async(req,res)=>{await Sessions.revoke(req.sessionRaw);clearSessionCookie(res);res.json({ok:true})})
  app.post('/api/auth/social-demo',async(req,res)=>{if(!config.demoAuth)return res.status(404).json({error:'Unavailable'});const role=req.body.role==='professional'?'professional':'patient';const email=role==='professional'?'maria@meleo.gr':'patient@meleo.gr';const u=await Users.byEmail(email);await issueSession(u,req,res);res.json({token:'cookie',user:publicUser(u),professional:role==='professional'?await Professionals.byUser(u.id):null})})
  app.post('/api/auth/forgot-password',limits.password,async(req,res)=>{const u=await Users.byEmail(str(req.body.email,200).toLowerCase());if(u&&config.mailEnabled){const t=await createToken(u.id,'password_reset',3600000);mail.resetPassword(u.email,u.name,`${config.appUrl}/?reset=${encodeURIComponent(t)}`).catch(()=>{})}res.json({ok:true})})
  app.post('/api/auth/reset-password',limits.password,async(req,res)=>{const password=String(req.body.password||'');if(!passwordPolicy(password).valid)return res.status(400).json(passwordPolicyError);const rec=await consumeToken(str(req.body.token,300),'password_reset');if(!rec)return res.status(400).json({error:'Ο σύνδεσμος έχει λήξει ή χρησιμοποιηθεί.'});await Users.update(rec.user_id,{password_hash:await hashPassword(password)});await Sessions.revokeUser(rec.user_id);res.json({ok:true})})
  app.post('/api/auth/verify-email',async(req,res)=>{const rec=await consumeToken(str(req.body.token,300),'verify_email');if(!rec)return res.status(400).json({error:'Ο σύνδεσμος δεν είναι έγκυρος.'});await Users.update(rec.user_id,{email_verified:true});res.json({ok:true})})
  app.post('/api/auth/verify-email/resend',auth,limits.password,async(req,res)=>{if(!config.mailEnabled)return res.json({ok:true});const u=await Users.byId(req.user.id);const t=await createToken(u.id,'verify_email',24*3600000);mail.verifyEmail(u.email,u.name,`${config.appUrl}/?verify_email=${encodeURIComponent(t)}`).catch(()=>{});res.json({ok:true})})

  app.get('/api/me',auth,async(req,res)=>{const u=await Users.byId(req.user.id);res.json({user:publicUser(u),professional:await Professionals.byUser(u.id)})})
  app.post('/api/me/enable-professional',auth,requireVerifiedEmail,limits.write,async(req,res)=>{const u=await Users.byId(req.user.id);if(u.role==='admin')return res.status(403).json({error:'Ο λογαριασμός διαχειριστή δεν μπορεί να ενεργοποιηθεί ως επαγγελματικός.'});let p=await Professionals.byUser(u.id);if(!p)p=await Professionals.createForUser(u.id);if(u.role!=='professional')await Users.update(u.id,{role:'professional'});await Professionals.update(p.id,{onboardingStage:p.onboardingStage||'plan',onboardingCompleted:false});await audit(u.id,'professional.enable',{source:'existing_consumer_account'});const updated=await Users.byId(u.id);res.json({ok:true,user:publicUser(updated),professional:await Professionals.byUser(u.id),next:'professional_onboarding'})})
  app.get('/api/me/sessions',auth,async(req,res)=>{res.json({items:await Sessions.listForUser(req.user.id,req.sessionRaw)})})
  app.delete('/api/me/sessions/others',auth,limits.password,async(req,res)=>{await Sessions.revokeOthers(req.user.id,req.sessionRaw);await audit(req.user.id,'security.sessions_revoke_others',{});res.json({ok:true})})
  app.put('/api/me',auth,limits.write,async(req,res)=>{const u=await Users.update(req.user.id,{name:str(req.body.name,120)||req.user.name,phone:str(req.body.phone,40)});res.json({user:publicUser(u)})})
}
