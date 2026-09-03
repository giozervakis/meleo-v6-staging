/*
 * MELEO D10E.10D
 *
 * Durable account-deletion recovery.
 *
 * External operations remain outside PostgreSQL transactions:
 *   1. Stripe cancellation
 *   2. verification-object deletion
 *
 * Only after those side effects succeed do we execute the final
 * anonymisation transaction.
 *
 * Initial HTTP failures persist deletion_pending and atomically create
 * one durable account_deletion_retry background job.
 *
 * Worker retries reuse the existing background job; they never create
 * recursive recovery jobs.
 */

export function createAccountDeletionService(
  deps
){
  const {
    Users,
    Professionals,
    many,
    tx,
    audit,
    deleteVerificationObject,
    getStripe,
    now,
    id
  }=deps


  async function schedulePendingRecovery(
    userId,
    action,
    reason,
    metadata={},
    scheduleRecovery=true
  ){
    await tx(async client=>{

      /*
       * Serialize competing deletion requests for this user so duplicate
       * HTTP requests cannot create duplicate recovery jobs.
       */
      await client.query(
        `
          SELECT id
          FROM users
          WHERE id=$1
          FOR UPDATE
        `,
        [userId]
      )

      await client.query(
        `
          UPDATE users

          SET
            deletion_pending=true,
            deletion_requested_at=
              coalesce(
                deletion_requested_at,
                $2
              ),
            updated_at=now()

          WHERE id=$1
        `,
        [
          userId,
          now()
        ]
      )

      await audit(
        userId,
        action,
        {
          ...metadata,
          reason,
          recoveryScheduled:
            scheduleRecovery
        },
        client
      )

      if(scheduleRecovery){

        /*
         * The user row lock above serializes competing requests.
         *
         * The NOT EXISTS guard prevents another pending/processing recovery
         * job for the same account from being created.
         */
        await client.query(
          `
            INSERT INTO background_jobs(
              id,
              job_type,
              payload,
              priority,
              max_attempts,
              run_at
            )

            SELECT
              $1,
              'account_deletion_retry',
              $2::jsonb,
              20,
              48,
              now()

            WHERE NOT EXISTS (
              SELECT 1
              FROM background_jobs

              WHERE
                job_type='account_deletion_retry'
                AND payload->>'userId'=$3
                AND status IN (
                  'pending',
                  'processing'
                )
            )
          `,
          [
            id('job'),
            JSON.stringify({
              userId
            }),
            userId
          ]
        )
      }
    })
  }


  async function cancelSubscription(
    professional,
    retryMode
  ){
    if(
      !professional?.stripeSubscriptionId
    ){
      return
    }

    const stripe=
      getStripe()

    /*
     * Preserve the previous HTTP-route behaviour when Stripe is not enabled.
     * A recovery worker, however, must never silently bypass an external
     * billing relationship that previously failed cancellation.
     */
    if(!stripe){
      if(retryMode){
        const error=
          new Error(
            'Stripe unavailable during account deletion recovery'
          )

        error.code=
          'ACCOUNT_DELETION_STRIPE_UNAVAILABLE'

        throw error
      }

      return
    }

    /*
     * Retry-safe cancellation.
     *
     * A previous deletion attempt may already have cancelled Stripe and then
     * failed while deleting storage. Re-read Stripe first and avoid sending
     * another cancellation for an already-cancelled subscription.
     */
    const subscription=
      await stripe
        .subscriptions
        .retrieve(
          professional.stripeSubscriptionId
        )

    if(
      subscription.status!==
      'canceled'
    ){
      await stripe
        .subscriptions
        .cancel(
          professional.stripeSubscriptionId
        )
    }
  }


  async function removeVerificationObjects(
    professional
  ){
    if(!professional){
      return []
    }

    const documents=
      await many(
        `
          SELECT
            id,
            storage_key "storageKey"

          FROM verification_documents

          WHERE professional_id=$1
        `,
        [professional.id]
      )

    for(
      const document
      of documents
    ){
      if(document.storageKey){
        await deleteVerificationObject(
          document.storageKey
        )
      }
    }

    return documents
  }


  async function removeProfilePhotoObject(
    user
  ){
    const profilePhotoKey=
      user?.profile_photo_key || null

    if(!profilePhotoKey){
      return null
    }

    await deleteVerificationObject(
      profilePhotoKey
    )

    return profilePhotoKey
  }


  async function finalizeDeletion(
    user,
    professional,
    verificationDocuments,
    profilePhotoRemoved
  ){
    const deletedEmail=
      `deleted+${user.id}@deleted.invalid`

    await tx(async client=>{

      await client.query(
        `
          DELETE FROM sessions
          WHERE user_id=$1
        `,
        [user.id]
      )

      await client.query(
        `
          DELETE FROM one_time_tokens
          WHERE user_id=$1
        `,
        [user.id]
      )

      await client.query(
        `
          DELETE FROM user_identities
          WHERE user_id=$1
        `,
        [user.id]
      )

      await client.query(
        `
          DELETE FROM favorites
          WHERE user_id=$1
        `,
        [user.id]
      )

      await client.query(
        `
          DELETE FROM notifications
          WHERE user_id=$1
        `,
        [user.id]
      )

      await client.query(
        `
          UPDATE bookings

          SET
            address='',
            notes_encrypted='',
            updated_at=now()

          WHERE patient_id=$1
        `,
        [user.id]
      )

      await client.query(
        `
          UPDATE booking_messages

          SET
            sender_name='Deleted User',
            body_encrypted=''

          WHERE sender_user_id=$1
        `,
        [user.id]
      )

      await client.query(
        `
          UPDATE reviews

          SET comment=''

          WHERE patient_id=$1
        `,
        [user.id]
      )

      await client.query(
        `
          UPDATE support_tickets

          SET
            subject='',
            updated_at=now()

          WHERE user_id=$1
        `,
        [user.id]
      )

      await client.query(
        `
          UPDATE support_messages

          SET body=''

          WHERE sender_user_id=$1
        `,
        [user.id]
      )

      await client.query(
        `
          UPDATE reports

          SET
            reason='account_deleted',
            details='',
            updated_at=now()

          WHERE reporter_user_id=$1
        `,
        [user.id]
      )


      if(professional){

        await client.query(
          `
            UPDATE verification_requests

            SET
              license_number='',
              notes='',
              admin_note=''

            WHERE professional_id=$1
          `,
          [professional.id]
        )

        await client.query(
          `
            DELETE FROM verification_documents
            WHERE professional_id=$1
          `,
          [professional.id]
        )

        await client.query(
          `
            UPDATE professionals

            SET
              title='',
              verified=false,
              featured=false,
              admin_suspended=true,
              city='',
              area='',
              region='',
              latitude=NULL,
              longitude=NULL,
              available='',
              bio='',
              languages='[]'::jsonb,
              credentials='[]'::jsonb,
              response_time='',
              services='[]'::jsonb,
              availability='[]'::jsonb,
              show_phone=false,
              show_email=false,
              prefer_platform_contact=true,
              subscription_status='cancelled',
              stripe_subscription_id=NULL,
              current_period_end=NULL,
              cancel_at_period_end=false,
              past_due_since=NULL,
              updated_at=now()

            WHERE id=$1
          `,
          [professional.id]
        )
      }


      await client.query(
        `
          UPDATE users

          SET
            name='Deleted User',
            email=$2,
            phone='',
            password_hash='!account-deleted!',
            email_verified=false,
            stripe_customer_id=NULL,
            avatar_key=NULL,
            profile_photo_key=NULL,
            profile_photo_mime=NULL,
            profile_photo_version=
              profile_photo_version+1,
            deletion_pending=false,
            deletion_requested_at=
              coalesce(
                deletion_requested_at,
                now()
              ),
            deleted_at=now(),
            last_totp_step=NULL,
            last_login_at=NULL,
            account_status='suspended',
            suspended_at=now(),
            suspension_reason='account_deleted',
            updated_at=now()

          WHERE id=$1
        `,
        [
          user.id,
          deletedEmail
        ]
      )

      await audit(
        user.id,
        'privacy.account_deleted',
        {
          anonymized:true,
          credentialsRemoved:true,
          verificationObjectsRemoved:
            verificationDocuments.length,
          profilePhotoRemoved:
            Boolean(
              profilePhotoRemoved
            ),
          recovered:
            Boolean(
              user.deletion_pending
            )
        },
        client
      )
    })
  }


  async function execute(
    userId,
    {
      retryMode=false,
      scheduleRecovery=true
    }={}
  ){
    const user=
      await Users.byId(
        userId
      )

    if(!user){
      const error=
        new Error(
          'Account deletion user not found'
        )

      error.code=
        'ACCOUNT_DELETION_USER_NOT_FOUND'

      throw error
    }

    /*
     * Makes worker retry safe across a crash after final DB commit but before
     * the background job itself was marked completed.
     */
    if(user.deleted_at){
      return {
        ok:true,
        deleted:true,
        alreadyDeleted:true
      }
    }

    const professional=
      user.role==='professional'
        ? await Professionals.byUser(
            user.id
          )
        : null


    try{

      await cancelSubscription(
        professional,
        retryMode
      )

    }catch(error){

      await schedulePendingRecovery(
        user.id,
        'privacy.deletion_pending',
        'stripe_cancel_failed',
        {
          stripeSubscriptionId:
            professional
              ?.stripeSubscriptionId ||
            null
        },
        scheduleRecovery
      )

      if(retryMode){
        throw error
      }

      return {
        ok:true,
        pending:true,
        reason:
          'stripe_cancel_failed'
      }
    }


    let verificationDocuments=[]

    try{

      verificationDocuments=
        await removeVerificationObjects(
          professional
        )

    }catch(error){

      await schedulePendingRecovery(
        user.id,
        'privacy.verification_storage_delete_failed',
        'verification_storage_delete_failed',
        {
          professionalId:
            professional?.id || null
        },
        scheduleRecovery
      )

      if(retryMode){
        throw error
      }

      return {
        ok:true,
        pending:true,
        reason:
          'verification_storage_delete_failed'
      }
    }


    let profilePhotoRemoved=null

    try{

      profilePhotoRemoved=
        await removeProfilePhotoObject(
          user
        )

    }catch(error){

      await schedulePendingRecovery(
        user.id,
        'privacy.profile_photo_storage_delete_failed',
        'profile_photo_storage_delete_failed',
        {
          profilePhotoKeyPresent:
            Boolean(
              user.profile_photo_key
            )
        },
        scheduleRecovery
      )

      if(retryMode){
        throw error
      }

      return {
        ok:true,
        pending:true,
        reason:
          'profile_photo_storage_delete_failed'
      }
    }


    await finalizeDeletion(
      user,
      professional,
      verificationDocuments,
      profilePhotoRemoved
    )

    return {
      ok:true,
      deleted:true,
      alreadyDeleted:false,
      email:user.email,
      name:user.name
    }
  }


  return {
    request:
      userId=>
        execute(
          userId,
          {
            retryMode:false,
            scheduleRecovery:true
          }
        ),

    retry:
      userId=>
        execute(
          userId,
          {
            retryMode:true,
            scheduleRecovery:false
          }
        )
  }
}
