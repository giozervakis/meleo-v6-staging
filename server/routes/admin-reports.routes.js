/**
 * MELEO v6.3.0
 * Admin Reports routes.
 *
 * Authorization remains provided by the application's
 * path-scoped /api/admin middleware.
 */
export function registerAdminReportsRoutes({
  app,
  pagination,
  many,
  sql,
  id,
  str,
  now
}) {

  app.get('/api/admin/reports',async(req,res)=>{const {page,limit,offset}=pagination(req.query,{defaultLimit:30,maxLimit:100});const items=await many(`SELECT r.*,u.name reporter_name,u.email reporter_email FROM reports r JOIN users u ON u.id=r.reporter_user_id ORDER BY created_at DESC LIMIT $1 OFFSET $2`,[limit,offset]);res.json({items,page,limit})})

  app.patch('/api/admin/reports/:id',async(req,res)=>{await sql('UPDATE reports SET status=$1,updated_at=now() WHERE id=$2',[str(req.body.status,40)||'closed',req.params.id]);res.json({ok:true})})

}
