/*
 * MELEO v6.3.0
 *
 * Booking communication HTTP routes.
 *
 * Owns:
 * - professional clarification
 * - booking conversation messages
 * - unread booking-message state
 * - mark booking messages read
 *
 * Booking recovery, reviews and calendar export remain
 * independently application-owned during incremental
 * modularization.
 */

export function registerBookingCommunicationRoutes(
  app,
  deps
) {
  const {
    auth,
    requireRole,
    limits,
    str,
    Bookings,
    Professionals,
    canViewBooking,
    Notifications
  } = deps


app.post('/api/bookings/:id/clarification',auth,requireRole('professional'),limits.write,async(req,res)=>{const b=await Bookings.byId(req.params.id),p=await Professionals.byId(b?.professionalId);if(!b||p.userId!==req.user.id)return res.status(404).json({error:'Not found'});const text=str(req.body.text||req.body.question,1500);await Bookings.update(b.id,{status:'clarification'});const updated=await Bookings.addMessage(b,req.user,text,'clarification');await Notifications.create(b.patientId,'message','Ο επαγγελματίας ζητά διευκρινίσεις',text.slice(0,180));res.json({booking:updated})})

app.post(
  '/api/bookings/:id/message',
  auth,
  limits.write,
  async(req,res)=>{

    const b=
      await Bookings.byId(
        req.params.id
      )

    if(!b){
      return res.status(404).json({
        error:'Not found'
      })
    }

    const p=
      await Professionals.byId(
        b.professionalId
      )

    if(
      !canViewBooking(
        req.user,
        b,
        p
      )
    ){
      return res.status(403).json({
        error:'Δεν επιτρέπεται.'
      })
    }

const text =
  str(
    req.body?.text,
    1500
  )

if(!text){
  return res.status(400).json({
    error:'Γράψε ένα μήνυμα'
  })
}

const updated =
  await Bookings.addMessage(
    b,
    req.user,
    text
  )

await Notifications.create(
  req.user.id===b.patientId
    ? p.userId
    : b.patientId,
  'message',
  'Νέο μήνυμα MELEO',
  text.slice(0,180),
  {
    priority:'normal',
    actionType:'booking',
    actionId:b.id,
    actionUrl:
      req.user.id===b.patientId
        ? '/professional'
        : '/dashboard'
  }
)

res.json({
  booking:updated
})
  }
)

app.get(
  '/api/bookings/unread',
  auth,
  async(req,res)=>{

    const items=
      await Bookings.conversationUnreadCounts(
        req.user.id
      )

    res.json({
      items,
      total:
        items.reduce(
          (sum,x)=>
            sum+Number(x.unread||0),
          0
        )
    })
  }
)

app.patch(
  '/api/bookings/:id/messages/read',
  auth,
  async(req,res)=>{

    const b=
      await Bookings.byId(
        req.params.id
      )

    if(!b){
      return res.status(404).json({
        error:'Not found'
      })
    }

    const p=
      await Professionals.byId(
        b.professionalId
      )

    if(
      !canViewBooking(
        req.user,
        b,
        p
      )
    ){
      return res.status(403).json({
        error:'Δεν επιτρέπεται.'
      })
    }

    res.json(
      await Bookings.markMessagesRead(
        b.id,
        req.user.id
      )
    )
  }
)
}
