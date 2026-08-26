/**
 * MELEO v6.3.0
 * Public Web / SEO / SSR routes.
 *
 * Infrastructure-sensitive endpoints intentionally excluded:
 * - POST /api/webhooks/stripe
 * - GET  /api/live
 */
export function registerPublicWebRoutes(
  app,
  dependencies = {}
) {
  const {
    config,
    many,
    one,
    Professionals,
    slugify
  } = dependencies

  app.get('/robots.txt',(_req,res)=>
    res
      .type('text/plain')
      .send(
        `User-agent: *\nAllow: /\nSitemap: ${config.appUrl}/sitemap.xml\n`
      )
  )

  app.get('/sitemap.xml',async(_req,res)=>{
    const pros=await many(
      `SELECT p.id
       FROM professionals p
       JOIN users u ON u.id=p.user_id
       WHERE p.verified=true
         AND p.admin_suspended=false
         AND p.subscription_status='active'
         AND u.deleted_at IS NULL`
    )

    const combos=await many(
      `SELECT DISTINCT specialty,city
       FROM professionals
       WHERE verified=true
         AND admin_suspended=false
         AND subscription_status='active'
         AND specialty<>''
         AND city<>''
       LIMIT 1000`
    )

    const urls=[
      `${config.appUrl}/`,
      `${config.appUrl}/search`,
      ...pros.map(
        p=>`${config.appUrl}/professionals/${p.id}`
      ),
      ...combos.map(
        x=>`${config.appUrl}/care/${encodeURIComponent(slugify(x.specialty))}/${encodeURIComponent(slugify(x.city))}`
      )
    ]

    res
      .type('application/xml')
      .send(
        `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u=>`<url><loc>${htmlEscape(u)}</loc></url>`).join('')}</urlset>`
      )
  })

  app.get('/professionals/:id',async(req,res,next)=>{
     const p=await Professionals.byId(req.params.id);if(!p||!p.verified||p.adminSuspended||!allowsVisibility(p))return next()
     const title=`${p.name} Β· ${p.specialty} | MELEO`
     const description=`${p.title||p.specialty} ΟƒΟ„Ξ·Ξ½ Ο€ΞµΟΞΉΞΏΟ‡Ξ® ${p.city||p.region||'ΟƒΞΏΟ…'}. ${p.verified?'MELEO Verified. ':''}${p.pricingMode==='from'?`Ξ‘Ο€Ο ${p.price}β‚¬ Ξ²Ξ±ΟƒΞΉΞΊΞ® ΞµΟ€Ξ―ΟƒΞΊΞµΟΞ·.`:'ΞΟΟƒΟ„ΞΏΟ‚ ΞΊΞ±Ο„ΟΟ€ΞΉΞ½ ΞµΟ€ΞΉΞΊΞΏΞΉΞ½Ο‰Ξ½Ξ―Ξ±Ο‚.'}`
     const canonical=`${config.appUrl}/professionals/${p.id}`
     const body=`<section><h1>${htmlEscape(p.name)}</h1><p>${htmlEscape(p.specialty)} Β· ${htmlEscape(p.city)}</p><p>${htmlEscape(p.bio||'')}</p></section>`
     const jsonLd={'@context':'https://schema.org','@type':'Person',name:p.name,jobTitle:p.title||p.specialty,address:{'@type':'PostalAddress',addressLocality:p.city,addressRegion:p.region,addressCountry:String(p.countryCode||'GR').toUpperCase()},url:canonical}
     res.type('html').send(injectSeo(baseHtml(),{title,description,canonical,body,jsonLd}))
   })

  app.get('/care/:specialty/:city',async(req,res,next)=>{
     const rows=await many(`SELECT DISTINCT specialty,city FROM professionals WHERE verified=true AND admin_suspended=false AND subscription_status='active' AND specialty<>'' AND city<>'' LIMIT 3000`)
     const match=rows.find(x=>slugify(x.specialty)===req.params.specialty&&slugify(x.city)===req.params.city);if(!match)return next()
     const count=await one(`SELECT count(*)::int n FROM professionals WHERE verified=true AND admin_suspended=false AND subscription_status='active' AND specialty=$1 AND city=$2`,[match.specialty,match.city])
     const title=`${match.specialty} ${match.city} Β· Ξ’ΟΞµΟ‚ ΞµΟ€Ξ±Ξ³Ξ³ΞµΞ»ΞΌΞ±Ο„Ξ―Ξ± | MELEO`
     const description=`Ξ’ΟΞµΟ‚ ΞµΟ€Ξ±Ξ»Ξ·ΞΈΞµΟ…ΞΌΞ­Ξ½ΞΏΟ…Ο‚ ΞµΟ€Ξ±Ξ³Ξ³ΞµΞ»ΞΌΞ±Ο„Ξ―ΞµΟ‚ ${match.specialty} ΟƒΟ„Ξ·Ξ½ Ο€ΞµΟΞΉΞΏΟ‡Ξ® ${match.city}. Ξ£ΟΞ³ΞΊΟΞΉΞ½Ξµ Ο€ΟΞΏΟ†Ξ―Ξ», Ξ΄ΞΉΞ±ΞΈΞµΟƒΞΉΞΌΟΟ„Ξ·Ο„Ξ± ΞΊΞ±ΞΉ ΟƒΟ„ΞµΞ―Ξ»Ξµ Ξ±Ξ―Ο„Ξ·ΞΌΞ± ΞΌΞ­ΟƒΟ‰ MELEO.`
     const canonical=`${config.appUrl}/care/${encodeURIComponent(req.params.specialty)}/${encodeURIComponent(req.params.city)}`
     const body=`<section><h1>${htmlEscape(match.specialty)} ΟƒΟ„Ξ·Ξ½ Ο€ΞµΟΞΉΞΏΟ‡Ξ® ${htmlEscape(match.city)}</h1><p>${count.n} Ξ΄ΞΉΞ±ΞΈΞ­ΟƒΞΉΞΌΞµΟ‚ ΞµΟ€ΞΉΞ»ΞΏΞ³Ξ­Ο‚ ΟƒΟ„Ξ· MELEO.</p></section>`
     res.type('html').send(injectSeo(baseHtml(),{title,description,canonical,body}))
   })

  app.get('/',(_req,res)=>res.json({service:'MELEO API',status:'online',version:APP_VERSION,releaseChannel:RELEASE_CHANNEL,architecture:'PostgreSQL relational + Redis multi-instance + background worker + observability + secure S3 object storage'}))
}
