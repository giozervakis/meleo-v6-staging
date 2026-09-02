import { one, many, sql, tx, id, now, sha256, pagination } from './pool.js'
import { decryptSensitive, encryptSensitive } from '../security.js'

const arr=v=>Array.isArray(v)?v:[]
export function professionalFromRow(r, user=null){
  if(!r)return null

  return {
    id:r.id,
    userId:r.user_id,
    name:user?.name||r.user_name,
    title:r.title,
    specialty:r.specialty,

    avatarKey:
      user?.avatar_key||
      r.avatar_key||
      null,

    profilePhotoUrl:
      (user?.profile_photo_key||r.profile_photo_key)
        ? `/api/profile-photo/${encodeURIComponent(r.user_id)}?v=${Number(
            user?.profile_photo_version||
            r.profile_photo_version||
            0
          )}`
        : null,

    verified:r.verified,
    featured:r.featured,
    rating:Number(r.rating||0),
    reviews:Number(r.reviews_count||0),

    city:r.city,
    area:r.area,
    region:r.region,
    countryCode:r.country_code,
    latitude:r.latitude,
    longitude:r.longitude,

    serviceRadiusKm:r.service_radius_km,
    subscriptionPlan:r.subscription_plan,
    subscriptionPrice:Number(r.subscription_price||0),

    subscriptionStatus:r.subscription_status,
    billingMode:r.billing_mode,
    onboardingCompleted:r.onboarding_completed,
    onboardingStage:r.onboarding_stage,
    subscriptionSince:r.subscription_since,

    available:r.available,
    bio:r.bio,

    languages:arr(r.languages),
    credentials:arr(r.credentials),
    responseTime:r.response_time,
    years:r.years,

    price:Number(r.price||0),
    pricingMode:r.pricing_mode,
    services:arr(r.services),
    availability:arr(r.availability),

    showPhone:r.show_phone,
    showEmail:r.show_email,
    preferPlatformContact:r.prefer_platform_contact,

    phone:r.show_phone
      ? (user?.phone||r.user_phone)
      : undefined,

    email:r.show_email
      ? (user?.email||r.user_email)
      : undefined,

    stripeSubscriptionId:r.stripe_subscription_id,
    currentPeriodEnd:r.current_period_end,
    cancelAtPeriodEnd:r.cancel_at_period_end,
    pastDueSince:r.past_due_since,
    adminSuspended:r.admin_suspended
  }
}

export const Users={
  byEmail: email=>one('SELECT * FROM users WHERE lower(email)=lower($1) AND deleted_at IS NULL',[email]),
  byId: userId=>one('SELECT * FROM users WHERE id=$1 AND deleted_at IS NULL',[userId]),
  async create(u){ await sql(`INSERT INTO users(id,role,name,email,phone,password_hash,email_verified,accepted_terms_at,terms_version,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now())`,[u.id,u.role,u.name,u.email,u.phone||'',u.passwordHash,!!u.emailVerified,u.acceptedTermsAt||null,u.termsVersion||null]); return this.byId(u.id) },
  async update(id, patch){
    const allowed={
  role:'role',
  name:'name',
  phone:'phone',
  email_verified:'email_verified',
  stripe_customer_id:'stripe_customer_id',
  last_login_at:'last_login_at',
  last_totp_step:'last_totp_step',
  account_status:'account_status',
  suspended_at:'suspended_at',
  suspension_reason:'suspension_reason',
  deletion_pending:'deletion_pending',
  deletion_requested_at:'deletion_requested_at',
  deleted_at:'deleted_at',
  password_hash:'password_hash',

  avatar_key:'avatar_key',
  profile_photo_key:'profile_photo_key',
  profile_photo_mime:'profile_photo_mime',
  profile_photo_version:'profile_photo_version'
}
    const sets=[],vals=[]; let i=1
    for(const [k,v] of Object.entries(patch)){const col=allowed[k];if(!col)continue;sets.push(`${col}=$${i++}`);vals.push(v)}
    if(!sets.length)return this.byId(id); vals.push(id); await sql(`UPDATE users SET ${sets.join(',')},updated_at=now() WHERE id=$${i}`,[...vals]); return this.byId(id)
  }
}

export const Sessions={
  async issue(userId, raw, expiresAt, meta={}){await sql(`INSERT INTO sessions(token_hash,user_id,expires_at,ip_hash,user_agent_hash) VALUES($1,$2,$3,$4,$5)`,[sha256(raw),userId,expiresAt,meta.ipHash||null,meta.uaHash||null])},
  async resolve(raw){return one(`SELECT s.*,u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.deleted_at IS NULL`,[sha256(raw)])},
  async revoke(raw){await sql('DELETE FROM sessions WHERE token_hash=$1',[sha256(raw)])},
  async revokeUser(userId){await sql('DELETE FROM sessions WHERE user_id=$1',[userId])},
  async revokeOthers(userId,raw){await sql('DELETE FROM sessions WHERE user_id=$1 AND token_hash<>$2',[userId,sha256(raw)])},
  async listForUser(userId,raw){const current=sha256(raw);const rows=await many(`SELECT token_hash,expires_at \"expiresAt\",created_at \"createdAt\",ip_hash \"ipHash\",user_agent_hash \"userAgentHash\" FROM sessions WHERE user_id=$1 AND expires_at>now() ORDER BY created_at DESC`,[userId]);return rows.map(r=>({expiresAt:r.expiresAt,createdAt:r.createdAt,ipHash:r.ipHash,userAgentHash:r.userAgentHash,current:r.token_hash===current}))},
  async sweep(){await sql('DELETE FROM sessions WHERE expires_at<=now()')}
}

export const Professionals={

  byUser: async userId=>{
    const r=await one(`
      SELECT
        p.*,
        u.name user_name,
        u.email user_email,
        u.phone user_phone,
        u.avatar_key,
        u.profile_photo_key,
        u.profile_photo_version
      FROM professionals p
      JOIN users u ON u.id=p.user_id
      WHERE p.user_id=$1
    `,[userId])

    return professionalFromRow(r)
  },

  byId: async pid=>{
    const r=await one(`
      SELECT
        p.*,
        u.name user_name,
        u.email user_email,
        u.phone user_phone,
        u.avatar_key,
        u.profile_photo_key,
        u.profile_photo_version
      FROM professionals p
      JOIN users u ON u.id=p.user_id
      WHERE p.id=$1
        AND u.deleted_at IS NULL
    `,[pid])

    return professionalFromRow(r)
  },


byId: async pid=>{
  const r=await one(`
    SELECT
      p.*,
      u.name user_name,
      u.email user_email,
      u.phone user_phone,
      u.avatar_key,
      u.profile_photo_key,
      u.profile_photo_version
    FROM professionals p
    JOIN users u ON u.id=p.user_id
    WHERE p.id=$1
      AND u.deleted_at IS NULL
  `,[pid])

  return professionalFromRow(r)
},
  async createForUser(userId){const pid=id('pro');await sql(`INSERT INTO professionals(id,user_id,onboarding_stage) VALUES($1,$2,'plan') ON CONFLICT(user_id) DO NOTHING`,[pid,userId]);return this.byUser(userId)},
  async update(pid, patch){
    const map={title:'title',specialty:'specialty',verified:'verified',featured:'featured',adminSuspended:'admin_suspended',city:'city',area:'area',region:'region',countryCode:'country_code',latitude:'latitude',longitude:'longitude',serviceRadiusKm:'service_radius_km',subscriptionPlan:'subscription_plan',subscriptionPrice:'subscription_price',subscriptionStatus:'subscription_status',billingMode:'billing_mode',onboardingCompleted:'onboarding_completed',onboardingStage:'onboarding_stage',subscriptionSince:'subscription_since',stripeSubscriptionId:'stripe_subscription_id',currentPeriodEnd:'current_period_end',cancelAtPeriodEnd:'cancel_at_period_end',pastDueSince:'past_due_since',available:'available',bio:'bio',languages:'languages',credentials:'credentials',responseTime:'response_time',years:'years',price:'price',pricingMode:'pricing_mode',services:'services',availability:'availability',showPhone:'show_phone',showEmail:'show_email',preferPlatformContact:'prefer_platform_contact'}
    const sets=[],vals=[];let i=1
    for(const [k,v] of Object.entries(patch)){const col=map[k];if(!col)continue;sets.push(`${col}=$${i++}`);vals.push(['languages','credentials','services','availability'].includes(k)?JSON.stringify(v):v)}
    if(!sets.length)return this.byId(pid);vals.push(pid);await sql(`UPDATE professionals SET ${sets.join(',')},updated_at=now() WHERE id=$${i}`,[...vals]);return this.byId(pid)
  },
  async search(q){
    const {page,limit,offset}=pagination(q)
    const where=[`p.verified=true`,`p.admin_suspended=false`,`u.account_status='active'`,`u.deleted_at IS NULL`,`(p.subscription_status='active' OR (p.subscription_status='past_due' AND p.past_due_since > now() - interval '3 days'))`]
    const vals=[];let i=1
    if(q.specialty){where.push(`p.specialty=$${i++}`);vals.push(q.specialty)}
    if(q.service){where.push(`p.services ? $${i++}`);vals.push(q.service)}
    if(q.location){where.push(`(p.city ILIKE $${i} OR p.area ILIKE $${i} OR p.region ILIKE $${i})`);vals.push(`%${q.location}%`);i++}
    let distanceExpr='NULL::double precision AS distance_km'
    let distanceOrder=''
    if(Number.isFinite(Number(q.lat))&&Number.isFinite(Number(q.lon))){
      const lat=Number(q.lat),lon=Number(q.lon);vals.push(lat,lon);const a=i++,b=i++
      distanceExpr=`(6371 * acos(LEAST(1,GREATEST(-1,cos(radians($${a})) * cos(radians(p.latitude)) * cos(radians(p.longitude)-radians($${b})) + sin(radians($${a})) * sin(radians(p.latitude)))))) AS distance_km`
      where.push(`p.latitude IS NOT NULL AND p.longitude IS NOT NULL`)
      // Bounding box πρώτα ώστε η ακριβή trigonometrική απόσταση να τρέχει σε μικρό υποσύνολο.
      where.push(`p.latitude BETWEEN $${a}-3.0 AND $${a}+3.0`)
      where.push(`p.longitude BETWEEN $${b}-3.5 AND $${b}+3.5`)
      where.push(`(6371 * acos(LEAST(1,GREATEST(-1,cos(radians($${a})) * cos(radians(p.latitude)) * cos(radians(p.longitude)-radians($${b})) + sin(radians($${a})) * sin(radians(p.latitude)))))) <= p.service_radius_km`)
      distanceOrder=', distance_km ASC'
    }
    /*
     * MELEO SMART MATCH v1
     *
     * Ranking philosophy:
     * - relevance / requested service remains a hard filter
     * - distance matters strongly when GPS is available
     * - real marketplace performance matters more than subscription
     * - Premium receives a controlled commercial boost
     * - new professionals are not buried because of missing history
     *
     * Smart Match is intentionally separate from MELEO Trust.
     */

    const hasGeo =
      Number.isFinite(Number(q.lat)) &&
      Number.isFinite(Number(q.lon))

const smartDistanceScore = hasGeo
  ? `
    CASE
      WHEN distance_km IS NULL THEN 0
      WHEN distance_km <= 2 THEN 20
      WHEN distance_km <= 5 THEN 18
      WHEN distance_km <= 10 THEN 15
      WHEN distance_km <= 20 THEN 10
      WHEN distance_km <= 35 THEN 6
      ELSE 2
    END
  `
  : '10'

const smartScoreExpr=`
  LEAST(
    100,
    GREATEST(
      0,

      /* Verified professional — max 6 */
      CASE
        WHEN verified=true THEN 6
        ELSE 0
      END

      +

      /* MELEO Trust — max 28 */
      CASE
        WHEN trust_eligible=true
        THEN (coalesce(trust_score,0) / 100.0) * 28

        /* Neutral fallback for new professionals */
        ELSE 18
      END

      +

      /* Rating quality — max 14 */
      CASE
        WHEN coalesce(reviews_count,0)=0 THEN 7

        ELSE LEAST(
          14,
          GREATEST(
            0,
            (coalesce(rating,0) / 5.0) * 14
          )
        )
      END

      +

      /* Review confidence — max 5 */
      CASE
        WHEN coalesce(reviews_count,0) >= 20 THEN 5
        WHEN coalesce(reviews_count,0) >= 10 THEN 4
        WHEN coalesce(reviews_count,0) >= 5 THEN 3
        WHEN coalesce(reviews_count,0) >= 1 THEN 2
        ELSE 1
      END

      +

      /* Distance — max 20 */
      ${smartDistanceScore}

      +

      /* Availability — max 8 */
      CASE
        WHEN lower(coalesce(available,'')) LIKE '%σήμερα%' THEN 8
        WHEN lower(coalesce(available,'')) LIKE '%άμεσα%' THEN 8
        WHEN lower(coalesce(available,'')) LIKE '%διαθέσ%' THEN 6
        ELSE 3
      END

      +

      /* Response behaviour — max 6 */
      CASE
        WHEN lower(coalesce(response_time,'')) LIKE '%λεπτ%' THEN 6
        WHEN lower(coalesce(response_time,'')) LIKE '%ώρα%' THEN 5
        WHEN lower(coalesce(response_time,'')) LIKE '%ωρ%' THEN 5
        WHEN coalesce(response_time,'') <> '' THEN 4
        ELSE 2
      END

      +

      /* Experience — max 3 */
      CASE
        WHEN coalesce(years,0) >= 10 THEN 3
        WHEN coalesce(years,0) >= 5 THEN 2
        WHEN coalesce(years,0) > 0 THEN 1
        ELSE 0
      END

      +

      /* Premium commercial boost — max 8 */
      CASE
        WHEN subscription_plan='premium'
          AND subscription_status='active'
        THEN 8
        ELSE 0
      END

      +

      /* Small legacy featured tie boost */
      CASE
        WHEN featured=true THEN 2
        ELSE 0
      END
    )
  )
`

    const base=`FROM professionals p JOIN users u ON u.id=p.user_id WHERE ${where.join(' AND ')}`

    /*
     * Distance is calculated in an inner query because PostgreSQL
     * cannot safely reuse the distance_km SELECT alias inside another
     * expression at the same SELECT level.
     */
    const candidateSql=`
  SELECT
    p.*,
    u.name user_name,
	u.email user_email,
	u.phone user_phone,
	u.avatar_key,
	u.profile_photo_key,
	u.profile_photo_version,
	${distanceExpr},

    coalesce(bs.total,0)::int AS trust_total,
    coalesce(bs.completed,0)::int AS trust_completed,
    coalesce(bs.cancelled,0)::int AS trust_cancelled,
    coalesce(bs.progressed,0)::int AS trust_progressed,
    coalesce(bs.recent_completed,0)::int AS trust_recent_completed

  FROM professionals p

  JOIN users u
    ON u.id=p.user_id

  LEFT JOIN LATERAL (
    SELECT
      count(*)::int AS total,

      count(*) FILTER (
        WHERE b.status='completed'
      )::int AS completed,

      count(*) FILTER (
        WHERE b.status='cancelled'
      )::int AS cancelled,

      count(*) FILTER (
        WHERE b.status<>'pending'
      )::int AS progressed,

      count(*) FILTER (
        WHERE b.status='completed'
          AND b.created_at>=now()-interval '90 days'
      )::int AS recent_completed

    FROM bookings b

    WHERE b.professional_id=p.id

  ) bs ON true

  WHERE ${where.join(' AND ')}
`

    const countVals=[...vals]

    vals.push(limit,offset)
    const lim=i++,off=i++

    const rows=await many(`
  WITH candidate AS (

    ${candidateSql}

  ),

  metrics AS (

    SELECT
      candidate.*,

      CASE
        WHEN (trust_completed + trust_cancelled) > 0
        THEN round(
          (
            trust_completed::numeric /
            (trust_completed + trust_cancelled)::numeric
          ) * 100
        )::int
        ELSE 100
      END AS trust_completion_rate,

      CASE
        WHEN trust_total > 0
        THEN round(
          (
            trust_progressed::numeric /
            trust_total::numeric
          ) * 100
        )::int
        ELSE 100
      END AS trust_response_rate,

      CASE
        WHEN (trust_completed + trust_cancelled) > 0
        THEN round(
          (
            trust_completed::numeric /
            (trust_completed + trust_cancelled)::numeric
          ) * 100
        )::int
        ELSE 100
      END AS trust_reliability_rate,

      (
        trust_completed >= 5
        AND coalesce(reviews_count,0) >= 3
      ) AS trust_eligible

    FROM candidate
  ),

  trust_scored AS (

    SELECT
      metrics.*,

      CASE
        WHEN trust_eligible = true THEN

          LEAST(
            100,
            GREATEST(
              0,

              CASE
                WHEN verified = true THEN 20
                ELSE 0
              END

              +

              round(
                GREATEST(
                  0,
                  LEAST(
                    25,
                    (coalesce(rating,0) / 5.0) * 25
                  )
                )
              )

              +

              round(
                GREATEST(
                  0,
                  LEAST(
                    20,
                    (trust_completion_rate / 100.0) * 20
                  )
                )
              )

              +

              round(
                GREATEST(
                  0,
                  LEAST(
                    15,
                    (trust_response_rate / 100.0) * 15
                  )
                )
              )

              +

              round(
                GREATEST(
                  0,
                  LEAST(
                    10,
                    (trust_reliability_rate / 100.0) * 10
                  )
                )
              )

              +

              CASE
                WHEN trust_recent_completed >= 8 THEN 10
                WHEN trust_recent_completed >= 5 THEN 8
                WHEN trust_recent_completed >= 2 THEN 6
                ELSE 4
              END
            )
          )::int

        ELSE NULL

      END AS trust_score

    FROM metrics
  )

  SELECT
    trust_scored.*,
    ROUND((${smartScoreExpr})::numeric,1) AS smart_match_score

  FROM trust_scored

  ORDER BY
    smart_match_score DESC,
    trust_score DESC NULLS LAST,
    rating DESC,
    reviews_count DESC,
    distance_km ASC NULLS LAST,
    created_at DESC

  LIMIT $${lim}
  OFFSET $${off}

`,vals)

    const c=await one(
      `SELECT count(*)::int total ${base}`,
      countVals
    )

const trustLabel=score=>
  score>=90
    ? 'Εξαιρετική αξιοπιστία'
    : score>=80
      ? 'Πολύ υψηλή αξιοπιστία'
      : score>=70
        ? 'Υψηλή αξιοπιστία'
        : score>=60
          ? 'Καλή αξιοπιστία'
          : 'Αναπτυσσόμενη αξιοπιστία'

const items=rows.map((r,index)=>{
  const p=professionalFromRow(r)

  const distance=
    r.distance_km==null
      ? undefined
      : Number(Number(r.distance_km).toFixed(1))

  const trustEligible=Boolean(r.trust_eligible)

  const trustScore=
    trustEligible
      ? Number(r.trust_score||0)
      : null

  const trust=trustEligible
    ? {
        eligible:true,
        score:trustScore,
        label:trustLabel(trustScore),
        completed:Number(r.trust_completed||0),
        reviews:Number(p.reviews||0),
        rating:Number(Number(p.rating||0).toFixed(1)),
        completionRate:Number(r.trust_completion_rate||0),
        responseRate:Number(r.trust_response_rate||0)
      }
    : {
        eligible:false,
        label:'MELEO Verified · Νέος επαγγελματίας',
        completed:Number(r.trust_completed||0),
        reviews:Number(p.reviews||0),
        minCompleted:5,
        minReviews:3
      }

  const reasons=[]

  if(trustEligible){
    if(trustScore>=90){
      reasons.push('Εξαιρετική αξιοπιστία')
    }else if(trustScore>=80){
      reasons.push('Πολύ υψηλή αξιοπιστία')
    }else if(trustScore>=70){
      reasons.push('Υψηλή αξιοπιστία')
    }
  }else{
    reasons.push('MELEO Verified · Νέος επαγγελματίας')
  }

  if(distance!=null){
    if(distance<=2){
      reasons.push('Πολύ κοντά σου')
    }else if(distance<=5){
      reasons.push(`${distance} km από εσένα`)
    }
  }

  if(
    Number(p.rating||0)>=4.8 &&
    Number(p.reviews||0)>=3
  ){
    reasons.push('Εξαιρετικές αξιολογήσεις')
  }

  if(
    String(p.available||'').toLowerCase().includes('σήμερα') ||
    String(p.available||'').toLowerCase().includes('άμεσα')
  ){
    reasons.push('Διαθέσιμος σήμερα')
  }

  if(
    String(p.responseTime||'').toLowerCase().includes('λεπτ')
  ){
    reasons.push('Γρήγορη ανταπόκριση')
  }

  if(
    p.subscriptionPlan==='premium' &&
    p.subscriptionStatus==='active'
  ){
    reasons.push('PREMIUM προτεραιότητα')
  }

  return {
    ...p,
    distance,
    trust,

    smartMatch:{
      score:Number(r.smart_match_score||0),
      rank:offset+index+1,
      version:'v1.1',
      reasons:reasons.slice(0,4)
    }
  }
})

return {
  items,
  page,
  limit,
  total:c?.total||0,
  totalPages:Math.ceil((c?.total||0)/limit),
  ranking:'smart-match-v1.1'
}
  }
}

export const Notifications={

  async create(
    userId,
    type,
    title,
    body,
    options={},
    client=null
  ){

    /*
     * Durable notification state and its live-event publication must
     * commit atomically.
     *
     * If the caller already owns a transaction, reuse that exact
     * PostgreSQL client.
     *
     * Standalone notifications create their own short local database
     * transaction. External Stripe/mail work remains outside it.
     */
    const write=
      async runner=>{

        const nid=
          id('ntf')

        const priority=
          [
            'low',
            'normal',
            'high',
            'critical'
          ].includes(
            options.priority
          )
            ? options.priority
            : 'normal'

        const actionType=
          options.actionType||
          null

        const actionId=
          options.actionId||
          null

        const actionUrl=
          options.actionUrl||
          null

        await runner.query(
          `
            INSERT INTO notifications(
              id,
              user_id,
              type,
              title,
              body,
              priority,
              action_type,
              action_id,
              action_url
            )
            VALUES(
              $1,$2,$3,$4,$5,$6,$7,$8,$9
            )
          `,
          [
            nid,
            userId,
            type,
            title,
            body||'',
            priority,
            actionType,
            actionId,
            actionUrl
          ]
        )

        const notification={
          id:nid,
          userId,
          type,
          title,
          text:body||'',
          priority,
          actionType,
          actionId,
          actionUrl,
          read:false,
          readAt:null,
          createdAt:now()
        }

        const ev=
          await runner.query(
            `
              INSERT INTO live_events(
                user_id,
                payload
              )
              VALUES($1,$2)
              RETURNING id
            `,
            [
              userId,
              {
                kind:
                  'notification.created',
                notification
              }
            ]
          )

        const eventId=
          ev.rows?.[0]?.id

        /*
         * PostgreSQL NOTIFY participates in the transaction and is
         * delivered only after a successful commit.
         */
        await runner.query(
          `
            SELECT pg_notify(
              'meleo_live',
              $1
            )
          `,
          [
            JSON.stringify({
              userId,
              eventId
            })
          ]
        )

        return notification
      }

    if(
      client?.query
    ){
      return write(
        client
      )
    }

    return tx(
      async runner=>
        write(
          runner
        )
    )
  },


  async list(userId,q={}){

    const {
      page,
      limit,
      offset
    }=pagination(
      q,
      {
        defaultLimit:30,
        maxLimit:100
      }
    )

    const items=await many(
      `
        SELECT
          id,
          user_id "userId",
          type,
          title,
          body text,
          priority,
          action_type "actionType",
          action_id "actionId",
          action_url "actionUrl",
          is_read read,
          read_at "readAt",
          created_at "createdAt"

        FROM notifications

        WHERE user_id=$1

        ORDER BY created_at DESC

        LIMIT $2
        OFFSET $3
      `,
      [
        userId,
        limit,
        offset
      ]
    )

    const stats=await one(
      `
        SELECT
          count(*)::int total,

          count(*) FILTER(
            WHERE is_read=false
          )::int unread

        FROM notifications

        WHERE user_id=$1
      `,
      [userId]
    )

    return {
      items,
      page,
      limit,
      total:stats?.total||0,
      unread:stats?.unread||0,
      totalPages:
        Math.ceil(
          (stats?.total||0)/limit
        )
    }
  },


  async unreadCount(userId){

    const r=await one(
      `
        SELECT
          count(*)::int count

        FROM notifications

        WHERE
          user_id=$1
          AND is_read=false
      `,
      [userId]
    )

    return Number(
      r?.count||0
    )
  },


  async read(notificationId,userId){

    const r=await one(
      `
        UPDATE notifications

        SET
          is_read=true,
          read_at=coalesce(
            read_at,
            now()
          )

        WHERE
          id=$1
          AND user_id=$2

        RETURNING
          id,
          action_type "actionType",
          action_id "actionId",
          action_url "actionUrl"
      `,
      [
        notificationId,
        userId
      ]
    )

    if(!r){
      return null
    }

    const ev=await one(
      `
        INSERT INTO live_events(
          user_id,
          payload
        )
        VALUES($1,$2)
        RETURNING id
      `,
      [
        userId,
        {
          kind:'notification.read',
          notificationId
        }
      ]
    )

    if(ev?.id){
      await sql(
        `
          SELECT pg_notify(
            'meleo_live',
            $1
          )
        `,
        [
          JSON.stringify({
            userId,
            eventId:ev.id
          })
        ]
      )
    }

    return r
  },


  async readAll(userId){

    await sql(
      `
        UPDATE notifications

        SET
          is_read=true,
          read_at=coalesce(
            read_at,
            now()
          )

        WHERE
          user_id=$1
          AND is_read=false
      `,
      [userId]
    )

    const ev=await one(
      `
        INSERT INTO live_events(
          user_id,
          payload
        )
        VALUES($1,$2)
        RETURNING id
      `,
      [
        userId,
        {
          kind:'notification.read_all'
        }
      ]
    )

    if(ev?.id){
      await sql(
        `
          SELECT pg_notify(
            'meleo_live',
            $1
          )
        `,
        [
          JSON.stringify({
            userId,
            eventId:ev.id
          })
        ]
      )
    }

    return {
      ok:true
    }
  }

}

function bookingFromJoinedRow(
  r,
  messages=[],
  review=null
){
  if(!r){
    return null
  }

  return {
    id:r.id,
    patientId:r.patient_id,
    professionalId:r.professional_id,
    service:r.service,
    date:String(r.visit_date).slice(0,10),
    time:String(r.visit_time).slice(0,5),
    address:r.address,
    notes:decryptSensitive(r.notes_encrypted),
    repeat:r.repeat_rule,
    status:r.status,
    price:Number(r.base_price||0),
    proposedPrice:
      r.proposed_price==null
        ? null
        : Number(r.proposed_price),
    agreedPrice:
      r.agreed_price==null
        ? null
        : Number(r.agreed_price),
    patientName:r.patient_name,
    patientEmail:r.patient_email,
    patientPhone:r.patient_phone,
    professionalName:r.professional_name,
    professionalEmail:r.professional_email,
    professionalPhone:r.professional_phone,
    specialty:r.specialty,
    subscriptionPlan:r.subscription_plan,
    city:r.city,
    area:r.area,
    region:r.region,
    recoveryParentId:r.recovery_parent_id||null,
    messages:
      messages.map(m=>({
        id:m.id,
        fromRole:m.fromRole,
        fromName:m.fromName,
        body_encrypted:m.body_encrypted,
        createdAt:m.createdAt,
        text:decryptSensitive(m.body_encrypted)
      })),
    reviewed:!!review,
    review
  }
}

export const Bookings={

  async byId(bid){

    const r=await one(
      `
        SELECT
          b.*,
          pu.name patient_name,
          pu.email patient_email,
          pu.phone patient_phone,
          pru.name professional_name,
          pru.email professional_email,
          pru.phone professional_phone,
          p.specialty,
          p.subscription_plan,
          p.city,
          p.area,
          p.region

        FROM bookings b

        JOIN users pu
          ON pu.id=b.patient_id

        JOIN professionals p
          ON p.id=b.professional_id

        JOIN users pru
          ON pru.id=p.user_id

        WHERE b.id=$1
      `,
      [bid]
    )

    if(!r){
      return null
    }

    const [
      messages,
      review
    ]=await Promise.all([
      many(
        `
          SELECT
            id,
            sender_role "fromRole",
            sender_name "fromName",
            body_encrypted,
            created_at "createdAt"

          FROM booking_messages

          WHERE booking_id=$1

          ORDER BY created_at ASC
        `,
        [bid]
      ),

      one(
        `
          SELECT
            id,
            rating,
            comment,
            created_at "createdAt"

          FROM reviews

          WHERE booking_id=$1
        `,
        [bid]
      )
    ])

    return bookingFromJoinedRow(
      r,
      messages,
      review
    )
  },


  async listForUser(user,q={}){

    const {
      page,
      limit,
      offset
    }=pagination(
      q,
      {
        defaultLimit:20,
        maxLimit:100
      }
    )

    let where
    let params

    if(user.role==='patient'){

      where='b.patient_id=$1'
      params=[user.id]

    }else if(user.role==='professional'){

      const p=
        await Professionals.byUser(
          user.id
        )

      if(String(q.scope||'')==='requested'){

        where='b.patient_id=$1'
        params=[user.id]

      }else if(String(q.scope||'')==='all'){

        where=
          '(b.patient_id=$1 OR b.professional_id=$2)'

        params=[
          user.id,
          p?.id||'__none__'
        ]

      }else{

        where='b.professional_id=$1'
        params=[
          p?.id||'__none__'
        ]
      }

    }else{

      where='true'
      params=[]
    }

    const bookingRows=
      await many(
        `
          SELECT
            b.*,
            pu.name patient_name,
            pu.email patient_email,
            pu.phone patient_phone,
            pru.name professional_name,
            pru.email professional_email,
            pru.phone professional_phone,
            p.specialty,
            p.subscription_plan,
            p.city,
            p.area,
            p.region

          FROM bookings b

          JOIN users pu
            ON pu.id=b.patient_id

          JOIN professionals p
            ON p.id=b.professional_id

          JOIN users pru
            ON pru.id=p.user_id

          WHERE ${where}

          ORDER BY b.created_at DESC

          LIMIT $${params.length+1}
          OFFSET $${params.length+2}
        `,
        [
          ...params,
          limit,
          offset
        ]
      )

    const countRow=
      await one(
        `
          SELECT
            count(*)::int total

          FROM bookings b

          WHERE ${where}
        `,
        params
      )

    if(bookingRows.length===0){

      const total=
        Number(
          countRow?.total||0
        )

      return {
        items:[],
        page,
        limit,
        total,
        totalPages:
          Math.ceil(
            total/limit
          )
      }
    }

    const bookingIds=
      bookingRows.map(
        row=>row.id
      )

    const [
      messageRows,
      reviewRows
    ]=await Promise.all([

      many(
        `
          SELECT
            booking_id "bookingId",
            id,
            sender_role "fromRole",
            sender_name "fromName",
            body_encrypted,
            created_at "createdAt"

          FROM booking_messages

          WHERE booking_id = ANY($1::text[])

          ORDER BY
            booking_id ASC,
            created_at ASC
        `,
        [bookingIds]
      ),

      many(
        `
          SELECT
            booking_id "bookingId",
            id,
            rating,
            comment,
            created_at "createdAt"

          FROM reviews

          WHERE booking_id = ANY($1::text[])
        `,
        [bookingIds]
      )
    ])

    const messagesByBooking=
      new Map()

    for(const message of messageRows){

      const current=
        messagesByBooking.get(
          message.bookingId
        )||[]

      current.push(message)

      messagesByBooking.set(
        message.bookingId,
        current
      )
    }

    const reviewsByBooking=
      new Map(
        reviewRows.map(
          review=>[
            review.bookingId,
            {
              id:review.id,
              rating:review.rating,
              comment:review.comment,
              createdAt:review.createdAt
            }
          ]
        )
      )

    const items=
      bookingRows.map(
        row=>
          bookingFromJoinedRow(
            row,
            messagesByBooking.get(row.id)||[],
            reviewsByBooking.get(row.id)||null
          )
      )

    const total=
      Number(
        countRow?.total||0
      )

    return {
      items,
      page,
      limit,
      total,
      totalPages:
        Math.ceil(
          total/limit
        )
    }
  },


  /**
   * D10D.8
   *
   * Booking creation and durable notification/live-event writes
   * commit in the same PostgreSQL transaction.
   */
  async create(
    data,
    notification=null
  ){
    await tx(async client=>{

      await client.query(
        `
          INSERT INTO bookings(
            id,
            patient_id,
            professional_id,
            service,
            visit_date,
            visit_time,
            address,
            notes_encrypted,
            repeat_rule,
            status,
            base_price,
            patient_contact_consent_at,
            recovery_parent_id
          )
          VALUES(
            $1,$2,$3,$4,$5,$6,$7,$8,$9,
            'pending',$10,now(),$11
          )
        `,
        [
          data.id,
          data.patientId,
          data.professionalId,
          data.service,
          data.date,
          data.time,
          data.address||'',
          encryptSensitive(data.notes||''),
          data.repeat||'μία φορά',
          data.price||0,
          data.recoveryParentId||null
        ]
      )

      if(notification){
        await Notifications.create(
          notification.userId,
          notification.type || 'booking',
          notification.title || 'Booking created',
          notification.body || '',
          notification.options || {},
          client
        )
      }
    })

    return this.byId(
      data.id
    )
  },
async addMessage(
  booking,
  sender,
  text,
  kind='message'
){

  const mid=id('msg')

  const bookingRole=
    sender.id===booking.patientId
      ? 'patient'
      : sender.role

  const professional=
    await Professionals.byId(
      booking.professionalId
    )

  const recipientUserId=
    sender.id===booking.patientId
      ? professional?.userId
      : booking.patientId

  if(!recipientUserId){
    throw new Error(
      'Message recipient not found'
    )
  }

  const createdAt=now()

  await tx(async client=>{

    await client.query(
      `
        INSERT INTO booking_messages(
          id,
          booking_id,
          sender_user_id,
          sender_role,
          sender_name,
          body_encrypted,
          kind,
          recipient_user_id,
          delivered_at
        )
        VALUES(
          $1,$2,$3,$4,$5,$6,$7,$8,now()
        )
      `,
      [
        mid,
        booking.id,
        sender.id,
        bookingRole,
        sender.name,
        encryptSensitive(text),
        kind,
        recipientUserId
      ]
    )

    const event=
      await client.query(
        `
          INSERT INTO live_events(
            user_id,
            payload
          )
          VALUES($1,$2)
          RETURNING id
        `,
        [
          recipientUserId,
          {
            kind:'message.created',

            message:{
              id:mid,
              bookingId:booking.id,
              senderUserId:sender.id,
              senderRole:bookingRole,
              senderName:sender.name,
              recipientUserId,
              kind,
              text,
              delivered:true,
              deliveredAt:createdAt,
              read:false,
              readAt:null,
              createdAt
            }
          }
        ]
      )

    const eventId=
      event.rows?.[0]?.id

    if(eventId){
      await client.query(
        `
          SELECT pg_notify(
            'meleo_live',
            $1
          )
        `,
        [
          JSON.stringify({
            userId:recipientUserId,
            eventId
          })
        ]
      )
    }

    await Notifications.create(
      recipientUserId,
      'message',
      '\u039d\u03ad\u03bf \u03bc\u03ae\u03bd\u03c5\u03bc\u03b1 MELEO',
      text.slice(0,180),
      {
        priority:'normal',
        actionType:'booking',
        actionId:booking.id,
        actionUrl:
          sender.id===booking.patientId
            ? '/professional'
            : '/dashboard'
      },
      client
    )
  })

  return this.byId(
    booking.id
  )
},
async unreadMessageCount(userId){

  const r=await one(
    `
      SELECT
        count(*)::int count

      FROM booking_messages

      WHERE
        recipient_user_id=$1
        AND read_at IS NULL
    `,
    [userId]
  )

  return Number(
    r?.count||0
  )
},


async conversationUnreadCounts(userId){

  const rows=await many(
    `
      SELECT
        booking_id "bookingId",
        count(*)::int unread

      FROM booking_messages

      WHERE
        recipient_user_id=$1
        AND read_at IS NULL

      GROUP BY booking_id
    `,
    [userId]
  )

  return rows
},


async markMessagesRead(
  bookingId,
  userId
){

  const changed=await many(
    `
      UPDATE booking_messages

      SET
        read_at=now()

      WHERE
        booking_id=$1
        AND recipient_user_id=$2
        AND read_at IS NULL

      RETURNING id
    `,
    [
      bookingId,
      userId
    ]
  )

  if(changed.length){

    const ev=await one(
      `
        INSERT INTO live_events(
          user_id,
          payload
        )
        VALUES($1,$2)
        RETURNING id
      `,
      [
        userId,
        {
          kind:'message.read',
          bookingId,
          messageIds:
            changed.map(
              x=>x.id
            )
        }
      ]
    )

    if(ev?.id){
      await sql(
        `
          SELECT pg_notify(
            'meleo_live',
            $1
          )
        `,
        [
          JSON.stringify({
            userId,
            eventId:ev.id
          })
        ]
      )
    }
  }

  return {
    ok:true,
    count:changed.length
  }
},
  async update(id,patch){
    const map={
      status:'status',
      proposedPrice:'proposed_price',
      agreedPrice:'agreed_price'
    }

    const sets=[]
    const vals=[]
    let i=1

    for(const [k,v] of Object.entries(patch)){
      if(!map[k])continue

      const placeholder='$'+i++

      sets.push(
        map[k]+'='+placeholder
      )

      vals.push(v)
    }

    if(!sets.length){
      return this.byId(id)
    }

    const idPlaceholder='$'+i++
    vals.push(id)

    await sql(
      `
        UPDATE bookings
        SET
          ${sets.join(',')},
          updated_at=now()
        WHERE id=${idPlaceholder}
      `,
      vals
    )

    return this.byId(id)
  },


  /*
   * D10D.5
   *
   * Atomically creates or refreshes a professional quote.
   * Booking state, proposed price, conversation message,
   * notification and live events commit together.
   */
  async quoteWithMessage(
    booking,
    sender,
    amount,
    extra,
    recipientUserId
  ){
    if(
      !booking?.id ||
      !booking?.status ||
      !sender?.id ||
      !recipientUserId
    ){
      throw new Error(
        'Invalid booking quote transaction input'
      )
    }

    const proposedPrice=
      Number(
        Number(amount).toFixed(2)
      )

    if(
      !Number.isFinite(proposedPrice) ||
      proposedPrice<=0 ||
      proposedPrice>5000
    ){
      throw new Error(
        'Invalid booking quote amount'
      )
    }

    const allowedStatuses=
      new Set([
        'pending',
        'clarification',
        'quoted'
      ])

    if(
      !allowedStatuses.has(
        booking.status
      )
    ){
      return {
        ok:false,
        code:
          'BOOKING_QUOTE_STATE_INVALID',
        booking
      }
    }

    const messageId=id('msg')
    const createdAt=now()

    const text=
      '??????? ??????? ???????: '+
      proposedPrice.toFixed(2)+
      '?'+
      (
        extra
          ? ' ? '+extra
          : ''
      )

    const outcome=
      await tx(async client=>{

        const changed=
          await client.query(
            `
              UPDATE bookings

              SET
                status='quoted',
                proposed_price=$1,
                agreed_price=NULL,
                updated_at=now()

              WHERE
                status=$2
                AND id=$3

              RETURNING id
            `,
            [
              proposedPrice,
              booking.status,
              booking.id
            ]
          )

        if(changed.rowCount!==1){
          return {
            ok:false
          }
        }

        await client.query(
          `
            INSERT INTO booking_messages(
              id,
              booking_id,
              sender_user_id,
              sender_role,
              sender_name,
              body_encrypted,
              kind,
              recipient_user_id,
              delivered_at
            )
            VALUES(
              $1,$2,$3,$4,$5,$6,
              'quote',$7,now()
            )
          `,
          [
            messageId,
            booking.id,
            sender.id,
            sender.role,
            sender.name,
            encryptSensitive(text),
            recipientUserId
          ]
        )

        await Notifications.create(
          recipientUserId,
          'quote',
          '??? ??????? ???????',
          proposedPrice.toFixed(2)+
            '? ? '+
            (
              extra ||
              booking.service
            ),
          {
            priority:'normal',
            actionType:'booking',
            actionId:booking.id,
            actionUrl:'/patient'
          },
          client
        )

        return {
          ok:true,
          proposedPrice,
          createdAt
        }
      })

    const current=
      await this.byId(
        booking.id
      )

    if(!outcome.ok){

      if(!current){
        return {
          ok:false,
          code:'BOOKING_NOT_FOUND',
          booking:null
        }
      }

      return {
        ok:false,
        code:'BOOKING_STATE_CONFLICT',
        booking:current
      }
    }

    if(!current){
      throw new Error(
        'Booking missing after quote transaction'
      )
    }

    return {
      ok:true,
      booking:current
    }
  },

  /*
   * Atomically accepts or declines an active quote.
   *
   * Accept:
   *   quoted -> accepted
   *   agreed_price := proposed_price
   *
   * Decline:
   *   quoted -> pending
   *   proposed/agreed prices are cleared so no stale offer
   *   remains authoritative.
   */
  async decideQuoteWithMessage(
    booking,
    sender,
    decision,
    professionalUserId
  ){
    if(
      !booking?.id ||
      !sender?.id ||
      !professionalUserId
    ){
      throw new Error(
        'Invalid quote decision transaction input'
      )
    }

    if(booking.status!=='quoted'){
      return {
        ok:false,
        code:
          'BOOKING_QUOTE_NOT_ACTIVE',
        booking
      }
    }

    if(
      decision!=='accept' &&
      decision!=='decline'
    ){
      return {
        ok:false,
        code:
          'BOOKING_QUOTE_DECISION_INVALID',
        booking
      }
    }

    const proposedPrice=
      Number(
        booking.proposedPrice
      )

    if(
      !Number.isFinite(proposedPrice) ||
      proposedPrice<=0
    ){
      return {
        ok:false,
        code:
          'BOOKING_QUOTE_PRICE_INVALID',
        booking
      }
    }

    const accepted=
      decision==='accept'

    const nextStatus=
      accepted
        ? 'accepted'
        : 'pending'

    const agreedPrice=
      accepted
        ? Number(
            proposedPrice.toFixed(2)
          )
        : null

    const messageId=id('msg')

    const text=
      accepted
        ? (
            '??????? ??????? ??????? '+
            agreedPrice.toFixed(2)+
            '? ??? ??????????? ?????????.'
          )
        : (
            '??? ????? ???????? ? ??????? ???????. '+
            '?????????? ??? ??????????.'
          )

    const outcome=
      await tx(async client=>{

        const changed=
          await client.query(
            `
              UPDATE bookings

              SET
                status=$1,
                proposed_price=
                  CASE
                    WHEN $1='accepted'
                      THEN proposed_price
                    ELSE NULL
                  END,
                agreed_price=$2,
                updated_at=now()

              WHERE
                status='quoted'
                AND id=$3

              RETURNING id
            `,
            [
              nextStatus,
              agreedPrice,
              booking.id
            ]
          )

        if(changed.rowCount!==1){
          return {
            ok:false
          }
        }

        await client.query(
          `
            INSERT INTO booking_messages(
              id,
              booking_id,
              sender_user_id,
              sender_role,
              sender_name,
              body_encrypted,
              kind,
              recipient_user_id,
              delivered_at
            )
            VALUES(
              $1,$2,$3,$4,$5,$6,
              'quote',$7,now()
            )
          `,
          [
            messageId,
            booking.id,
            sender.id,
            sender.role,
            sender.name,
            encryptSensitive(text),
            professionalUserId
          ]
        )

        await Notifications.create(
          professionalUserId,
          accepted
            ? 'accepted'
            : 'quote',
          accepted
            ? '? ??????? ??????? ????? ????????'
            : '? ??????? ??????? ??? ????? ????????',
          accepted
            ? (
                sender.name+
                ' ? '+
                agreedPrice.toFixed(2)+
                '?'
              )
            : booking.service,
          {
            priority:
              accepted
                ? 'high'
                : 'normal',
            actionType:'booking',
            actionId:booking.id,
            actionUrl:'/dashboard'
          },
          client
        )

        return {
          ok:true
        }
      })

    const current=
      await this.byId(
        booking.id
      )

    if(!outcome.ok){

      if(!current){
        return {
          ok:false,
          code:'BOOKING_NOT_FOUND',
          booking:null
        }
      }

      return {
        ok:false,
        code:'BOOKING_STATE_CONFLICT',
        booking:current
      }
    }

    if(!current){
      throw new Error(
        'Booking missing after quote decision transaction'
      )
    }

    return {
      ok:true,
      booking:current
    }
  },

  /*
   * D10D.4
   *
   * Atomically moves a booking into clarification and persists
   * the clarification message + live event in the same database
   * transaction.
   *
   * If any database write fails, PostgreSQL rolls the entire
   * operation back. A concurrent booking-state change is handled
   * with compare-and-set semantics.
   */
  async clarifyWithMessage(
    booking,
    sender,
    text
  ){
    if(
      !booking?.id ||
      !booking?.status ||
      !sender?.id ||
      !text
    ){
      throw new Error(
        'Invalid clarification transaction input'
      )
    }

    const messageId=id('msg')
    const createdAt=now()
    const recipientUserId=
      booking.patientId

    if(!recipientUserId){
      throw new Error(
        'Clarification recipient not found'
      )
    }

    const senderRole=
      sender.id===booking.patientId
        ? 'patient'
        : sender.role

    const outcome=
      await tx(async client=>{

        /*
         * Compare-and-set first.
         *
         * The remaining writes are performed only if this request
         * successfully owns the lifecycle transition.
         */
        const changed=
          await client.query(
            `
              UPDATE bookings

              SET
                status='clarification',
                updated_at=now()

              WHERE
                status=$1
                AND id=$2

              RETURNING id
            `,
            [
              booking.status,
              booking.id
            ]
          )

        if(changed.rowCount!==1){
          return {
            ok:false
          }
        }

        await client.query(
          `
            INSERT INTO booking_messages(
              id,
              booking_id,
              sender_user_id,
              sender_role,
              sender_name,
              body_encrypted,
              kind,
              recipient_user_id,
              delivered_at
            )
            VALUES(
              $1,$2,$3,$4,$5,$6,
              'clarification',$7,now()
            )
          `,
          [
            messageId,
            booking.id,
            sender.id,
            senderRole,
            sender.name,
            encryptSensitive(text),
            recipientUserId
          ]
        )

        const event=
          await client.query(
            `
              INSERT INTO live_events(
                user_id,
                payload
              )
              VALUES($1,$2)
              RETURNING id
            `,
            [
              recipientUserId,
              {
                kind:'message.created',

                message:{
                  id:messageId,
                  bookingId:booking.id,
                  senderUserId:sender.id,
                  senderRole,
                  senderName:sender.name,
                  recipientUserId,
                  kind:'clarification',
                  text,
                  delivered:true,
                  deliveredAt:createdAt,
                  read:false,
                  readAt:null,
                  createdAt
                }
              }
            ]
          )

        const eventId=
          event.rows?.[0]?.id

        /*
         * PostgreSQL delivers NOTIFY only after the surrounding
         * transaction commits successfully.
         */
        if(eventId){
          await client.query(
            `
              SELECT pg_notify(
                'meleo_live',
                $1
              )
            `,
            [
              JSON.stringify({
                userId:recipientUserId,
                eventId
              })
            ]
          )
        }

        await Notifications.create(
          recipientUserId,
          'message',
          '\u039f \u03b5\u03c0\u03b1\u03b3\u03b3\u03b5\u03bb\u03bc\u03b1\u03c4\u03af\u03b1\u03c2 \u03b6\u03b7\u03c4\u03ac \u03b4\u03b9\u03b5\u03c5\u03ba\u03c1\u03b9\u03bd\u03af\u03c3\u03b5\u03b9\u03c2',
          text.slice(0,180),
          {
            priority:'normal',
            actionType:'booking',
            actionId:booking.id,
            actionUrl:'/dashboard'
          },
          client
        )

        return {
          ok:true
        }
      })

    const current=
      await this.byId(
        booking.id
      )

    if(!outcome.ok){

      if(!current){
        return {
          ok:false,
          code:'BOOKING_NOT_FOUND',
          booking:null
        }
      }

      return {
        ok:false,
        code:'BOOKING_STATE_CONFLICT',
        booking:current
      }
    }

    if(!current){
      throw new Error(
        'Booking missing after clarification transaction'
      )
    }

    return {
      ok:true,
      booking:current
    }
  },

  /*
   * Atomic booking lifecycle compare-and-set.
   *
   * The write succeeds only while the database row still has
   * the status that was validated by the caller.
   *
   * This prevents two concurrent requests from both committing
   * transitions based on the same stale booking state.
   */
  /*
   * Atomic booking lifecycle compare-and-set.
   *
   * D10D.6
   *
   * Booking state and durable notification/live-event writes
   * commit in the same PostgreSQL transaction.
   */
  async transition(
    id,
    expectedStatus,
    patch,
    notification=null
  ){
    const map={
      status:'status',
      proposedPrice:'proposed_price',
      agreedPrice:'agreed_price'
    }

    if(
      !patch ||
      !Object.prototype.hasOwnProperty.call(
        patch,
        'status'
      )
    ){
      throw new Error(
        'Booking transition requires target status'
      )
    }

    const sets=[]
    const vals=[]
    let i=1

    for(const [k,v] of Object.entries(patch)){
      if(!map[k])continue

      const placeholder='$'+i++

      sets.push(
        map[k]+'='+placeholder
      )

      vals.push(v)
    }

    if(!sets.length){
      throw new Error(
        'Booking transition has no writable fields'
      )
    }

    const expectedPlaceholder='$'+i++
    vals.push(expectedStatus)

    const idPlaceholder='$'+i++
    vals.push(id)

    const outcome=
      await tx(async client=>{

        const result=
          await client.query(
            `
              UPDATE bookings
              SET
                ${sets.join(',')},
                updated_at=now()
              WHERE status=${expectedPlaceholder}
                AND id=${idPlaceholder}
            `,
            vals
          )

        if(result.rowCount===1){

          if(notification){
            await Notifications.create(
              notification.userId,
              notification.type || 'booking',
              notification.title || 'Booking update',
              notification.body || '',
              notification.options || {},
              client
            )
          }

          return {
            ok:true
          }
        }

        return {
          ok:false
        }
      })

    const current=
      await this.byId(id)

    if(!outcome.ok){

      if(!current){
        return {
          ok:false,
          code:'BOOKING_NOT_FOUND',
          booking:null
        }
      }

      return {
        ok:false,
        code:'BOOKING_STATE_CONFLICT',
        booking:current
      }
    }

    if(!current){
      throw new Error(
        'Booking missing after transition transaction'
      )
    }

    return {
      ok:true,
      booking:current
    }
  }
}

export const Analytics={
  async event(professionalId,type,fingerprint,ttlMinutes=60){return tx(async client=>{const ins=await client.query(`INSERT INTO analytics_event_dedup(fingerprint,professional_id,event_type,expires_at) VALUES($1,$2,$3,now()+($4||' minutes')::interval) ON CONFLICT DO NOTHING RETURNING fingerprint`,[fingerprint,professionalId,type,String(ttlMinutes)]);if(!ins.rowCount)return false;const col={impression:'impressions',profile_view:'profile_views',phone_click:'phone_clicks'}[type];if(!col)return false;await client.query(`INSERT INTO professional_analytics_daily(professional_id,day,${col}) VALUES($1,current_date,1) ON CONFLICT(professional_id,day) DO UPDATE SET ${col}=professional_analytics_daily.${col}+1`,[professionalId]);return true})},
  async summary(professionalId,days=30){const row=await one(`SELECT coalesce(sum(impressions),0)::int impressions,coalesce(sum(profile_views),0)::int "profileViews",coalesce(sum(phone_clicks),0)::int "phoneClicks" FROM professional_analytics_daily WHERE professional_id=$1 AND day>=current_date-$2::int`,[professionalId,days]);const reqs=await one(`SELECT count(*)::int requests,count(*) FILTER(WHERE status='completed')::int clients FROM bookings WHERE professional_id=$1 AND created_at>=now()-($2||' days')::interval`,[professionalId,String(days)]);const rev=await one(`SELECT count(*)::int reviews FROM reviews WHERE professional_id=$1 AND created_at>=now()-($2||' days')::interval`,[professionalId,String(days)]);return {...row,requests:reqs.requests,newClients:reqs.clients,newReviews:rev.reviews}}
}

export const Admin={
  async stats(){
    const accounts=await one(`SELECT count(*)::int total,
      count(*) FILTER(WHERE role='patient')::int patients,
      count(*) FILTER(WHERE role='professional')::int professionals,
      count(*) FILTER(WHERE role='admin')::int admins,
      count(*) FILTER(WHERE created_at>=now()-interval '7 days')::int new7,
      count(*) FILTER(WHERE created_at>=now()-interval '30 days')::int new30,
      count(*) FILTER(WHERE email_verified=false AND role<>'admin')::int "unverifiedEmail",
      count(*) FILTER(WHERE deletion_pending=true)::int "deletionPending",
      count(*) FILTER(WHERE account_status='suspended')::int "suspendedUsers",
      count(*) FILTER(WHERE coalesce(last_login_at,created_at)>=now()-interval '30 days')::int active30
      FROM users WHERE deleted_at IS NULL`)
    const professionals=await one(`SELECT count(*)::int total,
      count(*) FILTER(WHERE verified)::int verified,
      count(*) FILTER(WHERE verified AND admin_suspended=false AND subscription_status='active')::int "publiclyVisible",
      count(*) FILTER(WHERE subscription_plan='basic' AND subscription_status='active')::int basic,
      count(*) FILTER(WHERE subscription_plan='premium' AND subscription_status='active')::int premium,
      count(*) FILTER(WHERE featured)::int featured,
      count(*) FILTER(WHERE subscription_status='past_due')::int "pastDue",
      count(*) FILTER(WHERE subscription_status='cancelled')::int churned
      FROM professionals`)
    const pending=await one(`SELECT count(*)::int n FROM verification_requests WHERE status='pending'`);professionals.pendingVerification=pending.n
    const bookings=await one(`SELECT count(*)::int total,
      count(*) FILTER(WHERE status='pending')::int pending,
      count(*) FILTER(WHERE status='clarification')::int clarification,
      count(*) FILTER(WHERE status='quoted')::int quoted,
      count(*) FILTER(WHERE status='accepted')::int accepted,
      count(*) FILTER(WHERE status='completed')::int completed,
      count(*) FILTER(WHERE status='cancelled')::int cancelled,
      coalesce(sum(coalesce(agreed_price,base_price)) FILTER(WHERE status='completed'),0)::numeric "completedGmv",
      coalesce(avg(coalesce(agreed_price,base_price)) FILTER(WHERE status='completed'),0)::numeric "avgValue"
      FROM bookings`)
    for(const k of ['completedGmv','avgValue'])bookings[k]=Number(bookings[k]||0)
    const sub=await one(`SELECT coalesce(sum(price) FILTER(WHERE status='active'),0)::numeric mrr,
      coalesce(sum(price) FILTER(WHERE status='past_due'),0)::numeric outstanding FROM subscriptions`)
    const pay=await one(`SELECT coalesce(sum(amount) FILTER(WHERE status='paid' AND created_at>=date_trunc('month',now())),0)::numeric collected,
      coalesce(sum(amount) FILTER(WHERE status='failed' AND created_at>=date_trunc('month',now())),0)::numeric failed,
      count(*) FILTER(WHERE status='failed' AND created_at>=date_trunc('month',now()))::int "failedPayments" FROM payments`)
    const mk=await one(`SELECT
      (SELECT count(DISTINCT patient_id) FROM bookings)::int "uniquePatientsWithBooking",
      (SELECT count(*) FROM (SELECT patient_id FROM bookings GROUP BY patient_id HAVING count(*)>1)x)::int "repeatPatients",
      (SELECT count(*) FROM reviews)::int "totalReviews",
      (SELECT coalesce(avg(rating),0) FROM reviews)::numeric "avgRating"`)
    const conv=(n,d)=>d?Number((100*n/d).toFixed(1)):0
    const revenue={subscriptionMrr:Number(sub.mrr||0),subscriptionArr:Number(sub.mrr||0)*12,collectedRevenue:Number(pay.collected||0),failedRevenue:Number(pay.failed||0),failedPayments:pay.failedPayments,outstanding:Number(sub.outstanding||0),platformMonthlyRevenue:Number(pay.collected||0),marketplaceGmv:bookings.completedGmv}
    const marketplace={active30:accounts.active30,suspendedUsers:accounts.suspendedUsers,uniquePatientsWithBooking:mk.uniquePatientsWithBooking,repeatPatients:mk.repeatPatients,totalReviews:mk.totalReviews,avgRating:Number(mk.avgRating||0),verificationRate:conv(professionals.verified,professionals.total),bookingCompletionRate:conv(bookings.completed,Math.max(0,bookings.total-bookings.cancelled)),requestToAcceptedRate:conv(bookings.accepted+bookings.completed,bookings.total),reviewCoverage:conv(mk.totalReviews,bookings.completed),patientActivationRate:conv(mk.uniquePatientsWithBooking,accounts.patients),premiumShare:conv(professionals.premium,professionals.basic+professionals.premium)}
    const specialties=await many(`SELECT coalesce(nullif(specialty,''),'Χωρίς ειδικότητα') name,count(*)::int count FROM professionals GROUP BY 1 ORDER BY count DESC`)
    const cities=await many(`SELECT coalesce(nullif(city,''),'Μη ορισμένη') name,count(*)::int count FROM professionals GROUP BY 1 ORDER BY count DESC`)
    const registrations14=await many(`SELECT d::date::text date,count(u.id)::int count FROM generate_series(current_date-13,current_date,interval '1 day') d LEFT JOIN users u ON u.created_at::date=d::date AND u.deleted_at IS NULL GROUP BY d ORDER BY d`)
    const bookings14=await many(`SELECT d::date::text date,count(b.id)::int count FROM generate_series(current_date-13,current_date,interval '1 day') d LEFT JOIN bookings b ON b.created_at::date=d::date GROUP BY d ORDER BY d`)
    delete accounts.active30; delete accounts.suspendedUsers
    return {
  accounts,
  professionals,
  bookings,
  revenue,
  marketplace,
  specialties,
  cities,
  registrations14,
  bookings14
}
  },

  async commandCenter(){

    const base=await this.stats()

    const [
      booking30,
      repeat30,
      trustCoverage,
      operations,
      growth,
      bookingsTrend30,
      registrationsTrend30,
      revenueTrend30,
      specialtyHealth,
      cityHealth
    ]=await Promise.all([

      one(`
        SELECT
          count(*)::int total,

          count(*) FILTER(
            WHERE status='pending'
          )::int pending,

          count(*) FILTER(
            WHERE status='clarification'
          )::int clarification,

          count(*) FILTER(
            WHERE status='quoted'
          )::int quoted,

          count(*) FILTER(
            WHERE status='accepted'
          )::int accepted,

          count(*) FILTER(
            WHERE status='completed'
          )::int completed,

          count(*) FILTER(
            WHERE status='cancelled'
          )::int cancelled,

          count(DISTINCT patient_id)::int
            "uniquePatients",

          count(DISTINCT professional_id)::int
            "engagedProfessionals",

          coalesce(
            sum(
              coalesce(agreed_price,base_price)
            ) FILTER(
              WHERE status='completed'
            ),
            0
          )::numeric "gmv"

        FROM bookings

        WHERE
          created_at>=now()-interval '30 days'
      `),


      one(`
        SELECT
          count(*)::int "uniquePatients",

          count(*) FILTER(
            WHERE booking_count>1
          )::int "repeatPatients"

        FROM (
          SELECT
            patient_id,
            count(*)::int booking_count

          FROM bookings

          WHERE
            created_at>=now()-interval '30 days'

          GROUP BY patient_id
        ) x
      `),


      one(`
        WITH professional_activity AS (

          SELECT
            p.id,
            p.verified,
            p.admin_suspended,
            p.subscription_status,

            count(
              DISTINCT b.id
            ) FILTER(
              WHERE b.status='completed'
            )::int completed,

            count(
              DISTINCT r.id
            )::int reviews

          FROM professionals p

          LEFT JOIN bookings b
            ON b.professional_id=p.id

          LEFT JOIN reviews r
            ON r.professional_id=p.id

          GROUP BY
            p.id,
            p.verified,
            p.admin_suspended,
            p.subscription_status
        )

        SELECT

          count(*) FILTER(
            WHERE
              verified=true
              AND admin_suspended=false
              AND subscription_status='active'
          )::int visible,

          count(*) FILTER(
            WHERE
              verified=true
              AND admin_suspended=false
              AND subscription_status='active'
              AND completed>=5
              AND reviews>=3
          )::int "trustEligible"

        FROM professional_activity
      `),


      one(`
        SELECT

          (
            SELECT count(*)
            FROM verification_requests
            WHERE status='pending'
          )::int "pendingVerifications",

          (
            SELECT count(*)
            FROM subscriptions
            WHERE status='past_due'
          )::int "pastDueSubscriptions",

          (
            SELECT count(*)
            FROM payments
            WHERE
              status='failed'
              AND created_at>=date_trunc('month',now())
          )::int "failedPayments",

          (
            SELECT count(*)
            FROM users
            WHERE
              deleted_at IS NULL
              AND account_status='suspended'
          )::int "suspendedAccounts",

          (
            SELECT count(*)
            FROM users
            WHERE
              deleted_at IS NULL
              AND deletion_pending=true
          )::int "deletionPending",

          (
            SELECT count(*)
            FROM reports
            WHERE
              coalesce(status,'open')<>'closed'
          )::int "openReports"
      `),


      one(`
        SELECT

          count(*) FILTER(
            WHERE
              created_at>=now()-interval '30 days'
          )::int "usersCurrent30",

          count(*) FILTER(
            WHERE
              created_at>=now()-interval '60 days'
              AND created_at<now()-interval '30 days'
          )::int "usersPrevious30",

          (
            SELECT count(*)
            FROM bookings
            WHERE
              created_at>=now()-interval '30 days'
          )::int "bookingsCurrent30",

          (
            SELECT count(*)
            FROM bookings
            WHERE
              created_at>=now()-interval '60 days'
              AND created_at<now()-interval '30 days'
          )::int "bookingsPrevious30"

        FROM users

        WHERE deleted_at IS NULL
      `),


      many(`
        SELECT
          d::date::text date,
          count(b.id)::int count

        FROM generate_series(
          current_date-29,
          current_date,
          interval '1 day'
        ) d

        LEFT JOIN bookings b
          ON b.created_at::date=d::date

        GROUP BY d

        ORDER BY d
      `),


      many(`
        SELECT
          d::date::text date,
          count(u.id)::int count

        FROM generate_series(
          current_date-29,
          current_date,
          interval '1 day'
        ) d

        LEFT JOIN users u
          ON u.created_at::date=d::date
          AND u.deleted_at IS NULL

        GROUP BY d

        ORDER BY d
      `),


      many(`
        SELECT
          d::date::text date,

          coalesce(
            sum(p.amount) FILTER(
              WHERE p.status='paid'
            ),
            0
          )::numeric amount

        FROM generate_series(
          current_date-29,
          current_date,
          interval '1 day'
        ) d

        LEFT JOIN payments p
          ON p.created_at::date=d::date

        GROUP BY d

        ORDER BY d
      `),


      many(`
        SELECT
          coalesce(
            nullif(p.specialty,''),
            'Χωρίς ειδικότητα'
          ) name,

          count(
            DISTINCT p.id
          )::int "activeProfessionals",

          count(b.id) FILTER(
            WHERE
              b.created_at>=now()-interval '30 days'
          )::int "bookings30",

          count(b.id) FILTER(
            WHERE
              b.created_at>=now()-interval '30 days'
              AND b.status='completed'
          )::int "completed30"

        FROM professionals p

        LEFT JOIN bookings b
          ON b.professional_id=p.id

        WHERE
          p.verified=true
          AND p.admin_suspended=false
          AND p.subscription_status='active'

        GROUP BY 1

        ORDER BY
          "bookings30" DESC,
          "activeProfessionals" DESC

        LIMIT 10
      `),


      many(`
        SELECT
          coalesce(
            nullif(p.city,''),
            'Μη ορισμένη'
          ) name,

          count(
            DISTINCT p.id
          )::int "activeProfessionals",

          count(b.id) FILTER(
            WHERE
              b.created_at>=now()-interval '30 days'
          )::int "bookings30",

          count(b.id) FILTER(
            WHERE
              b.created_at>=now()-interval '30 days'
              AND b.status='completed'
          )::int "completed30"

        FROM professionals p

        LEFT JOIN bookings b
          ON b.professional_id=p.id

        WHERE
          p.verified=true
          AND p.admin_suspended=false
          AND p.subscription_status='active'

        GROUP BY 1

        ORDER BY
          "bookings30" DESC,
          "activeProfessionals" DESC

        LIMIT 10
      `)

    ])


    const percent=(n,d)=>
      d
        ? Number(
            (
              (Number(n||0)/Number(d))*100
            ).toFixed(1)
          )
        : 0


    const growthPercent=(current,previous)=>{

      current=Number(current||0)
      previous=Number(previous||0)

      if(previous===0){
        return current>0
          ? 100
          : 0
      }

      return Number(
        (
          ((current-previous)/previous)*100
        ).toFixed(1)
      )
    }


    const activeSubscriptions=
      Number(base.professionals?.basic||0)+
      Number(base.professionals?.premium||0)


    const resolvedBookings=
      Number(booking30.completed||0)+
      Number(booking30.cancelled||0)


    const marketplaceHealth={

      bookingCompletionRate:
        percent(
          booking30.completed,
          resolvedBookings
        ),

      requestFulfillmentRate:
        percent(
          Number(booking30.accepted||0)+
          Number(booking30.completed||0),
          booking30.total
        ),

      repeatCareRate:
        percent(
          repeat30.repeatPatients,
          repeat30.uniquePatients
        ),

      trustCoverage:
        percent(
          trustCoverage.trustEligible,
          trustCoverage.visible
        ),

      premiumShare:
        percent(
          base.professionals?.premium,
          activeSubscriptions
        ),

      patientActivationRate:
        Number(
          base.marketplace?.patientActivationRate||0
        ),

      reviewCoverage:
        Number(
          base.marketplace?.reviewCoverage||0
        ),

      engagedProfessionals30:
        Number(
          booking30.engagedProfessionals||0
        ),

      uniquePatients30:
        Number(
          booking30.uniquePatients||0
        )
    }


    const growthMetrics={

      users30:
        Number(
          growth.usersCurrent30||0
        ),

      usersGrowth:
        growthPercent(
          growth.usersCurrent30,
          growth.usersPrevious30
        ),

      bookings30:
        Number(
          growth.bookingsCurrent30||0
        ),

      bookingsGrowth:
        growthPercent(
          growth.bookingsCurrent30,
          growth.bookingsPrevious30
        )
    }


    const alerts=[]

    if(Number(operations.pendingVerifications||0)>0){
      alerts.push({
        key:'verification',
        severity:'warning',
        count:Number(
          operations.pendingVerifications
        ),
        title:'Αιτήματα επαλήθευσης',
        text:'Επαγγελματίες περιμένουν έλεγχο.'
      })
    }

    if(Number(operations.pastDueSubscriptions||0)>0){
      alerts.push({
        key:'past_due',
        severity:'warning',
        count:Number(
          operations.pastDueSubscriptions
        ),
        title:'Past-due συνδρομές',
        text:'Απαιτείται έλεγχος κατάστασης χρέωσης.'
      })
    }

    if(Number(operations.failedPayments||0)>0){
      alerts.push({
        key:'payments',
        severity:'critical',
        count:Number(
          operations.failedPayments
        ),
        title:'Αποτυχημένες πληρωμές',
        text:'Αποτυχίες πληρωμών μέσα στον τρέχοντα μήνα.'
      })
    }

    if(Number(operations.suspendedAccounts||0)>0){
      alerts.push({
        key:'suspended',
        severity:'critical',
        count:Number(
          operations.suspendedAccounts
        ),
        title:'Suspended accounts',
        text:'Λογαριασμοί βρίσκονται σε αναστολή.'
      })
    }

    if(Number(operations.openReports||0)>0){
      alerts.push({
        key:'reports',
        severity:'critical',
        count:Number(
          operations.openReports
        ),
        title:'Ανοιχτές αναφορές',
        text:'Υπάρχουν reports που χρειάζονται διαχειριστικό έλεγχο.'
      })
    }

    if(Number(operations.deletionPending||0)>0){
      alerts.push({
        key:'deletions',
        severity:'info',
        count:Number(
          operations.deletionPending
        ),
        title:'Αιτήματα διαγραφής',
        text:'Λογαριασμοί περιμένουν ολοκλήρωση διαδικασίας διαγραφής.'
      })
    }


    const revenueTrend=
      revenueTrend30.map(x=>({
        date:x.date,
        amount:Number(x.amount||0)
      }))


    return {

      generatedAt:
        new Date().toISOString(),

      executive:{
        mrr:
          Number(
            base.revenue?.subscriptionMrr||0
          ),

        arr:
          Number(
            base.revenue?.subscriptionArr||0
          ),

        activeSubscriptions,

        activeProfessionals:
          Number(
            base.professionals?.publiclyVisible||0
          ),

        patients:
          Number(
            base.accounts?.patients||0
          ),

        bookings30:
          Number(
            booking30.total||0
          ),

        gmv30:
          Number(
            booking30.gmv||0
          ),

        collectedThisMonth:
          Number(
            base.revenue?.collectedRevenue||0
          )
      },

      subscriptionHealth:{
        basic:
          Number(
            base.professionals?.basic||0
          ),

        premium:
          Number(
            base.professionals?.premium||0
          ),

        active:
          activeSubscriptions,

        pastDue:
          Number(
            base.professionals?.pastDue||0
          ),

        cancelled:
          Number(
            base.professionals?.churned||0
          ),

        premiumShare:
          marketplaceHealth.premiumShare
      },

      marketplaceHealth,

      growth:growthMetrics,

      operations:{
        pendingVerifications:
          Number(
            operations.pendingVerifications||0
          ),

        pastDueSubscriptions:
          Number(
            operations.pastDueSubscriptions||0
          ),

        failedPayments:
          Number(
            operations.failedPayments||0
          ),

        suspendedAccounts:
          Number(
            operations.suspendedAccounts||0
          ),

        deletionPending:
          Number(
            operations.deletionPending||0
          ),

        openReports:
          Number(
            operations.openReports||0
          )
      },

      alerts,

      trends:{
        bookings30:
          bookingsTrend30,

        registrations30:
          registrationsTrend30,

        revenue30:
          revenueTrend
      },

      marketplace:{
        specialties:
          specialtyHealth,

        cities:
          cityHealth
      },

      base
    }
  }
}


export async function audit(actorId,action,meta={},client=null){const run=client?.query?client.query.bind(client):sql;await run(`INSERT INTO audit_logs(id,actor_id,action,meta) VALUES($1,$2,$3,$4)`,[id('log'),actorId||null,action,meta])}
