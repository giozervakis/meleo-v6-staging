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
    one,
    sql,
    id,
    many
  } = deps


app.post('/api/favorites/:professionalId',auth,requireConsumer,limits.write,async(req,res)=>{const pid=req.params.professionalId;const existing=await one('SELECT id FROM favorites WHERE user_id=$1 AND professional_id=$2',[req.user.id,pid]);if(existing){await sql('DELETE FROM favorites WHERE id=$1',[existing.id]);return res.json({favorite:false})}await sql('INSERT INTO favorites(id,user_id,professional_id) VALUES($1,$2,$3)',[id('fav'),req.user.id,pid]);res.json({favorite:true})})

app.get('/api/favorites',auth,async(req,res)=>{const rows=await many('SELECT professional_id FROM favorites WHERE user_id=$1 ORDER BY created_at DESC',[req.user.id]);res.json(rows.map(x=>x.professional_id))})

}
