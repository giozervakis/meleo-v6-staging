import React, {
  useEffect,
  useRef,
  useState
} from 'react'

import { api } from '../../lib/api'

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
        'Στάλθηκε νέο email επαλήθευσης.'
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
    <div className="verify-email-banner">

      <div>
        <b>Επιβεβαίωσε το email σου</b>

        <span>
          Για πλήρη ασφάλεια λογαριασμού και ειδοποιήσεις,
          επιβεβαίωσε τη διεύθυνση {user.email}.
        </span>
      </div>

      <button
        onClick={resend}
        disabled={busy}
      >
        {busy
          ? 'Αποστολή…'
          : 'Νέο email επαλήθευσης'
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
	const [bookings,setBookings]=useState<Booking[]>([]);const [careTeam,setCareTeam]=useState<any[]>([]);const [open,setOpen]=useState<string>('');const [reply,setReply]=useState('');
 const [messageReadBusy,setMessageReadBusy]=useState<string>('')
 const [patientMessageUnreadByBooking,setPatientMessageUnreadByBooking]=useState<Record<string,number>>({})
 const [patientMessageUnreadTotal,setPatientMessageUnreadTotal]=useState(0)
 const [patientConversation,setPatientConversation]=useState<string>('')
 const [patientMessageDraft,setPatientMessageDraft]=useState('')
 const [patientMessageSending,setPatientMessageSending]=useState(false)
 const patientInboxMessagesRef=useRef<HTMLDivElement|null>(null)
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

  return()=>{

    window.removeEventListener(
      'meleo:live',
      f
    )

    window.removeEventListener(
      'meleo:communication-refresh',
      f
    )

  }

},[])
 async function loadRecovery(id:string){setRecoveryBusy(id);try{const d=await api('/bookings/'+id+'/recovery-candidates',{},token);setRecovery(x=>({...x,[id]:d.items||[]}))}catch(e:any){setToast(e.message)}finally{setRecoveryBusy('')}}
 async function cancel(id:string){await api('/bookings/'+id+'/status',{method:'PATCH',body:JSON.stringify({status:'cancelled'})},token);setOpen(id);await refresh();await loadRecovery(id)}
 async function recover(id:string,professionalId:string){setRecoveryBusy(id);try{await api('/bookings/'+id+'/recover',{method:'POST',body:JSON.stringify({professionalId})},token);setToast('Το ίδιο αίτημα στάλθηκε σε νέο επαγγελματία.');setRecovery(x=>({...x,[id]:[]}));await refresh()}catch(e:any){setToast(e.message)}finally{setRecoveryBusy('')}}
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
      'Η αποστολή μηνύματος απέτυχε.'
    )

  }
  finally{

    setPatientMessageSending(false)

  }
}
 async function sendReply(id:string){if(!reply.trim())return;await api('/bookings/'+id+'/message',{method:'POST',body:JSON.stringify({text:reply})},token);setReply('');refresh()}
 async function quoteDecision(id:string,decision:string){await api('/bookings/'+id+'/quote-decision',{method:'POST',body:JSON.stringify({decision})},token);refresh()}
 async function bookAgain(b:any){try{const d=await api('/professionals/'+b.professionalId);const p=d.professional||d;startBooking(p,{service:b.service,address:b.address,repeat:b.repeat||'once'});setToast('Έτοιμο — επίλεξε νέα ημερομηνία και ώρα.')}catch(e:any){setToast(e.message)}}
const now = new Date()

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
useEffect(()=>{

  const el=patientInboxMessagesRef.current

  if(!el)return

  requestAnimationFrame(()=>{
    el.scrollTop=el.scrollHeight
  })

},[
  activePatientConversation?.id,
  activePatientConversation?.messages?.length
])

const upcomingBookings = bookings
  .filter((b:any)=>
    ['pending','clarification','quoted','accepted'].includes(b.status)
  )
  .sort((a:any,b:any)=>{
    const ad = new Date(`${a.date}T${a.time||'00:00'}`).getTime()
    const bd = new Date(`${b.date}T${b.time||'00:00'}`).getTime()
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
    const when = new Date(
      `${b.date}T${b.time||'00:00'}`
    )

    return when.getTime() >= now.getTime()
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
    const ad = new Date(
      `${a.date||''}T${a.time||'00:00'}`
    ).getTime()

    const bd = new Date(
      `${b.date||''}T${b.time||'00:00'}`
    ).getTime()

    return bd-ad
  })
  .slice(0,5)

const patientJourneyLevel =
  completedBookings.length>=10
    ? 'MELEO Regular'
    : completedBookings.length>=5
      ? 'Active Care'
      : completedBookings.length>=1
        ? 'Care Started'
        : 'Getting Started'

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
    ? `Έχεις ${quotedBookings.length} ${
        quotedBookings.length===1
          ? 'πρόταση κόστους'
          : 'προτάσεις κόστους'
      } για έλεγχο.`
    : clarificationBookings.length>0
      ? `Υπάρχουν ${clarificationBookings.length} ${
          clarificationBookings.length===1
            ? 'αίτημα'
            : 'αιτήματα'
        } που χρειάζονται διευκρίνιση.`
      : pendingReviews.length>0
        ? `Έχεις ${pendingReviews.length} ${
            pendingReviews.length===1
              ? 'ολοκληρωμένη επίσκεψη'
              : 'ολοκληρωμένες επισκέψεις'
          } που περιμένουν αξιολόγηση.`
        : activeRequests>0
          ? 'Η MELEO παρακολουθεί τα ενεργά αιτήματά σου.'
          : completedBookings.length>0
            ? 'Η φροντίδα σου είναι ενημερωμένη.'
            : 'Ξεκίνα βρίσκοντας τον κατάλληλο επαγγελματία.'
			
return (
  <section className="page patient-care-page">
    <div className="container">

      <VerifyEmailBanner
        user={user}
        token={token}
        cfg={cfg}
        setToast={setToast}
      />

      <div className="patient-care-hero">

        <div className="patient-care-hero-copy">
          <span className="patient-care-kicker">
            MELEO PERSONAL CARE
          </span>

          <h1>
            Καλησπέρα, {user.name.split(' ')[0]}
          </h1>

          <p>
            Η φροντίδα σου, οι άνθρωποί σου και οι επόμενες κινήσεις
            σου σε ένα προσωπικό κέντρο.
          </p>

          <div className="patient-care-hero-status">
            <span>{patientJourneyLevel}</span>

            {needsAttention>0
              ? <b>{needsAttention} χρειάζονται προσοχή</b>
              : <b>Όλα ενημερωμένα</b>
            }
          </div>
        </div>

        <div className="patient-care-identity">
          <IdentityAvatar
            name={user.name}
            photoUrl={user.profilePhotoUrl}
            avatarKey={user.avatarKey}
            size="xl"
          />

          <div>
            <b>{user.name}</b>
            <small>{user.email}</small>
            <span>Personal Care Member</span>
          </div>
        </div>

      </div>


      <div className="patient-care-metrics">

        <div className="patient-care-metric">
          <span>💬</span>
          <strong>{activeRequests}</strong>
          <b>Ενεργά αιτήματα</b>
          <small>σε εξέλιξη</small>
        </div>

        <div className="patient-care-metric">
          <span>✓</span>
          <strong>{completedBookings.length}</strong>
          <b>Ολοκληρωμένες</b>
          <small>επισκέψεις</small>
        </div>

        <div className="patient-care-metric">
          <span>♡</span>
          <strong>{careTeam.length}</strong>
          <b>Ομάδα Φροντίδας</b>
          <small>αγαπημένοι επαγγελματίες</small>
        </div>

        <div className="patient-care-metric">
          <span>★</span>
          <strong>{pendingReviews.length}</strong>
          <b>Αξιολογήσεις</b>
          <small>σε αναμονή</small>
        </div>

        <div className="patient-care-metric">
          <span>◎</span>
          <strong>{uniqueProfessionals}</strong>
          <b>Επαγγελματίες</b>
          <small>που σε εξυπηρέτησαν</small>
        </div>

        <div className="patient-care-metric">
          <span>↻</span>
          <strong>{careContinuity}%</strong>
          <b>Care Continuity</b>
          <small>συνέχεια φροντίδας</small>
        </div>

      </div>


      <div className="patient-care-grid">

        <div className="patient-care-main">


          <section className="patient-command-panel next-care-panel">

            <div className="patient-panel-head">
              <div>
                <small>NEXT CARE</small>
                <h3>Η επόμενη φροντίδα σου</h3>
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
                        'el-GR',
                        {month:'short'}
                      )}
                    </span>

                    <small>
                      {nextBooking.time}
                    </small>
                  </div>

                  <div className="next-care-info">
                    <small>ΕΠΑΓΓΕΛΜΑΤΙΑΣ</small>

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
  Προβολή αιτήματος
</button>

                      {nextBooking.professionalPhone&&
                        <a
                          className="btn btn-outline"
                          href={`tel:${nextBooking.professionalPhone}`}
                        >
                          ☎ Επικοινωνία
                        </a>
                      }

                    </div>
                  </div>

                </div>

              : <div className="next-care-empty">

                  <div>✦</div>

                  <div>
                    <h4>
                      Δεν υπάρχει προγραμματισμένη φροντίδα
                    </h4>

                    <p>
                      Βρες τον κατάλληλο επαγγελματία ή
                      χρησιμοποίησε το Smart Request.
                    </p>

                    <div>
                      <button
                        className="btn btn-dark"
                        onClick={()=>setView('search')}
                      >
                        Αναζήτηση επαγγελματία
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
            <section className="patient-attention-panel">

              <div className="patient-attention-icon">
                !
              </div>

              <div>
                <small>ΧΡΕΙΑΖΕΤΑΙ ΕΝΕΡΓΕΙΑ</small>
                <h3>{attentionMessage}</h3>

                <p>
                  Άνοιξε τις κρατήσεις σου για να συνεχίσει
                  ομαλά η διαδικασία φροντίδας.
                </p>
              </div>

            </section>
          }


          {careTeam.length>0&&
            <section className="patient-command-panel">

              <div className="patient-panel-head">
                <div>
                  <small>MY CARE TEAM</small>
                  <h3>Η Ομάδα Φροντίδας μου</h3>
                </div>

                <span>
                  {careTeam.length} επαγγελματίες
                </span>
              </div>

              <p className="patient-panel-intro">
                Οι άνθρωποι που ήδη γνωρίζεις και εμπιστεύεσαι.
                Μπορείς να ζητήσεις ξανά φροντίδα χωρίς νέα αναζήτηση.
              </p>

              <div className="patient-care-team-grid">

                {careTeam.slice(0,6).map((p:any)=>
                  <article
                    className="patient-care-team-card"
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
                        ? <strong className="patient-care-trust">
                            {p.trust.score}
                          </strong>
                        : <strong className="patient-care-trust new">
                            NEW
                          </strong>
                      }

                    </div>

                    <div className="patient-care-team-meta">

                      <span>
                        ★ {p.rating||'Νέο'}
                      </span>

                      {p.lastCompleted&&
                        <span>
                          Τελευταία επίσκεψη ·{' '}
                          {new Date(
                            p.lastCompleted.date
                          ).toLocaleDateString('el-GR')}
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
                        Ζήτησε ξανά
                      </button>

                      <button
                        className="btn btn-outline"
                        onClick={()=>openPro(p)}
                      >
                        Προφίλ
                      </button>

                    </div>

                  </article>
                )}

              </div>

            </section>
          }


          <section className="patient-command-panel">

<div className="patient-section-tabs">

  <button
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

    Οι κρατήσεις μου
  </button>


  <button
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

    Μηνύματα

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
  <>
            <div className="patient-panel-head">
              <div>
                <small>MY REQUESTS</small>
                <h3>Οι κρατήσεις μου</h3>
              </div>

              <span>
                {bookings.length} συνολικά
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
                                ? `Από ${b.price}€`
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
                            ? 'Κλείσιμο'
                            : 'Λεπτομέρειες'
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
                            <small>Επαγγελματίας</small>
                            <b>{b.professionalName}</b>
                            <span>{b.professionalEmail}</span>
                            <span>{b.professionalPhone}</span>
                          </div>

                          <div>
                            <small>Αίτημα</small>
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
                            <small>Περιγραφή ανάγκης</small>
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
                              Προτεινόμενο τελικό κόστος
                            </span>

                            <strong>
                              {b.proposedPrice}€
                            </strong>

                            <small>
                              Επιβεβαίωσε μόνο εφόσον έχεις
                              συμφωνήσει με τον επαγγελματία.
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
                                Αποδοχή & επιβεβαίωση
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
                                Δεν συμφωνώ
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
                              placeholder="Απάντησε ή πρόσθεσε διευκρινίσεις…"
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
                              Αποστολή απάντησης
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
                            Ακύρωση αιτήματος
                          </button>
                        }


                        {b.status==='cancelled'&&
                          <div className="smart-recovery">

                            <div className="recovery-head">
                              <span>
                                MELEO SMART RECOVERY
                              </span>

                              <h4>
                                Η φροντίδα σου μπορεί να συνεχιστεί
                                χωρίς νέα αναζήτηση.
                              </h4>

                              <p>
                                Η MELEO μπορεί να προτείνει έως 3
                                άλλους κατάλληλους επαγγελματίες
                                για την ίδια υπηρεσία.
                              </p>
                            </div>

                            {!recovery[b.id]&&
                              <button
                                className="btn btn-dark"
                                disabled={
                                  recoveryBusy===b.id
                                }
                                onClick={()=>
                                  loadRecovery(b.id)
                                }
                              >
                                {recoveryBusy===b.id
                                  ? 'Αναζήτηση…'
                                  : 'Βρες νέους επαγγελματίες'
                                }
                              </button>
                            }

                            {recovery[b.id]?.length===0&&
                              <p className="muted">
                                Δεν βρέθηκαν αυτή τη στιγμή
                                άλλοι συμβατοί επαγγελματίες.
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
                                    ★ {p.rating||'Νέο'} · {priceLabel(p,true)}
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
                                  Αποστολή ίδιου αιτήματος
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
                                  ΓΝΩΡΙΜΗ ΦΡΟΝΤΙΔΑ
                                </span>

                                <b>
                                  Χρειάζεσαι ξανά τον ίδιο επαγγελματία;
                                </b>

                                <small>
                                  Η υπηρεσία και η διεύθυνση
                                  θα συμπληρωθούν αυτόματα.
                                </small>
                              </div>

                              <button
                                className="btn btn-dark"
                                onClick={()=>bookAgain(b)}
                              >
                                Ζήτησε ξανά επίσκεψη
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
                  title="Δεν έχεις ακόμη κρατήσεις"
                  text="Η επόμενη φροντίδα σου απέχει λίγα clicks."
                />
            }
 </>
}{patientSection==='messages'&&
  <>

    <div className="patient-panel-head">
      <div>
        <small>MELEO COMMUNICATION</small>
        <h3>Τα μηνύματά μου</h3>
      </div>

      <span>
        {patientMessageUnreadTotal} αδιάβαστα
      </span>
    </div>


    <div className="patient-inbox-list">

      {patientMessageBookings.length===0
        ?
        <div className="inbox-list-empty">
          <span>💬</span>
          <b>Δεν υπάρχουν συνομιλίες</b>
          <small>
            Τα μηνύματα με επαγγελματίες θα εμφανίζονται εδώ.
          </small>
        </div>

        :
        patientMessageBookings.map((b:any)=>{

          const messages=b.messages||[]
          const last=messages.at(-1)

          const unread=
            Number(
              patientMessageUnreadByBooking[b.id]||0
            )

          const active=
            activePatientConversation?.id===b.id

          return(
            <button
              key={b.id}
              className={
                'inbox-conversation-item '+
                (active?'active ':'')+
                (unread>0?'unread':'')
              }
              onClick={()=>
                openPatientConversation(b.id)
              }
            >

              <div className="inbox-avatar">
                {initials(
                  b.professionalName||
                  'Επαγγελματίας'
                )}
              </div>


              <div className="inbox-conversation-main">

                <div className="inbox-conversation-top">

                  <strong>
                    {b.professionalName||
                     'Επαγγελματίας MELEO'}
                  </strong>

                  {last?.createdAt&&
                    <time>
                      {new Date(
                        last.createdAt
                      ).toLocaleTimeString(
                        'el-GR',
                        {
                          hour:'2-digit',
                          minute:'2-digit'
                        }
                      )}
                    </time>
                  }

                </div>


                <span className="inbox-service">
                  {b.service||
                   b.specialty||
                   'Αίτημα επίσκεψης'}
                </span>


                <div className="inbox-preview-row">

                  <p>
                    {last?.text||
                     last?.body||
                     'Άνοιξε τη συνομιλία'}
                  </p>

                  {unread>0&&
                    <b className="conversation-unread">
                      {unread>99
                        ? '99+'
                        : unread
                      }
                    </b>
                  }

                </div>

              </div>

            </button>
          )
        })
      }

    </div>


    <div className="patient-inbox-chat">

      {activePatientConversation
        ?
        <>

          <div className="inbox-chat-head">

            <div className="inbox-chat-person">

              <div className="inbox-avatar large">
                {initials(
                  activePatientConversation.professionalName||
                  'Επαγγελματίας'
                )}
              </div>

              <div>

                <strong>
                  {activePatientConversation.professionalName||
                   'Επαγγελματίας MELEO'}
                </strong>

                <span>
                  {activePatientConversation.service||
                   activePatientConversation.specialty||
                   'Αίτημα επίσκεψης'}
                </span>

              </div>

            </div>


            <span
              className={
                'status '+
                activePatientConversation.status
              }
            >
              {statusLabel(
                activePatientConversation.status
              )}
            </span>

          </div>


          <div className="inbox-booking-context">

            <div>
              <small>Υπηρεσία</small>
              <strong>
                {activePatientConversation.service||'—'}
              </strong>
            </div>

            <div>
              <small>Ημερομηνία</small>
              <strong>
                {activePatientConversation.date||'—'}
              </strong>
            </div>

            <div>
              <small>Ώρα</small>
              <strong>
                {activePatientConversation.time||'—'}
              </strong>
            </div>

            <div>
              <small>Κόστος</small>
              <strong>
                {activePatientConversation.agreedPrice
                  ? money(
                      activePatientConversation.agreedPrice
                    )
                  : activePatientConversation.proposedPrice
                    ? money(
                        activePatientConversation.proposedPrice
                      )
                    : activePatientConversation.price
                      ? `Από ${money(
                          activePatientConversation.price
                        )}`
                      : 'Σε αναμονή'
                }
              </strong>
            </div>

          </div>


          <div
  className="inbox-messages"
  ref={patientInboxMessagesRef}
>

            {(activePatientConversation.messages||[]).length===0
              ?
              <div className="chat-empty">

                <span>💬</span>

                <strong>
                  Ξεκίνα τη συνομιλία
                </strong>

                <p>
                  Στείλε μήνυμα στον επαγγελματία
                  σχετικά με το συγκεκριμένο αίτημα.
                </p>

              </div>

              :
              (activePatientConversation.messages||[])
                .map((m:any)=>{

                  const mine=
                    m.senderUserId===user.id ||
                    m.senderRole==='patient'

                  return(
                    <div
                      key={m.id}
                      className={
                        'inbox-message-row '+
                        (mine?'mine':'theirs')
                      }
                    >

                      <div
                        className={
                          'inbox-message-bubble '+
                          (m.kind||'message')
                        }
                      >

                        {!mine&&
                          <b>
                            {m.senderName||
                             activePatientConversation.professionalName||
                             'Επαγγελματίας'}
                          </b>
                        }

                        <p>
                          {m.text||
                           m.body||
                           ''}
                        </p>

                        <small>
                          {m.createdAt
                            ? new Date(
                                m.createdAt
                              ).toLocaleString(
                                'el-GR',
                                {
                                  day:'2-digit',
                                  month:'2-digit',
                                  hour:'2-digit',
                                  minute:'2-digit'
                                }
                              )
                            : ''
                          }
                        </small>

                      </div>

                    </div>
                  )
                })
            }

          </div>


          <div className="inbox-composer">

            <textarea
              value={patientMessageDraft}
              onChange={e=>
                setPatientMessageDraft(
                  e.target.value
                )
              }
              placeholder="Γράψε μήνυμα στον επαγγελματία…"
              maxLength={1500}
              onKeyDown={e=>{

                if(
                  e.key==='Enter' &&
                  !e.shiftKey
                ){
                  e.preventDefault()
                  sendPatientInboxMessage()
                }

              }}
            />


            <div className="inbox-composer-foot">

              <small>
                Enter για αποστολή · Shift + Enter για νέα γραμμή
              </small>

              <button
                className="inbox-send-button"
                disabled={
                  !patientMessageDraft.trim() ||
                  patientMessageSending
                }
                onClick={sendPatientInboxMessage}
              >
                {patientMessageSending
                  ? 'Αποστολή…'
                  : <>
                      Αποστολή
                      <span>→</span>
                    </>
                }
              </button>

            </div>

          </div>

        </>

        :

        <div className="inbox-no-selection">

          <span>💬</span>

          <h3>
            Επίλεξε συνομιλία
          </h3>

          <p>
            Επίλεξε έναν επαγγελματία από τη λίστα
            για να δεις τα μηνύματα.
          </p>

        </div>
      }

    </div>

  </>
}
          </section>

        </div>


        <aside className="patient-care-side">


          <section className="patient-command-panel care-status-panel">

            <div className="patient-panel-head">
              <div>
                <small>CARE STATUS</small>
                <h3>Η φροντίδα σου</h3>
              </div>
            </div>

            <div className="care-continuity-score">

              <strong>
                {careContinuity}%
              </strong>

              <span>
                Care Continuity
              </span>

            </div>

            <div className="care-status-list">

              <div>
                <span>Ενεργά αιτήματα</span>
                <b>{activeRequests}</b>
              </div>

              <div>
                <span>Επιβεβαιωμένες</span>
                <b>{acceptedBookings.length}</b>
              </div>

              <div>
                <span>Ολοκληρωμένες</span>
                <b>{completedBookings.length}</b>
              </div>

              <div>
                <span>Ομάδα Φροντίδας</span>
                <b>{careTeam.length}</b>
              </div>

            </div>

          </section>


          {careActivity.length>0&&
            <section className="patient-command-panel">

              <div className="patient-panel-head">
                <div>
                  <small>CARE ACTIVITY</small>
                  <h3>Πρόσφατη δραστηριότητα</h3>
                </div>
              </div>

              <div className="patient-activity-list">

                {careActivity.map((b:any)=>
                  <div
                    className="patient-activity-item"
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
                        {new Date(
                          `${b.date}T${b.time||'00:00'}`
                        ).toLocaleDateString('el-GR')}
                        {' · '}
                        {statusLabel(b.status)}
                      </small>
                    </div>

                  </div>
                )}

              </div>

            </section>
          }


          <section className="patient-command-panel patient-quick-actions">

            <div className="patient-panel-head">
              <div>
                <small>QUICK ACTIONS</small>
                <h3>Τι θέλεις να κάνεις;</h3>
              </div>
            </div>

            <button
              onClick={()=>setView('search')}
            >
              <span>⌕</span>

              <div>
                <b>Βρες επαγγελματία</b>
                <small>
                  Αναζήτηση ανά ειδικότητα και περιοχή
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
                  Περιέγραψε τι χρειάζεσαι
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
                  Βρες διαθέσιμο επαγγελματία
                </small>
              </div>

              <em>›</em>
            </button>

            <button
              onClick={()=>setView('account')}
            >
              <span>⚙</span>

              <div>
                <b>Ρυθμίσεις λογαριασμού</b>
                <small>
                  Προφίλ, ασφάλεια και εικόνα
                </small>
              </div>

              <em>›</em>
            </button>

          </section>


          <section className="patient-safety-card">

            <b>
              Ασφάλεια πρώτα
            </b>

            <p>
              Σε επείγουσα κατάσταση κάλεσε{' '}
              <strong>
                {cfg?.emergencyNumber||'112'}
              </strong>.
              Η MELEO δεν είναι υπηρεσία επειγόντων
              και δεν παρέχει ιατρικές συμβουλές.
            </p>

          </section>

        </aside>

      </div>

    </div>
  </section>
)

}

export default PatientDashboard