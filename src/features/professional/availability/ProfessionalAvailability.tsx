import React, {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react'

import { api } from '../../../lib/api'
import {useTranslation} from 'react-i18next'
import './professional-availability.css'

type WeeklySchedule = Record<number,string[]>

type AvailabilityException = {
  date:string
  available:boolean
  slots:string[]
  note?:string
}

type Props = {
  availability?:string[]
  token?:string
  onChange?:(availability:string[])=>void
  onSave?:()=>Promise<any>|any
  setToast?:(message:string)=>void
}

const DAYS = [
  {day:1,label:'Δευτέρα',short:'Δευ'},
  {day:2,label:'Τρίτη',short:'Τρι'},
  {day:3,label:'Τετάρτη',short:'Τετ'},
  {day:4,label:'Πέμπτη',short:'Πεμ'},
  {day:5,label:'Παρασκευή',short:'Παρ'},
  {day:6,label:'Σάββατο',short:'Σαβ'},
  {day:7,label:'Κυριακή',short:'Κυρ'}
]

const SLOT_OPTIONS = [
  '07:00','07:30',
  '08:00','08:30',
  '09:00','09:30',
  '10:00','10:30',
  '11:00','11:30',
  '12:00','12:30',
  '13:00','13:30',
  '14:00','14:30',
  '15:00','15:30',
  '16:00','16:30',
  '17:00','17:30',
  '18:00','18:30',
  '19:00','19:30',
  '20:00','20:30',
  '21:00'
]

function emptyWeekly():WeeklySchedule{
  return {
    1:[],
    2:[],
    3:[],
    4:[],
    5:[],
    6:[],
    7:[]
  }
}

function normalizeTimes(value:any):string[]{
  if(!Array.isArray(value)){
    return []
  }

  return Array.from(
    new Set(
      value
        .map(x=>String(x||'').trim())
        .filter(x=>/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(x))
    )
  ).sort()
}

function normalizeWeekly(value:any):WeeklySchedule{
  const result=emptyWeekly()

  for(const item of DAYS){
    result[item.day]=normalizeTimes(
      value?.[item.day] ??
      value?.[String(item.day)] ??
      []
    )
  }

  return result
}

function normalizeExceptions(value:any):AvailabilityException[]{
  if(!Array.isArray(value)){
    return []
  }

  return value
    .map((item:any)=>({
      date:String(item?.date||''),
      available:Boolean(item?.available),
      slots:normalizeTimes(item?.slots),
      note:String(item?.note||'')
    }))
    .filter(
      item=>/^\d{4}-\d{2}-\d{2}$/.test(item.date)
    )
    .sort(
      (a,b)=>a.date.localeCompare(b.date)
    )
}

function formatDate(date:string,locale:string){
  if(!date){
    return ''
  }

  try{
    return new Intl.DateTimeFormat(
      locale,
      {
        weekday:'short',
        day:'2-digit',
        month:'short',
        year:'numeric'
      }
    ).format(
      new Date(`${date}T12:00:00`)
    )
  }catch{
    return date
  }
}

export default function ProfessionalAvailability({
  availability=[],
  token='',
  onChange,
  setToast
}:Props){

  const {t,i18n}=useTranslation()

  const [weekly,setWeekly]=
    useState<WeeklySchedule>(
      emptyWeekly()
    )

  const [exceptions,setExceptions]=
    useState<AvailabilityException[]>([])

  const [loading,setLoading]=
    useState(true)

  const [saving,setSaving]=
    useState(false)

  const [error,setError]=
    useState('')

  const [selectedDay,setSelectedDay]=
    useState(1)

  const [exceptionDate,setExceptionDate]=
    useState('')

  const [exceptionAvailable,setExceptionAvailable]=
    useState(false)

  const [exceptionSlots,setExceptionSlots]=
    useState<string[]>([])

  const [exceptionNote,setExceptionNote]=
    useState('')

  const load=useCallback(
    async()=>{
      setLoading(true)
      setError('')

      try{
        const data:any=
          await api(
            '/professional/availability',
            {},
            token
          )

        const nextWeekly=
          normalizeWeekly(
            data?.weekly
          )

        const nextExceptions=
          normalizeExceptions(
            data?.exceptions
          )

        const hasStructured=
          Boolean(
            data?.hasWeeklySchedule
          )

        if(
          !hasStructured &&
          Array.isArray(availability) &&
          availability.length>0
        ){
          const legacy=
            normalizeTimes(
              availability
            )

          for(const item of DAYS){
            nextWeekly[item.day]=[...legacy]
          }
        }

        setWeekly(nextWeekly)
        setExceptions(nextExceptions)

      }catch(e:any){
        setError(
          e?.message ||
          t('proAvailability.errors.load')
        )
      }finally{
        setLoading(false)
      }
    },
    [token]
  )

  useEffect(
    ()=>{
      load()
    },
    [load]
  )

  const selectedSlots=
    weekly[selectedDay]||[]

  const activeDays=
    useMemo(
      ()=>
        DAYS.filter(
          item=>
            (weekly[item.day]||[]).length>0
        ).length,
      [weekly]
    )

  const weeklySlotCount=
    useMemo(
      ()=>
        DAYS.reduce(
          (sum,item)=>
            sum+
            (weekly[item.day]||[]).length,
          0
        ),
      [weekly]
    )

  function toggleTime(
    day:number,
    time:string
  ){
    setWeekly(current=>{
      const existing=
        current[day]||[]

      const next=
        existing.includes(time)
          ? existing.filter(x=>x!==time)
          : [...existing,time].sort()

      return {
        ...current,
        [day]:next
      }
    })
  }

  function setDayEnabled(
    day:number,
    enabled:boolean
  ){
    setWeekly(current=>({
      ...current,
      [day]:
        enabled
          ? (
              current[day]?.length
                ? current[day]
                : ['09:00']
            )
          : []
    }))
  }

  function copyDayToWeekdays(){
    const source=[
      ...(weekly[selectedDay]||[])
    ]

    setWeekly(current=>{
      const next={...current}

      for(const day of [1,2,3,4,5]){
        next[day]=[...source]
      }

      return next
    })

    setToast?.(
      t('proAvailability.toast.copiedWeekdays')
    )
  }

  function clearSelectedDay(){
    setWeekly(current=>({
      ...current,
      [selectedDay]:[]
    }))
  }

  function toggleExceptionSlot(time:string){
    setExceptionSlots(current=>
      current.includes(time)
        ? current.filter(x=>x!==time)
        : [...current,time].sort()
    )
  }

  function addException(){
    if(!exceptionDate){
      setToast?.(
        t('proAvailability.toast.selectExceptionDate')
      )
      return
    }

    if(
      exceptionAvailable &&
      exceptionSlots.length===0
    ){
      setToast?.(
        t('proAvailability.toast.selectExceptionSlot')
      )
      return
    }

    const next:AvailabilityException={
      date:exceptionDate,
      available:exceptionAvailable,
      slots:
        exceptionAvailable
          ? normalizeTimes(exceptionSlots)
          : [],
      note:exceptionNote.trim()
    }

    setExceptions(current=>
      [
        ...current.filter(
          item=>item.date!==next.date
        ),
        next
      ].sort(
        (a,b)=>a.date.localeCompare(b.date)
      )
    )

    setExceptionDate('')
    setExceptionAvailable(false)
    setExceptionSlots([])
    setExceptionNote('')
  }

  function removeException(date:string){
    setExceptions(current=>
      current.filter(
        item=>item.date!==date
      )
    )
  }

  async function save(){
    setSaving(true)
    setError('')

    try{
      const payload={
        weekly,
        exceptions
      }

      const data:any=
        await api(
          '/professional/availability',
          {
            method:'PUT',
            body:JSON.stringify(payload)
          },
          token
        )

      const normalizedWeekly=
        normalizeWeekly(
          data?.weekly ?? weekly
        )

      const normalizedExceptions=
        normalizeExceptions(
          data?.exceptions ?? exceptions
        )

      setWeekly(normalizedWeekly)
      setExceptions(normalizedExceptions)

      /*
       * Keep the old Professional.availability string[]
       * populated for older surfaces during migration.
       * We use the union of the structured weekly schedule.
       */
      const legacy=
        Array.from(
          new Set(
            DAYS.flatMap(
              item=>
                normalizedWeekly[item.day]||[]
            )
          )
        ).sort()

      onChange?.(legacy)

      setToast?.(
        t('proAvailability.toast.saved')
      )

    }catch(e:any){
      const message=
        e?.message ||
        t('proAvailability.errors.save')

      setError(message)
      setToast?.(message)

    }finally{
      setSaving(false)
    }
  }

  if(loading){
    return (
      <section className="availability-center">
        <div className="availability-loading">
          <span className="availability-spinner"/>
          <strong>
            {t('proAvailability.loading')}
          </strong>
        </div>
      </section>
    )
  }

  return (
    <section className="availability-center">

      <header className="availability-hero">

        <div>
          <span className="availability-eyebrow">
            MELEO PROFESSIONAL · AVAILABILITY
          </span>

          <h1>
            {t('proAvailability.hero.title')}
          </h1>

          <p>
            {t('proAvailability.hero.text')}
          </p>
        </div>

        <div className="availability-hero-stats">

          <div>
            <strong>{activeDays}</strong>
            <span>{t('proAvailability.stats.activeDays')}</span>
          </div>

          <div>
            <strong>{weeklySlotCount}</strong>
            <span>{t('proAvailability.stats.slotsWeek')}</span>
          </div>

          <div>
            <strong>{exceptions.length}</strong>
            <span>{t('proAvailability.stats.exceptions')}</span>
          </div>

        </div>

      </header>

      {error&&(
        <div className="availability-error">
          {error}
        </div>
      )}

      <div className="availability-workspace">

        <div className="availability-main">

          <div className="availability-section-head">

            <div>
              <span>{t('proAvailability.weekly.kicker')}</span>
              <h2>
                {t('proAvailability.weekly.title')}
              </h2>
            </div>

            <button
              type="button"
              className="availability-secondary-action"
              onClick={copyDayToWeekdays}
            >
              {t('proAvailability.weekly.copyWeekdays')}
            </button>

          </div>

          <div className="availability-week">

            {DAYS.map(item=>{
              const slots=
                weekly[item.day]||[]

              const active=
                slots.length>0

              return (
                <button
                  type="button"
                  key={item.day}
                  className={[
                    'availability-day',
                    selectedDay===item.day
                      ? 'selected'
                      : '',
                    active
                      ? 'active'
                      : ''
                  ].filter(Boolean).join(' ')}
                  onClick={()=>
                    setSelectedDay(item.day)
                  }
                >

                  <span>
                    {item.short}
                  </span>

                  <strong>
                    {active
                      ? `${slots.length} ${t('proAvailability.hours')}`
                      : t('proAvailability.closed')}
                  </strong>

                </button>
              )
            })}

          </div>

          <div className="availability-day-editor">

            <div className="availability-day-title">

              <div>
                <span>
                  {DAYS.find(
                    item=>item.day===selectedDay
                  )?.label}
                </span>

                <h3>
                  {t('proAvailability.day.title')}
                </h3>
              </div>

              <label className="availability-day-toggle">
                <input
                  type="checkbox"
                  checked={selectedSlots.length>0}
                  onChange={e=>
                    setDayEnabled(
                      selectedDay,
                      e.target.checked
                    )
                  }
                />
                <span>
                  {t('proAvailability.day.active')}
                </span>
              </label>

            </div>

            {selectedSlots.length===0 ? (

              <div className="availability-closed-day">

                <strong>
                  {t('proAvailability.day.closedTitle')}
                </strong>

                <p>
                  {t('proAvailability.day.closedText')}
                </p>

                <button
                  type="button"
                  className="availability-primary-small"
                  onClick={()=>
                    setDayEnabled(
                      selectedDay,
                      true
                    )
                  }
                >
                  {t('proAvailability.day.enable')}
                </button>

              </div>

            ) : (

              <>
                <div className="availability-time-grid">

                  {SLOT_OPTIONS.map(time=>(
                    <button
                      type="button"
                      key={time}
                      className={[
                        'availability-time',
                        selectedSlots.includes(time)
                          ? 'selected'
                          : ''
                      ].filter(Boolean).join(' ')}
                      onClick={()=>
                        toggleTime(
                          selectedDay,
                          time
                        )
                      }
                    >
                      {time}
                    </button>
                  ))}

                </div>

                <div className="availability-editor-foot">

                  <span>
                    {selectedSlots.length}
                    {' '}
                    {t('proAvailability.day.selectedSlots')}
                  </span>

                  <button
                    type="button"
                    onClick={clearSelectedDay}
                  >
                    {t('proAvailability.day.clear')}
                  </button>

                </div>
              </>
            )}

          </div>


          <div className="availability-exceptions">

            <div className="availability-section-head">

              <div>
                <span>{t('proAvailability.exceptions.kicker')}</span>

                <h2>
                  {t('proAvailability.exceptions.title')}
                </h2>
              </div>

            </div>

            <div className="availability-exception-form">

              <label>
                <span>{t('proAvailability.exceptions.date')}</span>

                <input
                  type="date"
                  min={new Date().toISOString().slice(0,10)}
                  value={exceptionDate}
                  onChange={e=>
                    setExceptionDate(
                      e.target.value
                    )
                  }
                />
              </label>

              <label className="availability-exception-switch">
                <input
                  type="checkbox"
                  checked={exceptionAvailable}
                  onChange={e=>{
                    setExceptionAvailable(
                      e.target.checked
                    )

                    if(!e.target.checked){
                      setExceptionSlots([])
                    }
                  }}
                />

                <span>
                  {t('proAvailability.exceptions.specialSchedule')}
                </span>
              </label>

              <label className="availability-exception-note">
                <span>{t('proAvailability.exceptions.note')}</span>

                <input
                  value={exceptionNote}
                  onChange={e=>
                    setExceptionNote(
                      e.target.value
                    )
                  }
                  placeholder={t('proAvailability.exceptions.notePlaceholder')}
                />
              </label>

            </div>

            {exceptionAvailable&&(
              <div className="availability-exception-slots">

                <span>
                  {t('proAvailability.exceptions.availableHours')}
                </span>

                <div className="availability-time-grid compact">

                  {SLOT_OPTIONS.map(time=>(
                    <button
                      type="button"
                      key={time}
                      className={[
                        'availability-time',
                        exceptionSlots.includes(time)
                          ? 'selected'
                          : ''
                      ].filter(Boolean).join(' ')}
                      onClick={()=>
                        toggleExceptionSlot(time)
                      }
                    >
                      {time}
                    </button>
                  ))}

                </div>

              </div>
            )}

            <button
              type="button"
              className="availability-add-exception"
              onClick={addException}
            >
              {t('proAvailability.exceptions.add')}
            </button>

            {exceptions.length>0&&(
              <div className="availability-exception-list">

                {exceptions.map(item=>(
                  <article
                    key={item.date}
                    className="availability-exception-card"
                  >

                    <div>

                      <strong>
                        {formatDate(item.date,i18n.resolvedLanguage==='en'?'en-GB':'el-GR')}
                      </strong>

                      <span
                        className={
                          item.available
                            ? 'available'
                            : 'closed'
                        }
                      >
                        {item.available
                          ? t('proAvailability.exceptions.specialScheduleShort')
                          : t('proAvailability.exceptions.unavailable')}
                      </span>

                    </div>

                    {item.available&&(
                      <p>
                        {item.slots.join(' · ')}
                      </p>
                    )}

                    {item.note&&(
                      <small>
                        {item.note}
                      </small>
                    )}

                    <button
                      type="button"
                      aria-label={t('proAvailability.exceptions.delete')}
                      onClick={()=>
                        removeException(
                          item.date
                        )
                      }
                    >
                      ×
                    </button>

                  </article>
                ))}

              </div>
            )}

          </div>

        </div>


        <aside className="availability-summary">

          <span className="availability-summary-label">
            {t('proAvailability.summary.kicker')}
          </span>

          <h3>
            {t('proAvailability.summary.title')}
          </h3>

          <div className="availability-summary-week">

            {DAYS.map(item=>{
              const slots=
                weekly[item.day]||[]

              return (
                <div key={item.day}>

                  <strong>
                    {item.short}
                  </strong>

                  <span>
                    {slots.length
                      ? `${slots.length} ${t('proAvailability.summary.available')}`
                      : t('proAvailability.closed')}
                  </span>

                </div>
              )
            })}

          </div>

          <div className="availability-info-card">

            <span className="availability-info-icon">
              ✓
            </span>

            <div>
              <strong>
                {t('proAvailability.summary.realAvailabilityTitle')}
              </strong>

              <p>
                {t('proAvailability.summary.realAvailabilityText')}
              </p>
            </div>

          </div>

          <div className="availability-info-card">

            <span className="availability-info-icon">
              ↻
            </span>

            <div>
              <strong>
                {t('proAvailability.summary.doubleBookingTitle')}
              </strong>

              <p>
                {t('proAvailability.summary.doubleBookingText')}
              </p>
            </div>

          </div>

          <button
            type="button"
            className="availability-save"
            disabled={saving}
            onClick={save}
          >
            {saving
              ? t('proAvailability.save.saving')
              : t('proAvailability.save.button')}
          </button>

          <small className="availability-save-note">
            {t('proAvailability.save.note')}
          </small>

        </aside>

      </div>

    </section>
  )
}