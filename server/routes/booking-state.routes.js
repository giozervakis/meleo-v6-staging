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
            error:'Δεν επιτρέπεται.'
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
              '?? ????????? ?????? ??????????.',
            code:
              'BOOKING_TRANSITION_FORBIDDEN'
          })
      })
      }

      const updated=
        await Bookings.update(
          b.id,
          {
            status
          }
        )

      const recipientUserId=
        isProvider
          ? b.patientId
          : p.userId

      await Notifications.create(
        recipientUserId,
        'booking',
        `Ενημέρωση κράτησης: ${status}`,
        b.service,
        {
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
      )

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