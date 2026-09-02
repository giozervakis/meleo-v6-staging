/*
 * MELEO v6.3.0
 *
 * Account profile and profile-media routes.
 *
 * Profile persistence, object storage and authentication
 * dependencies are injected by the application composition root.
 */

export function registerAccountProfileRoutes(
  app,
  deps
) {
  const {
    limits,
    auth,
    str,
    Users,
    audit,
    publicUser,
    profilePhotoObjectKey,
    putVerificationObject,
    getVerificationObject,
    deleteVerificationObject
  } = deps

  if (!app) {
    throw new Error(
      'registerAccountProfileRoutes requires an Express app'
    )
  }

  const required = {
    limits,
    auth,
    str,
    Users,
    audit,
    publicUser,
    profilePhotoObjectKey,
    putVerificationObject,
    getVerificationObject,
    deleteVerificationObject
  }

  for (
    const [name,value]
    of Object.entries(required)
  ) {
    if (
      value === undefined ||
      value === null
    ) {
      throw new Error(
        `registerAccountProfileRoutes missing dependency: ${name}`
      )
    }
  }

  const PROFILE_AVATARS=[
    'care-01',
    'care-02',
    'care-03',
    'care-04',
    'care-05',
    'care-06',
    'care-07',
    'care-08',
    'care-09',
    'care-10',
    'care-11',
    'care-12'
  ]

  app.put('/api/me/avatar',auth,limits.write,async(req,res)=>{
    const avatarKey=str(req.body.avatarKey,40)

    if(
      avatarKey &&
      !PROFILE_AVATARS.includes(avatarKey)
    ){
      return res.status(400).json({
        error:'Μη έγκυρο avatar.'
      })
    }

    const updated=await Users.update(
      req.user.id,
      {
        avatar_key:avatarKey||null
      }
    )

    await audit(
      req.user.id,
      'profile.avatar.update',
      {
        avatarKey:avatarKey||null
      }
    )

    res.json({
      user:publicUser(updated)
    })
  })
  app.post('/api/me/profile-photo',auth,limits.write,async(req,res)=>{
    const data=String(req.body.data||'')

    if(!data){
      return res.status(400).json({
        error:'Δεν στάλθηκε εικόνα.'
      })
    }

    if(data.length>4_000_000){
      return res.status(400).json({
        error:'Η εικόνα είναι πολύ μεγάλη.'
      })
    }

    const buf=Buffer.from(data,'base64')

    let mime=''

    if(
      buf.slice(0,3).toString('hex')==='ffd8ff'
    ){
      mime='image/jpeg'
    }
    else if(
      buf.slice(0,8).toString('hex')==='89504e470d0a1a0a'
    ){
      mime='image/png'
    }
    else if(
      buf.slice(0,4).toString()==='RIFF' &&
      buf.slice(8,12).toString()==='WEBP'
    ){
      mime='image/webp'
    }

    if(!mime){
      return res.status(400).json({
        error:'Επιτρέπονται μόνο JPG, PNG ή WEBP.'
      })
    }

    const current=await Users.byId(req.user.id)

    const nextVersion=
      Number(current.profile_photo_version||0)+1

    const newKey=
      profilePhotoObjectKey(
        req.user.id,
        nextVersion
      )

    await putVerificationObject(
      newKey,
      buf
    )

    const oldKey=
      current.profile_photo_key||null

    let updated

    try{

      updated=
        await Users.update(
          req.user.id,
          {
            profile_photo_key:newKey,
            profile_photo_mime:mime,
            profile_photo_version:nextVersion
          }
        )

    }catch(error){

      /*
       * Storage write succeeded but local persistence failed.
       *
       * Compensate by removing the newly-written object so a failed
       * profile update cannot leave orphaned storage behind.
       *
       * Storage remains outside any database transaction.
       */
      await deleteVerificationObject(
        newKey
      ).catch(
        ()=>{}
      )

      throw error
    }

    if(oldKey && oldKey!==newKey){
      deleteVerificationObject(oldKey)
        .catch(()=>{})
    }

    await audit(
      req.user.id,
      'profile.photo.update',
      {
        mime,
        version:nextVersion,
        size:buf.length
      }
    )

    res.json({
      user:publicUser(updated)
    })
  })


  app.delete('/api/me/profile-photo',auth,limits.write,async(req,res)=>{
    const current=await Users.byId(req.user.id)

    const oldKey=
      current.profile_photo_key||null

    const nextVersion=
      Number(current.profile_photo_version||0)+1

    const updated=await Users.update(
      req.user.id,
      {
        profile_photo_key:null,
        profile_photo_mime:null,
        profile_photo_version:nextVersion
      }
    )

    if(oldKey){
      deleteVerificationObject(oldKey)
        .catch(()=>{})
    }

    await audit(
      req.user.id,
      'profile.photo.delete',
      {
        version:nextVersion
      }
    )

    res.json({
      user:publicUser(updated)
    })
  })


  app.get('/api/profile-photo/:userId',async(req,res)=>{
    const userId=
      str(req.params.userId,120)

    const u=
      await Users.byId(userId)

    if(
      !u ||
      !u.profile_photo_key
    ){
      return res.status(404).end()
    }

    try{
      const buf=
        await getVerificationObject(
          u.profile_photo_key
        )

      res.setHeader(
        'Content-Type',
        u.profile_photo_mime||'image/jpeg'
      )

      res.setHeader(
        'Cache-Control',
        'public, max-age=31536000, immutable'
      )

      res.setHeader(
        'X-Content-Type-Options',
        'nosniff'
      )

      res.end(buf)
    }
    catch(e){
      if(
        e?.code==='ENOENT' ||
        e?.status===404
      ){
        return res.status(404).end()
      }

      throw e
    }
  })


}
