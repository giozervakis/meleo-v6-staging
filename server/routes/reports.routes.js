export function registerReportRoutes(
  app,
  {
    auth,
    limits,
    sql,
    id,
    str
  }
) {

  app.post('/api/reports',auth,limits.write,async(req,res)=>{const rid=id('rpt');await sql(`INSERT INTO reports(id,reporter_user_id,target_type,target_id,reason,details) VALUES($1,$2,$3,$4,$5,$6)`,[rid,req.user.id,str(req.body.targetType,40),str(req.body.targetId,80),str(req.body.reason,200),str(req.body.details,1500)]);res.json({ok:true,id:rid})})
}
