import { sql } from '../relational/pool.js'
/*
 * MELEO v6.3.0
 *
 * Booking core HTTP routes.
 *
 * Owns booking creation and authenticated booking listing only.
 *
 * Booking state transitions, communication, recovery,
 * reviews, unread state and calendar export remain separate
 * application concerns during incremental modularization.
 */


// MELEO V7 PHASE 6E.2 SCHEDULING HELPERS

function meleoWeekday(date){

  const parsed=
    new Date(
      `${date}T12:00:00Z`
    )

  if(
    Number.isNaN(
      parsed.getTime()
    )
  ){
    return null
  }

  const jsDay=
    parsed.getUTCDay()

  return jsDay===0
    ? 7
    : jsDay
}


function meleoNormalizeTime(value){

  const text=
    String(value||'')
      .trim()
      .slice(0,5)

  return /^(?:[01]\d|2[0-3]):[0-5]\d$/
    .test(text)
      ? text
      : null
}


async function meleoAvailabilityForDate(
  professional,
  date
){
  const availabilitySettings=
    await sql(
      `
        SELECT
          structured_enabled "structuredEnabled"
        FROM professional_availability_settings
        WHERE professional_id=$1
      `,
      [
        professional.id
      ]
    )

  const structuredEnabled=
    availabilitySettings.rows.length>0 &&
    availabilitySettings.rows[0].structuredEnabled!==false


  const dayOfWeek=
    meleoWeekday(date)

  if(!dayOfWeek){
    return {
      date,
      slots:[],
      source:'invalid'
    }
  }


  const exceptionResult=
    await sql(
      `
        SELECT
          available,
          slots

        FROM professional_availability_exceptions

        WHERE
          professional_id=$1
          AND exception_date=$2

        LIMIT 1
      `,
      [
        professional.id,
        date
      ]
    )

  const exception=
    exceptionResult.rows?.[0]

  let slots=[]
  let source='weekly'


  if(exception){

    source='exception'

    if(exception.available){

      slots=
        (
          Array.isArray(exception.slots)
            ? exception.slots
            : []
        )
        .map(meleoNormalizeTime)
        .filter(Boolean)
    }

  }else{

    const weeklyResult=
      await sql(
        `
          SELECT
            to_char(
              slot_time,
              'HH24:MI'
            ) time

          FROM professional_availability_slots

          WHERE
            professional_id=$1
            AND day_of_week=$2

          ORDER BY slot_time ASC
        `,
        [
          professional.id,
          dayOfWeek
        ]
      )

    slots=
      (weeklyResult.rows||[])
        .map(row=>
          meleoNormalizeTime(
            row.time
          )
        )
        .filter(Boolean)


    if(slots.length===0){

      const weeklyCount=
        await sql(
          `
            SELECT
              count(*)::int count

            FROM professional_availability_slots

            WHERE professional_id=$1
          `,
          [professional.id]
        )

      const hasWeeklySchedule=
        Number(
          weeklyCount.rows?.[0]?.count||0
        )>0


      if(!structuredEnabled){

        slots=
          (
            Array.isArray(
              professional.availability
            )
              ? professional.availability
              : []
          )
          .map(meleoNormalizeTime)
          .filter(Boolean)

        source='legacy'
      }
    }
  }


  slots=
    Array.from(
      new Set(slots)
    ).sort()


  if(slots.length===0){

    return {
      date,
      dayOfWeek,
      slots:[],
      source
    }
  }


  const occupiedResult=
    await sql(
      `
        SELECT
          to_char(
            visit_time,
            'HH24:MI'
          ) time

        FROM bookings

        WHERE
          professional_id=$1
          AND visit_date=$2
          AND status IN(
            'pending',
            'clarification',
            'quoted',
            'accepted'
          )
      `,
      [
        professional.id,
        date
      ]
    )


  const occupied=
    new Set(
      (occupiedResult.rows||[])
        .map(row=>
          meleoNormalizeTime(
            row.time
          )
        )
        .filter(Boolean)
    )


  return {
    date,
    dayOfWeek,
    slots:
      slots.filter(
        time=>!occupied.has(time)
      ),
    occupied:
      Array.from(occupied).sort(),
    source
  }
}


async function meleoSlotIsBookable(
  professional,
  date,
  time
){

  const normalizedTime=
    meleoNormalizeTime(time)

  if(!normalizedTime){
    return false
  }

  const availability=
    await meleoAvailabilityForDate(
      professional,
      date
    )

  return availability.slots
    .includes(
      normalizedTime
    )
}
export function registerBookingCoreRoutes(
  app,
  deps
) {
  const {
    auth,
    requireConsumer,
    requireVerifiedEmail,
    limits,
    str,
    isDate,
    isTime,
    Professionals,
    Users,
    allowsVisibility,
    id,
    Bookings,
    mail,
    audit
  } = deps
  // MELEO V7 PHASE 6E.2 AUTHORITATIVE BOOKING VALIDATION

  app.post(
    '/api/bookings',
    auth,
    requireConsumer,
    requireVerifiedEmail,
    limits.write,
    async(req,res)=>{

      const pid=
        str(
          req.body.professionalId,
          80
        )

      const service=
        str(
          req.body.service,
          160
        )

      const date=
        str(
          req.body.date,
          20
        )

      const time=
        str(
          req.body.time,
          10
        )


      if(
        !pid ||
        !service ||
        !isDate(date) ||
        !isTime(time)
      ){
        return res
          .status(400)
          .json({
            error:
              'Συμπλήρωσε υπηρεσία, ημερομηνία και ώρα.'
          })
      }


      const p=
        await Professionals.byId(pid)


      if(
        !p ||
        !p.verified ||
        !allowsVisibility(p)
      ){
        return res
          .status(404)
          .json({
            error:
              'Ο επαγγελματίας δεν είναι διαθέσιμος.'
          })
      }


      if(p.userId===req.user.id){

        return res
          .status(400)
          .json({
            error:
              'Δεν μπορείς να δημιουργήσεις αίτημα προς το δικό σου επαγγελματικό προφίλ.'
          })
      }


      const bookable=
        await meleoSlotIsBookable(
          p,
          date,
          time
        )


      if(!bookable){

        return res
          .status(409)
          .json({
            error:
              'Η συγκεκριμένη ώρα δεν είναι πλέον διαθέσιμη. Επίλεξε άλλη διαθέσιμη ώρα.',
            code:
              'BOOKING_SLOT_UNAVAILABLE'
          })
      }


      const bid=
        id('bkg')


      const professionalUser =
        await Users.byId(
          p.userId
        )


      let b

      try{

        b=
          await Bookings.create({
            id:bid,
            patientId:req.user.id,
            professionalId:pid,
            service,
            date,
            time,
            address:
              str(
                req.body.address,
                300
              ),
            notes:
              str(
                req.body.notes,
                3000
              ),
            repeat:
              str(
                req.body.repeat,
                120
              )||'Μία φορά',
            price:p.price
          },{
            userId:p.userId,
            type:'booking',
            title:'Νέο αίτημα επίσκεψης',
            body:`${req.user.name} · ${service}`
          },
          async client=>{

            if(
              !professionalUser?.email
            ){
              return
            }

            await mail.newBooking(
              professionalUser.email,
              professionalUser.name,
              service,
              date,
              time,
              {
                dedupKey:
                  `booking:${bid}:created:${professionalUser.id}`,
                client
              }
            )
          })

      }catch(error){

        if(error?.code==='23505'){

          return res
            .status(409)
            .json({
              error:
                'Η συγκεκριμένη ώρα μόλις δεσμεύτηκε. Επίλεξε άλλη διαθέσιμη ώρα.',
              code:
                'BOOKING_SLOT_CONFLICT'
            })
        }

        throw error
      }




      await audit(
        req.user.id,
        'booking.create',
        {
          bookingId:bid,
          professionalId:pid,
          visitDate:date,
          visitTime:time
        }
      )


      res.json({
        booking:b
      })
    }
  )
app.get('/api/bookings',auth,async(req,res)=>res.json(await Bookings.listForUser(req.user,req.query)))

// MELEO V7 PHASE 6E.2 PUBLIC AVAILABILITY ENDPOINT

  app.get(
    '/api/professionals/:id/availability',
    async(req,res)=>{

      const professional=
        await Professionals.byId(
          req.params.id
        )

      if(
        !professional ||
        !professional.verified ||
        !allowsVisibility(professional)
      ){
        return res
          .status(404)
          .json({
            error:
              'Ο επαγγελματίας δεν είναι διαθέσιμος.'
          })
      }

      const date=
        String(
          req.query?.date||''
        ).trim()

      if(
        !date ||
        !isDate(date)
      ){
        return res
          .status(400)
          .json({
            error:
              'Μη έγκυρη ημερομηνία.'
          })
      }

      const availability=
        await meleoAvailabilityForDate(
          professional,
          date
        )

      res.json({
        professionalId:
          professional.id,
        ...availability
      })
    }
  )
}
