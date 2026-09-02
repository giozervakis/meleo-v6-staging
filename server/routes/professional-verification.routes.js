export function registerProfessionalVerificationRoutes(
  app,
  {
    auth,
    requireRole,
    requireVerifiedEmail,
    limits,
    Professionals,
    many,
    tx,
    str,
    id,
    verificationObjectKey,
    putVerificationObject,
    deleteVerificationObject,
    encryptFileBuffer,
    sql,
    audit,
    config
  }
) {

  app.post('/api/professional/verification-document',auth,requireRole('professional'),requireVerifiedEmail,limits.write,async(req,res)=>{const p=await Professionals.byUser(req.user.id);const name=str(req.body.name,180),data=String(req.body.data||'');if(!data||data.length>12_000_000)return res.status(400).json({error:'Το αρχείο είναι κενό ή πολύ μεγάλο.'});const buf=Buffer.from(data,'base64');let detected='';if(buf.slice(0,4).toString('hex')==='25504446')detected='application/pdf';else if(buf.slice(0,3).toString('hex')==='ffd8ff')detected='image/jpeg';else if(buf.slice(0,8).toString('hex')==='89504e470d0a1a0a')detected='image/png';else if(buf.slice(0,4).toString()==='RIFF'&&buf.slice(8,12).toString()==='WEBP')detected='image/webp';if(!detected)return res.status(400).json({error:'Επιτρέπονται μόνο PDF/JPG/PNG/WEBP.'});const did=id('doc'),storageKey=verificationObjectKey(did);await putVerificationObject(storageKey,encryptFileBuffer(buf));try{
  await sql(
    `INSERT INTO verification_documents(id,professional_id,storage_key,original_name,mime_type,size_bytes) VALUES($1,$2,$3,$4,$5,$6)`,
    [
      did,
      p.id,
      storageKey,
      name,
      detected,
      buf.length
    ]
  )
}catch(e){

  /*
   * Storage creation succeeded but the local metadata INSERT failed.
   *
   * Compensate outside any database transaction. If compensation itself
   * fails, preserve evidence of the orphaned object without replacing the
   * original database error that caused the upload to fail.
   */
  let cleanupError=null

  try{

    await deleteVerificationObject(
      storageKey
    )

  }catch(error){

    cleanupError=
      error
  }

  if(cleanupError){

    const recoveryEvidence={
      professionalId:p.id,
      documentId:did,
      storageKey,
      reason:
        'db_insert_failed_cleanup_failed'
    }

    /*
     * Audit persistence is best-effort because the original DB operation
     * may have failed due to broader database unavailability.
     */
    await audit(
      req.user.id,
      'verification.document.storage_cleanup_failed',
      recoveryEvidence
    ).catch(
      ()=>{}
    )

    /*
     * Operational fallback ensures the failed compensation is not silent
     * even when durable audit persistence is temporarily unavailable.
     */
    console.error(
      '[MELEO] verification document storage compensation failed',
      recoveryEvidence
    )
  }

  throw e
}res.json({ok:true,id:did,name,mime:detected,size:buf.length,storage:config.storage.driver})})
  app.get('/api/professional/verification-documents',auth,requireRole('professional'),async(req,res)=>{const p=await Professionals.byUser(req.user.id);const items=await many(`SELECT id,original_name name,mime_type mime,size_bytes size,created_at "createdAt" FROM verification_documents WHERE professional_id=$1 ORDER BY created_at DESC`,[p.id]);res.json(items)})
  app.post('/api/professional/verification',auth,requireRole('professional'),requireVerifiedEmail,limits.write,async(req,res)=>{const p=await Professionals.byUser(req.user.id);if(!p.subscriptionPlan||!['active','past_due'].includes(p.subscriptionStatus))return res.status(400).json({error:'Απαιτείται πρώτα ενεργή συνδρομή.'});if(!p.specialty||!p.title||!p.city)return res.status(400).json({error:'Ολοκλήρωσε πρώτα το επαγγελματικό προφίλ.'});const rid=id('ver');await tx(async c=>{await c.query(`INSERT INTO verification_requests(id,professional_id,license_number,notes,status) VALUES($1,$2,$3,$4,'pending')`,[rid,p.id,str(req.body.licenseNumber,120),str(req.body.notes,1000)]);await c.query(`UPDATE professionals SET onboarding_stage='pending_verification',updated_at=now() WHERE id=$1`,[p.id]);await audit(req.user.id,'verification.submit',{professionalId:p.id},c)});res.json({ok:true,request:{id:rid,status:'pending'}})})

}
