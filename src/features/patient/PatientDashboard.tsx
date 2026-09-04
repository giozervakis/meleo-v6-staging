import React, {
  useEffect,
  useState
} from 'react'


import {useTranslation} from 'react-i18next'
import { api } from '../../lib/api'
import PatientMessages from './messages/PatientMessages'
import './patient-rc3d.css'

import type {
  Booking
} from '../../domain/types'

function Empty({title,text}:any){
  return (
    <div className="empty">
      <div>◇</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  )
}
function VerifyEmailBanner({user,token,cfg,setToast}:any){
  const {t}=useTranslation()
  const [busy,setBusy]=useState(false)

  if(
    !user ||
    user.emailVerified ||
    cfg?.demoAuth
  ){
    return null
  }

  async function resend(){

    setBusy(true)

    try{

      const r=await api(
        '/auth/resend-verification',
        {
          method:'POST'
        },
        token
      )

      setToast(
        r.message||
        t('patient.verifyEmail.sent')
      )

    }
    catch(e:any){

      setToast(e.message)

    }
    finally{

      setBusy(false)

    }
  }

  return (
    <div className="verify-email-banner" role="status" aria-live="polite">

      <div>
        <b>{t('patient.verifyEmail.title')}</b>

        <span>{t('patient.verifyEmail.text',{email:user.email})}</span>
      </div>

      <button
        onClick={resend}
        disabled={busy}
        aria-busy={busy}
      >
        {busy
          ? t('patient.verifyEmail.sending')
          : t('patient.verifyEmail.resend')
        }
      </button>

    </div>
  )
}

type PatientDashboardProps = {
  user:any
  token:string
  openPro:(p:any)=>void
  startBooking:(p:any,seed?:any)=>void
  cfg:any
  setView:(v:string)=>void
  setToast:(text:string)=>void

  IdentityAvatar:any
  CalendarActions:any
  ReviewComposer:any
  Conversation:any

  initials:(name:string)=>string
  statusLabel:(status:string)=>string
  repeatLabel:(repeat:string)=>string
  priceLabel:(p:any,compact?:boolean)=>string
  money:(value:number)=>string
}

function PatientDashboard({
  user,
  token,
  openPro,
  startBooking,
  cfg,
  setView,
  setToast,

  IdentityAvatar,
  CalendarActions,
  ReviewComposer,
  Conversation,

  initials,
  statusLabel,
  repeatLabel,
  priceLabel,
  money
}:PatientDashboardProps){
  const {t,i18n}=useTranslation()
	const [bookings,setBookings]=useState<Booking[]>([]);const [careTeam,setCareTeam]=useState<any[]>([]);const [open,setOpen]=useState<string>('');const [reply,setReply]=useState('');
 const [messageReadBusy,setMessageReadBusy]=useState<string>('')
 const [patientMessageUnreadByBooking,setPatientMessageUnreadByBooking]=useState<Record<string,number>>({})
 const [patientMessageUnreadTotal,setPatientMessageUnreadTotal]=useState(0)
 const [patientConversation,setPatientConversation]=useState<string>('')
 const [patientMessageDraft,setPatientMessageDraft]=useState('')
 const [patientMessageSending,setPatientMessageSending]=useState(false)
 const [patientSection,setPatientSection]=useState<'bookings'|'messages'>('bookings')
 const [recovery,setRecovery]=useState<Record<string,any[]>>({});const [recoveryBusy,setRecoveryBusy]=useState<string>('')
 async function refresh(){
  const scope=
    user?.role==='professional'
      ? '&scope=requested'
      : ''

  const [d,team]=await Promise.all([
    api('/bookings?limit=50'+scope,{},token),
    api('/care-team',{},token).catch(
      ()=>({items:[]})
    )
  ])

  setBookings(
    Array.isArray(d)
      ? d
      : d.items||[]
  )

  setCareTeam(
    team.items||[]
  )
}
 async function refreshPatientMessageUnread(){
  try{
    const d=await api(
      '/bookings/unread',
      {},
      token
    )

    const map:Record<string,number>={}

    for(const item of d.items||[]){
      map[item.bookingId]=Number(item.unread||0)
    }

    setPatientMessageUnreadByBooking(map)
    setPatientMessageUnreadTotal(
      Number(d.total||0)
    )
  }
  catch(e){
    console.error(
      'Patient unread messages load failed',
      e
    )
  }
}
useEffect(()=>{

  refresh()
  refreshPatientMessageUnread()

  const f=()=>{
    refresh()
    refreshPatientMessageUnread()
  }

  window.addEventListener(
    'meleo:live',
    f
  )

  window.addEventListener(
    'meleo:communication-refresh',
    f
  )

  window.addEventListener(
    'meleo:favorites-changed',
    f
  )

  return()=>{

    window.removeEventListener(
      'meleo:live',
      f
    )

    window.removeEventListener(
      'meleo:communication-refresh',
      f
    )

    window.removeEventListener(
      'meleo:favorites-changed',
      f
    )

  }

},[])
 async function loadRecovery(id:string){setRecoveryBusy(id);try{const d=await api('/bookings/'+id+'/recovery-candidates',{},token);setRecovery(x=>({...x,[id]:d.items||[]}))}catch(e:any){setToast(e.message)}finally{setRecoveryBusy('')}}
 async function cancel(id:string){await api('/bookings/'+id+'/status',{method:'PATCH',body:JSON.stringify({status:'cancelled'})},token);setOpen(id);await refresh();await loadRecovery(id)}
 async function recover(id:string,professionalId:string){setRecoveryBusy(id);try{await api('/bookings/'+id+'/recover',{method:'POST',body:JSON.stringify({professionalId})},token);setToast(t('patient.feedback.recoverySent'));setRecovery(x=>({...x,[id]:[]}));await refresh()}catch(e:any){setToast(e.message)}finally{setRecoveryBusy('')}}
 async function markConversationRead(id:string){
  if(messageReadBusy===id)return

  try{
    setMessageReadBusy(id)

    await api(
      '/bookings/'+id+'/messages/read',
      {
        method:'PATCH'
      },
      token
    )

    window.dispatchEvent(
      new CustomEvent('meleo:communication-refresh')
    )
  }
  catch(e){
    console.error(
      'Could not mark conversation as read',
      e
    )
  }
  finally{
    setMessageReadBusy('')
  }
}
async function openPatientConversation(id:string){

  setPatientConversation(id)

  try{

    await api(
      '/bookings/'+id+'/messages/read',
      {
        method:'PATCH'
      },
      token
    )

    await refreshPatientMessageUnread()

    window.dispatchEvent(
      new CustomEvent(
        'meleo:communication-refresh'
      )
    )

  }
  catch(e){

    console.error(
      'Patient conversation read failed',
      e
    )

  }
}
async function sendPatientInboxMessage(){

  const conversationId=
    patientConversation||
    activePatientConversation?.id

  if(
    !conversationId ||
    !patientMessageDraft.trim() ||
    patientMessageSending
  ){
    return
  }

  try{

    setPatientMessageSending(true)

    await api(
      '/bookings/'+conversationId+'/message',
      {
        method:'POST',
        body:JSON.stringify({
          text:patientMessageDraft.trim()
        })
      },
      token
    )

    setPatientMessageDraft('')

    await refresh()
    await refreshPatientMessageUnread()

    window.dispatchEvent(
      new CustomEvent(
        'meleo:communication-refresh'
      )
    )

  }
  catch(e:any){

    setToast(
      e.message||
      t('patient.feedback.messageSendFailed')
    )

  }
  finally{

    setPatientMessageSending(false)

  }
}
 async function sendReply(id:string){if(!reply.trim())return;await api('/bookings/'+id+'/message',{method:'POST',body:JSON.stringify({text:reply})},token);setReply('');refresh()}
 async function quoteDecision(id:string,decision:string){await api('/bookings/'+id+'/quote-decision',{method:'POST',body:JSON.stringify({decision})},token);refresh()}
 async function bookAgain(b:any){try{const d=await api('/professionals/'+b.professionalId);const p=d.professional||d;startBooking(p,{service:b.service,address:b.address,repeat:b.repeat||'once'});setToast(t('patient.feedback.bookAgainReady'))}catch(e:any){setToast(e.message)}}
const now = new Date()

function patientBookingDateTime(
  booking:any
){
  const rawDate =
    String(
      booking?.date||''
    ).trim()

  if(!rawDate){
    return null
  }

  const datePart =
    rawDate.match(/^\d{4}-\d{2}-\d{2}/)?.[0]
    ||
    rawDate.slice(0,10)

  if(!/^\d{4}-\d{2}-\d{2}$/.test(datePart)){
    return null
  }

  const rawTime =
    String(
      booking?.time||'00:00'
    ).trim()

  const timePart =
    /^\d{2}:\d{2}(:\d{2})?$/.test(rawTime)
      ? rawTime
      : '00:00'

  const value =
    new Date(
      `${datePart}T${timePart}`
    )

  return Number.isNaN(value.getTime())
    ? null
    : value
}

const patientMessageBookings=
  [...bookings]
    .filter(
      (b:any)=>
        (b.messages||[]).length>0 ||
        Number(
          patientMessageUnreadByBooking[b.id]||0
        )>0
    )
    .sort((a:any,b:any)=>{

      const am=
        (a.messages||[]).at(-1)

      const bm=
        (b.messages||[]).at(-1)

      return (
        new Date(
          bm?.createdAt||
          b.updatedAt||
          b.createdAt||
          0
        ).getTime()
        -
        new Date(
          am?.createdAt||
          a.updatedAt||
          a.createdAt||
          0
        ).getTime()
      )
    })


const activePatientConversation=
  patientMessageBookings.find(
    (b:any)=>
      b.id===patientConversation
  )
  ||
  patientMessageBookings[0]
  ||
  null
const upcomingBookings = bookings
  .filter((b:any)=>
    ['pending','clarification','quoted','accepted'].includes(b.status)
  )
  .sort((a:any,b:any)=>{
    const ad =
      patientBookingDateTime(a)?.getTime()
      ??
      Number.MAX_SAFE_INTEGER

    const bd =
      patientBookingDateTime(b)?.getTime()
      ??
      Number.MAX_SAFE_INTEGER

    return ad-bd
  })

const completedBookings = bookings.filter(
  (b:any)=>b.status==='completed'
)

const pendingBookings = bookings.filter(
  (b:any)=>b.status==='pending'
)

const clarificationBookings = bookings.filter(
  (b:any)=>b.status==='clarification'
)

const quotedBookings = bookings.filter(
  (b:any)=>b.status==='quoted'
)

const acceptedBookings = bookings.filter(
  (b:any)=>b.status==='accepted'
)

const cancelledBookings = bookings.filter(
  (b:any)=>b.status==='cancelled'
)

const pendingReviews = completedBookings.filter(
  (b:any)=>!b.reviewed
)

const nextBooking =
  upcomingBookings.find((b:any)=>{
    const when =
      patientBookingDateTime(b)

    return (
      when &&
      when.getTime() >= now.getTime()
    )
  }) || upcomingBookings[0] || null

const activeRequests =
  pendingBookings.length +
  clarificationBookings.length +
  quotedBookings.length +
  acceptedBookings.length

const needsAttention =
  clarificationBookings.length +
  quotedBookings.length +
  pendingReviews.length

const uniqueProfessionals =
  new Set(
    completedBookings
      .map((b:any)=>b.professionalId)
      .filter(Boolean)
  ).size

const careActivity = [
  ...bookings
]
  .sort((a:any,b:any)=>{
    const ad =
      patientBookingDateTime(a)?.getTime()
      ??
      0

    const bd =
      patientBookingDateTime(b)?.getTime()
      ??
      0

    return bd-ad
  })
  .slice(0,5)

const patientJourneyLevel =
  completedBookings.length>=10
    ? t('patient.hero.journey.regular')
    : completedBookings.length>=5
      ? t('patient.hero.journey.active')
      : completedBookings.length>=1
        ? t('patient.hero.journey.started')
        : t('patient.hero.journey.gettingStarted')

const careContinuity =
  completedBookings.length
    ? Math.min(
        100,
        Math.round(
          (
            Math.min(completedBookings.length,10)*6 +
            Math.min(careTeam.length,5)*8
          )
        )
      )
    : 0

const attentionMessage =
  quotedBookings.length>0
    ? t('patient.attention.quotes',{count:quotedBookings.length})
    : clarificationBookings.length>0
      ? t('patient.attention.clarifications',{count:clarificationBookings.length})
      : pendingReviews.length>0
        ? t('patient.attention.reviews',{count:pendingReviews.length})
        : activeRequests>0
          ? t('patient.attention.active')
          : completedBookings.length>0
            ? t('patient.attention.updated')
            : t('patient.attention.start')
return (
  <section className="page patient-care-page rc3d-patient-page">
    <div className="container">

      <VerifyEmailBanner
        user={user}
        token={token}
        cfg={cfg}
        setToast={setToast}
      />

      <div className="patient-care-hero" aria-labelledby="rc3d-patient-hero-title">

        <div className="patient-care-hero-copy">
          <span className="patient-care-kicker">{t('patient.hero.kicker')}</span>

          <h1 id="rc3d-patient-hero-title">{t('patient.hero.greeting',{name:user.name.split(' ')[0]})}</h1>

          <p>{t('patient.hero.intro')}</p>

          <div className="patient-care-hero-status" role="status" aria-live="polite">
            <span>{patientJourneyLevel}</span>

            {needsAttention>0
              ? <b>{t('patient.hero.attention',{count:needsAttention})}</b>
              : <b>{t('patient.hero.upToDate')}</b>
            }
          </div>
        </div>

        <div className="patient-care-identity" aria-label={t('patient.hero.memberAria')}>
          <IdentityAvatar
            name={user.name}
            photoUrl={user.profilePhotoUrl}
            avatarKey={user.avatarKey}
            size="xl"
          />

          <div>
            <b>{user.name}</b>
            <small>{user.email}</small>
            <span>{t('patient.hero.member')}</span>
          </div>
        </div>

      </div>


      <div className="patient-care-metrics" role="list" aria-label={t('patient.metrics.aria')}>

        <div className="patient-care-metric" role="listitem">
          <span>💬</span>
          <strong>{activeRequests}</strong>
          <b>{t('patient.metrics.active')}</b>
          <small>{t('patient.metrics.inProgress')}</small>
        </div>

        <div className="patient-care-metric" role="listitem">
          <span>✓</span>
          <strong>{completedBookings.length}</strong>
          <b>{t('patient.metrics.completed')}</b>
          <small>{t('patient.metrics.visits')}</small>
        </div>

        <div className="patient-care-metric" role="listitem">
          <span>♡</span>
          <strong>{careTeam.length}</strong>
          <b>{t('patient.metrics.team')}</b>
          <small>{t('patient.metrics.favoritePros')}</small>
        </div>

        <div className="patient-care-metric" role="listitem">
          <span>★</span>
          <strong>{pendingReviews.length}</strong>
          <b>{t('patient.metrics.reviews')}</b>
          <small>{t('patient.metrics.pending')}</small>
        </div>

        <div className="patient-care-metric" role="listitem">
          <span>◎</span>
          <strong>{uniqueProfessionals}</strong>
          <b>{t('patient.metrics.professionals')}</b>
          <small>{t('patient.metrics.servedBy')}</small>
        </div>

        <div className="patient-care-metric" role="listitem">
          <span>↻</span>
          <strong>{careContinuity}%</strong>
          <b>{t('patient.metrics.continuity')}</b>
          <small>{t('patient.metrics.continuityHelp')}</small>
        </div>

      </div>


      <div
          className={
            'patient-care-grid '+
            (patientSection==='messages'
              ? 'messages-grid-mode'
              : '')
          }
        >

        <div
          className={
            'patient-care-main '+
            (patientSection==='messages'
              ? 'messages-mode'
              : 'bookings-mode')
          }
        >


          <section className="patient-command-panel next-care-panel" aria-labelledby="rc3d-next-care-title" aria-live="polite">

            <div className="patient-panel-head">
              <div>
                <small>{t('patient.nextCare.kicker')}</small>
                <h3 id="rc3d-next-care-title">{t('patient.nextCare.title')}</h3>
              </div>

              {nextBooking&&
                <span className={`status premium-status ${nextBooking.status}`}>
                  {statusLabel(nextBooking.status)}
                </span>
              }
            </div>

            {nextBooking
              ? <div className="next-care-content">

                  <div className="next-care-date">
                    <strong>
                      {nextBooking.date.slice(8,10)}
                    </strong>

                    <span>
                      {new Date(
                        `${nextBooking.date}T00:00:00`
                      ).toLocaleDateString(
                        i18n.language==='en'?'en-US':'el-GR',
                        {month:'short'}
                      )}
                    </span>

                    <small>
                      {nextBooking.time}
                    </small>
                  </div>

                  <div className="next-care-info">
                    <small>{t('patient.nextCare.professional')}</small>

                    <h4>
                      {nextBooking.professionalName}
                    </h4>

                    <b>
                      {nextBooking.service}
                    </b>

                    {nextBooking.address&&
                      <span>
                        ⌖ {nextBooking.address}
                      </span>
                    }

                    <div className="next-care-actions">

                      <button
  className="btn btn-dark"
  onClick={()=>{
    setOpen(nextBooking.id)
    markConversationRead(nextBooking.id)
  }}
>
  {t('patient.nextCare.viewRequest')}
</button>

                      {nextBooking.professionalPhone&&
                        <a
                          className="btn btn-outline"
                          href={`tel:${nextBooking.professionalPhone}`}
                        >
                          ☎ {t('patient.nextCare.contact')}
                        </a>
                      }

                    </div>
                  </div>

                </div>

              : <div className="next-care-empty">

                  <div>✦</div>

                  <div>
                    <h4>
                      {t('patient.nextCare.emptyTitle')}
                    </h4>

                    <p>{t('patient.nextCare.emptyText')}</p>

                    <div>
                      <button
                        className="btn btn-dark"
                        onClick={()=>setView('search')}
                      >
                        {t('patient.nextCare.searchProfessional')}
                      </button>

                      <button
                        className="btn btn-outline"
                        onClick={()=>setView('smart')}
                      >
                        Smart Request
                      </button>
                    </div>
                  </div>

                </div>
            }

          </section>


          {needsAttention>0&&
            <section className="patient-attention-panel" role="status" aria-live="polite" aria-labelledby="rc3d-attention-title">

              <div className="patient-attention-icon">
                !
              </div>

              <div>
                <small>{t('patient.attention.kicker')}</small>
                <h3 id="rc3d-attention-title">{attentionMessage}</h3>

                <p>{t('patient.attention.help')}</p>
              </div>

            </section>
          }


          {careTeam.length>0&&
            <section className="patient-command-panel" aria-labelledby="rc3d-care-team-title">

              <div className="patient-panel-head">
                <div>
                  <small>{t('patient.careTeam.kicker')}</small>
                  <h3 id="rc3d-care-team-title">{t('patient.careTeam.title')}</h3>
                </div>

                <span>
                  {t('patient.careTeam.count',{count:careTeam.length})}
                </span>
              </div>

              <p className="patient-panel-intro">
                {t('patient.careTeam.intro')}
              </p>

              <div className="patient-care-team-grid" role="list">

                {careTeam.slice(0,6).map((p:any)=>
                  <article
                    className="patient-care-team-card"
                    role="listitem"
                    key={p.id}
                  >

                    <div className="patient-care-team-top">

                      <IdentityAvatar
                        name={p.name}
                        photoUrl={p.profilePhotoUrl}
                        avatarKey={p.avatarKey}
                        size="md"
                      />

                      <div>
                        <b>{p.name}</b>
                        <span>
                          {p.title}
                          {p.city ? ` · ${p.city}` : ''}
                        </span>
                      </div>

                      {p.trust?.eligible
                        ? <strong className="patient-care-trust" aria-label={t('patient.careTeam.trustAria',{score:p.trust.score})}>
                            {p.trust.score}
                          </strong>
                        : <strong className="patient-care-trust new" aria-label={t('patient.careTeam.newProfessional')}>
                            NEW
                          </strong>
                      }

                    </div>

                    <div className="patient-care-team-meta">

                      <span>
                        ★ {p.rating||t('patient.careTeam.newRating')}
                      </span>

                      {p.lastCompleted&&
                        <span>
                          {t('patient.careTeam.lastVisit')} ·{' '}
                          {new Date(
                            p.lastCompleted.date
                          ).toLocaleDateString(i18n.language==='en'?'en-US':'el-GR')}
                        </span>
                      }

                    </div>

                    <div className="patient-care-team-actions">

                      <button
                        className="btn btn-dark"
                        onClick={()=>
                          startBooking(
                            p,
                            p.lastCompleted
                              ? {
                                  service:p.lastCompleted.service,
                                  address:p.lastCompleted.address,
                                  repeat:'once'
                                }
                              : null
                          )
                        }
                      >
                        {t('patient.careTeam.requestAgain')}
                      </button>

                      <button
                        className="btn btn-outline"
                        onClick={()=>openPro(p)}
                      >
                        {t('patient.careTeam.profile')}
                      </button>

                    </div>

                  </article>
                )}

              </div>

            </section>
          }


          <section
            className={
              'patient-command-panel patient-section-shell '+
              (patientSection==='messages'
                ? 'messages-workspace-shell'
                : 'bookings-workspace-shell')
            }
          >

<div className="patient-section-tabs" role="tablist" aria-label={t('patient.bookings.tablistAria')} aria-orientation="horizontal">

  <button
    role="tab"
    aria-selected={patientSection==='bookings'}
    aria-controls="rc3d-patient-bookings-panel"
    id="rc3d-patient-bookings-tab"
    className={
      patientSection==='bookings'
        ? 'active'
        : ''
    }
    onClick={()=>
      setPatientSection('bookings')
    }
  >
    <span>📋</span>

    {t('patient.tabs.bookings')}
  </button>


  <button
    role="tab"
    aria-selected={patientSection==='messages'}
    aria-controls="rc3d-patient-messages-panel"
    id="rc3d-patient-messages-tab"
    className={
      patientSection==='messages'
        ? 'active'
        : ''
    }
    onClick={()=>
      setPatientSection('messages')
    }
  >
    <span>💬</span>

    {t('patient.tabs.messages')}

    {patientMessageUnreadTotal>0&&
      <b>
        {patientMessageUnreadTotal>99
          ? '99+'
          : patientMessageUnreadTotal
        }
      </b>
    }

  </button>

</div>

{patientSection==='bookings'&&
  <div id="rc3d-patient-bookings-panel" role="tabpanel" aria-labelledby="rc3d-patient-bookings-tab">
            <div className="patient-panel-head">
              <div>
                <small>{t('patient.bookings.kicker')}</small>
                <h3>{t('patient.bookings.title')}</h3>
              </div>

              <span>
                {t('patient.bookings.count',{count:bookings.length})}
              </span>
            </div>

            {bookings.length
              ? bookings.map(b=>

                  <div
                    className="patient-request-wrap"
                    key={b.id}
                  >

                    <div
                      className={`booking-row booking-card-premium clickable booking-${b.status}`}
role="button"
tabIndex={0}
aria-expanded={open===b.id}
onKeyDown={e=>{
  if(e.key==='Enter'||e.key===' '){
    e.preventDefault()
    const next=open===b.id?'':b.id
    setOpen(next)
    if(next){markConversationRead(next)}
  }
}}
onClick={()=>{
  const next=
    open===b.id
      ? ''
      : b.id

  setOpen(next)

  if(next){
    markConversationRead(next)
  }
}}
                    >

                      <div className="booking-accent"/>

                      <div className="date-tile premium-date">
                        <b>{b.date.slice(8,10)}</b>
                        <span>{b.date.slice(5,7)}</span>
                      </div>

                      <div className="booking-info premium-booking-info">

                        <b className="booking-service">
                          {b.service}
                        </b>

                        <span className="booking-professional">
                          {b.professionalName}
                        </span>

                        <div className="booking-meta">
                          <span>◷ {b.time}</span>

                          {b.address&&
                            <span>
                              ⌖ {b.address}
                            </span>
                          }
                        </div>

                      </div>

                      <div className="booking-card-right">

                        <b className="booking-price">
                          {b.agreedPrice
                            ? `${b.agreedPrice}€`
                            : b.proposedPrice
                              ? `${b.proposedPrice}€`
                              : b.price
                                ? `${t('patient.bookings.from')} ${b.price}€`
                                : '—'
                          }
                        </b>

                        <span
                          className={
                            'status premium-status '+
                            b.status
                          }
                        >
                          {statusLabel(b.status)}
                        </span>

                        <button
                          className="small-action premium-details-btn"
                          aria-expanded={open===b.id}
onClick={e=>{
  e.stopPropagation()

  const next=
    open===b.id
      ? ''
      : b.id

  setOpen(next)

  if(next){
    markConversationRead(next)
  }
}}
                        >
                          {open===b.id
                            ? t('patient.bookings.close')
                            : t('patient.bookings.details')
                          }

                          <span className="details-arrow">
                            {open===b.id
                              ? '↑'
                              : '›'
                            }
                          </span>
                        </button>

                      </div>
                    </div>


                    {open===b.id&&
                      <div className="patient-request-detail">

                        <div className="request-detail-grid">

                          <div>
                            <small>{t('patient.bookings.professional')}</small>
                            <b>{b.professionalName}</b>
                            <span>{b.professionalEmail}</span>
                            <span>{b.professionalPhone}</span>
                          </div>

                          <div>
                            <small>{t('patient.bookings.request')}</small>
                            <b>{b.service}</b>
                            <span>
                              {b.date} · {b.time}
                            </span>
                            <span>
                              {repeatLabel(b.repeat)}
                            </span>
                          </div>

                        </div>

                        {b.notes&&
                          <div className="request-description">
                            <small>{t('patient.bookings.needDescription')}</small>
                            <p>{b.notes}</p>
                          </div>
                        }

                        <Conversation
                          messages={b.messages||[]}
                        />

                        <CalendarActions
                          booking={b}
                        />

                        {b.status==='quoted'&&
                          <div className="quote-box">

                            <span>
                              {t('patient.bookingActions.quoteTitle')}
                            </span>

                            <strong>
                              {b.proposedPrice}€
                            </strong>

                            <small>
                              {t('patient.bookingActions.quoteHelp')}
                            </small>

                            <div>

                              <button
                                className="accept"
                                onClick={()=>
                                  quoteDecision(
                                    b.id,
                                    'accept'
                                  )
                                }
                              >
                                {t('patient.bookingActions.acceptQuote')}
                              </button>

                              <button
                                className="small-action"
                                onClick={()=>
                                  quoteDecision(
                                    b.id,
                                    'reject'
                                  )
                                }
                              >
                                {t('patient.bookingActions.rejectQuote')}
                              </button>

                            </div>
                          </div>
                        }

                        {[
                          'pending',
                          'clarification',
                          'quoted'
                        ].includes(b.status)&&
                          <div className="reply-box">

                            <textarea
                              aria-label={t('patient.bookingActions.replyAria')}
                              placeholder={t('patient.bookingActions.replyPlaceholder')}
                              value={reply}
                              onChange={e=>
                                setReply(e.target.value)
                              }
                            />

                            <button
                              className="btn btn-dark"
                              onClick={()=>
                                sendReply(b.id)
                              }
                            >
                              {t('patient.bookingActions.sendReply')}
                            </button>

                          </div>
                        }

                        {[
                          'pending',
                          'clarification',
                          'quoted',
                          'accepted'
                        ].includes(b.status)&&
                          <button
                            className="text-btn danger"
                            onClick={()=>cancel(b.id)}
                          >
                            {t('patient.bookingActions.cancelRequest')}
                          </button>
                        }


                        {b.status==='cancelled'&&
                          <div className="smart-recovery">

                            <div className="recovery-head">
                              <span>
                                {t('patient.recovery.kicker')}
                              </span>

                              <h4>
                                {t('patient.recovery.title')}
                              </h4>

                              <p>
                                {t('patient.recovery.text')}
                              </p>
                            </div>

                            {!recovery[b.id]&&
                              <button
                                className="btn btn-dark"
                                disabled={
                                  recoveryBusy===b.id
                                }
                                aria-busy={recoveryBusy===b.id}
                                onClick={()=>
                                  loadRecovery(b.id)
                                }
                              >
                                {recoveryBusy===b.id
                                  ? t('patient.recovery.searching')
                                  : t('patient.recovery.findProfessionals')
                                }
                              </button>
                            }

                            {recovery[b.id]?.length===0&&
                              <p className="muted">
                                {t('patient.recovery.empty')}
                              </p>
                            }

                            {recovery[b.id]?.map((p:any)=>
                              <div
                                className="recovery-card"
                                key={p.id}
                              >

                                <IdentityAvatar
                                  name={p.name}
                                  photoUrl={p.profilePhotoUrl}
                                  avatarKey={p.avatarKey}
                                  size="sm"
                                />

                                <div>
                                  <b>{p.name}</b>
                                  <span>
                                    {p.title} · {p.city}
                                  </span>
                                  <small>
                                    ★ {p.rating||t('patient.recovery.newRating')} · {priceLabel(p,true)}
                                  </small>
                                </div>

                                <button
                                  className="btn btn-outline"
                                  disabled={
                                    recoveryBusy===b.id
                                  }
                                  onClick={()=>
                                    recover(b.id,p.id)
                                  }
                                >
                                  {t('patient.recovery.sendSameRequest')}
                                </button>

                              </div>
                            )}

                          </div>
                        }


                        {b.status==='completed'&&
                          <>
                            <div className="call-again-box">

                              <div>
                                <span>
                                  {t('patient.repeatCare.kicker')}
                                </span>

                                <b>
                                  {t('patient.repeatCare.title')}
                                </b>

                                <small>
                                  {t('patient.repeatCare.text')}
                                </small>
                              </div>

                              <button
                                className="btn btn-dark"
                                onClick={()=>bookAgain(b)}
                              >
                                {t('patient.repeatCare.cta')}
                              </button>

                            </div>

                            <ReviewComposer
                              booking={b}
                              token={token}
                              onDone={refresh}
                              setToast={setToast}
                            />
                          </>
                        }

                      </div>
                    }

                  </div>
                )

              : <Empty
                  title={t('patient.emptyBookings.title')}
                  text={t('patient.emptyBookings.text')}
                />
            }
 </div>
}
 {patientSection==='messages'&&
  <div id="rc3d-patient-messages-panel" role="tabpanel" aria-labelledby="rc3d-patient-messages-tab">
  <PatientMessages
    bookings={patientMessageBookings}
    unreadByBooking={
      patientMessageUnreadByBooking
    }
    unreadTotal={
      patientMessageUnreadTotal
    }
    activeId={
      patientConversation||
      activePatientConversation?.id||
      ''
    }
    draft={
      patientMessageDraft
    }
    sending={
      patientMessageSending
    }
    user={user}
    setDraft={
      setPatientMessageDraft
    }
    openConversation={
      openPatientConversation
    }
    sendMessage={
      sendPatientInboxMessage
    }
    initials={initials}
    statusLabel={statusLabel}
    money={money}
  />
  </div>
}

          </section>

        </div>


        {patientSection!=='messages'&&
        <aside className="patient-care-side">


          <section className="patient-command-panel care-status-panel" aria-labelledby="rc3d-care-status-title">

            <div className="patient-panel-head">
              <div>
                <small>{t('patient.sideRail.status.kicker')}</small>
                <h3 id="rc3d-care-status-title">{t('patient.sideRail.status.title')}</h3>
              </div>
            </div>

            <div className="care-continuity-score">

              <strong>
                {careContinuity}%
              </strong>

              <span>
                {t('patient.sideRail.status.continuity')}
              </span>

            </div>

            <div className="care-status-list" role="list" aria-label={t('patient.sideRail.status.aria')}>

              <div>
                <span>{t('patient.sideRail.status.active')}</span>
                <b>{activeRequests}</b>
              </div>

              <div>
                <span>{t('patient.sideRail.status.confirmed')}</span>
                <b>{acceptedBookings.length}</b>
              </div>

              <div>
                <span>{t('patient.sideRail.status.completed')}</span>
                <b>{completedBookings.length}</b>
              </div>

              <div>
                <span>{t('patient.sideRail.status.team')}</span>
                <b>{careTeam.length}</b>
              </div>

            </div>

          </section>


          {careActivity.length>0&&
            <section className="patient-command-panel" aria-labelledby="rc3d-care-activity-title">

              <div className="patient-panel-head">
                <div>
                  <small>{t('patient.sideRail.activity.kicker')}</small>
                  <h3 id="rc3d-care-activity-title">{t('patient.sideRail.activity.title')}</h3>
                </div>
              </div>

              <div className="patient-activity-list" role="list">

                {careActivity.map((b:any)=>
                  <div
                    className="patient-activity-item"
                    role="listitem"
                    key={b.id}
                  >

                    <span
                      className={`activity-dot ${b.status}`}
                    />

                    <div>
                      <b>{b.service}</b>

                      <span>
                        {b.professionalName}
                      </span>

                      <small>
                        {patientBookingDateTime(b)
                          ?.toLocaleDateString(
                            i18n.language==='en'
                              ? 'en-US'
                              : 'el-GR'
                          )
                          ||
                          String(b.date||'').slice(0,10)
                        }
                        {' · '}
                        {statusLabel(b.status)}
                      </small>
                    </div>

                  </div>
                )}

              </div>

            </section>
          }


          <section className="patient-command-panel patient-quick-actions" aria-labelledby="rc3d-quick-actions-title">

            <div className="patient-panel-head">
              <div>
                <small>{t('patient.sideRail.actions.kicker')}</small>
                <h3 id="rc3d-quick-actions-title">{t('patient.sideRail.actions.title')}</h3>
              </div>
            </div>

            <button
              onClick={()=>setView('search')}
            >
              <span>⌕</span>

              <div>
                <b>{t('patient.sideRail.actions.search')}</b>
                <small>
                  {t('patient.sideRail.actions.searchHelp')}
                </small>
              </div>

              <em>›</em>
            </button>

            <button
              onClick={()=>setView('smart')}
            >
              <span>✦</span>

              <div>
                <b>Smart Request</b>
                <small>
                  {t('patient.sideRail.actions.smartHelp')}
                </small>
              </div>

              <em>›</em>
            </button>

            <button
              onClick={()=>setView('now')}
            >
              <span>⚡</span>

              <div>
                <b>MELEO Now</b>
                <small>
                  {t('patient.sideRail.actions.nowHelp')}
                </small>
              </div>

              <em>›</em>
            </button>

            <button
              onClick={()=>setView('account')}
            >
              <span>⚙</span>

              <div>
                <b>{t('patient.sideRail.actions.account')}</b>
                <small>
                  {t('patient.sideRail.actions.accountHelp')}
                </small>
              </div>

              <em>›</em>
            </button>

          </section>


          <section className="patient-safety-card" aria-labelledby="rc3d-safety-title">

            <b>{t('patient.sideRail.safety.title')}</b>

            <p>{t('patient.sideRail.safety.emergency')} {' '}
              <strong>
                {cfg?.emergencyNumber||'112'}
              </strong>.
              {' '}{t('patient.sideRail.safety.disclaimer')}</p>

          </section>

        </aside>

              }

      </div>

    </div>
  </section>
)

}

export default PatientDashboard
