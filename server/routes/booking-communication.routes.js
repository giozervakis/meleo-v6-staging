import {
  bookingTransitionResult,
  canUserTransitionBooking
} from '../relational/booking-state-machine.js'

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


app.post(
  '/api/bookings/:id/clarification',
  auth,
  requireRole('professional'),
  limits.write,
  async(req,res)=>{

    const b=
      await Bookings.byId(
        req.params.id
      )

    const p=
      await Professionals.byId(
        b?.professionalId
      )

    if(
      !b ||
      !p ||
      p.userId!==req.user.id
    ){
      return res
        .status(404)
        .json({
          error:'Not found'
        })
    }

    const transition=
      bookingTransitionResult(
        b.status,
        'clarification'
      )

    if(!transition.ok){
      return res
        .status(409)
        .json({
          error:
            'Invalid booking status transition',
          code:
            transition.code
        })
    }

    if(
      !canUserTransitionBooking({
        user:req.user,
        booking:b,
        professional:p,
        toStatus:'clarification'
      })
    ){
      return res
        .status(403)
        .json({
          error:
            '\u0394\u03b5\u03bd \u03b5\u03c0\u03b9\u03c4\u03c1\u03ad\u03c0\u03b5\u03c4\u03b1\u03b9.',
          code:
            'BOOKING_TRANSITION_FORBIDDEN'
        })
    }

    const text=
      str(
        req.body.text ||
        req.body.question,
        1500
      )

    if(!text){
      return res
        .status(400)
        .json({
          error:'\u0393\u03c1\u03ac\u03c8\u03b5 \u03ad\u03bd\u03b1 \u03bc\u03ae\u03bd\u03c5\u03bc\u03b1'
        })
    }

    const write=
      await Bookings.transition(
        b.id,
        b.status,
        {
          status:'clarification'
        }
      )

    if(!write.ok){

      if(
        write.code===
          'BOOKING_NOT_FOUND'
      ){
        return res
          .status(404)
          .json({
            error:'Not found',
            code:
              'BOOKING_NOT_FOUND'
          })
      }

      return res
        .status(409)
        .json({
          error:
            'Booking state changed concurrently',
          code:
            'BOOKING_STATE_CONFLICT',
          currentStatus:
            write.booking?.status ||
            null
        })
    }

    const transitioned=
      write.booking

    const updated=
      await Bookings.addMessage(
        transitioned,
        req.user,
        text,
        'clarification'
      )

    await Notifications.create(
      b.patientId,
      'message',
      '\u039f \u03b5\u03c0\u03b1\u03b3\u03b3\u03b5\u03bb\u03bc\u03b1\u03c4\u03af\u03b1\u03c2 \u03b6\u03b7\u03c4\u03ac \u03b4\u03b9\u03b5\u03c5\u03ba\u03c1\u03b9\u03bd\u03af\u03c3\u03b5\u03b9\u03c2',
      text.slice(0,180)
    )

    res.json({
      booking:updated
    })
  }
)

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
