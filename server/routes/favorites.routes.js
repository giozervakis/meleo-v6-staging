/*
 * MELEO v6.3.0
 *
 * Favorites HTTP routes.
 *
 * Owns:
 *   POST /api/favorites/:professionalId
 *   GET  /api/favorites
 *
 * /api/care-team intentionally remains outside
 * the Favorites HTTP domain.
 */

export function registerFavoritesRoutes(
  app,
  deps
) {
  const {
    auth,
    requireConsumer,
    limits,
    tx,
    id,
    many
  } = deps


app.post('/api/favorites/:professionalId',auth,requireConsumer,limits.write,async(req,res)=>{
  const pid=req.params.professionalId
  let favorite=false

  await tx(async c=>{
    const lockKey=`${req.user.id}:${pid}`

    await c.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
      [lockKey]
    )

    const removed=await c.query(
      'DELETE FROM favorites WHERE user_id=$1 AND professional_id=$2 RETURNING id',
      [req.user.id,pid]
    )

    if(removed.rowCount===1){
      favorite=false
      return
    }

    await c.query(
      'INSERT INTO favorites(id,user_id,professional_id) VALUES($1,$2,$3)',
      [id('fav'),req.user.id,pid]
    )

    favorite=true
  })

  res.json({favorite})
})

app.get('/api/favorites',auth,async(req,res)=>{const rows=await many('SELECT professional_id FROM favorites WHERE user_id=$1 ORDER BY created_at DESC',[req.user.id]);res.json(rows.map(x=>x.professional_id))})

}
