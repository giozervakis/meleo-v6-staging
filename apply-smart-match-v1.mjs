import fs from 'node:fs'

const repoFile = 'server/relational/repositories.js'
const appFile = 'src/App.tsx'
const cssFile = 'src/styles.css'

function mustReplace(file, from, to) {
  const original = fs.readFileSync(file, 'utf8')

  // Normalize Windows CRLF → LF only for matching.
  const src = original.replace(/\r\n/g, '\n')
  const needle = from.replace(/\r\n/g, '\n')
  const replacement = to.replace(/\r\n/g, '\n')

  if (!src.includes(needle)) {
    console.error(`\n❌ Δεν βρέθηκε το αναμενόμενο block στο ${file}`)
    process.exit(1)
  }

  const updated = src.replace(needle, replacement)

  fs.writeFileSync(file, updated, 'utf8')
  console.log(`✓ ${file}`)
}

/* =========================================================
   1. BACKEND — SMART MATCH ENGINE
   ========================================================= */

mustReplace(
  repoFile,

`    vals.push(limit,offset);const lim=i++,off=i++
    const base=\`FROM professionals p JOIN users u ON u.id=p.user_id WHERE \${where.join(' AND ')}\`
    const rows=await many(\`SELECT p.*,u.name user_name,u.email user_email,u.phone user_phone,\${distanceExpr} \${base} ORDER BY p.featured DESC,p.rating DESC\${distanceOrder},p.created_at DESC LIMIT $\${lim} OFFSET $\${off}\`,vals)
    const countVals=vals.slice(0,-2);const c=await one(\`SELECT count(*)::int total \${base}\`,countVals)
    return {items:rows.map(r=>({...professionalFromRow(r),distance:r.distance_km==null?undefined:Number(Number(r.distance_km).toFixed(1))})),page,limit,total:c?.total||0,totalPages:Math.ceil((c?.total||0)/limit)}`,

`    /*
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
      ? \`
        CASE
          WHEN distance_km IS NULL THEN 0
          WHEN distance_km <= 2 THEN 24
          WHEN distance_km <= 5 THEN 21
          WHEN distance_km <= 10 THEN 17
          WHEN distance_km <= 20 THEN 12
          WHEN distance_km <= 35 THEN 7
          ELSE 3
        END
      \`
      : '12'

    const smartScoreExpr = \`
      LEAST(
        100,
        GREATEST(
          0,

          /* Verified identity / professional status */
          10

          /* Rating quality — max 20 */
          + CASE
              WHEN coalesce(reviews_count,0)=0 THEN 10
              ELSE LEAST(20, GREATEST(0, coalesce(rating,0) * 4))
            END

          /* Review confidence — max 10 */
          + CASE
              WHEN coalesce(reviews_count,0) >= 20 THEN 10
              WHEN coalesce(reviews_count,0) >= 10 THEN 8
              WHEN coalesce(reviews_count,0) >= 5 THEN 6
              WHEN coalesce(reviews_count,0) >= 1 THEN 4
              ELSE 3
            END

          /* Distance / geographic relevance — max 24 */
          + \${smartDistanceScore}

          /* Availability — max 10 */
          + CASE
              WHEN lower(coalesce(available,'')) LIKE '%σήμερα%' THEN 10
              WHEN lower(coalesce(available,'')) LIKE '%άμεσα%' THEN 10
              WHEN lower(coalesce(available,'')) LIKE '%διαθέσ%' THEN 7
              ELSE 4
            END

          /* Response behaviour proxy — max 10 */
          + CASE
              WHEN lower(coalesce(response_time,'')) LIKE '%λεπτ%' THEN 10
              WHEN lower(coalesce(response_time,'')) LIKE '%ώρα%' THEN 8
              WHEN lower(coalesce(response_time,'')) LIKE '%ωρ%' THEN 8
              WHEN coalesce(response_time,'') <> '' THEN 6
              ELSE 4
            END

          /* Experience — max 8 */
          + CASE
              WHEN coalesce(years,0) >= 10 THEN 8
              WHEN coalesce(years,0) >= 5 THEN 6
              WHEN coalesce(years,0) >= 2 THEN 4
              WHEN coalesce(years,0) > 0 THEN 2
              ELSE 1
            END

          /*
           * Premium commercial boost — max 8.
           * Deliberately limited so Premium cannot overpower
           * a substantially better Basic professional.
           */
          + CASE
              WHEN subscription_plan='premium'
                   AND subscription_status='active'
              THEN 8
              ELSE 0
            END

          /* Existing featured flag — tiny legacy/tie boost */
          + CASE WHEN featured=true THEN 2 ELSE 0 END
        )
      )
    \`

    const base=\`FROM professionals p JOIN users u ON u.id=p.user_id WHERE \${where.join(' AND ')}\`

    /*
     * Distance is calculated in an inner query because PostgreSQL
     * cannot safely reuse the distance_km SELECT alias inside another
     * expression at the same SELECT level.
     */
    const candidateSql=\`
      SELECT
        p.*,
        u.name user_name,
        u.email user_email,
        u.phone user_phone,
        \${distanceExpr}
      \${base}
    \`

    const countVals=[...vals]

    vals.push(limit,offset)
    const lim=i++,off=i++

    const rows=await many(\`
      SELECT ranked.*,
             ROUND((\${smartScoreExpr})::numeric,1) AS smart_match_score
      FROM (
        \${candidateSql}
      ) ranked
      ORDER BY
        smart_match_score DESC,
        rating DESC,
        reviews_count DESC,
        distance_km ASC NULLS LAST,
        created_at DESC
      LIMIT $\${lim}
      OFFSET $\${off}
    \`,vals)

    const c=await one(
      \`SELECT count(*)::int total \${base}\`,
      countVals
    )

    return {
      items:rows.map((r,index)=>({
        ...professionalFromRow(r),

        distance:
          r.distance_km==null
            ? undefined
            : Number(Number(r.distance_km).toFixed(1)),

        smartMatch:{
          score:Number(r.smart_match_score||0),
          rank:offset+index+1,
          version:'v1'
        }
      })),

      page,
      limit,
      total:c?.total||0,
      totalPages:Math.ceil((c?.total||0)/limit),
      ranking:'smart-match-v1'
    }`
)

/* =========================================================
   2. FRONTEND — DON'T DESTROY SERVER RANKING
   ========================================================= */

mustReplace(
  appFile,

` const [sort,setSort]=useState('recommended'); const sorted=useMemo(()=>[...pros].sort((a,b)=>sort==='price'?a.price-b.price:sort==='rating'?b.rating-a.rating:Number(b.featured)-Number(a.featured)),[pros,sort])`,

` const [sort,setSort]=useState('recommended')
 const sorted=useMemo(()=>{
   const items=[...pros]

   if(sort==='price')
     return items.sort((a,b)=>(a.price||0)-(b.price||0))

   if(sort==='rating')
     return items.sort((a,b)=>(b.rating||0)-(a.rating||0))

   // "recommended" preserves the authoritative server-side
   // MELEO Smart Match ordering.
   return items
 },[pros,sort])`
)

/* =========================================================
   3. FRONTEND — SMART MATCH BADGE
   ========================================================= */

mustReplace(
  appFile,

`return <article className="pro-card"><div className="pro-card-top">`,

`return <article className="pro-card">
    {p.smartMatch?.rank<=3&&
      <div className="smart-match-banner">
        <span>✦ MELEO SMART MATCH</span>
        <strong>#{p.smartMatch.rank}</strong>
        <em>{Math.round(p.smartMatch.score)}% αντιστοίχιση</em>
      </div>
    }
    <div className="pro-card-top">`
)

/* =========================================================
   4. CSS
   ========================================================= */

fs.appendFileSync(
  cssFile,
`

/* =========================================================
   MELEO SMART MATCH v1
   ========================================================= */

.smart-match-banner{
  display:flex;
  align-items:center;
  gap:10px;
  padding:10px 14px;
  margin:-1px -1px 0;
  border-radius:18px 18px 0 0;
  background:
    linear-gradient(
      110deg,
      rgba(19,42,38,.98),
      rgba(31,67,58,.96)
    );
  color:#fff;
  font-size:11px;
  letter-spacing:.04em;
}

.smart-match-banner span{
  font-weight:800;
}

.smart-match-banner strong{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-width:28px;
  height:24px;
  padding:0 7px;
  border-radius:999px;
  background:rgba(255,255,255,.13);
  font-size:12px;
}

.smart-match-banner em{
  margin-left:auto;
  color:#e7c984;
  font-style:normal;
  font-weight:800;
  letter-spacing:0;
}

@media(max-width:640px){
  .smart-match-banner{
    gap:7px;
    padding:9px 11px;
    font-size:10px;
  }

  .smart-match-banner em{
    font-size:10px;
  }
}
`,
  'utf8'
)

console.log(`
=============================================
✓ MELEO SMART MATCH v1 INSTALLED
=============================================

Backend:
✓ server-side ranking
✓ distance weighting
✓ rating weighting
✓ review confidence
✓ availability weighting
✓ response-time weighting
✓ experience weighting
✓ controlled Premium boost
✓ pagination-safe rank

Frontend:
✓ recommended preserves backend ranking
✓ Smart Match Top-3 badge
✓ match percentage

Next:
  npm run build
`)