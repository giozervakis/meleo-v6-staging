import { sql, tx } from '../relational/pool.js'
/*
 * MELEO v6.3.0
 *
 * Professional directory and profile routes.
 *
 * Scope:
 * - public professional search
 * - public professional detail
 * - professional reviews
 * - authenticated professional profile update
 *
 * Verification, subscriptions, billing and realtime lifecycle
 * intentionally remain outside this module.
 */

export function registerProfessionalCoreRoutes(
  app,
  deps
) {
  const {
    Professionals,
    limits,
    allowsVisibility,
    meleoTrustForProfessional,
    pagination,
    many,
    one,
    sanitizeProfilePatch,
    auth,
    requireRole,
    tx
  } = deps


  if (!app) {
    throw new Error(
      'registerProfessionalCoreRoutes requires an Express app'
    )
  }


  const required = {
    Professionals,
    limits,
    allowsVisibility,
    meleoTrustForProfessional,
    pagination,
    many,
    one,
    sanitizeProfilePatch,
    auth,
    requireRole,
    tx
  }


  for (
    const [
      name,
      value
    ] of Object.entries(
      required
    )
  ) {
    if (
      value === undefined ||
      value === null
    ) {
      throw new Error(
        `registerProfessionalCoreRoutes missing dependency: ${name}`
      )
    }
  }


app.get('/api/professionals',async(req,res)=>{const result=await Professionals.search(req.query);res.json(result)})
app.get('/api/professionals/:id',limits.profile,async(req,res)=>{const p=await Professionals.byId(req.params.id);if(!p||!p.verified||p.adminSuspended||!allowsVisibility(p))return res.status(404).json({error:'Ο επαγγελματίας δεν είναι διαθέσιμος.'});const trust=await meleoTrustForProfessional(p.id);res.json({professional:{...p,trust}})})
app.get('/api/professionals/:id/reviews',async(req,res)=>{const {page,limit,offset}=pagination(req.query,{defaultLimit:10,maxLimit:50});const items=await many(`SELECT r.id,r.rating,r.comment,r.created_at "createdAt",u.name "patientName" FROM reviews r JOIN users u ON u.id=r.patient_id WHERE r.professional_id=$1 ORDER BY r.created_at DESC LIMIT $2 OFFSET $3`,[req.params.id,limit,offset]);const c=await one('SELECT count(*)::int total FROM reviews WHERE professional_id=$1',[req.params.id]);res.json({items,page,limit,total:c.total,totalPages:Math.ceil(c.total/limit)})})
app.put('/api/professional/profile',auth,requireRole('professional'),limits.write,async(req,res)=>{
  const p=
    await Professionals.byUser(
      req.user.id
    )

  const patch=
    sanitizeProfilePatch(
      req.body
    )

  await tx(async c=>{

    const map={
      title:'title',
      specialty:'specialty',
      city:'city',
      area:'area',
      region:'region',
      latitude:'latitude',
      longitude:'longitude',
      serviceRadiusKm:'service_radius_km',
      bio:'bio',
      languages:'languages',
      credentials:'credentials',
      responseTime:'response_time',
      years:'years',
      price:'price',
      pricingMode:'pricing_mode',
      services:'services',
      availability:'availability'
    }

    const sets=[]
    const vals=[]
    let i=1

    for(
      const [key,value]
      of Object.entries(patch)
    ){
      const column=
        map[key]

      if(!column){
        continue
      }

      sets.push(
        `${column}=$${i++}`
      )

      vals.push(
        ['languages','credentials','services','availability'].includes(key)
          ? JSON.stringify(value)
          : value
      )
    }

    if(sets.length){
      vals.push(p.id)

      await c.query(
        `
          UPDATE professionals
          SET
            ${sets.join(',')},
            updated_at=now()
          WHERE id=$${i}
        `,
        vals
      )
    }

    const result=
      await c.query(
        `
          SELECT
            specialty,
            title,
            city,
            onboarding_stage
          FROM professionals
          WHERE id=$1
        `,
        [p.id]
      )

    const row=
      result.rows?.[0]

    if(
      row?.specialty &&
      row?.title &&
      row?.city &&
      ![
        'pending_verification',
        'approved'
      ].includes(
        row.onboarding_stage
      )
    ){
      await c.query(
        `
          UPDATE professionals
          SET
            onboarding_stage='verification',
            updated_at=now()
          WHERE id=$1
        `,
        [p.id]
      )
    }
  })

  res.json({
    professional:
      await Professionals.byId(
        p.id
      )
  })
})


// MELEO V7 PHASE 6E.2 PROFESSIONAL AVAILABILITY ROUTES

  app.get(
    '/api/professional/availability',
    auth,
    requireRole('professional'),
    async(req,res)=>{

      const p=
        await Professionals.byUser(
          req.user.id
        )

      if(!p){
        return res
          .status(404)
          .json({
            error:'Δεν βρέθηκε επαγγελματικό προφίλ.'
          })
      }

          const availabilitySettings=
      await sql(
        `
          SELECT
            structured_enabled "structuredEnabled"
          FROM professional_availability_settings
          WHERE professional_id=$1
        `,
        [
          p.id
        ]
      )

    const structuredEnabled=
      availabilitySettings.rows.length>0 &&
      availabilitySettings.rows[0].structuredEnabled!==false

const result=
        await sql(
          `
            SELECT
              day_of_week "dayOfWeek",
              to_char(
                slot_time,
                'HH24:MI'
              ) "time"

            FROM professional_availability_slots

            WHERE professional_id=$1

            ORDER BY
              day_of_week ASC,
              slot_time ASC
          `,
          [p.id]
        )

      const exceptionsResult=
        await sql(
          `
            SELECT
              exception_date::text date,
              available,
              slots,
              note

            FROM professional_availability_exceptions

            WHERE professional_id=$1

            ORDER BY exception_date ASC
          `,
          [p.id]
        )

      const weekly={
        1:[],
        2:[],
        3:[],
        4:[],
        5:[],
        6:[],
        7:[]
      }

      for(const row of result.rows||[]){
        const day=
          Number(row.dayOfWeek)

        if(Array.isArray(weekly[day])){
          weekly[day].push(
            String(row.time)
          )
        }
      }

      const hasWeeklySchedule=
        (result.rows||[]).length>0

      res.json({
        weekly,
        exceptions:
          (exceptionsResult.rows||[])
            .map(row=>({
              date:String(row.date).slice(0,10),
              available:Boolean(row.available),
              slots:Array.isArray(row.slots)
                ? row.slots
                : [],
              note:String(row.note||'')
            })),
        hasWeeklySchedule: structuredEnabled,
        legacyAvailability:
          Array.isArray(p.availability)
            ? p.availability
            : [],
        hasWeeklySchedule
      })
    }
  )


  app.put(
    '/api/professional/availability',
    auth,
    requireRole('professional'),
    limits.write,
    async(req,res)=>{

      const p=
        await Professionals.byUser(
          req.user.id
        )

      if(!p){
        return res
          .status(404)
          .json({
            error:'Δεν βρέθηκε επαγγελματικό προφίλ.'
          })
      }

      const rawWeekly=
        req.body?.weekly &&
        typeof req.body.weekly==='object'
          ? req.body.weekly
          : {}

      const normalized=[]

      const normalizeTime=value=>{

        const text=
          String(value||'').trim()

        if(
          !/^(?:[01]\d|2[0-3]):[0-5]\d$/
            .test(text)
        ){
          return null
        }

        return text
      }

      for(let day=1;day<=7;day++){

        const values=
          Array.isArray(
            rawWeekly[day]
          )
            ? rawWeekly[day]
            : Array.isArray(
                rawWeekly[String(day)]
              )
              ? rawWeekly[String(day)]
              : []

        const unique=
          Array.from(
            new Set(
              values
                .map(normalizeTime)
                .filter(Boolean)
            )
          )
          .sort()

        if(unique.length>48){
          return res
            .status(400)
            .json({
              error:
                'Υπερβολικά πολλές διαθέσιμες ώρες σε μία ημέρα.'
            })
        }

        for(const time of unique){

          normalized.push({
            day,
            time
          })
        }
      }

      const rawExceptions=
        Array.isArray(req.body?.exceptions)
          ? req.body.exceptions
          : []

      const normalizedExceptions=[]

      for(const item of rawExceptions){

        const date=
          String(item?.date||'').trim()

        if(
          !/^\d{4}-\d{2}-\d{2}$/
            .test(date)
        ){
          continue
        }

        const slots=
          Array.from(
            new Set(
              (
                Array.isArray(item?.slots)
                  ? item.slots
                  : []
              )
              .map(normalizeTime)
              .filter(Boolean)
            )
          )
          .sort()

        normalizedExceptions.push({
          date,
          available:
            Boolean(item?.available),
          slots,
          note:
            String(item?.note||'')
              .trim()
              .slice(0,200)
        })
      }

      if(normalizedExceptions.length>180){
        return res
          .status(400)
          .json({
            error:
              'Υπερβολικά πολλές εξαιρέσεις διαθεσιμότητας.'
          })
      }

      await tx(async client=>{

      await client.query(
        `
          INSERT INTO professional_availability_settings(
            professional_id,
            structured_enabled,
            updated_at
          )
          VALUES(
            $1,
            true,
            now()
          )
          ON CONFLICT(professional_id)
          DO UPDATE SET
            structured_enabled=true,
            updated_at=now()
        `,
        [
          p.id
        ]
      )


        await client.query(
          `
            DELETE FROM professional_availability_slots
            WHERE professional_id=$1
          `,
          [p.id]
        )

        for(const slot of normalized){

          await client.query(
            `
              INSERT INTO professional_availability_slots(
                professional_id,
                day_of_week,
                slot_time
              )
              VALUES($1,$2,$3)
            `,
            [
              p.id,
              slot.day,
              slot.time
            ]
          )
        }


        await client.query(
          `
            DELETE FROM professional_availability_exceptions
            WHERE professional_id=$1
          `,
          [p.id]
        )

        for(const exception of normalizedExceptions){

          await client.query(
            `
              INSERT INTO professional_availability_exceptions(
                professional_id,
                exception_date,
                available,
                slots,
                note
              )
              VALUES(
                $1,$2,$3,$4::jsonb,$5
              )
            `,
            [
              p.id,
              exception.date,
              exception.available,
              JSON.stringify(
                exception.slots
              ),
              exception.note
            ]
          )
        }
      })


      res.json({
        ok:true,
        weekly:
          normalized.reduce(
            (acc,item)=>{

              acc[item.day].push(
                item.time
              )

              return acc
            },
            {
              1:[],
              2:[],
              3:[],
              4:[],
              5:[],
              6:[],
              7:[]
            }
          ),
        exceptions:
          normalizedExceptions
      })
    }
  )
}
