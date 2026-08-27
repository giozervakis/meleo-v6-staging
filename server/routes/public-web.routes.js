
function htmlEscape(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/**
 * MELEO v6.2.1
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
    slugify,
    allowsVisibility,
    injectSeo,
    baseHtml,
    APP_VERSION,
    RELEASE_CHANNEL
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
    const p=await Professionals.byId(req.params.id)

    if(
      !p ||
      !p.verified ||
      p.adminSuspended ||
      !allowsVisibility(p)
    ){
      return next()
    }

    const title=`${p.name} · ${p.specialty} | MELEO`

    const description=
      `${p.title||p.specialty} στην περιοχή ${p.city||p.region||'του'}. ` +
      `${p.verified?'MELEO Verified. ':''}` +
      `${
        p.pricingMode==='from'
          ? `Από ${p.price}€ βασική επίσκεψη.`
          : 'Κόστος κατόπιν επικοινωνίας.'
      }`

    const canonical=
      `${config.appUrl}/professionals/${p.id}`

    const body=
      `<section>` +
      `<h1>${htmlEscape(p.name)}</h1>` +
      `<p>${htmlEscape(p.specialty)} · ${htmlEscape(p.city||'')}</p>` +
      `<p>${htmlEscape(p.bio||'')}</p>` +
      `</section>`

    const jsonLd={
      '@context':'https://schema.org',
      '@type':'Person',
      name:p.name,
      jobTitle:p.title||p.specialty,
      address:{
        '@type':'PostalAddress',
        addressLocality:p.city,
        addressRegion:p.region,
        addressCountry:String(p.countryCode||'GR').toUpperCase()
      },
      url:canonical
    }

    res
      .type('html')
      .send(
        injectSeo(
          baseHtml(),
          {
            title,
            description,
            canonical,
            body,
            jsonLd
          }
        )
      )
  })

  app.get('/care/:specialty/:city',async(req,res,next)=>{
    const rows=await many(
      `SELECT DISTINCT specialty,city
       FROM professionals
       WHERE verified=true
         AND admin_suspended=false
         AND subscription_status='active'
         AND specialty<>''
         AND city<>''
       LIMIT 3000`
    )

    const match=rows.find(
      x=>
        slugify(x.specialty)===req.params.specialty &&
        slugify(x.city)===req.params.city
    )

    if(!match){
      return next()
    }

    const count=await one(
      `SELECT count(*)::int n
       FROM professionals
       WHERE verified=true
         AND admin_suspended=false
         AND subscription_status='active'
         AND specialty=$1
         AND city=$2`,
      [match.specialty,match.city]
    )

    const title=
      `${match.specialty} ${match.city} · Βρες επαγγελματία | MELEO`

    const description=
      `Βρες επαληθευμένους επαγγελματίες ${match.specialty} ` +
      `στην περιοχή ${match.city}. ` +
      `Σύγκρινε προφίλ, διαθεσιμότητα και στείλε αίτημα μέσω MELEO.`

    const canonical=
      `${config.appUrl}/care/` +
      `${encodeURIComponent(req.params.specialty)}/` +
      `${encodeURIComponent(req.params.city)}`

    const body=
      `<section>` +
      `<h1>${htmlEscape(match.specialty)} στην περιοχή ${htmlEscape(match.city)}</h1>` +
      `<p>${count.n} διαθέσιμες επιλογές στη MELEO.</p>` +
      `</section>`

    res
      .type('html')
      .send(
        injectSeo(
          baseHtml(),
          {
            title,
            description,
            canonical,
            body
          }
        )
      )
  })

  app.get('/api',(_req,res)=>res.json({service:'MELEO API',status:'online',version:APP_VERSION,releaseChannel:RELEASE_CHANNEL,architecture:'PostgreSQL relational + Redis multi-instance + background worker + observability + secure S3 object storage'}))
}
