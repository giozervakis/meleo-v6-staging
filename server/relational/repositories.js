import { one, many, sql, tx, id, now, sha256, pagination } from './pool.js'
import { decryptSensitive, encryptSensitive } from '../security.js'

const arr=v=>Array.isArray(v)?v:[]
export function professionalFromRow(r, user=null){
  if(!r)return null
  return {
    id:r.id,userId:r.user_id,name:user?.name||r.user_name,title:r.title,specialty:r.specialty,
    verified:r.verified,featured:r.featured,rating:Number(r.rating||0),reviews:Number(r.reviews_count||0),
    city:r.city,area:r.area,region:r.region,countryCode:r.country_code,latitude:r.latitude,longitude:r.longitude,
    serviceRadiusKm:r.service_radius_km,subscriptionPlan:r.subscription_plan,subscriptionPrice:Number(r.subscription_price||0),
    subscriptionStatus:r.subscription_status,billingMode:r.billing_mode,onboardingCompleted:r.onboarding_completed,
    onboardingStage:r.onboarding_stage,subscriptionSince:r.subscription_since,available:r.available,bio:r.bio,
    languages:arr(r.languages),credentials:arr(r.credentials),responseTime:r.response_time,years:r.years,
    price:Number(r.price||0),pricingMode:r.pricing_mode,services:arr(r.services),availability:arr(r.availability),
    showPhone:r.show_phone,showEmail:r.show_email,preferPlatformContact:r.prefer_platform_contact,
    phone:r.show_phone?(user?.phone||r.user_phone):undefined,email:r.show_email?(user?.email||r.user_email):undefined,
    stripeSubscriptionId:r.stripe_subscription_id,currentPeriodEnd:r.current_period_end,cancelAtPeriodEnd:r.cancel_at_period_end,
    pastDueSince:r.past_due_since,adminSuspended:r.admin_suspended
  }
}

export const Users={
  byEmail: email=>one('SELECT * FROM users WHERE lower(email)=lower($1) AND deleted_at IS NULL',[email]),
  byId: userId=>one('SELECT * FROM users WHERE id=$1 AND deleted_at IS NULL',[userId]),
  async create(u){ await sql(`INSERT INTO users(id,role,name,email,phone,password_hash,email_verified,accepted_terms_at,terms_version,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now())`,[u.id,u.role,u.name,u.email,u.phone||'',u.passwordHash,!!u.emailVerified,u.acceptedTermsAt||null,u.termsVersion||null]); return this.byId(u.id) },
  async update(id, patch){
    const allowed={name:'name',phone:'phone',email_verified:'email_verified',stripe_customer_id:'stripe_customer_id',last_login_at:'last_login_at',last_totp_step:'last_totp_step',account_status:'account_status',suspended_at:'suspended_at',suspension_reason:'suspension_reason',deletion_pending:'deletion_pending',deletion_requested_at:'deletion_requested_at',deleted_at:'deleted_at',password_hash:'password_hash'}
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
  byUser: async userId=>{const r=await one(`SELECT p.*,u.name user_name,u.email user_email,u.phone user_phone FROM professionals p JOIN users u ON u.id=p.user_id WHERE p.user_id=$1`,[userId]);return professionalFromRow(r)},
  byId: async pid=>{const r=await one(`SELECT p.*,u.name user_name,u.email user_email,u.phone user_phone FROM professionals p JOIN users u ON u.id=p.user_id WHERE p.id=$1 AND u.deleted_at IS NULL`,[pid]);return professionalFromRow(r)},
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
    vals.push(limit,offset);const lim=i++,off=i++
    const base=`FROM professionals p JOIN users u ON u.id=p.user_id WHERE ${where.join(' AND ')}`
    const rows=await many(`SELECT p.*,u.name user_name,u.email user_email,u.phone user_phone,${distanceExpr} ${base} ORDER BY p.featured DESC,p.rating DESC${distanceOrder},p.created_at DESC LIMIT $${lim} OFFSET $${off}`,vals)
    const countVals=vals.slice(0,-2);const c=await one(`SELECT count(*)::int total ${base}`,countVals)
    return {items:rows.map(r=>({...professionalFromRow(r),distance:r.distance_km==null?undefined:Number(Number(r.distance_km).toFixed(1))})),page,limit,total:c?.total||0,totalPages:Math.ceil((c?.total||0)/limit)}
  }
}

export const Notifications={
  async create(userId,type,title,body,client=null){const nid=id('ntf');const runner=client||{query:(q,p)=>sql(q,p)};await runner.query(`INSERT INTO notifications(id,user_id,type,title,body) VALUES($1,$2,$3,$4,$5)`,[nid,userId,type,title,body||'']);const ev=await runner.query(`INSERT INTO live_events(user_id,payload) VALUES($1,$2) RETURNING id`,[userId,{kind:'notification',notification:{id:nid,userId,type,title,text:body||'',read:false,createdAt:now()}}]);const eventId=ev.rows?.[0]?.id;await runner.query(`SELECT pg_notify('meleo_live',$1)`,[JSON.stringify({userId,eventId})]);return nid},
  async list(userId,q={}){const {page,limit,offset}=pagination(q,{defaultLimit:30,maxLimit:100});const items=await many(`SELECT id,user_id "userId",type,title,body text,is_read read,created_at "createdAt" FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,[userId,limit,offset]);const c=await one('SELECT count(*)::int total FROM notifications WHERE user_id=$1',[userId]);return {items,page,limit,total:c.total,totalPages:Math.ceil(c.total/limit)}},
  read: (id,userId)=>sql('UPDATE notifications SET is_read=true WHERE id=$1 AND user_id=$2',[id,userId])
}

export const Bookings={
  async byId(bid){const r=await one(`SELECT b.*,pu.name patient_name,pu.email patient_email,pu.phone patient_phone,pru.name professional_name,pru.email professional_email,pru.phone professional_phone,p.specialty,p.subscription_plan,p.city,p.area,p.region FROM bookings b JOIN users pu ON pu.id=b.patient_id JOIN professionals p ON p.id=b.professional_id JOIN users pru ON pru.id=p.user_id WHERE b.id=$1`,[bid]);if(!r)return null;const messages=await many(`SELECT id,sender_role "fromRole",sender_name "fromName",body_encrypted,created_at "createdAt" FROM booking_messages WHERE booking_id=$1 ORDER BY created_at ASC`,[bid]);const review=await one('SELECT id,rating,comment,created_at "createdAt" FROM reviews WHERE booking_id=$1',[bid]);return {id:r.id,patientId:r.patient_id,professionalId:r.professional_id,service:r.service,date:String(r.visit_date).slice(0,10),time:String(r.visit_time).slice(0,5),address:r.address,notes:decryptSensitive(r.notes_encrypted),repeat:r.repeat_rule,status:r.status,price:Number(r.base_price||0),proposedPrice:r.proposed_price==null?null:Number(r.proposed_price),agreedPrice:r.agreed_price==null?null:Number(r.agreed_price),patientName:r.patient_name,patientEmail:r.patient_email,patientPhone:r.patient_phone,professionalName:r.professional_name,professionalEmail:r.professional_email,professionalPhone:r.professional_phone,specialty:r.specialty,subscriptionPlan:r.subscription_plan,city:r.city,area:r.area,region:r.region,recoveryParentId:r.recovery_parent_id||null,messages:messages.map(m=>({...m,text:decryptSensitive(m.body_encrypted)})),reviewed:!!review,review}},
  async listForUser(user,q={}){const {page,limit,offset}=pagination(q,{defaultLimit:20,maxLimit:100});let where,params;if(user.role==='patient'){where='b.patient_id=$1';params=[user.id]}else if(user.role==='professional'){const p=await Professionals.byUser(user.id);where='b.professional_id=$1';params=[p?.id||'__none__']}else{where='true';params=[]}const rows=await many(`SELECT b.id FROM bookings b WHERE ${where} ORDER BY b.created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`,[...params,limit,offset]);const c=await one(`SELECT count(*)::int total FROM bookings b WHERE ${where}`,params);const items=[];for(const r of rows)items.push(await this.byId(r.id));return {items,page,limit,total:c.total,totalPages:Math.ceil(c.total/limit)}},
  async create(data){await sql(`INSERT INTO bookings(id,patient_id,professional_id,service,visit_date,visit_time,address,notes_encrypted,repeat_rule,status,base_price,patient_contact_consent_at,recovery_parent_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,now(),$11)`,[data.id,data.patientId,data.professionalId,data.service,data.date,data.time,data.address||'',encryptSensitive(data.notes||''),data.repeat||'Μία φορά',data.price||0,data.recoveryParentId||null]);return this.byId(data.id)},
  async addMessage(booking,sender,text,kind='message'){const mid=id('msg');await sql(`INSERT INTO booking_messages(id,booking_id,sender_user_id,sender_role,sender_name,body_encrypted,kind) VALUES($1,$2,$3,$4,$5,$6,$7)`,[mid,booking.id,sender.id,sender.role,sender.name,encryptSensitive(text),kind]);return this.byId(booking.id)},
  async update(id,patch){const map={status:'status',proposedPrice:'proposed_price',agreedPrice:'agreed_price'};const sets=[],vals=[];let i=1;for(const [k,v] of Object.entries(patch)){if(!map[k])continue;sets.push(`${map[k]}=$${i++}`);vals.push(v)}if(!sets.length)return this.byId(id);vals.push(id);await sql(`UPDATE bookings SET ${sets.join(',')},updated_at=now() WHERE id=$${i}`,[...vals]);return this.byId(id)}
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
    return {accounts,professionals,bookings,revenue,marketplace,specialties,cities,registrations14,bookings14}
  }
}

export async function audit(actorId,action,meta={}){await sql(`INSERT INTO audit_logs(id,actor_id,action,meta) VALUES($1,$2,$3,$4)`,[id('log'),actorId||null,action,meta])}
