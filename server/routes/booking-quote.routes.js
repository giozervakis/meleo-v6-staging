/*
 * MELEO D10D.5
 *
 * Authoritative relational quote / final-price routes.
 *
 * These routes replace the legacy in-memory quote flow.
 */

export function registerBookingQuoteRoutes(
  app,
  deps
){
  const {
    auth,
    requireRole,
    limits,
    str,
    Bookings,
    Professionals
  }=deps


  app.post(
    '/api/bookings/:id/quote',
    auth,
    requireRole('professional'),
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
            error:'??? ??????? ??????'
          })
      }

      const p=
        await Professionals.byId(
          b.professionalId
        )

      if(
        !p ||
        p.userId!==req.user.id
      ){
        return res
          .status(403)
          .json({
            error:'??? ???????????'
          })
      }

      if(
        ![
          'pending',
          'clarification',
          'quoted'
        ].includes(
          b.status
        )
      ){
        return res
          .status(409)
          .json({
            error:
              '?? ?????? ??? ??????? ??????? ??????? ?? ???? ??? ?????????',
            code:
              'BOOKING_QUOTE_STATE_INVALID'
          })
      }

      const amount=
        Number(
          req.body?.amount
        )

      if(
        !Number.isFinite(amount) ||
        amount<=0 ||
        amount>5000
      ){
        return res
          .status(400)
          .json({
            error:'?? ?????? ????',
            code:
              'BOOKING_QUOTE_AMOUNT_INVALID'
          })
      }

      const extra=
        str(
          req.body?.message,
          500
        )

      const write=
        await Bookings.quoteWithMessage(
          b,
          req.user,
          amount,
          extra,
          b.patientId
        )

      if(!write.ok){

        if(
          write.code===
            'BOOKING_NOT_FOUND'
        ){
          return res
            .status(404)
            .json({
              error:'??? ??????? ??????',
              code:
                'BOOKING_NOT_FOUND'
            })
        }

        if(
          write.code===
            'BOOKING_QUOTE_STATE_INVALID'
        ){
          return res
            .status(409)
            .json({
              error:
                '?? ?????? ??? ??????? ??????? ??????? ?? ???? ??? ?????????',
              code:
                write.code
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

      res.json(
        write.booking
      )
    }
  )


  app.post(
    '/api/bookings/:id/quote-decision',
    auth,
    requireRole('patient'),
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
            error:'??? ??????? ??????'
          })
      }

      if(
        b.patientId!==req.user.id
      ){
        return res
          .status(403)
          .json({
            error:'??? ???????????'
          })
      }

      if(b.status!=='quoted'){
        return res
          .status(409)
          .json({
            error:
              '??? ??????? ?????? ??????? ???????',
            code:
              'BOOKING_QUOTE_NOT_ACTIVE'
          })
      }

      const decision=
        str(
          req.body?.decision,
          20
        )

      /*
       * Preserve legacy API compatibility:
       * any explicit accept accepts;
       * reject/decline both mean decline.
       * Unknown values are rejected instead of silently declining.
       */
      const normalizedDecision=
        decision==='accept'
          ? 'accept'
          : (
              decision==='reject' ||
              decision==='decline'
                ? 'decline'
                : null
            )

      if(!normalizedDecision){
        return res
          .status(400)
          .json({
            error:
              '?? ?????? ??????? ????????',
            code:
              'BOOKING_QUOTE_DECISION_INVALID'
          })
      }

      const p=
        await Professionals.byId(
          b.professionalId
        )

      if(!p?.userId){
        return res
          .status(409)
          .json({
            error:
              '? ????????????? ??? ????? ??????????',
            code:
              'BOOKING_PROFESSIONAL_MISSING'
          })
      }

      const write=
        await Bookings.decideQuoteWithMessage(
          b,
          req.user,
          normalizedDecision,
          p.userId
        )

      if(!write.ok){

        if(
          write.code===
            'BOOKING_NOT_FOUND'
        ){
          return res
            .status(404)
            .json({
              error:'??? ??????? ??????',
              code:
                'BOOKING_NOT_FOUND'
            })
        }

        if(
          write.code===
            'BOOKING_QUOTE_PRICE_INVALID'
        ){
          return res
            .status(409)
            .json({
              error:
                '? ?????? ??????? ??? ???? ?????? ????',
              code:
                write.code
            })
        }

        if(
          write.code===
            'BOOKING_QUOTE_NOT_ACTIVE'
        ){
          return res
            .status(409)
            .json({
              error:
                '??? ??????? ?????? ??????? ???????',
              code:
                write.code
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

      res.json(
        write.booking
      )
    }
  )
}
