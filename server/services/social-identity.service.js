export function createSocialIdentityService({
  Users,
  one,
  id,
  now,
  audit,
  config
}) {

const SOCIAL_IDENTITY_PROVIDER_GOOGLE =
  'google'


function normalizeSocialEmail(
  value
) {
  return String(
    value || ''
  )
    .trim()
    .toLowerCase()
}


async function socialIdentityBySubject(
  provider,
  providerSubject
) {
  const normalizedProvider =
    String(
      provider || ''
    )
      .trim()
      .toLowerCase()

  const normalizedSubject =
    String(
      providerSubject || ''
    )
      .trim()

  if (
    !normalizedProvider ||
    !normalizedSubject
  ) {
    return null
  }

  return one(
    `
      SELECT
        ui.*,
        u.role,
        u.name,
        u.email,
        u.phone,
        u.password_hash,
        u.email_verified,
        u.account_status,
        u.stripe_customer_id,
        u.deleted_at
      FROM user_identities ui
      JOIN users u
        ON u.id = ui.user_id
      WHERE ui.provider = $1
        AND ui.provider_subject = $2
      LIMIT 1
    `,
    [
      normalizedProvider,
      normalizedSubject
    ]
  )
}


async function socialIdentityForUserProvider(
  userId,
  provider
) {
  return one(
    `
      SELECT *
      FROM user_identities
      WHERE user_id = $1
        AND provider = $2
      LIMIT 1
    `,
    [
      userId,
      String(provider || '')
        .trim()
        .toLowerCase()
    ]
  )
}


async function insertSocialIdentity({
  userId,
  provider,
  providerSubject,
  providerEmail = null
}) {
  const normalizedProvider =
    String(
      provider || ''
    )
      .trim()
      .toLowerCase()

  const normalizedSubject =
    String(
      providerSubject || ''
    )
      .trim()

  const normalizedEmail =
    normalizeSocialEmail(
      providerEmail
    ) || null

  if (
    !userId ||
    !normalizedProvider ||
    !normalizedSubject
  ) {
    throw new Error(
      'Invalid social identity'
    )
  }

  return one(
    `
      INSERT INTO user_identities(
        id,
        user_id,
        provider,
        provider_subject,
        provider_email,
        created_at,
        updated_at,
        last_login_at
      )
      VALUES(
        $1,
        $2,
        $3,
        $4,
        $5,
        now(),
        now(),
        now()
      )
      RETURNING *
    `,
    [
      id('uid'),
      userId,
      normalizedProvider,
      normalizedSubject,
      normalizedEmail
    ]
  )
}


async function touchSocialIdentity(
  identityId,
  providerEmail = null
) {
  const normalizedEmail =
    normalizeSocialEmail(
      providerEmail
    ) || null

  return one(
    `
      UPDATE user_identities
      SET
        provider_email =
          COALESCE(
            $2,
            provider_email
          ),
        last_login_at = now(),
        updated_at = now()
      WHERE id = $1
      RETURNING *
    `,
    [
      identityId,
      normalizedEmail
    ]
  )
}


async function linkSocialIdentity({
  userId,
  provider,
  providerSubject,
  providerEmail = null
}) {
  const existingSubject =
    await socialIdentityBySubject(
      provider,
      providerSubject
    )

  /*
   * A provider subject can belong to only one MELEO user.
   * Never silently move it between accounts.
   */
  if (
    existingSubject &&
    existingSubject.user_id !== userId
  ) {
    const error =
      new Error(
        'Social identity is already linked to another account'
      )

    error.code =
      'SOCIAL_IDENTITY_CONFLICT'

    throw error
  }


  const existingProvider =
    await socialIdentityForUserProvider(
      userId,
      provider
    )

  /*
   * One provider identity per MELEO user.
   * Prevent replacing Google identity A with Google identity B.
   */
  if (
    existingProvider &&
    existingProvider.provider_subject !==
      String(providerSubject)
  ) {
    const error =
      new Error(
        'Another identity from this provider is already linked'
      )

    error.code =
      'SOCIAL_PROVIDER_ALREADY_LINKED'

    throw error
  }


  if (existingSubject) {

    await touchSocialIdentity(
      existingSubject.id,
      providerEmail
    )

    return existingSubject
  }


  if (existingProvider) {

    await touchSocialIdentity(
      existingProvider.id,
      providerEmail
    )

    return existingProvider
  }


  return insertSocialIdentity({
    userId,
    provider,
    providerSubject,
    providerEmail
  })
}


async function resolveGoogleAccount(
  googleProfile
) {
  const provider =
    SOCIAL_IDENTITY_PROVIDER_GOOGLE

  const subject =
    String(
      googleProfile?.sub || ''
    ).trim()

  const email =
    normalizeSocialEmail(
      googleProfile?.email
    )

  const emailVerified =
    googleProfile?.email_verified === true


  if (!subject) {
    const error =
      new Error(
        'Google identity does not contain a subject'
      )

    error.code =
      'GOOGLE_SUBJECT_MISSING'

    throw error
  }


  /*
   * 1. Strongest lookup:
   *    Google issuer + immutable Google subject.
   */
  const linked =
    await socialIdentityBySubject(
      provider,
      subject
    )


  if (linked) {

    if (
      linked.deleted_at
    ) {
      const error =
        new Error(
          'Linked MELEO account is unavailable'
        )

      error.code =
        'ACCOUNT_UNAVAILABLE'

      throw error
    }


    if (
      linked.account_status ===
      'suspended'
    ) {
      const error =
        new Error(
          'Linked MELEO account is suspended'
        )

      error.code =
        'ACCOUNT_SUSPENDED'

      throw error
    }


    await touchSocialIdentity(
      linked.id,
      email || null
    )


    const user =
      await Users.byId(
        linked.user_id
      )


    return {
      user,
      identity:
        await socialIdentityBySubject(
          provider,
          subject
        ),
      created: false,
      linkedByEmail: false
    }
  }


  /*
   * 2. No existing Google subject.
   *
   * Linking by email is allowed only when Google itself
   * cryptographically asserted email_verified=true.
   */
  if (
    email &&
    emailVerified
  ) {

    const existingUser =
      await Users.byEmail(
        email
      )


    if (existingUser) {

      if (
        existingUser.deleted_at
      ) {
        const error =
          new Error(
            'Existing MELEO account is unavailable'
          )

        error.code =
          'ACCOUNT_UNAVAILABLE'

        throw error
      }


      if (
        existingUser.account_status ===
        'suspended'
      ) {
        const error =
          new Error(
            'Existing MELEO account is suspended'
          )

        error.code =
          'ACCOUNT_SUSPENDED'

        throw error
      }


      const identity =
        await linkSocialIdentity({
          userId:
            existingUser.id,

          provider,

          providerSubject:
            subject,

          providerEmail:
            email
        })


      /*
       * A verified Google email is sufficient to mark the
       * matching MELEO email as verified.
       */
      if (
        !existingUser.email_verified
      ) {
        await Users.update(
          existingUser.id,
          {
            email_verified:
              true
          }
        )
      }


      const refreshed =
        await Users.byId(
          existingUser.id
        )


      return {
        user:
          refreshed,

        identity,

        created:
          false,

        linkedByEmail:
          true
      }
    }
  }


  /*
   * 3. Creating a new MELEO account requires a verified email.
   *
   * Do not create an email-less or unverified-email account
   * from Google OAuth.
   */
  if (
    !email ||
    !emailVerified
  ) {
    const error =
      new Error(
        'A verified Google email is required'
      )

    error.code =
      'GOOGLE_VERIFIED_EMAIL_REQUIRED'

    throw error
  }


  const name =
    String(
      googleProfile?.name ||
      email.split('@')[0] ||
      'MELEO User'
    )
      .trim()
      .slice(
        0,
        120
      )


  /*
   * Social-only accounts intentionally have no usable
   * local password.
   */
  const userId =
    id(
      'usr'
    )


  const user =
    await Users.create({
      id:
        userId,

      role:
        'patient',

      name,

      email,

      phone:
        '',

      passwordHash:
        null,

      emailVerified:
        true,

      acceptedTermsAt:
        now(),

      termsVersion:
        config.legal.termsVersion
    })


  const identity =
    await linkSocialIdentity({
      userId:
        user.id,

      provider,

      providerSubject:
        subject,

      providerEmail:
        email
    })


  await audit(
    user.id,
    'auth.social_account_created',
    {
      provider
    }
  )


  return {
    user,
    identity,
    created:
      true,

    linkedByEmail:
      false
  }
}

  return Object.freeze({
    resolveGoogleAccount
  })
}
