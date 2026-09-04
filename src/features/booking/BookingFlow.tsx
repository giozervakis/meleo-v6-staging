import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'

import { api } from '../../lib/api'
import './booking-rc3d.css'

type AvailabilityResponse = {
  professionalId:string
  date:string
  dayOfWeek?:number
  slots:string[]
  occupied?:string[]
  source?:string
}

function tomorrow(){
  const d=new Date()
  d.setDate(d.getDate()+1)

  const year=d.getFullYear()
  const month=String(d.getMonth()+1).padStart(2,'0')
  const day=String(d.getDate()).padStart(2,'0')

  return `${year}-${month}-${day}`
}

function today(){
  const d=new Date()

  const year=d.getFullYear()
  const month=String(d.getMonth()+1).padStart(2,'0')
  const day=String(d.getDate()).padStart(2,'0')

  return `${year}-${month}-${day}`
}

function BookingFlow({
  p,
  seed,
  user,
  token,
  setView,
  setToast,
  Empty,
  priceLabel,
  MiniCard
}:any){
  const {t,i18n}=useTranslation()
  const stepHeadingRef=useRef<HTMLHeadingElement>(null)
  const statusRef=useRef<HTMLDivElement>(null)

  const availableServices =
    Array.isArray(p?.services) &&
    p.services.length > 0
      ? p.services
      : [t('booking.defaultService')]

  const [step,setStep]=
    useState(1)

  const [contactConsent,setContactConsent]=
    useState(false)

  const addressRef=
    useRef<HTMLInputElement>(null)

  const consentRef=
    useRef<HTMLInputElement>(null)

  const [validationError,setValidationError]=
    useState<'address'|'consent'|''>('')

  const [form,setForm]=
    useState({
      service:
        seed?.service &&
        availableServices.includes(seed.service)
          ? seed.service
          : availableServices[0],
      date:tomorrow(),
      time:'',
      address:seed?.address||'',
      notes:'',
      repeat:seed?.repeat||'once'
    })

  const [busy,setBusy]=
    useState(false)

  const [slots,setSlots]=
    useState<string[]>([])

  const [occupied,setOccupied]=
    useState<string[]>([])

  const [slotsLoading,setSlotsLoading]=
    useState(false)

  const [slotsError,setSlotsError]=
    useState('')

  const [availabilitySource,setAvailabilitySource]=
    useState('')

  const loadAvailability=
    useCallback(
      async(
        date:string,
        preserveTime=true
      )=>{
        if(!p?.id || !date){
          setSlots([])
          return []
        }

        setSlotsLoading(true)
        setSlotsError('')

        try{
          const data=
            await api<AvailabilityResponse>(
              `/professionals/${encodeURIComponent(p.id)}/availability?date=${encodeURIComponent(date)}`,
              {},
              token
            )

          const nextSlots=
            Array.isArray(data?.slots)
              ? data.slots
                  .map(x=>String(x||'').trim())
                  .filter(Boolean)
              : []

          const nextOccupied=
            Array.isArray(data?.occupied)
              ? data.occupied
              : []

          setSlots(nextSlots)
          setOccupied(nextOccupied)
          setAvailabilitySource(
            String(data?.source||'')
          )

          setForm(current=>{

            const keepCurrent=
              preserveTime &&
              nextSlots.includes(
                current.time
              )

            return {
              ...current,
              time:
                keepCurrent
                  ? current.time
                  : (
                      nextSlots[0]||''
                    )
            }
          })

          return nextSlots

        }catch(e:any){
          setSlots([])
          setOccupied([])
          setAvailabilitySource('')
          setForm(current=>({
            ...current,
            time:''
          }))

          setSlotsError(
            e?.message ||
            t('booking.availability.errorFallback')
          )

          return []

        }finally{
          setSlotsLoading(false)
        }
      },
      [p?.id,token,t]
    )

  useEffect(
    ()=>{
      loadAvailability(
        form.date,
        true
      )
    },
    [
      form.date,
      loadAvailability
    ]
  )

  const selectedDateLabel=
    useMemo(
      ()=>{
        if(!form.date){
          return ''
        }

        try{
          return new Intl.DateTimeFormat(
            i18n.language==='en'?'en-GB':'el-GR',
            {
              weekday:'long',
              day:'numeric',
              month:'long'
            }
          ).format(
            new Date(
              `${form.date}T12:00:00`
            )
          )
        }catch{
          return form.date
        }
      },
      [form.date,i18n.language]
    )

  useEffect(()=>{
    if(step===1 || step===2){
      requestAnimationFrame(
        ()=>stepHeadingRef.current?.focus()
      )
    }else if(step===3){
      requestAnimationFrame(()=>{
        const target=statusRef.current

        if(!target){
          return
        }

        target.scrollIntoView({
          behavior:'smooth',
          block:'start'
        })

        target.focus({
          preventScroll:true
        })
      })
    }
  },[step])

  async function submit(){

    if(!form.time){
      setToast(
        t('booking.validation.time')
      )
      return
    }

    if(!form.address.trim()){
      setValidationError('address')

      setToast(
        t('booking.validation.address')
      )

      requestAnimationFrame(
        ()=>addressRef.current?.focus()
      )

      return
    }

    if(!contactConsent){
      setValidationError('consent')

      setToast(
        t('booking.validation.contactConsent')
      )

      requestAnimationFrame(
        ()=>consentRef.current?.focus()
      )

      return
    }

    setValidationError('')
    setBusy(true)

    try{
      await api(
        '/bookings',
        {
          method:'POST',
          body:JSON.stringify({
            professionalId:p.id,
            ...form,
            contactConsent
          })
        },
        token
      )

      setStep(3)

      setToast(
        t('booking.toast.success')
      )

    }catch(e:any){

      const message=
        e?.message ||
        t('booking.toast.failure')

      setToast(message)

      /*
       * Backend is authoritative.
       * A 409 is exposed by api() as an Error message,
       * so refresh availability after any failed booking.
       * This safely handles stale/conflicting slots without
       * weakening server-side validation.
       */
      await loadAvailability(
        form.date,
        false
      )

    }finally{
      setBusy(false)
    }
  }

  if(!['patient','professional'].includes(user?.role)){
    return <section className="page rc3d-booking-page"><div className="container narrow">
      <Empty title={t('booking.auth.title')} text={t('booking.auth.text')}/>
      <button className="btn btn-dark wide" onClick={()=>setView('home')}>{t('booking.actions.back')}</button>
    </div></section>
  }

  return <section className="page rc3d-booking-page">
    <div className="container booking-layout">
      <div className="booking-flow">
        <button className="back rc3d-booking-back" onClick={()=>setView('profile')}>← {p.name}</button>
        <div className="booking-progress" aria-label={t('booking.progress.label')}>
          <span className={step>=1?'on':''} aria-current={step===1?'step':undefined}>1</span><i aria-hidden="true"/>
          <span className={step>=2?'on':''} aria-current={step===2?'step':undefined}>2</span><i aria-hidden="true"/>
          <span className={step>=3?'on':''} aria-current={step===3?'step':undefined}>3</span>
        </div>

        {step===1&&<div className="form-card rc3d-booking-card">
          <div className="eyebrow">{t('booking.step1.eyebrow')}</div>
          <h1 ref={stepHeadingRef} tabIndex={-1}>{t('booking.step1.title')}</h1>
          <p className="booking-live-intro">{t('booking.step1.intro')}</p>
          <label>{t('booking.fields.service')}<select value={form.service} onChange={e=>setForm({...form,service:e.target.value})}>
            {availableServices.map((x:string)=><option key={x} value={x}>{x}</option>)}
          </select></label>
          <label>{t('booking.fields.date')}<input type="date" value={form.date} min={today()} onChange={e=>setForm(current=>({...current,date:e.target.value,time:''}))}/></label>
          <div className="booking-live-availability" aria-busy={slotsLoading}>
            <div className="booking-live-head"><div><span>{t('booking.availability.heading')}</span><strong>{selectedDateLabel}</strong></div>
              {!slotsLoading&&<small>{t('booking.availability.count',{count:slots.length})}</small>}
            </div>
            <div className="rc3d-booking-live-region" role="status" aria-live="polite" aria-atomic="true">
              {slotsLoading&&<div className="booking-slots-loading"><span aria-hidden="true"/>{t('booking.availability.loading')}</div>}
              {!slotsLoading&&slotsError&&<div className="booking-slots-error" role="alert"><strong>{t('booking.availability.errorTitle')}</strong><p>{slotsError}</p><button type="button" onClick={()=>loadAvailability(form.date,false)}>{t('booking.actions.retry')}</button></div>}
              {!slotsLoading&&!slotsError&&slots.length===0&&<div className="booking-no-slots"><span aria-hidden="true">○</span><div><strong>{t('booking.availability.emptyTitle')}</strong><p>{t('booking.availability.emptyText')}</p></div></div>}
            </div>
            {!slotsLoading&&!slotsError&&slots.length>0&&<div className="booking-slot-grid" role="group" aria-label={t('booking.availability.choose')}>
              {slots.map(time=><button type="button" key={time} className={form.time===time?'selected':''} aria-pressed={form.time===time} onClick={()=>setForm(current=>({...current,time}))}>{time}</button>)}
            </div>}
            {!slotsLoading&&availabilitySource&&<small className="booking-live-note">{t('booking.availability.liveNote')}</small>}
          </div>
          <label>{t('booking.fields.repeat')}<select value={form.repeat} onChange={e=>setForm({...form,repeat:e.target.value})}>
            <option value="once">{t('booking.repeat.once')}</option><option value="daily7">{t('booking.repeat.daily7')}</option><option value="twice7">{t('booking.repeat.twice7')}</option>
          </select></label>
          <button className="btn btn-dark wide" disabled={slotsLoading||!form.time} onClick={()=>setStep(2)}>{t('booking.actions.continue')} →</button>
        </div>}

        {step===2&&<div className="form-card rc3d-booking-card">
          <div className="eyebrow">{t('booking.step2.eyebrow')}</div>
          <h1 ref={stepHeadingRef} tabIndex={-1}>{t('booking.step2.title')}</h1>
          <div className="booking-selected-slot"><span>{t('booking.selected.heading')}</span><strong>{selectedDateLabel} · {form.time}</strong><button type="button" onClick={()=>setStep(1)}>{t('booking.actions.change')}</button></div>
          <label>
            {t('booking.fields.address')}
            <input
              ref={addressRef}
              autoComplete="street-address"
              placeholder={t('booking.fields.addressPlaceholder')}
              value={form.address}
              aria-required="true"
              aria-invalid={validationError==='address'}
              aria-describedby={
                validationError==='address'
                  ? 'booking-address-error'
                  : undefined
              }
              onChange={e=>{
                setForm({
                  ...form,
                  address:e.target.value
                })

                if(validationError==='address'){
                  setValidationError('')
                }
              }}
            />
          </label>

          {validationError==='address'&&
            <div
              id="booking-address-error"
              className="error"
              role="alert"
            >
              {t('booking.validation.address')}
            </div>
          }
          <label>{t('booking.fields.notes')}<textarea placeholder={t('booking.fields.notesPlaceholder')} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
          <div className="summary-box" aria-label={t('booking.summary.label')}>
            <div><span>{t('booking.summary.service')}</span><b>{form.service}</b></div>
            <div><span>{t('booking.summary.date')}</span><b>{form.date} · {form.time}</b></div>
            <div><span>{t('booking.summary.baseCost')}</span><b>{priceLabel(p,true)}</b></div>
            <div><span>{t('booking.summary.finalCost')}</span><b>{t('booking.summary.byAgreement')}</b></div>
          </div>
          <label className="consent-row booking-consent">
            <input
              ref={consentRef}
              type="checkbox"
              checked={contactConsent}
              aria-invalid={validationError==='consent'}
              aria-describedby={
                validationError==='consent'
                  ? 'booking-consent-error'
                  : undefined
              }
              onChange={e=>{
                setContactConsent(
                  e.target.checked
                )

                if(validationError==='consent'){
                  setValidationError('')
                }
              }}
            />
            <span>{t('booking.consent')}</span>
          </label>

          {validationError==='consent'&&
            <div
              id="booking-consent-error"
              className="error"
              role="alert"
            >
              {t('booking.validation.contactConsent')}
            </div>
          }

          <button
            className="btn btn-dark wide"
            disabled={busy}
            aria-busy={busy}
            onClick={submit}
          >
            {busy
              ? t('booking.actions.submitting')
              : t('booking.actions.submit')}
          </button>
          <button className="text-btn" onClick={()=>setStep(1)}>← {t('booking.actions.changeTime')}</button>
        </div>}

        {step===3&&<div className="success-card rc3d-booking-success" ref={statusRef} tabIndex={-1} role="status" aria-live="polite">
          <div className="success-icon" aria-hidden="true">✓</div><div className="eyebrow">{t('booking.success.eyebrow')}</div>
          <h1>{t('booking.success.title')}</h1><p>{t('booking.success.text')}</p>
          <button className="btn btn-dark" onClick={()=>setView('patient-dashboard')}>{t('booking.actions.myBookings')}</button>
        </div>}
      </div>
      <aside className="booking-side"><MiniCard p={p}/><hr/><p><b>{t('booking.side.title')}</b></p><ol>
        <li>{t('booking.side.one')}</li><li>{t('booking.side.two')}</li><li>{t('booking.side.three')}</li><li>{t('booking.side.four')}</li>
      </ol></aside>
    </div>
  </section>
}

export default BookingFlow
