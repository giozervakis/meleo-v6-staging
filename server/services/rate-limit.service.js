/*
 * MELEO request rate-limiting service.
 *
 * Request-time ownership:
 * - named rate-limit middleware
 * - deterministic E2E read-only bypass outside production
 * - Redis shared counter
 * - PostgreSQL persistent fallback
 * - bucket hashing
 * - HTTP 429 / Retry-After
 *
 * The global /api middleware installation remains app-owned.
 * Expired rate_limits cleanup remains lifecycle-owned.
 */

export function createRateLimitService({
  config,
  sha256,
  redisRateLimit,
  one
}){
  // Persistent Postgres rate limiter. Works across instances.
  function rateLimit({windowMs,max,name,message='Πολλά αιτήματα. Δοκίμασε ξανά σε λίγο.',keyFn}){return async(req,res,next)=>{

  //
  // Deterministic CI / E2E read-load mode.
  //
  // Read-only requests bypass throttling only when E2E_MODE is
  // explicitly enabled outside production.
  //
  // Mutation/auth/security rate limits remain fully active so
  // security E2E tests continue exercising real protections.
  //
  // E2E_MODE itself is forbidden by the production configuration
  // guard, therefore this branch can never be active in production.
  //
  if(
    config.e2eMode &&
    !config.isProd &&
    ['GET','HEAD','OPTIONS'].includes(req.method)
  ){
    return next()
  }

  const rawKey=keyFn?String(keyFn(req)||'anonymous'):String(req.ip||'local');const bucket=`${name}:${sha256(rawKey).slice(0,24)}`;try{let count,ttlMs;if(config.redis.url){try{const r=await redisRateLimit(config.redis.keyPrefix+'rl:'+bucket,windowMs);count=r.count;ttlMs=r.ttlMs}catch(err){console.warn('[MELEO v5.1] Redis limiter fallback:',err.message)}}if(count==null){const row=await one(`INSERT INTO rate_limits(bucket_key,count,reset_at) VALUES($1,1,now()+($2||' milliseconds')::interval) ON CONFLICT(bucket_key) DO UPDATE SET count=CASE WHEN rate_limits.reset_at<=now() THEN 1 ELSE rate_limits.count+1 END,reset_at=CASE WHEN rate_limits.reset_at<=now() THEN now()+($2||' milliseconds')::interval ELSE rate_limits.reset_at END,updated_at=now() RETURNING count,reset_at`,[bucket,String(windowMs)]);count=row.count;ttlMs=Math.max(0,new Date(row.reset_at).getTime()-Date.now())}if(count>max){res.setHeader('Retry-After',Math.max(1,Math.ceil(ttlMs/1000)));return res.status(429).json({error:message})}next()}catch(e){next(e)}}}
  const E2E_MODE = config.e2eMode && !config.isProd

  const limits = {
    global: rateLimit({
      windowMs: 60000,
      max: E2E_MODE ? 5000 : 500,
      name: 'global'
    }),

    login: rateLimit({
      windowMs: 900000,
      max: E2E_MODE ? 500 : 20,
      name: 'login'
    }),

    loginAccount: rateLimit({
      windowMs: 900000,
      max: E2E_MODE ? 250 : 10,
      name: 'login-account',
      keyFn: req =>
        String(req.body?.email || '')
          .trim()
          .toLowerCase()
    }),

    admin: rateLimit({
      windowMs: 60000,
      max: E2E_MODE ? 500 : 90,
      name: 'admin'
    }),

    adminWrite: rateLimit({
      windowMs: 60000,
      max: E2E_MODE ? 250 : 20,
      name: 'admin-write'
    }),

    register: rateLimit({
      windowMs: 3600000,
      max: E2E_MODE ? 250 : 10,
      name: 'register'
    }),

    password: rateLimit({
      windowMs: 3600000,
      max: E2E_MODE ? 250 : 8,
      name: 'password'
    }),

    write: rateLimit({
      windowMs: 60000,
      max: E2E_MODE ? 1000 : 60,
      name: 'write'
    }),

    geo: rateLimit({
      windowMs: 60000,
      max: E2E_MODE ? 500 : 30,
      name: 'geo'
    }),

    checkout: rateLimit({
      windowMs: 600000,
      max: E2E_MODE ? 250 : 15,
      name: 'checkout'
    }),

    profile: rateLimit({
      windowMs: 60000,
      max: E2E_MODE ? 500 : 60,
      name: 'profile'
    }),

    analytics: rateLimit({
      windowMs: 60000,
      max: E2E_MODE ? 500 : 25,
      name: 'analytics'
    })
  }


  return {
    limits
  }
}
