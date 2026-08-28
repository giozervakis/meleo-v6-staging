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
    sha256,

    googleOAuthEnabled,
    createGoogleOAuthTransaction,
    validateGoogleOAuthTransaction,
    googleAuthorizationUrl,
    exchangeGoogleAuthorizationCode,
    verifyGoogleIdToken,
    resolveGoogleAccount,
    getGoogleOAuthTransactionCookie,
    setGoogleOAuthTransactionCookie,
    clearGoogleOAuthTransactionCookie
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
    sha256,

    googleOAuthEnabled,
    createGoogleOAuthTransaction,
    validateGoogleOAuthTransaction,
    googleAuthorizationUrl,
    exchangeGoogleAuthorizationCode,
    verifyGoogleIdToken,
    resolveGoogleAccount,
    getGoogleOAuthTransactionCookie,
    setGoogleOAuthTransactionCookie,
    clearGoogleOAuthTransactionCookie
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


  app.post('/api/auth/register',limits.register,async(req,res)=>{const role=req.body.role==='professional'?'professional':'patient',name=str(req.body.name,120),email=str(req.body.email,200).toLowerCase(),phone=str(req.body.phone,40),password=String(req.body.password||'');if(!name||!isEmail(email))return res.status(400).json({error:'Ξ£Ο…ΞΌΟ€Ξ»Ξ®ΟΟ‰ΟƒΞµ ΟƒΟ‰ΟƒΟ„Ξ¬ ΟΞ½ΞΏΞΌΞ± ΞΊΞ±ΞΉ email.'});if(!passwordPolicy(password).valid)return res.status(400).json(passwordPolicyError);const existing=await Users.byEmail(email);if(existing){const roleLabel=existing.role==='professional'?'Ξ•Ο€Ξ±Ξ³Ξ³ΞµΞ»ΞΌΞ±Ο„Ξ―Ξ±Ο‚':existing.role==='patient'?'Ξ£Ο…Ξ½ΞΏΞ΄ΟΟ‚ / Ξ‘ΟƒΞΈΞµΞ½Ξ®Ο‚':'Ξ”ΞΉΞ±Ο‡ΞµΞΉΟΞΉΟƒΟ„Ξ®Ο‚';const wantsProfessional=role==='professional';return res.status(409).json({error:wantsProfessional&&existing.role==='patient'?`Ξ¥Ο€Ξ¬ΟΟ‡ΞµΞΉ Ξ®Ξ΄Ξ· Ξ»ΞΏΞ³Ξ±ΟΞΉΞ±ΟƒΞΌΟΟ‚ MELEO ΞΌΞµ Ξ±Ο…Ο„Ο Ο„ΞΏ email Ο‰Ο‚ ${roleLabel}. Ξ£Ο…Ξ½Ξ΄Ξ­ΟƒΞΏΟ… ΟƒΟ„ΞΏΞ½ Ο…Ο€Ξ¬ΟΟ‡ΞΏΞ½Ο„Ξ± Ξ»ΞΏΞ³Ξ±ΟΞΉΞ±ΟƒΞΌΟ ΟƒΞΏΟ… ΞΊΞ±ΞΉ ΞµΟ€Ξ―Ξ»ΞµΞΎΞµ Β«Ξ“Ξ―Ξ½Ξµ ΞµΟ€Ξ±Ξ³Ξ³ΞµΞ»ΞΌΞ±Ο„Ξ―Ξ±Ο‚Β». Ξ”ΞµΞ½ Ο‡ΟΞµΞΉΞ¬Ξ¶ΞµΟ„Ξ±ΞΉ Ξ΄ΞµΟΟ„ΞµΟΞΏΟ‚ Ξ»ΞΏΞ³Ξ±ΟΞΉΞ±ΟƒΞΌΟΟ‚.`:`Ξ•Ξ―ΟƒΞ±ΞΉ Ξ®Ξ΄Ξ· ΞµΞ³Ξ³ΞµΞ³ΟΞ±ΞΌΞΌΞ­Ξ½ΞΏΟ‚ ΟƒΟ„Ξ· MELEO Ο‰Ο‚ ${roleLabel} ΞΌΞµ Ξ±Ο…Ο„Ο Ο„ΞΏ email. Ξ£Ο…Ξ½Ξ΄Ξ­ΟƒΞΏΟ… ΟƒΟ„ΞΏΞ½ Ο…Ο€Ξ¬ΟΟ‡ΞΏΞ½Ο„Ξ± Ξ»ΞΏΞ³Ξ±ΟΞΉΞ±ΟƒΞΌΟ ΟƒΞΏΟ….`,code:'ACCOUNT_EXISTS',existingRole:existing.role})};const uid=id('usr');const u=await Users.create({id:uid,role,name,email,phone,passwordHash:await hashPassword(password),emailVerified:!config.mailEnabled,acceptedTermsAt:now(),termsVersion:config.legal.termsVersion});if(role==='professional')await Professionals.createForUser(uid);if(config.mailEnabled){const t=await createToken(uid,'verify_email',24*3600000);mail.verifyEmail(email,name,`${config.appUrl}/?verify_email=${encodeURIComponent(t)}`).catch(()=>{})}await issueSession(u,req,res);await audit(uid,'auth.register',{role});res.json({token:'cookie',user:publicUser(u),professional:role==='professional'?await Professionals.byUser(uid):null})})
  app.post('/api/auth/login',limits.login,limits.loginAccount,async(req,res)=>{const email=str(req.body.email,200).toLowerCase(),password=String(req.body.password||'');const u=await Users.byEmail(email);if(!u||!await verifyPassword(password,u.password_hash)){if(email===config.admin.email||u?.role==='admin')await audit(u?.id||null,'security.admin_login_failed',{ipHash:sha256(req.ip||''),uaHash:sha256(req.headers['user-agent']||'')});return res.status(401).json({error:'Ξ›Ξ¬ΞΈΞΏΟ‚ email Ξ® ΞΊΟ‰Ξ΄ΞΉΞΊΟΟ‚.'});}if(u.account_status==='suspended'&&u.role!=='admin')return res.status(403).json({error:'Ξ Ξ»ΞΏΞ³Ξ±ΟΞΉΞ±ΟƒΞΌΟΟ‚ Ξ­Ο‡ΞµΞΉ Ξ±Ξ½Ξ±ΟƒΟ„Ξ±Ξ»ΞµΞ―.'});if(u.role==='admin'&&config.admin.totpSecret){const step=matchTotpStep(config.admin.totpSecret,req.body.totp);if(step==null){await audit(u.id,'security.admin_2fa_failed',{ipHash:sha256(req.ip||'')});return res.status(401).json({error:'Ξ‘Ο€Ξ±ΞΉΟ„ΞµΞ―Ο„Ξ±ΞΉ Ξ­Ξ³ΞΊΟ…ΟΞΏΟ‚ ΞΊΟ‰Ξ΄ΞΉΞΊΟΟ‚ 2FA.',requires2fa:true})}if(u.last_totp_step!=null&&Number(u.last_totp_step)>=step){await audit(u.id,'security.admin_2fa_replay',{ipHash:sha256(req.ip||'')});return res.status(401).json({error:'Ξ ΞΊΟ‰Ξ΄ΞΉΞΊΟΟ‚ 2FA Ξ­Ο‡ΞµΞΉ Ξ®Ξ΄Ξ· Ο‡ΟΞ·ΟƒΞΉΞΌΞΏΟ€ΞΏΞΉΞ·ΞΈΞµΞ―.'})};await Users.update(u.id,{last_totp_step:step})}await Users.update(u.id,{last_login_at:now()});await issueSession(u,req,res);await audit(u.id,'auth.login',{});res.json({token:'cookie',user:publicUser(u),professional:u.role==='professional'?await Professionals.byUser(u.id):null})})
  app.post('/api/auth/logout',auth,async(req,res)=>{await Sessions.revoke(req.sessionRaw);clearSessionCookie(res);res.json({ok:true})})
  app.post('/api/auth/social-demo',async(req,res)=>{if(!config.demoAuth)return res.status(404).json({error:'Unavailable'});const role=req.body.role==='professional'?'professional':'patient';const email=role==='professional'?'maria@meleo.gr':'patient@meleo.gr';const u=await Users.byEmail(email);await issueSession(u,req,res);res.json({token:'cookie',user:publicUser(u),professional:role==='professional'?await Professionals.byUser(u.id):null})})

  /*
   * =========================================================
   * GOOGLE OAUTH / OPENID CONNECT
   * =========================================================
   */


  app.get(
    '/api/auth/google/start',
    async (
      req,
      res
    ) => {

      if (!googleOAuthEnabled) {
        return res
          .status(404)
          .json({
            error:
              'Η σύνδεση με Google δεν είναι ενεργοποιημένη.'
          })
      }


      try {

        const oauth =
          createGoogleOAuthTransaction()


        setGoogleOAuthTransactionCookie(
          res,
          oauth.transaction
        )


        const authorizationUrl =
          googleAuthorizationUrl({
            state:
              oauth.state,

            nonce:
              oauth.nonce,

            codeChallenge:
              oauth.codeChallenge
          })


        return res.redirect(
          302,
          String(
            authorizationUrl
          )
        )

      } catch (error) {

        clearGoogleOAuthTransactionCookie(
          res
        )


        await audit(
          null,
          'security.google_oauth_start_failed',
          {
            code:
              String(
                error?.code ||
                'GOOGLE_OAUTH_START_FAILED'
              ).slice(
                0,
                100
              ),

            ipHash:
              sha256(
                req.ip || ''
              )
          }
        ).catch(
          () => {}
        )


        return res
          .status(503)
          .json({
            error:
              'Η σύνδεση με Google δεν είναι διαθέσιμη αυτή τη στιγμή.'
          })
      }
    }
  )


  app.get(
    '/api/auth/google/callback',
    async (
      req,
      res
    ) => {

      const rawTransaction =
        getGoogleOAuthTransactionCookie(
          req
        )


      clearGoogleOAuthTransactionCookie(
        res
      )


      const frontendRedirect =
        (
          status,
          code = ''
        ) => {

          const target =
            new URL(
              '/login',
              config.appUrl
            )


          target.searchParams.set(
            'google_oauth',
            status
          )


          if (code) {
            target.searchParams.set(
              'google_oauth_code',
              String(code).slice(
                0,
                100
              )
            )
          }


          return target.toString()
        }


      const providerError =
        str(
          req.query?.error,
          100
        )


      if (providerError) {

        await audit(
          null,
          'security.google_oauth_provider_rejected',
          {
            provider:
              'google',

            reason:
              providerError,

            ipHash:
              sha256(
                req.ip || ''
              )
          }
        ).catch(
          () => {}
        )


        return res.redirect(
          302,
          frontendRedirect(
            'cancelled',
            providerError
          )
        )
      }


      const returnedState =
        str(
          req.query?.state,
          1000
        )


      const code =
        str(
          req.query?.code,
          4096
        )


      const validated =
        validateGoogleOAuthTransaction(
          rawTransaction,
          returnedState
        )


      if (!validated?.ok) {

        const reason =
          String(
            validated?.reason ||
            'invalid_transaction'
          ).slice(
            0,
            100
          )


        await audit(
          null,
          'security.google_oauth_transaction_rejected',
          {
            provider:
              'google',

            reason,

            ipHash:
              sha256(
                req.ip || ''
              )
          }
        ).catch(
          () => {}
        )


        return res.redirect(
          302,
          frontendRedirect(
            'failed',
            reason
          )
        )
      }


      if (!code) {

        await audit(
          null,
          'security.google_oauth_callback_rejected',
          {
            provider:
              'google',

            reason:
              'missing_code',

            ipHash:
              sha256(
                req.ip || ''
              )
          }
        ).catch(
          () => {}
        )


        return res.redirect(
          302,
          frontendRedirect(
            'failed',
            'missing_code'
          )
        )
      }


      try {

        const tokenResult =
          await exchangeGoogleAuthorizationCode({
            code,

            codeVerifier:
              validated
                .transaction
                .codeVerifier
          })


        const googleIdentity =
          await verifyGoogleIdToken({
            idToken:
              tokenResult.idToken,

            expectedNonce:
              validated
                .transaction
                .nonce
          })


        const resolved =
          await resolveGoogleAccount({
            sub:
              googleIdentity.subject,

            email:
              googleIdentity.email,

            email_verified:
              googleIdentity.emailVerified,

            name:
              googleIdentity.name,

            picture:
              googleIdentity.picture
          })


        if (
          !resolved ||
          !resolved.user ||
          !resolved.user.id
        ) {

          const invalidAccount =
            new Error(
              'Google account resolution returned no MELEO user'
            )

          invalidAccount.code =
            'GOOGLE_ACCOUNT_RESOLUTION_FAILED'

          throw invalidAccount
        }


        const user =
          await Users.byId(
            resolved.user.id
          )


        if (!user) {

          const missingUser =
            new Error(
              'Resolved MELEO user could not be reloaded'
            )

          missingUser.code =
            'ACCOUNT_UNAVAILABLE'

          throw missingUser
        }


        /*
         * RC2-A1 SECURITY:
         * Admin accounts must never authenticate through Google OAuth.
         * Admin authentication remains password + mandatory TOTP only.
         *
         * This intentionally happens before last_login_at is updated and
         * before issueSession(), so a blocked OAuth attempt cannot produce
         * an authenticated admin session or look like a successful login.
         */
        if (user.role === 'admin') {

          await audit(
            user.id,
            'security.admin_google_oauth_blocked',
            {
              provider:
                'google',

              ipHash:
                sha256(
                  req.ip || ''
                )
            }
          ).catch(
            () => {}
          )


          return res.redirect(
            302,
            frontendRedirect(
              'failed',
              'admin_google_oauth_disabled'
            )
          )
        }


        await Users.update(
          user.id,
          {
            last_login_at:
              now()
          }
        )


        await issueSession(
          user,
          req,
          res
        )


        await audit(
          user.id,
          'auth.google.login',
          {
            provider:
              'google',

            created:
              resolved.created === true,

            linkedByEmail:
              resolved.linkedByEmail === true
          }
        )


        const successTarget =
          new URL(
            '/',
            config.appUrl
          )


        successTarget.searchParams.set(
          'google_oauth',
          'success'
        )


        return res.redirect(
          302,
          successTarget.toString()
        )

      } catch (error) {

        const errorCode =
          String(
            error?.code ||
            'GOOGLE_OAUTH_CALLBACK_FAILED'
          ).slice(
            0,
            100
          )


        await audit(
          null,
          'security.google_oauth_callback_failed',
          {
            provider:
              'google',

            code:
              errorCode,

            ipHash:
              sha256(
                req.ip || ''
              )
          }
        ).catch(
          () => {}
        )


        return res.redirect(
          302,
          frontendRedirect(
            'failed',
            errorCode
          )
        )
      }
    }
  )

  app.post('/api/auth/forgot-password',limits.password,async(req,res)=>{const u=await Users.byEmail(str(req.body.email,200).toLowerCase());if(u&&config.mailEnabled){const t=await createToken(u.id,'password_reset',3600000);mail.resetPassword(u.email,u.name,`${config.appUrl}/?reset=${encodeURIComponent(t)}`).catch(()=>{})}res.json({ok:true})})
  app.post('/api/auth/reset-password',limits.password,async(req,res)=>{const password=String(req.body.password||'');if(!passwordPolicy(password).valid)return res.status(400).json(passwordPolicyError);const rec=await consumeToken(str(req.body.token,300),'password_reset');if(!rec)return res.status(400).json({error:'Ξ ΟƒΟΞ½Ξ΄ΞµΟƒΞΌΞΏΟ‚ Ξ­Ο‡ΞµΞΉ Ξ»Ξ®ΞΎΞµΞΉ Ξ® Ο‡ΟΞ·ΟƒΞΉΞΌΞΏΟ€ΞΏΞΉΞ·ΞΈΞµΞ―.'});await Users.update(rec.user_id,{password_hash:await hashPassword(password)});await Sessions.revokeUser(rec.user_id);res.json({ok:true})})
  app.post('/api/auth/verify-email',async(req,res)=>{const rec=await consumeToken(str(req.body.token,300),'verify_email');if(!rec)return res.status(400).json({error:'Ξ ΟƒΟΞ½Ξ΄ΞµΟƒΞΌΞΏΟ‚ Ξ΄ΞµΞ½ ΞµΞ―Ξ½Ξ±ΞΉ Ξ­Ξ³ΞΊΟ…ΟΞΏΟ‚.'});await Users.update(rec.user_id,{email_verified:true});res.json({ok:true})})
  app.post('/api/auth/verify-email/resend',auth,limits.password,async(req,res)=>{if(!config.mailEnabled)return res.json({ok:true});const u=await Users.byId(req.user.id);const t=await createToken(u.id,'verify_email',24*3600000);mail.verifyEmail(u.email,u.name,`${config.appUrl}/?verify_email=${encodeURIComponent(t)}`).catch(()=>{});res.json({ok:true})})

  app.get('/api/me',auth,async(req,res)=>{const u=await Users.byId(req.user.id);res.json({user:publicUser(u),professional:await Professionals.byUser(u.id)})})
  app.post('/api/me/enable-professional',auth,requireVerifiedEmail,limits.write,async(req,res)=>{const u=await Users.byId(req.user.id);if(u.role==='admin')return res.status(403).json({error:'Ξ Ξ»ΞΏΞ³Ξ±ΟΞΉΞ±ΟƒΞΌΟΟ‚ Ξ΄ΞΉΞ±Ο‡ΞµΞΉΟΞΉΟƒΟ„Ξ® Ξ΄ΞµΞ½ ΞΌΟ€ΞΏΟΞµΞ― Ξ½Ξ± ΞµΞ½ΞµΟΞ³ΞΏΟ€ΞΏΞΉΞ·ΞΈΞµΞ― Ο‰Ο‚ ΞµΟ€Ξ±Ξ³Ξ³ΞµΞ»ΞΌΞ±Ο„ΞΉΞΊΟΟ‚.'});let p=await Professionals.byUser(u.id);if(!p)p=await Professionals.createForUser(u.id);if(u.role!=='professional')await Users.update(u.id,{role:'professional'});await Professionals.update(p.id,{onboardingStage:p.onboardingStage||'plan',onboardingCompleted:false});await audit(u.id,'professional.enable',{source:'existing_consumer_account'});const updated=await Users.byId(u.id);res.json({ok:true,user:publicUser(updated),professional:await Professionals.byUser(u.id),next:'professional_onboarding'})})
  app.get('/api/me/sessions',auth,async(req,res)=>{res.json({items:await Sessions.listForUser(req.user.id,req.sessionRaw)})})
  app.delete('/api/me/sessions/others',auth,limits.password,async(req,res)=>{await Sessions.revokeOthers(req.user.id,req.sessionRaw);await audit(req.user.id,'security.sessions_revoke_others',{});res.json({ok:true})})
  app.put('/api/me',auth,limits.write,async(req,res)=>{const u=await Users.update(req.user.id,{name:str(req.body.name,120)||req.user.name,phone:str(req.body.phone,40)});res.json({user:publicUser(u)})})
}
