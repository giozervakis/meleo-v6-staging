export function createAdminBootstrapService({
  config,
  Users,
  hashPassword,
  now
}){
  if(!config){
    throw new Error(
      'admin bootstrap requires config'
    )
  }

  if(!Users){
    throw new Error(
      'admin bootstrap requires Users repository'
    )
  }

  if(typeof hashPassword!=='function'){
    throw new Error(
      'admin bootstrap requires hashPassword'
    )
  }

  if(typeof now!=='function'){
    throw new Error(
      'admin bootstrap requires now'
    )
  }

  async function ensureAdmin(){
    const email=
      config.admin.email

    const pass=
      config.admin.password||
      (
        config.isProd
          ? ''
          : 'admin123'
      )

    if(!pass){
      return
    }

    let user=
      await Users.byEmail(email)

    if(!user){
      user=
        await Users.create({
          id:'u_admin',
          role:'admin',
          name:'MELEO Admin',
          email,
          phone:'',
          passwordHash:
            await hashPassword(pass),
          emailVerified:true,
          acceptedTermsAt:
            now()
        })

      return user
    }

    if(config.admin.password){
      await Users.update(
        user.id,
        {
          password_hash:
            await hashPassword(
              config.admin.password
            )
        }
      )
    }

    return user
  }

  return Object.freeze({
    ensureAdmin
  })
}
