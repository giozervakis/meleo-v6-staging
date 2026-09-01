export function registerSupportRoutes(
  app,
  {
    auth,
    requireRole,
    limits,
    pagination,
    many,
    one,
    sql,
    tx,
    id,
    str,
    Notifications
  }
) {

  app.get('/api/support/tickets',auth,async(req,res)=>{const {page,limit,offset}=pagination(req.query,{defaultLimit:20,maxLimit:100});const where=req.user.role==='admin'?'true':'t.user_id=$1',params=req.user.role==='admin'?[]:[req.user.id];const ids=await many(`SELECT t.id FROM support_tickets t WHERE ${where} ORDER BY updated_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`,[...params,limit,offset]);const items=[];for(const x of ids){const t=await one(`SELECT t.*,u.name user_name,u.email user_email FROM support_tickets t JOIN users u ON u.id=t.user_id WHERE t.id=$1`,[x.id]);t.messages=await many(`SELECT m.id,m.sender_role "fromRole",u.name "fromName",m.body text,m.created_at "createdAt" FROM support_messages m JOIN users u ON u.id=m.sender_user_id WHERE ticket_id=$1 ORDER BY m.created_at`,[x.id]);items.push({id:t.id,userId:t.user_id,userName:t.user_name,userEmail:t.user_email,subject:t.subject,category:t.category,status:t.status,createdAt:t.created_at,updatedAt:t.updated_at,messages:t.messages})}res.json({items,page,limit})})

  app.post('/api/support/tickets',auth,limits.write,async(req,res)=>{const tid=id('tic'),subject=str(req.body.subject,160),text=str(req.body.text,2000);if(!subject||!text)return res.status(400).json({error:'Συμπλήρωσε θέμα και μήνυμα.'});await tx(async c=>{await c.query(`INSERT INTO support_tickets(id,user_id,subject,category) VALUES($1,$2,$3,$4)`,[tid,req.user.id,subject,str(req.body.category,40)||'general']);await c.query(`INSERT INTO support_messages(id,ticket_id,sender_user_id,sender_role,body) VALUES($1,$2,$3,$4,$5)`,[id('tmsg'),tid,req.user.id,req.user.role,text])});res.json({ok:true,id:tid})})

  app.post('/api/support/tickets/:id/message',auth,limits.write,async(req,res)=>{const t=await one('SELECT * FROM support_tickets WHERE id=$1',[req.params.id]);if(!t||(req.user.role!=='admin'&&t.user_id!==req.user.id))return res.status(404).json({error:'Not found'});const text=str(req.body.text,2000);await tx(async c=>{await c.query(`INSERT INTO support_messages(id,ticket_id,sender_user_id,sender_role,body) VALUES($1,$2,$3,$4,$5)`,[id('tmsg'),t.id,req.user.id,req.user.role,text]);await c.query('UPDATE support_tickets SET updated_at=now() WHERE id=$1',[t.id]);await Notifications.create(req.user.role==='admin'?t.user_id:req.user.id,'support','Νέα απάντηση υποστήριξης',text.slice(0,180),{},c)});res.json({ok:true})})

  app.patch('/api/support/tickets/:id',auth,requireRole('admin'),limits.write,async(req,res)=>{const status=['open','pending','closed'].includes(req.body.status)?req.body.status:'open';await sql('UPDATE support_tickets SET status=$1,updated_at=now() WHERE id=$2',[status,req.params.id]);res.json({ok:true})})
}
