import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api'
import { serviceMap, specialtyOptions } from '../../domain/catalog'
import type { Booking, Plan } from '../../domain/types'
import ProfessionalNotifications from './notifications/ProfessionalNotifications'
import ProfessionalSupport from './support/ProfessionalSupport'
import { APP_VERSION } from '../../version'
import ProfessionalMessages from './messages/ProfessionalMessages'
import ProfessionalAvailability from './availability/ProfessionalAvailability'
import ProfessionalReputation from './reputation/ProfessionalReputation'
import ProfessionalBilling from './billing/ProfessionalBilling'
import ProfessionalVerification from './verification/ProfessionalVerification'

function initials(name:string){ return name.split(' ').slice(0,2).map(x=>x[0]).join('').toUpperCase() }
function statusLabel(s:string){ return ({pending:'Σε αναμονή',clarification:'Χρειάζονται διευκρινίσεις',quoted:'Πρόταση κόστους',accepted:'Επιβεβαιωμένη',completed:'Ολοκληρώθηκε',cancelled:'Ακυρώθηκε'} as any)[s]||s }
function repeatLabel(r:string){return ({once:'Μία επίσκεψη',daily7:'Καθημερινά για 7 ημέρες',twice7:'Πρωί & βράδυ για 7 ημέρες'} as any)[r]||r}
function money(v:number){return `${Number(v||0).toFixed(2).replace('.',',')}€`}
const FALLBACK_CONFIG={plans:[{id:'basic',name:'BASIC',price:9.99,currency:'EUR',interval:'month',recommended:false,features:['Δημόσιο επαγγελματικό προφίλ','Αιτήματα και διαχείριση κρατήσεων']},{id:'premium',name:'PREMIUM',price:14.99,currency:'EUR',interval:'month',recommended:true,features:['Όλα τα BASIC','Προτεραιότητα στην κατάταξη αποτελεσμάτων']}]} as any
async function fileToBase64(file:File){return await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||'').split(',')[1]||'');r.onerror=()=>reject(new Error('Αδυναμία ανάγνωσης αρχείου'));r.readAsDataURL(file)})}
function Mark(){return <div className="brand"><span className="brand-glyph">M</span><span>MELEO</span></div>}
function Empty({title,text}:any){return <div className="empty"><div>◇</div><h3>{title}</h3><p>{text}</p></div>}
function Stat({label,value,note}:any){return <div className="stat-card"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>}
function VerifyEmailBanner({user,token,cfg,setToast}:any){
 const [busy,setBusy]=useState(false); if(!user||user.emailVerified||cfg?.demoAuth)return null
 async function resend(){setBusy(true);try{const r=await api('/auth/resend-verification',{method:'POST'},token);setToast(r.message||'Στάλθηκε νέο email επαλήθευσης.')}catch(e:any){setToast(e.message)}finally{setBusy(false)}}
 return <div className="verify-email-banner"><div><b>Επιβεβαίωσε το email σου</b><span>Για πλήρη ασφάλεια λογαριασμού και ειδοποιήσεις, επιβεβαίωσε τη διεύθυνση {user.email}.</span></div><button onClick={resend} disabled={busy}>{busy?'Αποστολή…':'Νέο email επαλήθευσης'}</button></div>
}
function CalendarActions({booking}:any){

  if(!['accepted','completed'].includes(booking.status)){
    return null
  }

  const dateValue = String(booking?.date || '').trim()
  const timeValue = String(booking?.time || '').trim()

  if(!dateValue || !timeValue){
    return null
  }

  const normalizedTime =
    /^\d{2}:\d{2}$/.test(timeValue)
      ? `${timeValue}:00`
      : timeValue

  const start = new Date(`${dateValue}T${normalizedTime}`)

  if(Number.isNaN(start.getTime())){
    console.warn(
      '[MELEO] Invalid booking date/time for calendar',
      {
        bookingId: booking?.id,
        date: booking?.date,
        time: booking?.time
      }
    )

    return null
  }

  const end = new Date(start.getTime() + 60 * 60 * 1000)

  const compact = (d:Date) =>
    d
      .toISOString()
      .replace(/[-:]/g,'')
      .replace(/\.\d{3}Z$/,'Z')

  const title = `MELEO · ${booking.service || 'Επίσκεψη'}`

  const loc = booking.address || ''

  const desc =
    `MELEO booking · ${
      booking.professionalName ||
      booking.patientName ||
      ''
    }`

  const google =
    `https://calendar.google.com/calendar/render` +
    `?action=TEMPLATE` +
    `&text=${encodeURIComponent(title)}` +
    `&dates=${compact(start)}/${compact(end)}` +
    `&details=${encodeURIComponent(desc)}` +
    `&location=${encodeURIComponent(loc)}`

  return (
    <div className="calendar-actions">

      <span>
        Προσθήκη στο ημερολόγιο
      </span>

      <a
        href={google}
        target="_blank"
        rel="noreferrer"
      >
        Google
      </a>

      <a
        href={`/api/bookings/${booking.id}/calendar.ics`}
      >
        Apple / .ics
      </a>

    </div>
  )
}
function Conversation({messages}:any){if(!messages?.length)return null;return <div className="conversation"><div className="conversation-title">Ιστορικό επικοινωνίας</div>{messages.map((m:any)=><div key={m.id} className={'conversation-msg '+m.fromRole}><div><b>{m.fromName}</b><small>{new Date(m.createdAt).toLocaleString('el-GR')}</small></div><p>{m.text}</p></div>)}</div>}

const PROFESSIONAL_TABS=new Set([
  'overview',
  'requests',
  'messages',
  'profile',
  'availability',
  'reputation',
  'subscription',
  'verification',
  'notifications',
  'support'
])

function professionalTabFromLocation(){
  const requested=
    String(
      new URLSearchParams(
        window.location.search
      ).get('tab')||
      ''
    ).toLowerCase()

  const aliases:Record<string,string>={
    billing:'subscription',
    bookings:'requests'
  }

  const normalized=
    aliases[requested]||
    requested

  return PROFESSIONAL_TABS.has(normalized)
    ? normalized
    : 'overview'
}
function ProfessionalDashboard({user,professional,token,onRefresh,setToast,cfg,setView}:any){
  const {t,i18n}=useTranslation()

  const [bookings,setBookings]=useState<Booking[]>([])
  const [analytics,setAnalytics]=useState<any>(null)
  const [tab,setTab]=useState(
    ()=>professionalTabFromLocation()
  )

  const [messageUnreadByBooking,setMessageUnreadByBooking]=useState<Record<string,number>>({})
  const [messageUnreadTotal,setMessageUnreadTotal]=useState(0)
  const [selectedConversation,setSelectedConversation]=useState<string>('')
  const [messageDraft,setMessageDraft]=useState('')
  const [messageSending,setMessageSending]=useState(false)
  const inboxMessagesRef=useRef<HTMLDivElement|null>(null)

  useEffect(()=>{
    const syncTabFromUrl=()=>{
      setTab(
        professionalTabFromLocation()
      )
    }

    window.addEventListener(
      'popstate',
      syncTabFromUrl
    )

    return()=>{
      window.removeEventListener(
        'popstate',
        syncTabFromUrl
      )
    }
  },[])
  const [form,setForm]=useState<any>(professional||{})
  const [vr,setVr]=useState({
    licenseNumber:'',
    notes:''
  })

  const [docs,setDocs]=useState<any[]>([])
  const [uploadBusy,setUploadBusy]=useState(false)

async function refresh(){

  const [bs,an]=await Promise.all([
    api('/bookings?limit=50',{},token),
    api('/professional/analytics',{},token).catch(()=>null)
  ])

  setBookings(
    Array.isArray(bs)
      ? bs
      : bs.items||[]
  )

  if(an){
    setAnalytics(an)
  }
}


async function refreshMessageUnread(){

  try{

    const d=await api(
      '/bookings/unread',
      {},
      token
    )

    const map:Record<string,number>={}

    for(const item of d.items||[]){
      map[item.bookingId]=Number(
        item.unread||0
      )
    }

    setMessageUnreadByBooking(map)

    setMessageUnreadTotal(
      Number(d.total||0)
    )

  }
  catch(e){

    console.error(
      'Professional unread messages load failed',
      e
    )

  }
}


useEffect(()=>{

  refresh()
  refreshMessageUnread()

  const f=()=>{
    refresh()
    refreshMessageUnread()
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


useEffect(
  ()=>setForm(professional||{}),
  [professional]
)
async function openConversation(id:string){
  setSelectedConversation(id)

  try{
    await api(
      '/bookings/'+id+'/messages/read',
      {
        method:'PATCH'
      },
      token
    )

    await refreshMessageUnread()

    window.dispatchEvent(
      new CustomEvent(
        'meleo:communication-refresh'
      )
    )
  }
  catch(e){
    console.error(
      'Conversation read failed',
      e
    )
  }
}
async function sendInboxMessage(){
  const conversationId=
  selectedConversation||
  activeConversation?.id

if(
  !conversationId ||
  !messageDraft.trim() ||
  messageSending
){
  return
}

  try{
    setMessageSending(true)

    await api(
      '/bookings/'+conversationId+'/message',
      {
        method:'POST',
        body:JSON.stringify({
          text:messageDraft.trim()
        })
      },
      token
    )

    setMessageDraft('')

    await refresh()
    await refreshMessageUnread()

    window.dispatchEvent(
      new CustomEvent(
        'meleo:communication-refresh'
      )
    )
  }
  catch(e:any){
    setToast(
      e.message||
      t('professionalDashboard.toast.messageFailed')
    )
  }
  finally{
    setMessageSending(false)
  }
}
 async function status(id:string,s:string,agreedPrice?:number){await api('/bookings/'+id+'/status',{method:'PATCH',body:JSON.stringify({status:s,agreedPrice})},token);refresh();setToast(s==='accepted'?t('professionalDashboard.toast.visitConfirmed'):t('professionalDashboard.toast.statusUpdated'))}
 async function saveProfile(){const payload={...form,price:Number(form.price),years:Number(form.years),services:typeof form.services==='string'?form.services.split(',').map((x:string)=>x.trim()).filter(Boolean):form.services,availability:typeof form.availability==='string'?form.availability.split(',').map((x:string)=>x.trim()).filter(Boolean):form.availability};await api('/professional/profile',{method:'PUT',body:JSON.stringify(payload)},token);await onRefresh();setToast(t('professionalDashboard.toast.profileUpdated'))}
 async function uploadVerificationFile(file:File){try{setUploadBusy(true);const dataBase64=await fileToBase64(file);const d=await api('/professional/verification-document',{method:'POST',body:JSON.stringify({name:file.name,data:dataBase64})},token);setDocs((x:any[])=>[...x,d]);setToast(t('professionalDashboard.toast.documentUploaded'))}catch(e:any){setToast(e.message)}finally{setUploadBusy(false)}}
 async function verifyReq(){try{await api('/professional/verification',{method:'POST',body:JSON.stringify(vr)},token);setToast(t('professionalDashboard.toast.verificationSubmitted'))}catch(e:any){setToast(e.message)}}
 const income=bookings.filter(b=>b.status==='completed').reduce((a,b)=>a+Number(b.agreedPrice??b.price??0),0)
 const completion=(()=>{const f=[professional?.title,professional?.specialty,professional?.city,professional?.bio,(professional?.services||[]).length,(professional?.availability||[]).length,professional?.years,professional?.verified];return Math.round(f.filter(Boolean).length/f.length*100)})()
 const messageBookings=
  [...bookings]
    .filter(
      (b:any)=>
        (b.messages||[]).length>0 ||
        Number(
          messageUnreadByBooking[b.id]||0
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

const activeConversation=
  messageBookings.find(
    (b:any)=>
      b.id===selectedConversation
  )
  ||
  messageBookings[0]
  ||
  null
  
  useEffect(()=>{

  const el=inboxMessagesRef.current

  if(!el)return

  requestAnimationFrame(()=>{
    el.scrollTop=el.scrollHeight
  })

},[
  activeConversation?.id,
  activeConversation?.messages?.length
])
 if(!professional || !['active','past_due'].includes(professional.subscriptionStatus) || !professional.onboardingCompleted) return <ProfessionalOnboarding user={user} professional={professional} token={token} onRefresh={onRefresh} setToast={setToast} cfg={cfg}/>
 return <section className="dashboard-pro"><div className="pro-sidebar"><Mark/><div className="pro-user"><div className="avatar">{initials(user.name)}</div><div><b>{user.name}</b><small>{professional?.verified?'✓ Verified':t('professionalDashboard.sidebar.pendingVerification')}</small></div></div><nav>{[
 ['overview','⌂',t('professionalDashboard.tabs.overview')],
 ['requests','◇',t('professionalDashboard.tabs.requests')],
 ['messages','💬',t('professionalDashboard.tabs.messages')],
 ['profile','○',t('professionalDashboard.tabs.profile')],
 ['availability','◷',t('professionalDashboard.tabs.availability')],
 ['reputation','★',t('professionalDashboard.tabs.reputation')],
 ['subscription','◆',t('professionalDashboard.tabs.subscription')],
 ['verification','✓',t('professionalDashboard.tabs.verification')],
 ['notifications','🔔',t('professionalDashboard.tabs.notifications')],
 ['support','?',t('professionalDashboard.tabs.support')]
]
.map(x=>
  <button
    key={x[0]}
    className={tab===x[0]?'active':''}
    onClick={()=>setTab(x[0])}
  >
    <span>{x[1]}</span>
    {x[2]}
    {x[0]==='requests'&&
      bookings.filter(
        b=>['pending','clarification'].includes(b.status)
      ).length>0&&
      <i>
        {bookings.filter(
          b=>['pending','clarification'].includes(b.status)
        ).length}
      </i>
    }
    {x[0]==='messages'&&messageUnreadTotal>0&&
      <i>
        {messageUnreadTotal>99 ? '99+' : messageUnreadTotal}
      </i>
    }
  </button>
)}
</nav><button className="pro-personal-care-link" onClick={()=>setView('patient-dashboard')}>♡ <span>{t('professionalDashboard.sidebar.personalBookings')}</span></button><small className="side-version">MELEO Professional v{APP_VERSION}</small></div><div className="pro-content"><VerifyEmailBanner user={user} token={token} cfg={cfg} setToast={setToast}/>{professional?.subscriptionStatus==='past_due'&&<div className="alert-banner">{t('professionalDashboard.alerts.pastDue')}</div>}{professional?.cancelAtPeriodEnd&&<div className="alert-banner soft">{t('professionalDashboard.alerts.cancelScheduled')}{professional?.currentPeriodEnd?t('professionalDashboard.alerts.onDate',{date:new Date(professional.currentPeriodEnd).toLocaleDateString(i18n.resolvedLanguage==='en'?'en-GB':'el-GR')}):''}.</div>}<div className="pro-top"><div><small>PROFESSIONAL SPACE</small><h2>{
  tab==='overview'
    ? t('professionalDashboard.headings.overview')
    : tab==='requests'
      ? t('professionalDashboard.headings.requests')
      : tab==='messages'
        ? t('professionalDashboard.headings.messages')
        : tab==='profile'
          ? t('professionalDashboard.headings.profile')
          : tab==='availability'
            ? t('professionalDashboard.headings.availability')
            : tab==='reputation'
              ? t('professionalDashboard.headings.reputation')
              : tab==='subscription'
              ? t('professionalDashboard.headings.subscription')
              : tab==='notifications'
                ? t('professionalDashboard.headings.notifications')
                : tab==='support'
                  ? t('professionalDashboard.headings.support')
                  : t('professionalDashboard.headings.verification')
}</h2>
</div><div className="status-pill"><i/> {professional?.verified?'Verified':'Pending verification'}</div>
 </div>{tab==='overview'&&<>

  <ProfessionalPerformance
    analytics={analytics}
    professional={professional}
    bookings={bookings}
    completion={completion}
    income={income}
    setTab={setTab}
  />

  <div className="pro-panels command-support-panels">

    <div className="panel">

      <div className="panel-heading">
        <div>
          <small className="performance-kicker">
            RECENT ACTIVITY
          </small>

          <h3>
            {t('professionalDashboard.overview.recentRequests')}
          </h3>
        </div>

        <button
          onClick={()=>setTab('requests')}
        >
          {t('professionalDashboard.overview.viewAll')}
        </button>
      </div>

      {bookings.length>0
        ? bookings
            .slice(0,4)
            .map(b=>
              <CompactBooking
                key={b.id}
                b={b}
                status={status}
                token={token}
                onRefresh={refresh}
                setToast={setToast}
              />
            )

        : <Empty
            title={t('professionalDashboard.overview.emptyTitle')}
            text={t('professionalDashboard.overview.emptyText')}
          />
      }

    </div>

  </div>

</>}
{tab==='requests'&&
  <ProfessionalRequestsWorkspace
    bookings={bookings}
    status={status}
    token={token}
    onRefresh={refresh}
    setToast={setToast}
  />
}
{tab==='messages'&&
  <ProfessionalMessages
    bookings={bookings}
    token={token}
    user={user}
    unreadByBooking={messageUnreadByBooking}
    unreadTotal={messageUnreadTotal}
    onRefresh={refresh}
    onUnreadRefresh={refreshMessageUnread}
    setToast={setToast}
  />
}{tab==='profile'&&<div className="panel form-panel"><div className="form-grid"><label>{t('professionalDashboard.profile.title')}<input value={form.title||''} onChange={e=>setForm({...form,title:e.target.value})}/></label><label>{t('professionalDashboard.profile.specialty')}<select value={form.specialty||'Νοσηλευτική'} onChange={e=>setForm({...form,specialty:e.target.value})}>{specialtyOptions.map(x=><option key={x}>{x}</option>)}</select></label><ProfessionalLocationEditor form={form} setForm={setForm}/><label>{t('professionalDashboard.profile.pricingMode')}<select value={form.pricingMode||'from'} onChange={e=>setForm({...form,pricingMode:e.target.value})}><option value="from">{t('professionalDashboard.profile.pricingFrom')}</option><option value="contact">{t('professionalDashboard.profile.pricingContact')}</option></select></label>{form.pricingMode!=='contact'&&<label>{t('professionalDashboard.profile.basePrice')}<input type="number" min="0" value={form.price||''} onChange={e=>setForm({...form,price:e.target.value})}/></label>}<div className="full contact-privacy-card"><b>{t('professionalDashboard.profile.publicContactTitle')}</b><p className="muted">{t('professionalDashboard.profile.publicContactBody')}</p><label className="consent-row"><input type="checkbox" checked={form.showPhone!==false} onChange={e=>setForm({...form,showPhone:e.target.checked})}/><span>{t('professionalDashboard.profile.showPhone')}</span></label><label className="consent-row"><input type="checkbox" checked={form.showEmail!==false} onChange={e=>setForm({...form,showEmail:e.target.checked})}/><span>{t('professionalDashboard.profile.showEmail')}</span></label><label className="consent-row"><input type="checkbox" checked={Boolean(form.preferPlatformContact)} onChange={e=>setForm({...form,preferPlatformContact:e.target.checked})}/><span>{t('professionalDashboard.profile.preferMeleo')}</span></label></div><div className="full notice">Το ποσό εμφανίζεται ως <b>«Από Χ€»</b>. Το τελικό κόστος συμφωνείται τηλεφωνικά με τον πελάτη ανάλογα με τις πραγματικές ανάγκες της επίσκεψης.</div><label>Έτη εμπειρίας<input type="number" value={form.years||''} onChange={e=>setForm({...form,years:e.target.value})}/></label><label className="full">Σύντομο βιογραφικό<textarea value={form.bio||''} onChange={e=>setForm({...form,bio:e.target.value})}/></label><label className="full">Υπηρεσίες που παρέχεις (χωρισμένες με κόμμα)<input value={Array.isArray(form.services)?form.services.join(', '):form.services||''} onChange={e=>setForm({...form,services:e.target.value})}/></label></div><button className="btn btn-dark" onClick={saveProfile}>Αποθήκευση προφίλ</button></div>}{tab==='availability'&&
  <ProfessionalAvailability
    availability={
      Array.isArray(form.availability)
        ? form.availability
        : []
    }
    token={token}
    onChange={(availability)=>
      setForm((current:any)=>({
        ...current,
        availability
      }))
    }
    setToast={setToast}
  />
}{tab==='reputation'&&
  <ProfessionalReputation
    professional={professional}
    bookings={bookings}
    analytics={analytics}
    setTab={setTab}
  />}{tab==='subscription'&&<ProfessionalBilling professional={professional} token={token} onRefresh={onRefresh} setToast={setToast} cfg={cfg}/>}{tab==='notifications'&&<ProfessionalNotifications token={token} setToast={setToast}/>}{tab==='support'&&<ProfessionalSupport token={token} setToast={setToast}/>}{tab==='verification'&&
  <ProfessionalVerification
    professional={professional}
    user={user}
    token={token}
    onRefresh={onRefresh}
    setToast={setToast}
  />
}</div></section>
}
function ProfessionalPerformance({
  analytics,
  professional,
  bookings,
  completion,
  income,
  setTab
}:any){

  const a=analytics||{
    impressions:0,
    profileViews:0,
    phoneClicks:0,
    requests:0,
    newClients:0,
    reviews:0,
    newReviews:0,
    requestConversion:0,
    clientConversion:0
  }

  /*
   * Relational analytics returns newReviews.
   * Keep reviews as a backwards-compatible fallback.
   */
  const analyticsReviews=
    Number(
      analytics?.newReviews ??
      analytics?.reviews ??
      a.reviews ??
      0
    )

  const impressions=
    Number(a.impressions||0)

  const profileViews=
    Number(a.profileViews||0)

  const phoneClicks=
    Number(a.phoneClicks||0)

  const requests=
    Number(a.requests||0)

  const newClients=
    Number(a.newClients||0)

  const impressionToProfile=
    impressions>0
      ? Math.round((profileViews/impressions)*100)
      : 0

  const profileToContact=
    profileViews>0
      ? Math.round(
          (
            (phoneClicks+requests)/
            profileViews
          )*100
        )
      : 0

  const requestToClient=
    requests>0
      ? Math.round((newClients/requests)*100)
      : Number(a.clientConversion||0)

  const growthScore=
    Math.max(
      0,
      Math.min(
        100,
        Math.round(
          (
            Math.min(100,completion)*.24
          )+
          (
            Math.min(100,impressionToProfile*4)*.18
          )+
          (
            Math.min(100,profileToContact*3)*.20
          )+
          (
            Math.min(100,requestToClient*2)*.23
          )+
          (
            professional?.verified
              ? 15
              : 0
          )
        )
      )
    )

  const trust=analytics?.trust||null

  const smartDiagnostics=
  analytics?.smartMatchDiagnostics||null

const d=smartDiagnostics?.factors||{}

const factorStatus=(
  points:number,
  max:number,
  special?:string
)=>{
  if(special==='premium'){
    return points>0
      ? 'premium'
      : 'neutral'
  }

  if(max<=0)return 'neutral'

  const ratio=points/max

  if(ratio>=.85)return 'strong'
  if(ratio>=.60)return 'good'
  if(ratio>0)return 'improve'

  return 'building'
}

const smartMatchFactors=[
  {
    key:'verified',
    label:'MELEO Verified',
    icon:'✓',
    value:smartDiagnostics
      ? `${Number(d.verified?.points||0).toFixed(0)} / ${d.verified?.max||6}`
      : '—',
    status:factorStatus(
      Number(d.verified?.points||0),
      Number(d.verified?.max||6)
    ),
    note:d.verified?.active
      ? 'Η επαληθευμένη επαγγελματική ιδιότητα προσθέτει το μέγιστο σχετικό σήμα.'
      : 'Η ολοκλήρωση της επαλήθευσης ενισχύει το Smart Match.'
  },

  {
    key:'trust',
    label:'MELEO Trust',
    icon:'✦',
    value:d.trust?.eligible
      ? `${Number(d.trust?.points||0).toFixed(1)} / ${d.trust?.max||28}`
      : `${Number(d.trust?.points||18).toFixed(1)} / ${d.trust?.max||28}`,
    status:d.trust?.eligible
      ? factorStatus(
          Number(d.trust?.points||0),
          Number(d.trust?.max||28)
        )
      : 'building',
    note:d.trust?.eligible
      ? `Trust Score ${d.trust?.score||0}/100 · συμμετέχει κανονικά στο matching.`
      : 'Νέος επαγγελματίας: εφαρμόζεται ουδέτερο Trust fallback ώστε να μη θάβεται λόγω έλλειψης ιστορικού.'
  },

  {
    key:'rating',
    label:'Ποιότητα αξιολόγησης',
    icon:'★',
    value:smartDiagnostics
      ? `${Number(d.rating?.points||0).toFixed(1)} / ${d.rating?.max||14}`
      : '—',
    status:factorStatus(
      Number(d.rating?.points||0),
      Number(d.rating?.max||14)
    ),
    note:d.rating?.reviews
      ? `${Number(d.rating?.rating||0).toFixed(1)}/5 από ${d.rating.reviews} αξιολογήσεις.`
      : 'Τα νέα προφίλ λαμβάνουν ουδέτερη αρχική βαθμολόγηση rating.'
  },

  {
    key:'reviews',
    label:'Εμπιστοσύνη αξιολογήσεων',
    icon:'◎',
    value:smartDiagnostics
      ? `${Number(d.reviewConfidence?.points||0)} / ${d.reviewConfidence?.max||5}`
      : '—',
    status:factorStatus(
      Number(d.reviewConfidence?.points||0),
      Number(d.reviewConfidence?.max||5)
    ),
    note:`${Number(d.reviewConfidence?.reviews||0)} verified αξιολογήσεις · όσο αυξάνεται το δείγμα, αυξάνεται και η εμπιστοσύνη του συστήματος.`
  },

  {
    key:'availability',
    label:'Διαθεσιμότητα',
    icon:'⚡',
    value:smartDiagnostics
      ? `${Number(d.availability?.points||0)} / ${d.availability?.max||8}`
      : '—',
    status:factorStatus(
      Number(d.availability?.points||0),
      Number(d.availability?.max||8)
    ),
    note:d.availability?.value
      ? `Τρέχουσα ένδειξη: ${d.availability.value}`
      : 'Ενημέρωσε τη διαθεσιμότητά σου για καλύτερη συνάφεια στις αναζητήσεις.'
  },

  {
    key:'response',
    label:'Ταχύτητα ανταπόκρισης',
    icon:'↗',
    value:smartDiagnostics
      ? `${Number(d.response?.points||0)} / ${d.response?.max||6}`
      : '—',
    status:factorStatus(
      Number(d.response?.points||0),
      Number(d.response?.max||6)
    ),
    note:d.response?.value
      ? `Δηλωμένος χρόνος απόκρισης: ${d.response.value}`
      : 'Η καταγεγραμμένη ταχύτητα ανταπόκρισης μπορεί να ενισχύσει το matching.'
  },

  {
    key:'experience',
    label:'Εμπειρία',
    icon:'◷',
    value:smartDiagnostics
      ? `${Number(d.experience?.points||0)} / ${d.experience?.max||3}`
      : '—',
    status:factorStatus(
      Number(d.experience?.points||0),
      Number(d.experience?.max||3)
    ),
    note:d.experience?.years
      ? `${d.experience.years} έτη επαγγελματικής εμπειρίας.`
      : 'Πρόσθεσε τα έτη εμπειρίας στο επαγγελματικό προφίλ.'
  },

  {
    key:'premium',
    label:'Premium boost',
    icon:'◆',
    value:d.premium?.active
      ? `+${Number(d.premium?.points||0)}`
      : '+0',
    status:factorStatus(
      Number(d.premium?.points||0),
      Number(d.premium?.max||8),
      'premium'
    ),
    note:d.premium?.active
      ? 'Ενεργό ελεγχόμενο εμπορικό boost. Δεν υπερισχύει ενός σημαντικά καλύτερου επαγγελματία.'
      : 'Το BASIC συμμετέχει κανονικά στο Smart Match χωρίς εμπορικό boost.'
  }
]

const smartMatchStrong=
  smartMatchFactors.filter(
    (x:any)=>
      x.status==='strong'||
      x.status==='premium'
  ).length

const smartMatchNeedsAttention=
  smartMatchFactors.filter(
    (x:any)=>x.status==='improve'
  ).length

  const pending=
    bookings.filter((b:any)=>b.status==='pending').length

  const clarification=
    bookings.filter((b:any)=>b.status==='clarification').length

  const accepted=
    bookings.filter((b:any)=>b.status==='accepted').length

  const completed=
    bookings.filter((b:any)=>b.status==='completed').length

  const subscriptionCost=
    Number(professional?.subscriptionPrice||0)

  const roi=
    subscriptionCost>0
      ? Number(income||0)/subscriptionCost
      : 0

  const funnel=[
    {
      icon:'👁',
      label:'Εμφανίσεις',
      value:impressions
    },
    {
      icon:'👤',
      label:'Προφίλ',
      value:profileViews
    },
    {
      icon:'📞',
      label:'Τηλέφωνο',
      value:phoneClicks
    },
    {
      icon:'💬',
      label:'Αιτήματα',
      value:requests
    },
    {
      icon:'✓',
      label:'Πελάτες',
      value:newClients
    }
  ]

  const insights:string[]=[]

  if(
    impressions>=20 &&
    impressionToProfile<10
  ){
    insights.push(
      'Οι εμφανίσεις σου δεν μετατρέπονται ακόμη αρκετά σε επισκέψεις προφίλ. Δούλεψε τίτλο, βασική εικόνα και σαφήνεια υπηρεσιών.'
    )
  }

  if(
    profileViews>=10 &&
    profileToContact<10
  ){
    insights.push(
      'Υπάρχει ενδιαφέρον για το προφίλ σου, αλλά χαμηλή μετάβαση σε επικοινωνία. Έλεγξε τιμή, διαθεσιμότητα και περιγραφή υπηρεσιών.'
    )
  }

  if(
    requests>=3 &&
    requestToClient<30
  ){
    insights.push(
      'Τα αιτήματα δεν μετατρέπονται ακόμη αρκετά σε ολοκληρωμένους πελάτες. Η γρήγορη απάντηση και οι σαφείς προτάσεις μπορούν να βοηθήσουν.'
    )
  }

  if(completion<80){
    insights.push(
      'Συμπλήρωσε περισσότερο το προφίλ σου για να αυξήσεις την εμπιστοσύνη των χρηστών.'
    )
  }

  if(pending>0){
    insights.push(
      `Έχεις ${pending} ${pending===1?'νέο αίτημα':'νέα αιτήματα'} που ${pending===1?'χρειάζεται':'χρειάζονται'} απάντηση.`
    )
  }

  if(clarification>0){
    insights.push(
      `${clarification} ${clarification===1?'αίτημα περιμένει':'αιτήματα περιμένουν'} διευκρινίσεις.`
    )
  }

  if((a.profileViews||0)>0 && (a.requests||0)===0){
    insights.push(
      'Έχεις επισκέψεις στο προφίλ αλλά ακόμη κανένα αίτημα. Έλεγξε περιγραφή, υπηρεσίες, τιμή και διαθεσιμότητα.'
    )
  }

  if((professional?.reviews||0)<3){
    insights.push(
      'Οι πρώτες αξιολογήσεις θα ενισχύσουν σημαντικά την κοινωνική απόδειξη του προφίλ σου.'
    )
  }

  if(professional?.subscriptionPlan==='premium'){
    insights.push(
      'Το PREMIUM σου δίνει ελεγχόμενη εμπορική ενίσχυση στο Smart Match, χωρίς να αντικαθιστά Trust και ποιότητα.'
    )
  }

  if(!insights.length){
    insights.push(
      'Το προφίλ σου είναι σε καλή κατάσταση. Συνέχισε να απαντάς γρήγορα και να ολοκληρώνεις σωστά τις επισκέψεις.'
    )
  }

  return (
    <div className="command-center">

      <section className="command-hero growth-center-hero">

        <div className="growth-hero-copy">

          <span className="command-kicker">
            MELEO PROFESSIONAL · GROWTH CENTER
          </span>

          <h2>
            Δες πώς η παρουσία σου
            <em> μετατρέπεται σε πελάτες.</em>
          </h2>

          <p>
            Πραγματική εικόνα της απόδοσής σου στη MELEO:
            από την πρώτη εμφάνιση μέχρι την επικοινωνία,
            το αίτημα και την ολοκληρωμένη συνεργασία.
          </p>

          <div className="growth-hero-signals">

            <span>
              <b>{impressionToProfile}%</b>
              εμφάνιση → προφίλ
            </span>

            <span>
              <b>{profileToContact}%</b>
              προφίλ → ενδιαφέρον
            </span>

            <span>
              <b>{requestToClient}%</b>
              αίτημα → πελάτης
            </span>

          </div>

        </div>

        <div className="growth-hero-side">

          <div className="growth-score-card">

            <small>GROWTH SCORE</small>

            <strong>
              {growthScore}
              <span>/100</span>
            </strong>

            <p>
              {growthScore>=80
                ? 'Ισχυρή παρουσία'
                : growthScore>=60
                  ? 'Καλή δυναμική'
                  : growthScore>=40
                    ? 'Αναπτυσσόμενη παρουσία'
                    : 'Χτίζεις τη δυναμική σου'}
            </p>

          </div>

          <div className="command-plan">

            <small>ΠΑΚΕΤΟ</small>

            <strong>
              {(professional?.subscriptionPlan||'basic').toUpperCase()}
            </strong>

            <span>
              {professional?.subscriptionStatus==='active'
                ? '● Ενεργό'
                : professional?.subscriptionStatus||'—'}
            </span>

          </div>

        </div>

      </section>

      <section className="command-metrics">

        <div className="command-metric">
          <span>👁</span>
          <strong>{Number(a.impressions||0).toLocaleString('el-GR')}</strong>
          <b>Εμφανίσεις</b>
          <small>στα αποτελέσματα</small>
        </div>

        <div className="command-metric">
          <span>👤</span>
          <strong>{Number(a.profileViews||0).toLocaleString('el-GR')}</strong>
          <b>Επισκέψεις προφίλ</b>
          <small>πραγματικό ενδιαφέρον</small>
        </div>

        <div className="command-metric">
          <span>📞</span>
          <strong>{Number(a.phoneClicks||0).toLocaleString('el-GR')}</strong>
          <b>Πατήματα τηλεφώνου</b>
          <small>άμεση επικοινωνία</small>
        </div>

        <div className="command-metric">
          <span>💬</span>
          <strong>{Number(a.requests||0).toLocaleString('el-GR')}</strong>
          <b>Αιτήματα</b>
          <small>μέσω MELEO</small>
        </div>

        <div className="command-metric">
          <span>✅</span>
          <strong>{Number(a.newClients||0).toLocaleString('el-GR')}</strong>
          <b>Νέοι πελάτες</b>
          <small>με ολοκληρωμένη επίσκεψη</small>
        </div>

        <div className="command-metric">
          <span>⭐</span>
          <strong>{analyticsReviews.toLocaleString('el-GR')}</strong>
          <b>Αξιολογήσεις</b>
          <small>verified bookings</small>
        </div>

      </section>

      <div className="command-grid">

        <section className="command-panel action-panel">

          <div className="command-panel-head">
            <div>
              <small>COMMAND CENTER</small>
              <h3>Τι χρειάζεται την προσοχή σου</h3>
            </div>

            {(pending+clarification)>0&&
              <span className="attention-badge">
                {pending+clarification}
              </span>
            }
          </div>

          <div className="action-list">

            <button
              onClick={()=>setTab('requests')}
              className={pending?'urgent':''}
            >
              <span>●</span>
              <div>
                <b>{pending} νέα αιτήματα</b>
                <small>
                  {pending
                    ? 'Χρειάζονται απάντηση'
                    : 'Δεν υπάρχουν αιτήματα σε αναμονή'}
                </small>
              </div>
              <em>→</em>
            </button>

            <button onClick={()=>setTab('requests')}>
              <span>●</span>
              <div>
                <b>{clarification} διευκρινίσεις</b>
                <small>Αιτήματα σε διάλογο</small>
              </div>
              <em>→</em>
            </button>

            <button onClick={()=>setTab('requests')}>
              <span>●</span>
              <div>
                <b>{accepted} επιβεβαιωμένες</b>
                <small>Προσεχείς επισκέψεις</small>
              </div>
              <em>→</em>
            </button>

            <div className="command-action-static">
              <span>●</span>
              <div>
                <b>{completed} ολοκληρωμένες</b>
                <small>Συνολικές ολοκληρωμένες συνεργασίες</small>
              </div>
            </div>

          </div>
        </section>

        <section className="command-panel health-panel">

          <div className="command-panel-head">
            <div>
              <small>PROFILE HEALTH</small>
              <h3>Ισχύς επαγγελματικού προφίλ</h3>
            </div>
          </div>

          <div className="profile-health-score">

            <div
              className="profile-health-ring"
              style={{
                background:
                  `conic-gradient(#d8ae58 ${completion*3.6}deg,#edf1ef 0deg)`
              }}
            >
              <span>
                <strong>{completion}%</strong>
                <small>complete</small>
              </span>
            </div>

            <div className="profile-health-copy">
              <b>
                {completion>=90
                  ? 'Εξαιρετικά συμπληρωμένο'
                  : completion>=70
                    ? 'Καλή βάση'
                    : 'Χρειάζεται ενίσχυση'}
              </b>

              <p>
                Πληρέστερο προφίλ σημαίνει περισσότερη πληροφορία
                για τον χρήστη πριν αποφασίσει.
              </p>

              <button
                className="btn btn-outline"
                onClick={()=>setTab('profile')}
              >
                Βελτίωση προφίλ
              </button>
            </div>

          </div>

          <div className="health-facts">
            <span>
              <b>{professional?.verified?'✓':'—'}</b>
              MELEO Verified
            </span>

            <span>
              <b>{professional?.rating||'—'}</b>
              Αξιολόγηση
            </span>

            <span>
              <b>{professional?.reviews||0}</b>
              Reviews
            </span>
          </div>

        </section>
		<section className="command-panel trust-dashboard-panel">

  <div className="command-panel-head">
    <div>
      <small>MELEO TRUST</small>
      <h3>Αξιοπιστία επαγγελματία</h3>
    </div>

    {trust?.eligible&&
      <span className="trust-dashboard-badge">
        {trust.score}/100
      </span>
    }
  </div>

  {trust?.eligible
    ? <>
        <div className="trust-dashboard-main">

          <div className="trust-dashboard-score">
            <strong>{trust.score}</strong>
            <span>/100</span>
          </div>

          <div className="trust-dashboard-copy">
            <b>{trust.label}</b>
            <p>
              Το MELEO Trust βασίζεται σε πραγματική δραστηριότητα,
              ολοκληρώσεις, αξιολογήσεις και συνέπεια.
            </p>
          </div>

        </div>

        <div className="trust-dashboard-metrics">

          <div>
            <small>Ολοκλήρωση</small>
            <strong>{trust.completionRate}%</strong>
          </div>

          <div>
            <small>Ανταπόκριση</small>
            <strong>{trust.responseRate}%</strong>
          </div>

          <div>
            <small>Ολοκληρωμένες</small>
            <strong>{trust.completed}</strong>
          </div>

          <div>
            <small>Αξιολογήσεις</small>
            <strong>{trust.reviews}</strong>
          </div>

        </div>
      </>
    : <>
        <div className="trust-dashboard-new">

          <div className="trust-dashboard-new-mark">
            M
          </div>

          <div>
            <b>Το Trust Score χτίζεται</b>

            <p>
              Για να ενεργοποιηθεί το MELEO Trust χρειάζονται
              τουλάχιστον 5 ολοκληρωμένες συνεργασίες και 3 αξιολογήσεις.
            </p>
          </div>

        </div>

        <div className="trust-progress-grid">

          <div>
            <small>Ολοκληρωμένες συνεργασίες</small>

            <strong>
              {trust?.completed||0}
              <span> / {trust?.minCompleted||5}</span>
            </strong>

            <div className="trust-progress-track">
              <i
                style={{
                  width:
                    `${Math.min(
                      100,
                      ((trust?.completed||0)/(trust?.minCompleted||5))*100
                    )}%`
                }}
              />
            </div>
          </div>

          <div>
            <small>Αξιολογήσεις</small>

            <strong>
              {trust?.reviews||0}
              <span> / {trust?.minReviews||3}</span>
            </strong>

            <div className="trust-progress-track">
              <i
                style={{
                  width:
                    `${Math.min(
                      100,
                      ((trust?.reviews||0)/(trust?.minReviews||3))*100
                    )}%`
                }}
              />
            </div>
          </div>

        </div>
      </>
  }

</section>
      </div>

	  <section className="smart-match-diagnostics">

  <div className="smart-match-head">

    <div>
      <small>MELEO SMART MATCH</small>
      <h3>Η δυναμική σου στο matching</h3>
      <p>
        Οι παράγοντες που βοηθούν τη MELEO να προτείνει
        τον κατάλληλο επαγγελματία στον κατάλληλο χρήστη.
      </p>
    </div>

    <div className="smart-match-summary">

      <div>
        <strong>{smartMatchStrong}</strong>
        <span>ισχυρά σήματα</span>
      </div>

      <div className={smartMatchNeedsAttention?'attention':''}>
        <strong>{smartMatchNeedsAttention}</strong>
        <span>για βελτίωση</span>
      </div>

    </div>

  </div>

{smartDiagnostics&&
  <div className="smart-match-score-strip">

    <div>
      <small>
        PROFILE SIGNALS
      </small>

      <strong>
        {Number(
          smartDiagnostics.profileScore||0
        ).toFixed(1)}
        <span>
          / {smartDiagnostics.profileMax||80}
        </span>
      </strong>

      <p>
        Οι σταθεροί παράγοντες του επαγγελματικού σου προφίλ.
      </p>
    </div>

    <div className="smart-match-distance-dynamic">
      <small>
        DISTANCE
      </small>

      <strong>
        dynamic
        <span>
          / {smartDiagnostics.distance?.maxPoints||20}
        </span>
      </strong>

      <p>
        {smartDiagnostics.distance?.note||
          'Υπολογίζεται ξεχωριστά σε κάθε αναζήτηση.'
        }
      </p>
    </div>

  </div>
}

  <div className="smart-match-factor-grid">

    {smartMatchFactors.map((factor:any)=>
      <div
        key={factor.key}
        className={
          `smart-match-factor ${factor.status}`
        }
      >

        <div className="smart-match-factor-top">

          <span className="smart-match-factor-icon">
            {factor.icon}
          </span>

          <span className={`smart-match-state ${factor.status}`}>
            {factor.status==='strong'
              ? 'ΙΣΧΥΡΟ'
              : factor.status==='good'
                ? 'ΚΑΛΟ'
                : factor.status==='improve'
                  ? 'ΒΕΛΤΙΩΣΗ'
                  : factor.status==='building'
                    ? 'ΧΤΙΖΕΤΑΙ'
                    : factor.status==='premium'
                      ? 'BOOST'
                      : 'ΟΥΔΕΤΕΡΟ'}
          </span>

        </div>

        <small>{factor.label}</small>

        <strong>
          {factor.value}
        </strong>

        <p>
          {factor.note}
        </p>

      </div>
    )}

  </div>

  <div className="smart-match-explainer">

    <span>ⓘ</span>

    <p>
      Το Smart Match δεν αγοράζεται.
      Το PREMIUM παρέχει μόνο ελεγχόμενη εμπορική ενίσχυση.
      Η συνάφεια, η απόσταση, το MELEO Trust,
      οι αξιολογήσεις, η διαθεσιμότητα και η συμπεριφορά
      ανταπόκρισης εξακολουθούν να καθορίζουν την ποιότητα
      της αντιστοίχισης.
    </p>

  </div>

</section>

      <section className="meleo-value-panel">

        <div className="value-heading">
          <div>
            <small>MELEO VALUE</small>
            <h3>Τι σου έχει αποφέρει η παρουσία σου</h3>
          </div>

          <span>πραγματικά δεδομένα</span>
        </div>

        <div className="value-funnel">

          {funnel.map((x:any,index:number)=>
            <React.Fragment key={x.label}>

              <div className="value-step">
                <span>{x.icon}</span>
                <strong>
                  {Number(x.value||0).toLocaleString('el-GR')}
                </strong>
                <small>{x.label}</small>
              </div>

              {index<funnel.length-1&&
                <div className="value-arrow">→</div>
              }

            </React.Fragment>
          )}

        </div>

        <div className="value-financial">

          <div>
            <small>Αξία ολοκληρωμένων επισκέψεων</small>
            <strong>{money(income)}</strong>
            <span>
              Με βάση τις τιμές των completed bookings.
            </span>
          </div>

          <div>
            <small>Μηνιαία συνδρομή</small>
            <strong>{money(subscriptionCost)}</strong>
            <span>
              {(professional?.subscriptionPlan||'—').toUpperCase()}
            </span>
          </div>

          <div className="roi-box">
            <small>Αναλογία αξίας / συνδρομής</small>

            <strong>
              {roi>0
                ? `${roi.toFixed(1).replace('.',',')}×`
                : '—'}
            </strong>

            <span>
              Δεν αποτελεί εγγύηση μελλοντικού εισοδήματος.
            </span>
          </div>

        </div>

        <div className="conversion-strip growth-conversion-strip">

          <span>
            <small>DISCOVERY</small>
            Εμφάνιση → Προφίλ
            <b>{impressionToProfile}%</b>
          </span>

          <span>
            <small>INTENT</small>
            Προφίλ → Επικοινωνία
            <b>{profileToContact}%</b>
          </span>

          <span>
            <small>CONVERSION</small>
            Αίτημα → Πελάτης
            <b>{requestToClient}%</b>
          </span>

        </div>

      </section>

      <section className="command-insights">

        <div className="command-panel-head">
          <div>
            <small>MELEO INSIGHTS</small>
            <h3>Τι μπορείς να κάνεις τώρα</h3>
          </div>
        </div>

        <div className="insight-list">
          {insights.slice(0,4).map(
            (text:string,index:number)=>
              <div
                key={index}
                className="insight-item"
              >
                <span>✦</span>
                <p>{text}</p>
              </div>
          )}
        </div>

      </section>

    </div>
  )
}
function ProfessionalRequestsWorkspace({
  bookings,
  status,
  token,
  onRefresh,
  setToast
}:any){

  type RequestFilter=
    'action'|
    'confirmed'|
    'completed'|
    'all'

  const {t}=useTranslation()

  const [filter,setFilter]=
    useState<RequestFilter>('action')

  const list=
    Array.isArray(bookings)
      ? bookings
      : []

  const needsAction=
    list.filter(
      (b:any)=>
        [
          'pending',
          'clarification',
          'quoted'
        ].includes(b.status)
    )

  const confirmed=
    list.filter(
      (b:any)=>
        b.status==='accepted'
    )

  const completed=
    list.filter(
      (b:any)=>
        b.status==='completed'
    )

  const cancelled=
    list.filter(
      (b:any)=>
        b.status==='cancelled'
    )

  const priority=(booking:any)=>{

    switch(booking.status){

      case 'pending':
        return 0

      case 'clarification':
        return 1

      case 'quoted':
        return 2

      case 'accepted':
        return 3

      case 'completed':
        return 4

      case 'cancelled':
        return 5

      default:
        return 6
    }
  }

  const bookingTime=(booking:any)=>{

    const value=
      booking.createdAt||
      booking.updatedAt||
      booking.date||
      ''

    const parsed=
      new Date(value).getTime()

    return Number.isFinite(parsed)
      ? parsed
      : 0
  }

  const sorted=
    [...list]
      .sort((a:any,b:any)=>{

        const priorityDiff=
          priority(a)-priority(b)

        if(priorityDiff!==0){
          return priorityDiff
        }

        return bookingTime(b)-bookingTime(a)
      })

  const visible=
    sorted.filter((booking:any)=>{

      if(filter==='action'){
        return [
          'pending',
          'clarification',
          'quoted'
        ].includes(booking.status)
      }

      if(filter==='confirmed'){
        return booking.status==='accepted'
      }

      if(filter==='completed'){
        return booking.status==='completed'
      }

      return true
    })

  const filterLabel=
    filter==='action'
      ? t('professionalRequests.filters.action')
      : filter==='confirmed'
        ? t('professionalRequests.filters.confirmed')
        : filter==='completed'
          ? t('professionalRequests.filters.completed')
          : t('professionalRequests.filters.all')

  return(

    <section className="pro-requests-workspace">

      <header className="pro-requests-hero">

        <div>

          <span className="pro-requests-kicker">
            MELEO PROFESSIONAL · REQUESTS
          </span>

          <h2>
            {t('professionalRequests.hero.title')}
            <em>{t('professionalRequests.hero.titleEm')}</em>
          </h2>

          <p>
{t('professionalRequests.hero.intro')}
          </p>

        </div>

        <div className="pro-requests-focus">

          <small>{t('professionalRequests.hero.attention')}</small>

          <strong>
            {needsAction.length}
          </strong>

          <span>
            {needsAction.length===1
              ? t('professionalRequests.hero.activeOne')
              : t('professionalRequests.hero.activeMany')}
          </span>

        </div>

      </header>


      <section className="pro-request-kpis">

        <button
          type="button"
          className={
            filter==='action'
              ? 'active attention'
              : 'attention'
          }
          onClick={()=>setFilter('action')}
        >
          <span>●</span>

          <div>
            <small>{t('professionalRequests.kpi.attention')}</small>
            <strong>{needsAction.length}</strong>
          </div>

          <em>{t('professionalRequests.kpi.attentionSub')}</em>
        </button>


        <button
          type="button"
          className={
            filter==='confirmed'
              ? 'active'
              : ''
          }
          onClick={()=>setFilter('confirmed')}
        >
          <span>✓</span>

          <div>
            <small>{t('professionalRequests.kpi.confirmed')}</small>
            <strong>{confirmed.length}</strong>
          </div>

          <em>{t('professionalRequests.kpi.confirmedSub')}</em>
        </button>


        <button
          type="button"
          className={
            filter==='completed'
              ? 'active'
              : ''
          }
          onClick={()=>setFilter('completed')}
        >
          <span>◎</span>

          <div>
            <small>{t('professionalRequests.kpi.completed')}</small>
            <strong>{completed.length}</strong>
          </div>

          <em>{t('professionalRequests.kpi.completedSub')}</em>
        </button>


        <button
          type="button"
          className={
            filter==='all'
              ? 'active'
              : ''
          }
          onClick={()=>setFilter('all')}
        >
          <span>≡</span>

          <div>
            <small>{t('professionalRequests.kpi.total')}</small>
            <strong>{list.length}</strong>
          </div>

          <em>
            {cancelled.length
              ? t('professionalRequests.kpi.cancelled',{count:cancelled.length})
              : t('professionalRequests.kpi.activity')}
          </em>
        </button>

      </section>


      <div className="pro-request-toolbar">

        <div>

          <span>
            {filterLabel}
          </span>

          <strong>
            {visible.length}
          </strong>

        </div>

        <div className="pro-request-filter-tabs">

          <button
            type="button"
            className={
              filter==='action'
                ? 'active'
                : ''
            }
            onClick={()=>setFilter('action')}
          >
            {t('professionalRequests.tabs.action')}

            {needsAction.length>0&&
              <i>
                {needsAction.length}
              </i>
            }

          </button>

          <button
            type="button"
            className={
              filter==='confirmed'
                ? 'active'
                : ''
            }
            onClick={()=>setFilter('confirmed')}
          >
            {t('professionalRequests.tabs.confirmed')}
          </button>

          <button
            type="button"
            className={
              filter==='completed'
                ? 'active'
                : ''
            }
            onClick={()=>setFilter('completed')}
          >
            {t('professionalRequests.tabs.completed')}
          </button>

          <button
            type="button"
            className={
              filter==='all'
                ? 'active'
                : ''
            }
            onClick={()=>setFilter('all')}
          >
            {t('professionalRequests.tabs.all')}
          </button>

        </div>

      </div>


      <div className="pro-request-worklist">

        {visible.length
          ? visible.map((booking:any)=>

              <CompactBooking
                key={booking.id}
                b={booking}
                status={status}
                full
                token={token}
                onRefresh={onRefresh}
                setToast={setToast}
              />

            )
          : <div className="pro-request-empty">

              <span>
                {filter==='action'
                  ? '✓'
                  : '○'}
              </span>

              <h3>
                {filter==='action'
                  ? t('professionalRequests.empty.actionTitle')
                  : t('professionalRequests.empty.otherTitle')}
              </h3>

              <p>
                {filter==='action'
                  ? t('professionalRequests.empty.actionText')
                  : t('professionalRequests.empty.otherText')}
              </p>

            </div>
        }

      </div>

    </section>
  )
}

function ProfessionalOnboarding({user,professional,token,onRefresh,setToast,cfg}:any){
 const {t}=useTranslation()
 const initialPlan=(sessionStorage.getItem('meleo_selected_plan')||professional?.subscriptionPlan||'basic') as 'basic'|'premium'
 const initialStep=professional?.subscriptionStatus==='active'?(professional?.onboardingStage==='verification'?4:3):1
 const [step,setStep]=useState(initialStep),[plan,setPlan]=useState<'basic'|'premium'>(initialPlan),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const [pf,setPf]=useState<any>({...professional,title:professional?.title||'',specialty:professional?.specialty||'',city:professional?.city||'',serviceRadiusKm:professional?.serviceRadiusKm||15,pricingMode:professional?.pricingMode||'contact',price:professional?.price||25,years:professional?.years||0,bio:professional?.bio||'',services:Array.isArray(professional?.services)?professional.services:[],showPhone:professional?.showPhone!==false,showEmail:professional?.showEmail!==false,preferPlatformContact:Boolean(professional?.preferPlatformContact)})
 const [vr,setVr]=useState({licenseNumber:'',notes:''}); const [docs,setDocs]=useState<any[]>([]); const [uploadBusy,setUploadBusy]=useState(false)
 const price=plan==='premium'?14.99:9.99
 async function checkout(){
   setError('');setBusy(true)
   try{
     const r=await api('/professional/subscription/checkout',{method:'POST',body:JSON.stringify({plan})},token)
     if(r.mode==='stripe'&&r.url){window.location.href=r.url;return}
     sessionStorage.removeItem('meleo_selected_plan')
     await onRefresh();setStep(3)
     setToast(r.mode==='demo'?t('professionalOnboarding.toast.demoActivated',{plan:plan.toUpperCase()}):t('professionalOnboarding.toast.planChanged',{plan:plan.toUpperCase()}))
   }catch(e:any){setError(e.message)}finally{setBusy(false)}
 }
 async function saveProfessional(){setError('');if(!pf.title||!pf.specialty||!pf.city){setError(t('professionalOnboarding.errors.profileRequired'));return}setBusy(true);try{const payload={...pf,years:Number(pf.years||0),price:Number(pf.price||0),serviceRadiusKm:Number(pf.serviceRadiusKm||15),services:Array.isArray(pf.services)?pf.services:[],availability:Array.isArray(pf.availability)?pf.availability:[]};await api('/professional/profile',{method:'PUT',body:JSON.stringify(payload)},token);await onRefresh();setStep(4);setToast(t('professionalOnboarding.toast.profileSaved'))}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 async function uploadVerificationFile(file:File){setError('');setUploadBusy(true);try{if(file.size>5*1024*1024)throw new Error(t('professionalOnboarding.errors.fileTooLarge'));const dataBase64=await fileToBase64(file);const d=await api('/professional/verification-document',{method:'POST',body:JSON.stringify({name:file.name,data:dataBase64})},token);setDocs((x:any[])=>[...x,d]);setToast(t('professionalOnboarding.toast.documentUploaded'))}catch(e:any){setError(e.message)}finally{setUploadBusy(false)}}
 async function submitVerification(){setError('');if(!vr.licenseNumber.trim()){setError(t('professionalOnboarding.errors.licenseRequired'));return}setBusy(true);try{await api('/professional/verification',{method:'POST',body:JSON.stringify(vr)},token);await onRefresh();setToast(t('professionalOnboarding.toast.verificationSubmitted'))}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 function toggleService(service:string){setPf((x:any)=>({...x,services:(x.services||[]).includes(service)?x.services.filter((v:string)=>v!==service):[...(x.services||[]),service]}))}
 return <section className="onboarding-page"><div className="onboarding-shell"><div className="onboarding-brand"><Mark/><span>PROFESSIONAL ONBOARDING</span></div><div className="onboarding-progress">{[['1',t('professionalOnboarding.progress.plan')],['2','Checkout'],['3',t('professionalOnboarding.progress.profile')],['4','Verification']].map(([n,l],i)=><div className={(step>=i+1?'active ':'')+(step===i+1?'current':'')} key={n}><i>{n}</i><span>{l}</span></div>)}</div>
 {step===1&&<div className="onboarding-card"><div className="onboarding-heading"><span>{t('professionalOnboarding.step1.kicker')}</span><h1>{t('professionalOnboarding.step1.title')}</h1><p>{t('professionalOnboarding.step1.intro')}</p></div><div className="onboarding-plans"><button className={plan==='basic'?'selected':''} onClick={()=>setPlan('basic')}><span>BASIC</span><strong>9,99€<small>{t('professionalOnboarding.step2.perMonth')}</small></strong><p>{t('professionalOnboarding.step1.basicBody')}</p><b>{plan==='basic'?t('professionalOnboarding.step1.selected'):t('professionalOnboarding.step1.chooseBasic')}</b></button><button className={'premium '+(plan==='premium'?'selected':'')} onClick={()=>setPlan('premium')}><em>{t('professionalOnboarding.step1.recommended')}</em><span>PREMIUM</span><strong>14,99€<small>{t('professionalOnboarding.step2.perMonth')}</small></strong><p>{t('professionalOnboarding.step1.premiumBody')}</p><b>{plan==='premium'?t('professionalOnboarding.step1.selected'):t('professionalOnboarding.step1.choosePremium')}</b></button></div><button className="btn btn-dark onboarding-next" onClick={()=>setStep(2)}>{t('professionalOnboarding.step1.continue')}</button></div>}
 {step===2&&<div className="onboarding-card checkout-card"><button className="back" onClick={()=>setStep(1)}>{t('professionalOnboarding.step2.back')}</button><div className="onboarding-heading"><span>{t('professionalOnboarding.step2.kicker')}</span><h1>{t('professionalOnboarding.step2.title',{plan:plan.toUpperCase()})}</h1><p>{t('professionalOnboarding.step2.intro',{price:money(price)})}</p></div><div className="checkout-layout"><div className="checkout-form">
   <div className="pay-methods"><span className="pay-chip">{t('professionalOnboarding.step2.card')}</span><span className="pay-chip">Google&nbsp;Pay</span><span className="pay-chip">Apple&nbsp;Pay</span></div>
   <ul className="checkout-facts"><li>{t('professionalOnboarding.step2.fact1')}</li><li>{t('professionalOnboarding.step2.fact2')}</li><li>{t('professionalOnboarding.step2.fact3')}</li><li>{t('professionalOnboarding.step2.fact4')}</li></ul>
   {!cfg?.paymentsEnabled&&cfg?.demoCheckout&&<div className="notice">{t('professionalOnboarding.step2.demoNotice')}</div>}
   {!cfg?.paymentsEnabled&&!cfg?.demoCheckout&&<div className="error">{t('professionalOnboarding.step2.paymentsDisabled')}</div>}
   {error&&<div className="error">{error}</div>}
   <button className="btn btn-gold wide" disabled={busy} onClick={checkout}>{busy?t('professionalOnboarding.step2.redirecting'):t('professionalOnboarding.step2.pay',{price:money(price)})}</button>
   <small className="terms">{t('professionalOnboarding.step2.terms')}</small>
 </div><aside className="checkout-summary"><span>MELEO PROFESSIONAL</span><h3>{plan.toUpperCase()}</h3><div><b>{money(price)}</b><small>{t('professionalOnboarding.step2.perMonth')}</small></div><p>{t('professionalOnboarding.step2.summary')}</p></aside></div></div>}
 {step===3&&<div className="onboarding-card"><div className="onboarding-heading"><span>{t('professionalOnboarding.step3.kicker')}</span><h1>{t('professionalOnboarding.step3.title')}</h1><p>{t('professionalOnboarding.step3.intro')}</p></div><div className="form-grid"><label>{t('professionalOnboarding.step3.professionalTitle')}<input value={pf.title||''} onChange={e=>setPf({...pf,title:e.target.value})} placeholder={t('professionalOnboarding.step3.titlePlaceholder')}/></label><label>{t('professionalOnboarding.step3.specialty')}<select value={pf.specialty||''} onChange={e=>setPf({...pf,specialty:e.target.value,services:[]})}><option value="">{t('professionalOnboarding.step3.selectSpecialty')}</option>{specialtyOptions.map(x=><option key={x}>{x}</option>)}</select></label><ProfessionalLocationEditor form={pf} setForm={setPf}/><label>{t('professionalOnboarding.step3.years')}<input type="number" min="0" value={pf.years||''} onChange={e=>setPf({...pf,years:e.target.value})}/></label><label>{t('professionalOnboarding.step3.pricingMode')}<select value={pf.pricingMode||'contact'} onChange={e=>setPf({...pf,pricingMode:e.target.value})}><option value="contact">{t('professionalOnboarding.step3.contact')}</option><option value="from">{t('professionalOnboarding.step3.from')}</option></select></label>{pf.pricingMode==='from'&&<label>{t('professionalOnboarding.step3.basePrice')}<input type="number" min="0" value={pf.price||''} onChange={e=>setPf({...pf,price:e.target.value})}/></label>}<label className="full">{t('professionalOnboarding.step3.bio')}<textarea value={pf.bio||''} onChange={e=>setPf({...pf,bio:e.target.value})}/></label>{pf.specialty&&<div className="full onboarding-services"><b>{t('professionalOnboarding.step3.services')}</b><div>{(serviceMap[pf.specialty]||[]).map(x=><button type="button" key={x} className={(pf.services||[]).includes(x)?'selected':''} onClick={()=>toggleService(x)}>{(pf.services||[]).includes(x)?'✓ ':''}{x}</button>)}</div></div>}</div>{error&&<div className="error">{error}</div>}<button className="btn btn-dark onboarding-next" disabled={busy} onClick={saveProfessional}>{busy?t('professionalOnboarding.step3.saving'):t('professionalOnboarding.step3.continue')}</button></div>}
 {step===4&&<div className="onboarding-card"><div className="onboarding-heading"><span>{t('professionalOnboarding.step4.kicker')}</span><h1>Professional Verification</h1><p>{t('professionalOnboarding.step4.intro')}</p></div><div className="verification-layout"><div className="checkout-form"><label>{t('professionalOnboarding.step4.license')}<input value={vr.licenseNumber} onChange={e=>setVr({...vr,licenseNumber:e.target.value})}/></label><label>{t('professionalOnboarding.step4.documents')}<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={uploadBusy} onChange={e=>{const f=e.target.files?.[0];if(f)uploadVerificationFile(f)}}/><small className="field-hint">{t('professionalOnboarding.step4.fileHint')}</small></label>{docs.length>0&&<div className="uploaded-docs">{docs.map((d:any)=><span key={d.id}>✓ {d.name}</span>)}</div>}<label>{t('professionalOnboarding.step4.notes')}<textarea value={vr.notes} onChange={e=>setVr({...vr,notes:e.target.value})} placeholder={t('professionalOnboarding.step4.notesPlaceholder')}/></label>{error&&<div className="error">{error}</div>}<button className="btn btn-gold wide" disabled={busy} onClick={submitVerification}>{busy?t('professionalOnboarding.step4.submitting'):t('professionalOnboarding.step4.submit')}</button></div><aside className="checkout-summary"><span>{t('professionalOnboarding.step4.afterSubmit')}</span><h3>Pending Verification</h3><p>{t('professionalOnboarding.step4.pendingBody')}</p></aside></div></div>}
 <div className="onboarding-foot">{t('professionalOnboarding.foot')} <b>{t('professionalOnboarding.footFlow')}</b></div></div></section>
}
function ProfessionalLocationEditor({form,setForm}:any){const {t}=useTranslation();const [busy,setBusy]=useState(false);const [msg,setMsg]=useState('');async function resolveTyped(){if(!form.city)return;setBusy(true);setMsg('');try{const r=await api('/location/search?q='+encodeURIComponent(form.city));if(!r[0])throw new Error(t('professionalLocation.errors.notFound'));const x=r[0];setForm({...form,city:x.city||form.city,region:x.region||'',countryCode:x.countryCode||'',latitude:x.lat,longitude:x.lon});setMsg(t('professionalLocation.toast.saved'))}catch(e:any){setMsg(e.message)}finally{setBusy(false)}}function gps(){if(!navigator.geolocation){setMsg(t('professionalLocation.errors.gpsUnsupported'));return}setBusy(true);navigator.geolocation.getCurrentPosition(async pos=>{try{const x=await api(`/location/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);setForm({...form,city:x.city||form.city,region:x.region||'',countryCode:x.countryCode||'',latitude:pos.coords.latitude,longitude:pos.coords.longitude});setMsg(t('professionalLocation.toast.gpsUsed'))}catch(e:any){setMsg(e.message)}finally{setBusy(false)}},()=>{setMsg(t('professionalLocation.errors.permissionDenied'));setBusy(false)},{enableHighAccuracy:true,timeout:10000})}return <><label>{t('professionalLocation.fields.city')}<div className="pro-location-entry"><input value={form.city||''} onChange={e=>setForm({...form,city:e.target.value,latitude:null,longitude:null})} placeholder={t('professionalLocation.fields.cityPlaceholder')}/><button type="button" onClick={resolveTyped} disabled={busy||!form.city}>{t('professionalLocation.fields.find')}</button></div></label><label>{t('professionalLocation.fields.radius')}<input type="number" min="1" max="300" value={form.serviceRadiusKm||15} onChange={e=>setForm({...form,serviceRadiusKm:Number(e.target.value)})}/></label><div className="full location-professional-box"><button type="button" className="btn btn-outline" onClick={gps} disabled={busy}>{t('professionalLocation.actions.useGps')}</button><div><b>{form.latitude&&form.longitude?t('professionalLocation.status.active'):t('professionalLocation.status.define')}</b><small>{form.city||t('professionalLocation.status.noCity')}{form.region?' · '+form.region:''}{form.countryCode?' · '+String(form.countryCode).toUpperCase():''} · {t('professionalLocation.status.radius',{radius:form.serviceRadiusKm||15})}</small>{msg&&<small className="location-msg">{msg}</small>}</div></div></>}
function CompactBooking({b,status,full=false,token,onRefresh,setToast}:any){
 const {t}=useTranslation()
 const [expanded,setExpanded]=useState(false);const [question,setQuestion]=useState('');const [quote,setQuote]=useState(String(b.proposedPrice||b.agreedPrice||b.price||''));const [msg,setMsg]=useState('');const [chat,setChat]=useState('')
 const [readBusy,setReadBusy]=useState(false)
 ; async function markConversationRead(){
  if(readBusy)return

  try{
    setReadBusy(true)

    await api(
      '/bookings/'+b.id+'/messages/read',
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
      'Could not mark professional conversation as read',
      e
    )
  }
  finally{
    setReadBusy(false)
  }
}
async function sendChat(){
  if(!chat.trim())return

  await api(
    '/bookings/'+b.id+'/message',
    {
      method:'POST',
      body:JSON.stringify({text:chat})
    },
    token
  )

  setChat('')

  await onRefresh()

  window.dispatchEvent(
    new CustomEvent('meleo:communication-refresh')
  )
}
 async function clarify(){if(!question.trim())return;await api('/bookings/'+b.id+'/clarification',{method:'POST',body:JSON.stringify({question})},token);setQuestion('');setExpanded(true);await onRefresh();setToast(t('professionalBooking.toast.clarificationSent'))}
 async function sendQuote(){const value=Number(quote);if(!value||value<=0)return setMsg(t('professionalBooking.errors.finalCostRequired'));await api('/bookings/'+b.id+'/quote',{method:'POST',body:JSON.stringify({amount:value,message:msg})},token);setMsg('');await onRefresh();setToast(t('professionalBooking.toast.quoteSent'))}
 return <div className={
  'request-card-pro '+
  'request-state-'+String(b.status||'unknown')+' '+
  (expanded?'expanded ':'')+
  (full?'full':'')
}><div className="request-row" onClick={()=>{
  const next=!expanded
  setExpanded(next)

  if(next){
    markConversationRead()
  }
}}><div className="request-icon">⌂</div><div><b>{b.patientName}</b><span>{b.service}</span><small>{b.date} · {b.time} · {b.address}</small></div><div className="request-price">{b.agreedPrice?`${b.agreedPrice}€`:b.proposedPrice?`${b.proposedPrice}€`:b.price?t('professionalBooking.price.from',{price:b.price}):t('professionalBooking.price.contact')}</div><span className={'status '+b.status}>{statusLabel(b.status)}</span>
<button
  className="small-action"
  onClick={e=>{
    e.stopPropagation()

    const next=!expanded
    setExpanded(next)

    if(next){
      markConversationRead()
    }
  }}
>
  {expanded?t('professionalBooking.actions.close'):t('professionalBooking.actions.open')}
</button>
</div>{expanded&&<div className="pro-request-detail"><div className="request-contact-strip"><div><small>{t('professionalBooking.detail.contact')}</small><b>{b.patientName}</b></div><a href={`mailto:${b.patientEmail}`}>✉ {b.patientEmail}</a>{b.patientPhone&&<a href={`tel:${b.patientPhone}`}>☎ {b.patientPhone}</a>}</div><div className="request-detail-grid three"><div><small>{t('professionalBooking.detail.service')}</small><b>{b.service}</b><span>{repeatLabel(b.repeat)}</span></div><div><small>{t('professionalBooking.detail.visit')}</small><b>{b.date} · {b.time}</b><span>{b.address}</span></div><div><small>{t('professionalBooking.detail.indicativePrice')}</small><b>{b.price?t('professionalBooking.price.from',{price:b.price}):t('professionalBooking.price.contactShort')}</b><span>{t('professionalBooking.detail.finalCostNote')}</span></div></div><div className="request-description important"><small>{t('professionalBooking.detail.analysis')}</small><p>{b.notes||t('professionalBooking.detail.analysisFallback')}</p></div><Conversation messages={b.messages||[]}/><CalendarActions booking={b}/>{b.status!=='cancelled'&&<div className="reply-box realtime-chat-box"><textarea placeholder={t('professionalBooking.chat.placeholder')} value={chat} onChange={e=>setChat(e.target.value)}/><button className="btn btn-dark" onClick={sendChat}>{t('professionalBooking.actions.sendMessage')}</button><small>{t('professionalBooking.chat.live')}</small></div>}{['pending','clarification'].includes(b.status)&&<div className="professional-decision-grid"><div className="decision-panel"><h4>{t('professionalBooking.decision.clarificationTitle')}</h4><textarea placeholder={t('professionalBooking.decision.clarificationPlaceholder')} value={question} onChange={e=>setQuestion(e.target.value)}/><button className="btn btn-outline wide" onClick={clarify}>{t('professionalBooking.actions.askClarification')}</button></div><div className="decision-panel highlight"><h4>{t('professionalBooking.decision.quoteTitle')}</h4><label>{t('professionalBooking.decision.quoteLabel')}<input type="number" min="1" value={quote} onChange={e=>setQuote(e.target.value)}/></label><textarea placeholder={t('professionalBooking.decision.quotePlaceholder')} value={msg} onChange={e=>setMsg(e.target.value)}/><button className="btn btn-dark wide" onClick={sendQuote}>{t('professionalBooking.actions.sendQuote')}</button></div></div>}{b.status==='quoted'&&<div className="quote-waiting"><b>{t('professionalBooking.states.waitingTitle')}</b><span>{t('professionalBooking.states.waitingText',{price:b.proposedPrice})}</span></div>}{b.status==='accepted'&&<div className="accepted-actions"><div><b>{t('professionalBooking.states.acceptedTitle')}</b><span>{t('professionalBooking.states.agreedCost',{price:b.agreedPrice||b.proposedPrice||b.price})}</span></div><button className="small-action" onClick={()=>status(b.id,'completed')}>{t('professionalBooking.actions.complete')}</button></div>}{['pending','clarification'].includes(b.status)&&<div className="reject-line"><button className="text-btn danger" onClick={()=>status(b.id,'cancelled')}>{t('professionalBooking.actions.reject')}</button></div>}</div>}</div>
}
export default ProfessionalDashboard
