import {
  isBookingStatus,
  bookingTransitionResult,
  canUserTransitionBooking
} from '../relational/booking-state-machine.js'

/*
 * MELEO v6.3.0
 *
 * Booking state HTTP routes.
 *
 * Owns booking status transitions only.
 *
 * Booking communication, recovery, reviews,
 * unread state and calendar export remain separate
 * application concerns during incremental modularization.
 */

export function registerBookingStateRoutes(
  app,
  deps
) {
  const {
    auth,
    limits,
    str,
    Bookings,
    Professionals,
    Users,
    canEditBooking,
    Notifications,
    mail
  } = deps


  app.patch(
    '/api/bookings/:id/status',
    auth,
    limits.write,
    async(req,res)=>{
      const b=
        await Bookings.byId(
          req.params.id
        )

      if(!b){
        return res
          .status(404)
          .json({
            error:'Not found'
          })
      }

      const p=
        await Professionals.byId(
          b.professionalId
        )

      if(
        !canEditBooking(
          req.user,
          b,
          p
        )
      ){
        return res
          .status(403)
          .json({
            error:'Ξ”ΞµΞ½ ΞµΟ€ΞΉΟ„ΟΞ­Ο€ΞµΟ„Ξ±ΞΉ.'
          })
      }

      const status=
        str(
          req.body.status,
          30
        )

      if(
        !isBookingStatus(
          status
        )
      ){
        return res
          .status(400)
          .json({
            error:'Invalid status',
            code:'BOOKING_TARGET_STATUS_INVALID'
          })
      }

      const transition=
        bookingTransitionResult(
          b.status,
          status
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

      const isRequester=
        b.patientId===req.user.id

      const isProvider=
        req.user.role==='professional' &&
        p?.userId===req.user.id

      if(
        !canUserTransitionBooking({
          user:req.user,
          booking:b,
          professional:p,
          toStatus:status
        })
      ){
        return res
          .status(403)
          .json({
            error:
              '\u039c\u03b7 \u03b5\u03c0\u03b9\u03c4\u03c1\u03b5\u03c0\u03c4\u03ae \u03b1\u03bb\u03bb\u03b1\u03b3\u03ae \u03ba\u03b1\u03c4\u03ac\u03c3\u03c4\u03b1\u03c3\u03b7\u03c2.',
            code:
              'BOOKING_TRANSITION_FORBIDDEN'
          })
      }

      /*
       * D10D.6
       *
       * clarification and quote lifecycle changes own
       * additional domain data and therefore must use
       * their dedicated workflow endpoints.
       */
      if(
        status==='clarification' ||
        status==='quoted' ||
        (
          b.status==='quoted' &&
          status==='accepted'
        )
      ){
        return res
          .status(409)
          .json({
            error:
              'This booking transition requires its dedicated workflow',
            code:
              'BOOKING_SPECIALIZED_TRANSITION_REQUIRED'
          })
      }
      const recipientUserId=
        isProvider
          ? b.patientId
          : p.userId

      const write=
        await Bookings.transition(
          b.id,
          b.status,
          {
            status
          },
          {
            userId:recipientUserId,
            type:'booking',
            title:
              `Ενημέρωση κράτησης: ${status}`,
            body:
              b.service,
            options:{
              priority:
                status==='cancelled'
                  ? 'high'
                  : 'normal',

              actionType:'booking',
              actionId:b.id,

              actionUrl:
                isProvider
                  ? '/dashboard'
                  : '/professional'
            }
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

      const updated=
        write.booking

      if(
        status==='cancelled' ||
        status==='completed'
      ){
        const recipient=
          await Users.byId(
            recipientUserId
          )

        if(recipient?.email){
          if(status==='cancelled'){
            mail
              .bookingCancelled(
                recipient.email,
                recipient.name,
                b.service,
                b.date,
                b.time
              )
              .catch(
                ()=>{}
              )
          }

          if(status==='completed'){
            mail
              .bookingCompleted(
                recipient.email,
                recipient.name,
                b.service
              )
              .catch(
                ()=>{}
              )
          }
        }
      }

      res.json({
        booking:updated
      })
    }
  )
}
