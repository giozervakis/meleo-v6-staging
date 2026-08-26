export function registerCommunicationSummaryRoutes(
  app,
  {
    auth,
    Notifications,
    Bookings
  }
) {

  app.get(
    '/api/communication/unread',
    auth,
    async(req,res)=>{

      const [
        notifications,
        messages
      ]=await Promise.all([
        Notifications.unreadCount(req.user.id),
        Bookings.unreadMessageCount(req.user.id)
      ])

      res.json({
        notifications,
        messages,
        total:
          Number(notifications||0)+
          Number(messages||0)
      })
    }
  )
}
