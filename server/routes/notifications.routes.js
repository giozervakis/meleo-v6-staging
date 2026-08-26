/*
 * MELEO v6.3.0
 *
 * Notifications HTTP routes.
 *
 * Owns:
 *   GET   /api/notifications
 *   PATCH /api/notifications/:id/read
 *   PATCH /api/notifications/read-all
 *
 * Communication aggregate unread state remains a separate
 * application concern.
 */

export function registerNotificationRoutes(
  app,
  deps
) {
  const {
    auth,
    Notifications
  } = deps


app.get('/api/notifications',auth,async(req,res)=>res.json(await Notifications.list(req.user.id,req.query)))

app.patch('/api/notifications/:id/read',auth,async(req,res)=>{await Notifications.read(req.params.id,req.user.id);res.json({ok:true})})

app.patch(
  '/api/notifications/read-all',
  auth,
  async(req,res)=>{

    res.json(
      await Notifications.readAll(
        req.user.id
      )
    )
  }
)

}
