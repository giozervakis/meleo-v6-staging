import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from './lib/api'
import { viewFromPath, pathForView, pushView } from './lib/router'
import type { User, Professional, BookingMessage, Booking, Plan, AppConfig } from './domain/types'
import { serviceMap, specialtyOptions } from './domain/catalog'
import { availabilityLabel, catalogLabel, localizedPriceLabel, localizedPriceNote } from './domain/catalog-i18n'
import { Home, SearchBox, SmartRequest, NowRequest } from './features/home/HomeExperience'
import LanguageSwitcher from './components/LanguageSwitcher'
const AdminPage = lazy(() => import('./features/admin/AdminPage'))
const ProfessionalDashboardPage = lazy(() => import('./features/professional/ProfessionalDashboard'))
const PatientDashboardPage = lazy(
  () => import('./features/patient/PatientDashboard')
)
const SearchPageView = lazy(
  () => import('./features/search/SearchPage')
)
const NotificationsPage = lazy(() => import('./features/support/SupportPages').then(m => ({default:m.NotificationsPage})))
const HelpCenter = lazy(() => import('./features/support/SupportPages').then(m => ({default:m.HelpCenter})))
const AccountSettingsView = lazy(() => import('./Account').then(m => ({default:m.AccountSettings})))
const LegalView = lazy(() => import('./Account').then(m => ({default:m.Legal})))
const ProfilePage = lazy(
  () => import('./features/profile/Profile')
)

const BookingFlowPage = lazy(
  () => import('./features/booking/BookingFlow')
)
function RouteFallback(){return <div className="route-loading" role="status" aria-live="polite"><span className="route-spinner"/>Φόρτωση MELEO…</div>}


function initials(name:string){ return name.split(' ').slice(0,2).map(x=>x[0]).join('').toUpperCase() }
function IdentityAvatar({
  name,
  photoUrl,
  avatarKey,
  size='md',
  className=''
}:any){
  if(photoUrl){
    return (
      <div className={`identity-avatar ${size} ${className}`}>
        <img
          src={photoUrl}
          alt={name||'MELEO profile'}
          loading="lazy"
        />
      </div>
    )
  }

  if(avatarKey){
    return (
      <div
        className={`identity-avatar ${size} meleo-avatar ${avatarKey} ${className}`}
        aria-label={name||'MELEO avatar'}
      >
        <span/>
      </div>
    )
  }

  return (
    <div className={`identity-avatar ${size} initials-avatar ${className}`}>
      {initials(name)}
    </div>
  )
}
function ProfileIdentityModal({
  user,
  onClose,
  onUpdated,
  setToast
}:any){
  const avatars=[
    'care-01','care-02','care-03','care-04',
    'care-05','care-06','care-07','care-08',
    'care-09','care-10','care-11','care-12'
  ]

  const [selectedAvatar,setSelectedAvatar]=useState(
    user?.avatarKey||''
  )

  const [imageSrc,setImageSrc]=useState('')
  const [zoom,setZoom]=useState(1)
  const [offsetX,setOffsetX]=useState(0)
  const [offsetY,setOffsetY]=useState(0)
  const [busy,setBusy]=useState(false)

  async function chooseAvatar(key:string){
    try{
      setBusy(true)

      const r=await api(
        '/me/avatar',
        {
          method:'PUT',
          body:JSON.stringify({
            avatarKey:key
          })
        }
      )

      setSelectedAvatar(key)
      onUpdated?.(r.user)

      setToast(
        'Το avatar ενημερώθηκε.'
      )
    }
    catch(e:any){
      setToast(e.message)
    }
    finally{
      setBusy(false)
    }
  }

  function pickFile(file?:File){
    if(!file)return

    if(![
      'image/jpeg',
      'image/png',
      'image/webp'
    ].includes(file.type)){
      setToast(
        'Επίλεξε JPG, PNG ή WEBP.'
      )
      return
    }

    if(file.size>6_000_000){
      setToast(
        'Η αρχική εικόνα είναι πολύ μεγάλη.'
      )
      return
    }

    const reader=new FileReader()

    reader.onload=()=>{
      setImageSrc(
        String(reader.result||'')
      )

      setZoom(1)
      setOffsetX(0)
      setOffsetY(0)
    }

    reader.readAsDataURL(file)
  }

  async function savePhoto(){
    if(!imageSrc)return

    try{
      setBusy(true)

      const data=
        await cropImageToBase64(
          imageSrc,
          zoom,
          offsetX,
          offsetY
        )

      const r=await api(
        '/me/profile-photo',
        {
          method:'POST',
          body:JSON.stringify({
            data
          })
        }
      )

      onUpdated?.(r.user)

      setToast(
        'Η φωτογραφία προφίλ αποθηκεύτηκε.'
      )

      setImageSrc('')
    }
    catch(e:any){
      setToast(e.message)
    }
    finally{
      setBusy(false)
    }
  }

  async function removePhoto(){
    try{
      setBusy(true)

      const r=await api(
        '/me/profile-photo',
        {
          method:'DELETE'
        }
      )

      onUpdated?.(r.user)

      setToast(
        'Η φωτογραφία αφαιρέθηκε.'
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
    <div
      className="identity-modal-backdrop"
      onClick={onClose}
    >
      <div
        className="identity-modal"
        onClick={e=>e.stopPropagation()}
      >

        <div className="identity-modal-head">
          <div>
            <small>MELEO PROFILE IDENTITY</small>
            <h2>Η εικόνα προφίλ μου</h2>
            <p>
              Πρόσθεσε φωτογραφία ή επίλεξε ένα MELEO avatar.
            </p>
          </div>

          <button
            className="identity-close"
            onClick={onClose}
            aria-label="Κλείσιμο"
          >
            ×
          </button>
        </div>

        <div className="identity-current">

          <IdentityAvatar
            name={user?.name}
            photoUrl={user?.profilePhotoUrl}
            avatarKey={user?.avatarKey}
            size="xl"
          />

          <div>
            <b>{user?.name}</b>
            <small>
              Η φωτογραφία είναι προαιρετική.
            </small>
          </div>

        </div>

        <div className="identity-section">
          <h3>Επίλεξε avatar</h3>

          <div className="identity-avatar-grid">
            {avatars.map(key=>
              <button
                key={key}
                className={
                  'identity-avatar-choice '+
                  (selectedAvatar===key
                    ? 'selected'
                    : '')
                }
                onClick={()=>chooseAvatar(key)}
                disabled={busy}
              >
                <IdentityAvatar
                  name={user?.name}
                  avatarKey={key}
                  size="md"
                />
              </button>
            )}
          </div>
        </div>

        <div className="identity-divider">
          <span>ή</span>
        </div>

        <div className="identity-section">
          <h3>Ανέβασε φωτογραφία</h3>

          <label className="identity-upload-btn">
            Επιλογή φωτογραφίας

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={e=>
                pickFile(
                  e.target.files?.[0]
                )
              }
            />
          </label>

          {imageSrc&&
            <div className="identity-crop-box">

              <div className="identity-crop-preview">
                <img
                  src={imageSrc}
                  alt=""
                  style={{
                    transform:
                      `translate(${offsetX}px,${offsetY}px) scale(${zoom})`
                  }}
                />

                <div className="identity-crop-mask"/>
              </div>

              <label>
                Zoom
                <input
                  type="range"
                  min="1"
                  max="2.5"
                  step=".05"
                  value={zoom}
                  onChange={e=>
                    setZoom(
                      Number(e.target.value)
                    )
                  }
                />
              </label>

              <div className="identity-position-controls">
                <button
                  onClick={()=>setOffsetY(v=>v-10)}
                >
                  ↑
                </button>

                <button
                  onClick={()=>setOffsetX(v=>v-10)}
                >
                  ←
                </button>

                <button
                  onClick={()=>setOffsetX(v=>v+10)}
                >
                  →
                </button>

                <button
                  onClick={()=>setOffsetY(v=>v+10)}
                >
                  ↓
                </button>
              </div>

              <button
                className="btn btn-dark wide"
                onClick={savePhoto}
                disabled={busy}
              >
                {busy
                  ? 'Αποθήκευση…'
                  : 'Αποθήκευση φωτογραφίας'
                }
              </button>

            </div>
          }

          {user?.profilePhotoUrl&&
            <button
              className="btn btn-outline wide identity-remove-photo"
              onClick={removePhoto}
              disabled={busy}
            >
              Αφαίρεση φωτογραφίας
            </button>
          }
        </div>

      </div>
    </div>
  )
}
function statusLabel(s:string){ return ({pending:'Σε αναμονή',clarification:'Χρειάζονται διευκρινίσεις',quoted:'Πρόταση κόστους',accepted:'Επιβεβαιωμένη',completed:'Ολοκληρώθηκε',cancelled:'Ακυρώθηκε'} as any)[s]||s }
function professionalLifecycleLabel(s:string){return ({approved:'Verified',pending_verification:'Pending Verification',verification_rejected:'Verification Rejected',awaiting_subscription:'Αναμονή συνδρομής',profile_incomplete:'Ελλιπές προφίλ',verification_required:'Αναμονή υποβολής verification',deletion_pending:'Διαγραφή σε αναμονή'} as any)[s]||'—'}
function professionalLifecycleClass(s:string){return s==='approved'?'yes':s==='pending_verification'?'pending':s==='verification_rejected'?'no':'neutral'}
async function fileToBase64(file:File){return await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||'').split(',')[1]||'');r.onerror=()=>reject(new Error('Αδυναμία ανάγνωσης αρχείου'));r.readAsDataURL(file)})}
async function cropImageToBase64(
  src:string,
  zoom:number,
  offsetX:number,
  offsetY:number
){
  return await new Promise<string>((resolve,reject)=>{
    const img=new Image()

    img.onload=()=>{
      const canvas=document.createElement('canvas')
      const size=640

      canvas.width=size
      canvas.height=size

      const ctx=canvas.getContext('2d')

      if(!ctx){
        reject(new Error('Canvas unavailable'))
        return
      }

      const scale=Math.max(
        size/img.width,
        size/img.height
      )*zoom

      const w=img.width*scale
      const h=img.height*scale

      const x=(size-w)/2 + offsetX
      const y=(size-h)/2 + offsetY

      ctx.fillStyle='#ffffff'
      ctx.fillRect(0,0,size,size)

      ctx.drawImage(
        img,
        x,
        y,
        w,
        h
      )

      const dataUrl=
        canvas.toDataURL(
          'image/jpeg',
          .86
        )

      resolve(
        dataUrl.split(',')[1]||''
      )
    }

    img.onerror=()=>reject(
      new Error('Η εικόνα δεν μπόρεσε να φορτωθεί.')
    )

    img.src=src
  })
}
function analyticsSessionId(){
  try{let v=sessionStorage.getItem('meleo_analytics_session');if(!v){v=(crypto?.randomUUID?.()||Math.random().toString(36).slice(2));sessionStorage.setItem('meleo_analytics_session',v)}return v}catch{return 'session'}
}
function trackProfessionalEvent(professionalId:string,type:'impression'|'profile_view'|'phone_click'){
  if(!professionalId)return
  const sid=analyticsSessionId();const key=`meleo_evt_${sid}_${type}_${professionalId}`
  try{if(type!=='phone_click'&&sessionStorage.getItem(key))return;if(type!=='phone_click')sessionStorage.setItem(key,'1')}catch{}
  api('/analytics/professional-event',{method:'POST',body:JSON.stringify({professionalId,type,sessionId:sid})}).catch(()=>{})
}

const FALLBACK_CONFIG:AppConfig={env:'production',demoAuth:false,googleOAuthEnabled:false,demoCheckout:false,paymentsEnabled:false,mailEnabled:false,portalEnabled:false,termsVersion:'—',emergencyNumber:'112',legal:{company:'',vatNumber:'',address:'',supportEmail:'support@meleo.gr',dpoEmail:'privacy@meleo.gr'},plans:[
  {id:'basic',name:'BASIC',price:9.99,currency:'EUR',interval:'month',recommended:false,features:['Δημόσιο επαγγελματικό προφίλ','Αιτήματα και διαχείριση κρατήσεων','Περιοχή & ακτίνα εξυπηρέτησης','Βασικά στατιστικά']},
  {id:'premium',name:'PREMIUM',price:14.99,currency:'EUR',interval:'month',recommended:true,features:['Όλα τα BASIC','Σήμανση «Προτεινόμενος»','Προτεραιότητα στην κατάταξη αποτελεσμάτων','Advanced profile analytics']}
]}
const money=(v:number)=>`${Number(v||0).toFixed(2).replace('.',',')}€`
function Mark(){return <div className="brand"><span className="brand-glyph">M</span><span>MELEO</span></div>}
function priceLabel(p:Professional, compact=false){if((p.pricingMode||'from')==='contact')return compact?'Κατόπιν επικοινωνίας':'Κατόπιν επικοινωνίας';return `Από ${p.price}€`}
function priceNote(p:Professional){return (p.pricingMode||'from')==='contact'?'Το κόστος συμφωνείται απευθείας με τον επαγγελματία.':'Βασικό κόστος απλής επίσκεψης · η τελική χρέωση διαμορφώνεται ανάλογα με τις ανάγκες και συμφωνείται πριν την επίσκεψη.'}
function Icon({children}:{children:React.ReactNode}){return <span className="iconbox">{children}</span>}
function Toast({text,onClose}:{text:string,onClose:()=>void}){useEffect(()=>{const t=setTimeout(onClose,3200);return()=>clearTimeout(t)},[]);return <div className="toast">{text}</div>}

function LiveEvents({user,setToast}:any){
 useEffect(()=>{if(!user)return;const es=new EventSource('/api/live',{withCredentials:true} as any);const handler=(ev:any)=>{try{const d=JSON.parse(ev.data||'{}');const n=d.notification;if(n){setToast(n.title);window.dispatchEvent(new CustomEvent('meleo:live',{detail:d}));if('Notification'in window&&Notification.permission==='granted'&&document.visibilityState!=='visible')new Notification(n.title,{body:n.text,tag:n.id})}}catch{}};es.addEventListener('meleo',handler);return()=>es.close()},[user?.id])
 return null
}

function CalendarActions({booking}:any){

  if(!['accepted','completed'].includes(booking?.status)){
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

  const iso = (d:Date) => d.toISOString()

  const compact = (d:Date) =>
    iso(d)
      .replace(/[-:]/g,'')
      .replace(/\.\d{3}Z$/,'Z')

  const title =
    `MELEO · ${booking?.service || 'Επίσκεψη'}`

  const loc = booking?.address || ''

  const desc =
    `MELEO booking · ${
      booking?.professionalName ||
      booking?.patientName ||
      ''
    }`

  const google =
    `https://calendar.google.com/calendar/render` +
    `?action=TEMPLATE` +
    `&text=${encodeURIComponent(title)}` +
    `&dates=${compact(start)}/${compact(end)}` +
    `&details=${encodeURIComponent(desc)}` +
    `&location=${encodeURIComponent(loc)}`

  const outlook =
    `https://outlook.live.com/calendar/0/deeplink/compose` +
    `?subject=${encodeURIComponent(title)}` +
    `&startdt=${encodeURIComponent(iso(start))}` +
    `&enddt=${encodeURIComponent(iso(end))}` +
    `&body=${encodeURIComponent(desc)}` +
    `&location=${encodeURIComponent(loc)}`

  const yahoo =
    `https://calendar.yahoo.com/` +
    `?v=60` +
    `&view=d` +
    `&type=20` +
    `&title=${encodeURIComponent(title)}` +
    `&st=${compact(start)}` +
    `&dur=0100` +
    `&desc=${encodeURIComponent(desc)}` +
    `&in_loc=${encodeURIComponent(loc)}`

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
        href={outlook}
        target="_blank"
        rel="noreferrer"
      >
        Outlook
      </a>

      <a
        href={yahoo}
        target="_blank"
        rel="noreferrer"
      >
        Yahoo
      </a>

      <a
        href={`/api/bookings/${booking.id}/calendar.ics`}
      >
        Apple / .ics
      </a>

    </div>
  )
}

export default function App(){
  const [token,setToken]=useState('cookie')
  const [user,setUser]=useState<User|null>(null)
  const [professional,setProfessional]=useState<Professional|null>(null)
  const [view,setViewState]=useState(()=>viewFromPath(window.location.pathname))
  const [authReturn,setAuthReturn]=useState('home')
  const [pros,setPros]=useState<Professional[]>([])
  const [selected,setSelected]=useState<Professional|null>(null)
  const [favorites,setFavorites]=useState<string[]>([])
  const [toast,setToast]=useState('')
  const [search,setSearch]=useState({specialty:'',service:'',locationQuery:'',locationLabel:'',lat:'',lon:''})
  const [loading,setLoading]=useState(true)
  const [cfg,setCfg]=useState<AppConfig>(FALLBACK_CONFIG)
  const [resetToken,setResetToken]=useState('')
  const [bookingSeed,setBookingSeed]=useState<any>(null)
    const [communicationUnread,setCommunicationUnread]=useState({
  notifications:0,
  messages:0,
  total:0
})
  const setView=(next:string, replace=false)=>{
  setViewState(next)
  pushView(next,selected?.id,replace)
}

/* Always start a new MELEO view from the top */
useEffect(()=>{
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: 'auto'
  })
},[view])

useEffect(()=>{
  const onPop=()=>{
    const v=viewFromPath(window.location.pathname)
    setViewState(v)

    if(v==='profile'){
      const pid=window.location.pathname.split('/')[2]
      api('/professionals/'+pid)
        .then((d:any)=>setSelected(d.professional||d))
        .catch(()=>setViewState('search'))
    }
  }

  window.addEventListener('popstate',onPop)

  if(viewFromPath(window.location.pathname)==='profile'){
    const pid=window.location.pathname.split('/')[2]
    api('/professionals/'+pid)
      .then((d:any)=>setSelected(d.professional||d))
      .catch(()=>setViewState('search'))
  }

  return()=>window.removeEventListener('popstate',onPop)
},[])
  useEffect(()=>{const onPop=()=>{const v=viewFromPath(window.location.pathname);setViewState(v);if(v==='profile'){const pid=window.location.pathname.split('/')[2];api('/professionals/'+pid).then((d:any)=>setSelected(d.professional||d)).catch(()=>setViewState('search'))}};window.addEventListener('popstate',onPop);if(viewFromPath(window.location.pathname)==='profile'){const pid=window.location.pathname.split('/')[2];api('/professionals/'+pid).then((d:any)=>setSelected(d.professional||d)).catch(()=>setViewState('search'))}return()=>window.removeEventListener('popstate',onPop)},[])
  const [identityOpen,setIdentityOpen]=useState(false)
  async function refreshMe(t=token){ try{const d=await api('/me',{},t);setUser(d.user);setProfessional(d.professional);if(['patient','professional'].includes(d.user.role))setFavorites(await api('/favorites',{},t))}catch{setUser(null);setProfessional(null)}finally{setLoading(false)} }
  async function refreshCommunicationUnread(){
  if(!user){
    setCommunicationUnread({
      notifications:0,
      messages:0,
      total:0
    })
    return
  }

  try{
    const d=await api(
      '/communication/unread',
      {},
      token
    )

    setCommunicationUnread({
      notifications:Number(d.notifications||0),
      messages:Number(d.messages||0),
      total:Number(d.total||0)
    })
  }
  catch(e){
    console.error(
      'Unread communication load failed',
      e
    )
  }
}
  async function loadPros(params=search){const qs=new URLSearchParams();if(params.specialty)qs.set('specialty',params.specialty);if(params.service)qs.set('service',params.service);if(params.lat&&params.lon){qs.set('lat',String(params.lat));qs.set('lon',String(params.lon))}else if(params.locationQuery){qs.set('location',params.locationQuery)};qs.set('limit','30');const d=await api('/professionals?'+qs.toString());setPros(Array.isArray(d)?d:(d.items||[]))}
  useEffect(()=>{api('/config').then(setCfg).catch(()=>{});refreshMe();const m=window.location.pathname.match(/^\/care\/([^/]+)\/([^/]+)$/);if(m){api('/seo/resolve?specialty='+encodeURIComponent(m[1])+'&city='+encodeURIComponent(m[2])).then((x:any)=>{const next={...search,specialty:x.specialty||'',service:'',locationQuery:x.city||'',locationLabel:x.city||'',lat:'',lon:''};setSearch(next);loadPros(next)}).catch(()=>loadPros())}else loadPros()},[])
  useEffect(()=>{
  if(!token){
    setUser(null)
    setProfessional(null)
  }
},[token])


useEffect(()=>{
  if(!user){
    setCommunicationUnread({
      notifications:0,
      messages:0,
      total:0
    })
    return
  }

  refreshCommunicationUnread()

  const onLive=()=>{
    refreshCommunicationUnread()
  }

  window.addEventListener(
    'meleo:live',
    onLive
  )
window.addEventListener(
  'meleo:communication-refresh',
  onLive
)
  return ()=>{
    window.removeEventListener(
      'meleo:live',
      onLive
    )
window.removeEventListener(
  'meleo:communication-refresh',
  onLive
)
  }
},[user?.id])


useEffect(()=>{
  window.scrollTo(0,0)
},[view])

  // Επιστροφή από το Stripe Checkout / σύνδεσμοι email. Τα query params
  // καθαρίζονται από το URL ώστε να μην επαναλαμβάνεται η ενέργεια σε refresh.
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search)
    if(![...params.keys()].length)return
    const clean=()=>window.history.replaceState({},'',window.location.pathname)
    const checkout=params.get('checkout'), sessionId=params.get('session_id')
    const verify=params.get('verify'), reset=params.get('reset'), billing=params.get('billing')
    ;(async()=>{
      if(checkout==='success'){
        setToast('Επιβεβαίωση πληρωμής…')
        const t='cookie'
        for(let i=0;i<6;i++){
          try{
            const r=await api('/professional/subscription/sync',{method:'POST',body:JSON.stringify({sessionId})},t)
            if(['active','past_due'].includes(r?.professional?.subscriptionStatus)){setToast('Η συνδρομή σου ενεργοποιήθηκε.');break}
          }catch{}
          await new Promise(res=>setTimeout(res,1500))
        }
        await refreshMe('cookie')
        setView('pro-dashboard')
      }
      if(checkout==='cancel')setToast('Η πληρωμή ακυρώθηκε. Δεν έγινε χρέωση.')
      if(billing==='return'){await refreshMe('cookie');setView('pro-dashboard')}
      if(verify){try{await api('/auth/verify-email',{method:'POST',body:JSON.stringify({token:verify})});setToast('Το email σου επιβεβαιώθηκε.');await refreshMe('cookie')}catch(e:any){setToast(e.message)}}
      if(reset){setResetToken(reset);setView('reset-password')}
      clean()
    })()
  },[])

  function logged(_t:string,u:User){
  setToken('cookie')
  setUser(u)

  setView(
    u.role === 'admin'
      ? 'admin'
      : u.role === 'professional'
        ? 'pro-dashboard'
        : 'patient-dashboard'
  )

  refreshMe('cookie')
  setToast(`Καλώς ήρθες, ${u.name.split(' ')[0]}`)
}
  async function logout(){try{await api('/auth/logout',{method:'POST'},token)}catch{}setToken('cookie');setUser(null);setProfessional(null);setView('home')}
  async function toggleFav(id:string){if(!user){setView('auth');return}if(!['patient','professional'].includes(user.role))return;const r=await api('/favorites/'+id,{method:'POST'},token);setFavorites(x=>r.favorite?[...x,id]:x.filter(v=>v!==id))}
  function openPro(p:Professional){setSelected(p);setViewState('profile');history.pushState({view:'profile'},'',`/professionals/${p.id}`);window.scrollTo({top:0,behavior:'smooth'})}
  function requireAuth(next='home'){if(user){setView(next);return}setAuthReturn(next);setView('auth')}

  if(loading)return <div className="splash"><div className="splash-logo">M</div><div>MELEO</div></div>

  return <div className="app-shell">
    <Header
  user={user}
  professional={professional}
  view={view}
  setView={setView}
  logout={logout}
  communicationUnread={communicationUnread}
/>
	<LiveEvents user={user} setToast={setToast}/>
    <main>
      {view==='home'&&<Home pros={pros} search={search} setSearch={setSearch} loadPros={loadPros} openPro={openPro} favorites={favorites} toggleFav={toggleFav} user={user} setView={setView} SectionTitle={SectionTitle} Step={Step} MiniCard={MiniCard} ProCard={ProCard}/>}
      {view==='smart'&&<SmartRequest search={search} setSearch={setSearch} loadPros={loadPros} setView={setView}/>}
      {view==='now'&&<NowRequest pros={pros} search={search} setSearch={setSearch} loadPros={loadPros} openPro={openPro} setView={setView} ProCard={ProCard}/>}
      {view==='search'&&
  <Suspense fallback={<RouteFallback/>}>
    <SearchPageView
      pros={pros}
      search={search}
      setSearch={setSearch}
      loadPros={loadPros}
      openPro={openPro}
      favorites={favorites}
      toggleFav={toggleFav}

      SearchBox={SearchBox}
      ProCard={ProCard}
    />
  </Suspense>
}
      {view==='profile'&&selected&&
  <Suspense fallback={<RouteFallback/>}>
    <ProfilePage
      p={selected}
      user={user}
      favorite={favorites.includes(selected.id)}
      toggleFav={toggleFav}
      setView={setView}
      startBooking={()=>{
        setBookingSeed(null)
        setView('booking')
      }}

      trackProfessionalEvent={trackProfessionalEvent}
      IdentityAvatar={IdentityAvatar}
      priceLabel={priceLabel}
      priceNote={priceNote}
    />
  </Suspense>
}
      {view==='booking'&&selected&&
  <Suspense fallback={<RouteFallback/>}>
    <BookingFlowPage
      p={selected}
      seed={bookingSeed}
      user={user}
      token={token}
      setView={setView}
      setToast={setToast}

      Empty={Empty}
      priceLabel={priceLabel}
      MiniCard={MiniCard}
    />
  </Suspense>
}
      {(view==='auth'||view==='admin-login'||(view==='admin'&&!user))&&<Auth cfg={cfg} setView={setView} onLogged={(t,u)=>{logged(t,u); if(view!=='admin-login'&&authReturn!=='home'&&u.role==='patient')setTimeout(()=>setView(authReturn),0)}}/>}
      {view==='patient-dashboard'&&user&&
  <Suspense fallback={<RouteFallback/>}>
    <PatientDashboardPage
      user={user}
      token={token}
      openPro={openPro}
      startBooking={(p:any,seed:any=null)=>{
        setSelected(p)
        setBookingSeed(seed)
        setView('booking')
      }}
      cfg={cfg}
      setView={setView}
      setToast={setToast}

      IdentityAvatar={IdentityAvatar}
      CalendarActions={CalendarActions}
      ReviewComposer={ReviewComposer}
      Conversation={Conversation}

      initials={initials}
      statusLabel={statusLabel}
      repeatLabel={repeatLabel}
      priceLabel={priceLabel}
      money={money}
    />
  </Suspense>
}
      {view==='pro-dashboard'&&user&&<Suspense fallback={<RouteFallback/>}><ProfessionalDashboardPage user={user} professional={professional} token={token} onRefresh={()=>refreshMe()} setToast={setToast} cfg={cfg} setView={setView}/></Suspense>}
      {view==='admin'&&user?.role==='admin'&&<Suspense fallback={<RouteFallback/>}><AdminPage token={token} setToast={setToast}/></Suspense>}
      {view==='become-pro'&&<BecomeProfessional onLogged={logged} user={user} professional={professional} token={token} onRefresh={()=>refreshMe()} setView={setView} setToast={setToast} cfg={cfg}/>}
      {view==='pricing'&&<Pricing user={user} token={token} professional={professional} onRefresh={()=>refreshMe()} setView={setView} setToast={setToast} cfg={cfg}/>}
      {view==='reset-password'&&<ResetPassword token={resetToken} setView={setView} setToast={setToast}/>}
      {view==='notifications'&&user&&<Suspense fallback={<RouteFallback/>}><NotificationsPage user={user} token={token} setToast={setToast}/></Suspense>}
      {view==='help'&&<Suspense fallback={<RouteFallback/>}><HelpCenter user={user} token={token} setToast={setToast} cfg={cfg}/></Suspense>}
{view==='account'&&user&&
  <Suspense fallback={<RouteFallback/>}>
    <AccountSettingsView
      user={user}
      token={token}
      logout={logout}
      setToast={setToast}
      cfg={cfg}
      api={api}
      onEditIdentity={()=>setIdentityOpen(true)}
    />
  </Suspense>
}
      {view==='terms'&&<Suspense fallback={<RouteFallback/>}><LegalView doc="terms" cfg={cfg} setView={setView}/></Suspense>}
      {view==='privacy'&&<Suspense fallback={<RouteFallback/>}><LegalView doc="privacy" cfg={cfg} setView={setView}/></Suspense>}
      {view==='cookies'&&<Suspense fallback={<RouteFallback/>}><LegalView doc="cookies" cfg={cfg} setView={setView}/></Suspense>}
    </main>
    <Footer cfg={cfg} setView={setView}/>
    <MobileNav user={user} view={view} setView={setView}/>
	{identityOpen&&user&&
  <ProfileIdentityModal
    user={user}
    onClose={()=>setIdentityOpen(false)}
    onUpdated={(updatedUser:any)=>{
      setUser(updatedUser)
      setIdentityOpen(false)
    }}
    setToast={setToast}
  />
}
    {toast&&<Toast text={toast} onClose={()=>setToast('')}/>}
  </div>
}

function VerifyEmailBanner({user,token,cfg,setToast}:any){
  const [sent,setSent]=useState(false)
  if(!user||user.emailVerified||!cfg.mailEnabled)return null
  async function resend(){try{await api('/auth/verify-email/resend',{method:'POST'},token);setSent(true);setToast('Στάλθηκε νέος σύνδεσμος επιβεβαίωσης.')}catch(e:any){setToast(e.message)}}
  return <div className="verify-banner">
    <span>Το email σου δεν έχει επιβεβαιωθεί. Ορισμένες ενέργειες παραμένουν κλειδωμένες μέχρι την επιβεβαίωση.</span>
    <button onClick={resend} disabled={sent}>{sent?'Στάλθηκε':'Στείλε ξανά τον σύνδεσμο'}</button>
  </div>
}

function Footer({cfg,setView}:any){
  return <footer className="site-footer"><div className="container footer-grid">
    <div>
      <Mark/>
      <p>Πλατφόρμα εύρεσης επαληθευμένων επαγγελματιών φροντίδας. Η MELEO δεν παρέχει ιατρικές υπηρεσίες και δεν αποτελεί υπηρεσία επείγουσας βοήθειας — σε επείγουσα ανάγκη κάλεσε <b>{cfg.emergencyNumber}</b>.</p>
      {cfg.legal.company&&<small>{cfg.legal.company}{cfg.legal.vatNumber?` · ΑΦΜ ${cfg.legal.vatNumber}`:''}{cfg.legal.address?` · ${cfg.legal.address}`:''}</small>}
    </div>
    <div className="footer-links">
      <b>Πλατφόρμα</b>
      <button onClick={()=>setView('search')}>Αναζήτηση</button>
      <button onClick={()=>setView('pricing')}>Συνδρομές</button>
      <button onClick={()=>setView('become-pro')}>Για επαγγελματίες</button><button onClick={()=>setView('help')}>Help Center</button>
    </div>
    <div className="footer-links">
      <b>Νομικά</b>
      <button onClick={()=>setView('terms')}>Όροι Χρήσης</button>
      <button onClick={()=>setView('privacy')}>Πολιτική Απορρήτου</button>
      <button onClick={()=>setView('cookies')}>Cookies</button>
    </div>
    <div className="footer-links">
      <b>Επικοινωνία</b>
      <a href={`mailto:${cfg.legal.supportEmail}`}>{cfg.legal.supportEmail}</a>
      <a href={`mailto:${cfg.legal.dpoEmail}`}>Υπεύθυνος προστασίας δεδομένων</a>
    </div>
  </div><div className="container footer-base"><span>© {new Date().getFullYear()} MELEO</span><span>Έκδοση όρων: {cfg.termsVersion}</span></div></footer>
}

function Header({
  user,
  professional,
  view,
  setView,
  logout,
  communicationUnread
}:{
  user:User|null
  professional:Professional|null
  view:string
  setView:(v:string)=>void
  logout:()=>void
  communicationUnread:{
    notifications:number
    messages:number
    total:number
  }
}){
  const [open,setOpen]=useState(false)
  const [accountOpen,setAccountOpen]=useState(false)
  useEffect(()=>{setOpen(false);setAccountOpen(false)},[view])
  useEffect(()=>{
    if(!open)return
    const previous=document.body.style.overflow
    document.body.style.overflow='hidden'
    const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false)}
    window.addEventListener('keydown',onKey)
    return()=>{document.body.style.overflow=previous;window.removeEventListener('keydown',onKey)}
  },[open])
  useEffect(()=>{
    if(!accountOpen)return
    const close=()=>setAccountOpen(false)
    const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')close()}
    window.addEventListener('click',close);window.addEventListener('keydown',onKey)
    return()=>{window.removeEventListener('click',close);window.removeEventListener('keydown',onKey)}
  },[accountOpen])
  const go=(v:string)=>{setView(v);setOpen(false);setAccountOpen(false);window.scrollTo({top:0,behavior:'smooth'})}
  const professionalReady=user?.role==='professional'&&professional?.verified===true&&['active','past_due'].includes(professional?.subscriptionStatus||'')&&professional?.onboardingStage==='approved'
  const accountView=user?.role==='admin'?'admin':user?.role==='professional'?'pro-dashboard':'patient-dashboard'
  const accountLabel=user?.role==='admin'?'Admin Control Center':user?.role==='professional'?(professionalReady?'Professional Dashboard':'Ολοκλήρωση επαγγελματικής εγγραφής'):'Οι κρατήσεις μου'
  const unreadNotifications=
  Number(communicationUnread?.notifications||0)

const unreadMessages=
  Number(communicationUnread?.messages||0)

const unreadTotal=
  Number(communicationUnread?.total||0)

const unreadLabel=
  unreadTotal>99
    ? '99+'
    : String(unreadTotal)

const notificationLabel=
  unreadNotifications>99
    ? '99+'
    : String(unreadNotifications)

const messageLabel=
  unreadMessages>99
    ? '99+'
    : String(unreadMessages)
  return <>
    <header className="topbar"><div className="container navrow"><button className="brand-btn" onClick={()=>go('home')}><Mark/></button><nav className="desktop-nav"><button className={view==='home'?'active':''} onClick={()=>go('home')}>Αρχική</button><button onClick={()=>go('search')}>Αναζήτηση</button><button onClick={()=>go('smart')}>Smart Request</button><button onClick={()=>go('now')}>MELEO Now</button><button onClick={()=>go('pricing')}>Συνδρομές</button><button onClick={()=>go('become-pro')}>Για επαγγελματίες</button></nav><div className="nav-actions"><LanguageSwitcher/>{user?<div className="account-menu-wrap" onClick={e=>e.stopPropagation()}><button   className={'user-pill '+(accountOpen?'open':'')}   onClick={()=>{     if(window.innerWidth > 980){       setAccountOpen(v=>!v)     }   }}   aria-haspopup="menu"   aria-expanded={accountOpen} >   <IdentityAvatar
  name={user.name}
  photoUrl={user.profilePhotoUrl}
  avatarKey={user.avatarKey}
  size="sm"
  className="header-avatar"
/>   <span className="desktop-only">{user.name.split(' ')[0]}</span>   <span className="profile-chevron desktop-only">⌄</span> </button>{accountOpen&&<div className="account-dropdown" role="menu"><div className="account-dropdown-head"><IdentityAvatar
  name={user.name}
  photoUrl={user.profilePhotoUrl}
  avatarKey={user.avatarKey}
  size="sm"
  className="header-avatar"
/><div><b>{user.name}</b><small>{user.email}</small></div></div><button onClick={()=>go(accountView)}>⌂ <span>{accountLabel}</span></button>{user.role==='professional'&&<button onClick={()=>go('patient-dashboard')}>♡ <span>Οι προσωπικές μου κρατήσεις</span></button>}<button
  className={
    'account-notification-link '+
    (unreadTotal>0?'has-unread':'')
  }
  onClick={()=>go('notifications')}
>
  <span className="account-notification-icon">
    🔔

    {unreadTotal>0&&
      <b className="account-notification-badge">
        {unreadLabel}
      </b>
    }
  </span>

  <span className="account-notification-copy">
    <strong>Ειδοποιήσεις</strong>

    {unreadTotal>0
      ? <small>
          {unreadNotifications>0&&
            `${notificationLabel} νέες ειδοποιήσεις`
          }

          {unreadNotifications>0&&unreadMessages>0
            ? ' · '
            : ''
          }

          {unreadMessages>0&&
            `${messageLabel} νέα μηνύματα`
          }
        </small>
      : <small>
          Δεν υπάρχουν νέα
        </small>
    }
  </span>

  {unreadTotal>0&&
    <span className="account-live-dot"/>
  }
</button><button onClick={()=>go('help')}>? <span>Help Center</span></button><button onClick={()=>go('account')}>⚙ <span>Ρυθμίσεις λογαριασμού</span></button><div className="account-dropdown-sep"/><button className="danger" onClick={async()=>{setAccountOpen(false);await logout()}}>↪ <span>Αποσύνδεση</span></button></div>}</div>:<button className="btn btn-dark desktop-login" onClick={()=>go('auth')}>Σύνδεση</button>}<button className={'mobile-menu-btn '+(open?'open':'')} aria-label="Άνοιγμα μενού" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><span/><span/><span/></button></div></div></header>
    {open&&<div className="mobile-menu-overlay" role="presentation" onClick={()=>setOpen(false)}><nav className="mobile-menu-panel" aria-label="Κύριο μενού" onClick={e=>e.stopPropagation()}>
      <div className="mobile-menu-head"><button className="mobile-menu-brand" onClick={()=>go('home')}><Mark/></button><button className="mobile-menu-close" aria-label="Κλείσιμο μενού" onClick={()=>setOpen(false)}>×</button></div>
      {user&&
  <div className="mobile-menu-user">
    <IdentityAvatar
      name={user.name}
      photoUrl={user.profilePhotoUrl}
      avatarKey={user.avatarKey}
      size="sm"
      className="header-avatar"
    />

    <div>
      <b>{user.name}</b>
      <small>{user.email}</small>
    </div>
  </div>
}

      <div className="mobile-menu-links">
        <button className={view==='home'?'active':''} onClick={()=>go('home')}><span className="mobile-menu-icon">⌂</span><div><b>Αρχική</b><small>Επιστροφή στη MELEO</small></div><em>›</em></button>
        <button className={view==='search'?'active':''} onClick={()=>go('search')}><span className="mobile-menu-icon">⌕</span><div><b>Αναζήτηση</b><small>Βρες τον κατάλληλο επαγγελματία</small></div><em>›</em></button>
        <button className={view==='smart'?'active':''} onClick={()=>go('smart')}><span className="mobile-menu-icon">✦</span><div><b>Smart Request</b><small>Περιέγραψε τι χρειάζεσαι</small></div><em>›</em></button>
        <button className={view==='now'?'active':''} onClick={()=>go('now')}><span className="mobile-menu-icon">⚡</span><div><b>MELEO Now</b><small>Βρες διαθέσιμο επαγγελματία τώρα</small></div><em>›</em></button>
        <button className={view==='pricing'?'active':''} onClick={()=>go('pricing')}><span className="mobile-menu-icon">◇</span><div><b>Συνδρομές</b><small>BASIC & PREMIUM για επαγγελματίες</small></div><em>›</em></button>
        <button className={view==='become-pro'?'active':''} onClick={()=>go('become-pro')}><span className="mobile-menu-icon">＋</span><div><b>Για επαγγελματίες</b><small>Γίνε μέλος του δικτύου MELEO</small></div><em>›</em></button>
      </div>
      <div className="mobile-menu-account">{user?<><button className="btn btn-dark wide" onClick={()=>go(accountView)}>{accountLabel}</button><button
  className={
    'btn btn-outline wide mobile-notification-button '+
    (unreadTotal>0?'has-unread':'')
  }
  onClick={()=>go('notifications')}
>
  <span>
    🔔 Ειδοποιήσεις
  </span>

  {unreadTotal>0&&
    <b className="mobile-notification-badge">
      {unreadLabel}
    </b>
  }
</button><button className="btn btn-outline wide" onClick={()=>go('help')}>Help Center</button><button className="btn btn-outline wide" onClick={()=>go('account')}>Ρυθμίσεις λογαριασμού</button><button className="btn btn-outline wide logout-mobile" onClick={async()=>{setOpen(false);await logout()}}>Αποσύνδεση</button></>:<><button className="btn btn-dark wide" onClick={()=>go('auth')}>Σύνδεση / Εγγραφή</button><small>Η αναζήτηση παραμένει διαθέσιμη χωρίς λογαριασμό.</small></>}</div>
      <div className="mobile-menu-foot"><span>MELEO</span><small>Care that comes to you.</small></div>
    </nav></div>}
  </>
}

function SectionTitle({over,title,subtitle}:any){return <div className="section-title"><div className="eyebrow">{over}</div><h2>{title}</h2><p>{subtitle}</p></div>}
function Step({n,icon,title,text}:any){return <div className="step"><div className="step-top"><span className="step-icon">{icon}</span><span className="step-num">{n}</span></div><h3>{title}</h3><p>{text}</p></div>}
function MiniCard({p}:{p:Professional}){
  const hasDistance=
    p.distance!==undefined &&
    p.distance!==null &&
    Number.isFinite(Number(p.distance))

  return (
    <div className="mini-card">
      <IdentityAvatar
        name={p.name}
        photoUrl={p.profilePhotoUrl}
        avatarKey={p.avatarKey}
        size="sm"
      />

      <div className="mini-main">
        <b>
          {p.name} <span className="verify">✦</span>
        </b>

        <small>
          {p.title}
          {p.services?.[0] ? ` · ${p.services[0]}` : ''}
        </small>

        <div>
          <span className="stars">
            ★ {p.rating || 'Νέο'}
          </span>

          {hasDistance && (
            <span>
              {' · '}
              {Number(p.distance).toFixed(1)} χλμ
            </span>
          )}
        </div>
      </div>

      <b className="mini-price">
        {priceLabel(p,true)}
      </b>
    </div>
  )
}
function ProCard({p,open,favorite,toggle}:any){
  const {t,i18n}=useTranslation()
  const language=i18n.language==='en'?'en':'el'

  useEffect(()=>{
    trackProfessionalEvent(p.id,'impression')
  },[p.id])

  const smart=
    p.smartMatch?.rank<=3
      ? p.smartMatch
      : null

  const hasDistance=
    p.distance!==undefined &&
    p.distance!==null &&
    Number.isFinite(Number(p.distance))

  const distance=
    hasDistance
      ? Number(p.distance)
      : null

  const rawReasons=
    (smart?.reasons||[]).slice(0,3)

  const reasons=
    language==='en'
      ? []
      : rawReasons

  const trustEligible=!!p.trust?.eligible
  const trustScore=
    trustEligible
      ? Number(p.trust.score||0)
      : null

  const reviews=Number(p.reviews||0)
  const rating=Number(p.rating||0)
  const premium=p.subscriptionPlan==='premium'

  const availableText=String(p.available||'').trim()
  const isAvailable=
    !!availableText &&
    ![
      'όχι',
      'μη διαθέσιμος',
      'μη διαθέσιμη',
      'unavailable',
      'false'
    ].includes(availableText.toLowerCase())

  const displayTitle=
    language==='en' && p.specialty
      ? catalogLabel(p.specialty,language)
      : catalogLabel(p.title,language)

  const displayAvailability=
    availabilityLabel(availableText,language)||
    t('card.availability')

  return (
    <article
      className={
        'discovery-card '+
        (smart?'discovery-smart ':'')+
        (premium?'discovery-premium ':'')
      }
      aria-label={`${p.name} · ${displayTitle}`}
    >
      {smart&&
        <div className="discovery-match">
          <div className="discovery-match-brand">
            <span className="discovery-match-icon">✦</span>
            <div>
              <small>MELEO SMART MATCH</small>
              <b>{t('card.strongMatch')}</b>
            </div>
          </div>

          <div className="discovery-match-score">
            <span>#{smart.rank}</span>
            <strong>
              {Math.round(smart.score)}
              <small>%</small>
            </strong>
          </div>
        </div>
      }

      <div className="discovery-card-header">
        <div className="discovery-identity">
          <div className="discovery-avatar-wrap">
            <IdentityAvatar
              name={p.name}
              photoUrl={p.profilePhotoUrl}
              avatarKey={p.avatarKey}
              size="lg"
            />

            {p.verified&&
              <span
                className="discovery-avatar-verified"
                title={t('card.verifiedTitle')}
              >
                ✓
              </span>
            }
          </div>

          <div className="discovery-person">
            <div className="discovery-name-row">
              <h3>{p.name}</h3>
              {p.verified&&
                <span className="discovery-verified">
                  MELEO Verified
                </span>
              }
            </div>

            <p>{displayTitle}</p>

            {(p.city||p.area)&&
              <small className="discovery-location">
                ⌖{' '}
                {p.area
                  ? `${p.area}${p.city?', '+p.city:''}`
                  : p.city
                }
              </small>
            }
          </div>
        </div>

        <button
          type="button"
          className={
            'discovery-heart '+
            (favorite?'active':'')
          }
          onClick={e=>{
            e.stopPropagation()
            toggle()
          }}
          title={
            favorite
              ? t('card.removeCareTeam')
              : t('card.addCareTeam')
          }
          aria-label={
            favorite
              ? t('card.removeCareTeam')
              : t('card.addCareTeam')
          }
        >
          {favorite?'♥':'♡'}
        </button>
      </div>

      {premium&&
        <div className="discovery-premium-label">
          <span>◆</span>
          MELEO PREMIUM
        </div>
      }

      <div className="discovery-signals">
        <div className="discovery-rating">
          <span className="discovery-star">★</span>

          {reviews>0
            ? <>
                <strong>{rating.toFixed(1)}</strong>
                <span>{reviews} {t('card.reviews')}</span>
              </>
            : <>
                <strong>{t('card.new')}</strong>
                <span>{t('card.noReviews')}</span>
              </>
          }
        </div>

        {trustEligible
          ? <div className="discovery-trust">
              <span>✦ MELEO Trust</span>
              <strong>{trustScore}/100</strong>
            </div>
          : p.verified
            ? <div className="discovery-trust discovery-trust-new">
                <span>✓ Verified</span>
                <strong>{t('card.newVerified')}</strong>
              </div>
            : null
        }
      </div>

      {!!p.services?.length&&
        <div className="discovery-services">
          {p.services
            .slice(0,3)
            .map((service:string)=>
              <span key={service}>
                {catalogLabel(service,language)}
              </span>
            )
          }
          {p.services.length>3&&
            <span className="discovery-more-services">
              +{p.services.length-3}
            </span>
          }
        </div>
      }

      <div className="discovery-context">
        {hasDistance&&
          <div>
            <span className="discovery-context-icon">⌖</span>
            <span>
              <b>
                {distance!.toFixed(1)} {language==='en'?'km':'χλμ'}
              </b>
              <small>{t('card.fromArea')}</small>
            </span>
          </div>
        }

        <div>
          <span
            className={
              'discovery-status-dot '+
              (isAvailable?'online':'')
            }
          />
          <span>
            <b>{displayAvailability}</b>
            <small>{t('card.currentIndicator')}</small>
          </span>
        </div>

        {p.responseTime&&
          <div>
            <span className="discovery-context-icon">◷</span>
            <span>
              <b>
                {language==='en'
                  ? 'Response information available'
                  : p.responseTime
                }
              </b>
              <small>{t('card.responseTime')}</small>
            </span>
          </div>
        }
      </div>

      {smart&&
        <div className="discovery-why">
          <div className="discovery-why-head">
            <div>
              <span className="discovery-why-mark">✦</span>
              <b>{t('card.why')}</b>
            </div>
            <small>Smart Match #{smart.rank}</small>
          </div>

          {reasons.length>0
            ? <div className="discovery-reasons">
                {reasons.map(
                  (reason:string,index:number)=>
                    <div key={`${reason}-${index}`}>
                      <span>✓</span>
                      <p>{reason}</p>
                    </div>
                )}
              </div>
            : <p className="discovery-match-generic">
                {t('card.genericReason')}
              </p>
          }
        </div>
      }

      <div className="discovery-footer">
        <div className="discovery-price">
          <small>{t('card.baseCost')}</small>
          <strong>
            {localizedPriceLabel(p,language)}
          </strong>
          <span>
            {localizedPriceNote(p,language)}
          </span>
        </div>

        <button
          type="button"
          className="discovery-open"
          onClick={open}
        >
          <span>{t('card.viewProfile')}</span>
          <b>→</b>
        </button>
      </div>

      <div className="discovery-safety">
        <span>✓</span>
        {t('card.finalPrice')}
      </div>
    </article>
  )
}

function getPasswordChecks(password: string) {
  const value = String(password || '')

  return {
    length: value.length >= 8,
    uppercase: /\p{Lu}/u.test(value),
    lowercase: /[a-zα-ωάέήίόύώϊϋΐΰ]/u.test(value),
    number: /\d/.test(value),
    special: /[^\p{L}\p{N}\s]/u.test(value)
  }
}

function isStrongPassword(password: string) {
  return Object.values(getPasswordChecks(password)).every(Boolean)
}

function PasswordChecklist({ password }: { password: string }) {
  const checks = getPasswordChecks(password)

  const items = [
    ['length', 'Τουλάχιστον 8 χαρακτήρες'],
    ['uppercase', 'Ένα κεφαλαίο γράμμα'],
    ['lowercase', 'Ένα πεζό γράμμα'],
    ['number', 'Έναν αριθμό'],
    ['special', 'Έναν ειδικό χαρακτήρα']
  ] as const

  return (
    <div className="password-checklist">
      <strong>Ο κωδικός πρέπει να περιλαμβάνει:</strong>

      {items.map(([key, label]) => (
        <div
          key={key}
          className={
            checks[key]
              ? 'password-rule ok'
              : 'password-rule'
          }
        >
          <span>
            {checks[key] ? '✓' : '○'}
          </span>

          <span>{label}</span>
        </div>
      ))}
    </div>
  )
}

function PasswordStrength({password}:{password:string}) {
  const checks = getPasswordChecks(password)
  const score = Object.values(checks).filter(Boolean).length

  const label =
    score <= 1 ? 'Πολύ αδύναμος' :
    score === 2 ? 'Αδύναμος' :
    score === 3 ? 'Μέτριος' :
    score === 4 ? 'Ισχυρός' :
    'Πολύ ισχυρός'

  return (
    <div className="password-strength">
      <div className="password-strength-head">
        <span>Ισχύς κωδικού</span>
        <strong>{label}</strong>
      </div>

      <div className="password-strength-bar">
        <span style={{width:`${(score/5)*100}%`}}/>
      </div>
    </div>
  )
}


function Auth({onLogged,cfg,setView}:{onLogged:(t:string,u:User)=>void;cfg:AppConfig;setView:(v:string)=>void}){
 const [mode,setMode]=useState<'login'|'register'|'forgot'>('login');
 const [role,setRole]=useState<'patient'|'professional'>('patient');
 const [form,setForm]=useState({name:'',email:'',phone:'',password:''});
 const [accepted,setAccepted]=useState(false);
 const [error,setError]=useState('');
 const [info,setInfo]=useState('');
 const [busy,setBusy]=useState(false);
 const [socialBusy,setSocialBusy]=useState(''); const [needs2fa,setNeeds2fa]=useState(false); const [totp,setTotp]=useState('');
 const [showPassword,setShowPassword]=useState(false);
async function submit(e:React.FormEvent){
  e.preventDefault()

  setError('')
  setInfo('')

  /*
   * ----------------------------------------------------------
   * PASSWORD POLICY — REGISTER
   * ----------------------------------------------------------
   */
  if(
    mode === 'register' &&
    !isStrongPassword(form.password)
  ){
    setError(
      'Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες και να περιλαμβάνει κεφαλαίο γράμμα, πεζό γράμμα, αριθμό και ειδικό χαρακτήρα.'
    )
    return
  }

  setBusy(true)

  try{

    /*
     * --------------------------------------------------------
     * FORGOT PASSWORD
     * --------------------------------------------------------
     */
    if(mode === 'forgot'){
      const r = await api(
        '/auth/forgot-password',
        {
          method:'POST',
          body:JSON.stringify({
            email:form.email
          })
        }
      )

      setInfo(
        r.message ||
        'Έλεγξε το email σου.'
      )

      return
    }

    /*
     * --------------------------------------------------------
     * LOGIN / REGISTER
     * --------------------------------------------------------
     */
    const body =
      mode === 'login'
        ? {
            email:form.email,
            password:form.password,
            totp
          }
        : {
            ...form,
            role,
            acceptedTerms:accepted
          }

    const r = await api(
      '/auth/' + mode,
      {
        method:'POST',
        body:JSON.stringify(body)
      }
    )

    onLogged(
      'cookie',
      r.user
    )

  }catch(e:any){

    setError(e.message)

    if(
      String(e.message).includes('2FA')
    ){
      setNeeds2fa(true)
    }

  }finally{

    setBusy(false)

  }
}
 async function startGoogleOAuth(){
  setError('')
  setInfo('')
  setSocialBusy('google-production')

  try{
   window.location.assign('/api/auth/google/start')
  }catch(e:any){
   setSocialBusy('')
   setError(e?.message || 'Δεν ήταν δυνατή η έναρξη σύνδεσης με Google.')
  }
 }
 async function social(provider:string){setSocialBusy(provider);setError('');try{const r=await api('/auth/social-demo',{method:'POST',body:JSON.stringify({provider})});onLogged('cookie',r.user)}catch(e:any){setError(e.message)}finally{setSocialBusy('')}}
 function demo(kind:'patient'|'professional'|'admin'){const accounts={patient:{email:'patient@meleo.gr',password:'demo123'},professional:{email:'maria@meleo.gr',password:'demo123'},admin:{email:'admin@meleo.gr',password:'admin123'}};setMode('login');setForm({...form,...accounts[kind]})}
 return <section className="auth-page"> <div className="auth-art"><Mark/><div className="auth-quote"><span>“</span><h2>Η φροντίδα είναι προσωπική.<br/>Η τεχνολογία πρέπει να την κάνει απλούστερη.</h2><p>MELEO · Care, beautifully connected.</p></div></div><div className="auth-panel"><div className="auth-mobile-brand"><Mark/></div><div className="auth-inner"><div className="auth-tabs"><button className={mode==='login'?'active':''} onClick={()=>{setMode('login');setError('');setInfo('')}}>Σύνδεση</button><button className={mode==='register'?'active':''} onClick={()=>{setMode('register');setError('');setInfo('')}}>Νέα εγγραφή</button></div><h1>{mode==='login'?'Καλώς ήρθες ξανά':mode==='forgot'?'Επαναφορά κωδικού':'Δημιούργησε λογαριασμό'}</h1><p>{mode==='login'?'Συνδέσου για να συνεχίσεις στη MELEO.':mode==='forgot'?'Δώσε το email του λογαριασμού σου και θα λάβεις σύνδεσμο επαναφοράς.':'Επίλεξε πώς θέλεις να χρησιμοποιήσεις τη MELEO.'}</p>{mode!=='forgot'&&cfg.googleOAuthEnabled&&<div className="auth-secondary auth-google-production" data-meleo-google-oauth="production"><div className="secondary-social"><button type="button" onClick={startGoogleOAuth} disabled={!!socialBusy}><b>G</b><span>{socialBusy==='google-production'?'Σύνδεση…':'Συνέχεια με Google'}</span></button></div><small>Ασφαλής σύνδεση μέσω Google.</small><div className="auth-divider"><span>ή με email</span></div></div>}{mode==='register'&&<div className="role-toggle"><button className={role==='patient'?'active':''} onClick={()=>setRole('patient')}><Icon>⌂</Icon><b>Χρειάζομαι φροντίδα</b><small>Συνοδός / ασθενής</small></button><button className={role==='professional'?'active':''} onClick={()=>setRole('professional')}><Icon>✦</Icon><b>Είμαι επαγγελματίας</b><small>Απαιτείται συνδρομή BASIC ή PREMIUM</small></button></div>}<form onSubmit={submit}>{mode==='register'&&<><label>Ονοματεπώνυμο<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Κινητό / Τηλέφωνο<input required value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label></>}<label>Email<input type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>{mode !== 'forgot' && (
  <label>
    Κωδικός

    <input
      type={showPassword ? 'text' : 'password'}
      minLength={8}
      required
      value={form.password}
      onChange={e =>
        setForm({
          ...form,
          password:e.target.value
        })
      }
    />

<button
  type="button"
  className="password-toggle"
  onClick={()=>setShowPassword(v=>!v)}
  aria-label={showPassword ? 'Απόκρυψη κωδικού' : 'Εμφάνιση κωδικού'}
>
  {showPassword ? 'Απόκρυψη' : 'Εμφάνιση'}
</button>
    {mode === 'register' && (
      <PasswordChecklist
        password={form.password}
      />
    )}
  </label>
)}{mode==='login'&&needs2fa&&<label>Κωδικός 2FA<input inputMode="numeric" maxLength={6} placeholder="123456" value={totp} onChange={e=>setTotp(e.target.value.replace(/\D/g,''))}/><small className="field-hint">Άνοιξε την εφαρμογή Authenticator του διαχειριστή.</small></label>}{mode==='register'&&<label className="consent-row"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/><span>Αποδέχομαι τους <button type="button" className="inline-link" onClick={()=>setView('terms')}>Όρους Χρήσης</button> και την <button type="button" className="inline-link" onClick={()=>setView('privacy')}>Πολιτική Απορρήτου</button>.</span></label>}{error&&<div className="error">{error}</div>}{info&&<div className="info-box">{info}</div>}<button className="btn btn-dark wide" disabled={busy||(mode==='register'&&!accepted)}>{busy?'Παρακαλώ...':mode==='login'?'Σύνδεση':mode==='forgot'?'Αποστολή συνδέσμου':'Δημιουργία λογαριασμού'}</button></form>{mode==='login'&&<button className="text-btn" onClick={()=>{setMode('forgot');setError('');setInfo('')}}>Ξέχασα τον κωδικό μου</button>}{mode==='forgot'&&<button className="text-btn" onClick={()=>{setMode('login');setError('');setInfo('')}}>← Επιστροφή στη σύνδεση</button>}{cfg.demoAuth&&<div className="auth-secondary"><div className="auth-divider"><span>ή συνέχισε γρήγορα</span></div><div className="secondary-social">{!cfg.googleOAuthEnabled&&<button onClick={()=>social('google')} disabled={!!socialBusy}><b>G</b><span>{socialBusy==='google'?'Σύνδεση…':'Google Demo'}</span></button>}<button onClick={()=>social('apple')} disabled={!!socialBusy}><b>●</b><span>{socialBusy==='apple'?'Σύνδεση…':'Apple Demo'}</span></button></div><small>Demo σύνδεση — διαθέσιμη μόνο εκτός production.</small></div>}{cfg.demoAuth&&mode==='login'&&<div className="demo-box"><small>DEMO ACCOUNTS</small><div><button onClick={()=>demo('patient')}>Συνοδός</button><button onClick={()=>demo('professional')}>Επαγγελματίας</button><button onClick={()=>demo('admin')}>Admin</button></div><p>Πάτησε ρόλο και μετά «Σύνδεση».</p></div>}</div></div></section>
}
function ResetPassword({token,setView,setToast}:any){
  const [password,setPassword]=useState('')
  const [confirm,setConfirm]=useState('')
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const [showPassword,setShowPassword]=useState(false)
  const [showConfirm,setShowConfirm]=useState(false)

  async function submit(e:React.FormEvent){
    e.preventDefault()
    setError('')

    if(!isStrongPassword(password)){
      setError(
        'Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες και να περιλαμβάνει κεφαλαίο γράμμα, πεζό γράμμα, αριθμό και ειδικό χαρακτήρα.'
      )
      return
    }

    if(password!==confirm){
      setError('Οι κωδικοί δεν ταιριάζουν.')
      return
    }

    setBusy(true)

    try{
      await api('/auth/reset-password',{
        method:'POST',
        body:JSON.stringify({token,password})
      })

      setToast('Ο κωδικός άλλαξε. Συνδέσου με τον νέο κωδικό.')
      setView('auth')
    }catch(e:any){
      setError(e.message)
    }finally{
      setBusy(false)
    }
  }

  return (
    <section className="page">
      <div className="container narrow">
        <div className="form-card">

          <div className="eyebrow">
            ΑΣΦΑΛΕΙΑ ΛΟΓΑΡΙΑΣΜΟΥ
          </div>

          <h1>Όρισε νέο κωδικό</h1>

          <form onSubmit={submit}>

            <label>
              Νέος κωδικός

              <input
                type={showPassword ? 'text' : 'password'}
                minLength={8}
                required
                value={password}
                onChange={e=>setPassword(e.target.value)}
              />

              <button
                type="button"
                className="password-toggle"
                onClick={()=>setShowPassword(v=>!v)}
              >
                {showPassword ? 'Απόκρυψη' : 'Εμφάνιση'}
              </button>
            </label>

            <PasswordStrength password={password}/>

            <PasswordChecklist password={password}/>

            <label>
              Επιβεβαίωση κωδικού

              <input
                type={showConfirm ? 'text' : 'password'}
                minLength={8}
                required
                value={confirm}
                onChange={e=>setConfirm(e.target.value)}
              />

              <button
                type="button"
                className="password-toggle"
                onClick={()=>setShowConfirm(v=>!v)}
              >
                {showConfirm ? 'Απόκρυψη' : 'Εμφάνιση'}
              </button>
            </label>

            {confirm && password!==confirm && (
              <small className="field-hint">
                Οι κωδικοί δεν ταιριάζουν.
              </small>
            )}

            {error&&(
              <div className="error">
                {error}
              </div>
            )}

            <button
              className="btn btn-dark wide"
              disabled={
                busy ||
                !isStrongPassword(password) ||
                password!==confirm
              }
            >
              {busy
                ? 'Αποθήκευση…'
                : 'Αποθήκευση νέου κωδικού'}
            </button>

          </form>

          <small className="terms">
            Για ασφάλεια, όλες οι ενεργές συνεδρίες αποσυνδέονται μετά την αλλαγή.
          </small>

        </div>
      </div>
    </section>
  )
}
function ReviewComposer({booking,token,onDone,setToast}:any){
 const [rating,setRating]=useState(Number(booking.review?.rating||0));const [comment,setComment]=useState(booking.review?.comment||'');const [busy,setBusy]=useState(false)
 if(booking.reviewed)return <div className="review-complete"><span>✓ Η αξιολόγησή σου καταχωρήθηκε</span><strong>{'★'.repeat(Number(booking.review?.rating||5))}{'☆'.repeat(5-Number(booking.review?.rating||5))}</strong>{booking.review?.comment&&<p>{booking.review.comment}</p>}<small>Verified booking review</small></div>
 async function submit(){if(!rating)return setToast('Επίλεξε από 1 έως 5 αστέρια.');setBusy(true);try{await api('/bookings/'+booking.id+'/review',{method:'POST',body:JSON.stringify({rating,comment})},token);setToast('Ευχαριστούμε! Η αξιολόγησή σου δημοσιεύτηκε.');await onDone()}catch(e:any){setToast(e.message)}finally{setBusy(false)}}
 return <div className="review-composer"><div><span className="review-kicker">Η ΕΠΙΣΚΕΨΗ ΟΛΟΚΛΗΡΩΘΗΚΕ</span><h4>Πώς ήταν η εμπειρία σου με {booking.professionalName};</h4><p>Η αξιολόγηση θα εμφανίζεται ως <b>Verified booking</b> και βοηθά άλλους χρήστες να επιλέξουν με μεγαλύτερη εμπιστοσύνη.</p></div><div className="review-stars" aria-label="Βαθμολογία">{[1,2,3,4,5].map(n=><button key={n} type="button" className={rating>=n?'active':''} onClick={()=>setRating(n)} aria-label={`${n} αστέρια`}>★</button>)}</div><textarea placeholder="Προαιρετικά, γράψε λίγα λόγια για την εμπειρία σου…" value={comment} maxLength={1000} onChange={e=>setComment(e.target.value)}/><button className="btn btn-gold" disabled={busy||!rating} onClick={submit}>{busy?'Υποβολή…':'Δημοσίευση αξιολόγησης'}</button></div>
}

function repeatLabel(r:string){return ({once:'Μία επίσκεψη',daily7:'Καθημερινά για 7 ημέρες',twice7:'Πρωί & βράδυ για 7 ημέρες'} as any)[r]||r}
function Conversation({messages}:any){if(!messages?.length)return null;return <div className="conversation"><div className="conversation-title">Ιστορικό επικοινωνίας</div>{messages.map((m:any)=><div key={m.id} className={'conversation-msg '+m.fromRole}><div><b>{m.fromName}</b><small>{new Date(m.createdAt).toLocaleString('el-GR')}</small></div><p>{m.text}</p></div>)}</div>}

function Stat({label,value,note}:any){return <div className="stat-card"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>}
function DashboardHead({eyebrow,title,subtitle}:any){return <div className="dashboard-head"><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>}

function Pricing({user,token,professional,onRefresh,setView,setToast,cfg}:any){
 const plans:Plan[]=cfg?.plans?.length?cfg.plans:FALLBACK_CONFIG.plans
 const [busy,setBusy]=useState('')
 async function choose(plan:string){
   if(!user){sessionStorage.setItem('meleo_selected_plan',plan);setView('auth');return}
   if(user.role==='patient'){sessionStorage.setItem('meleo_selected_plan',plan);setView('become-pro');return}if(user.role!=='professional'){setToast('Τα πακέτα αφορούν επαγγελματικούς λογαριασμούς.');return}
   sessionStorage.setItem('meleo_selected_plan',plan)
   setBusy(plan)
   try{
     const r=await api('/professional/subscription/checkout',{method:'POST',body:JSON.stringify({plan})},token)
     if(r.mode==='stripe'&&r.url){window.location.href=r.url;return}
     await onRefresh();setView('pro-dashboard')
     setToast(r.mode==='demo'?'Η συνδρομή ενεργοποιήθηκε (demo)':'Το πακέτο ενημερώθηκε')
   }catch(e:any){setToast(e.message);setView('pro-dashboard')}finally{setBusy('')}
 }
 return <section className="pricing-page page"><div className="container">
   <SectionTitle over="MELEO PROFESSIONAL" title="Απλές συνδρομές. Καθαρή αξία." subtitle="Δεν υπάρχει δωρεάν επαγγελματικό πακέτο. Επίλεξε BASIC ή PREMIUM ανάλογα με την προβολή και τα εργαλεία που χρειάζεσαι."/>
   <div className="pricing-grid">{plans.map(x=><div key={x.id} className={'pricing-card '+(x.id==='premium'?'premium':'')}>
     <div className="pricing-head"><span>{x.recommended?'Προτεινόμενο':'Για επαγγελματική παρουσία'}</span><h2>{x.name}</h2><div><strong>{money(x.price)}</strong><small>/μήνα</small></div></div>
     <ul>{x.features.map(f=><li key={f}>✓ {f}</li>)}</ul>
     <button className={'btn wide '+(x.id==='premium'?'btn-gold':'btn-dark')} disabled={busy===x.id} onClick={()=>choose(x.id)}>
       {professional?.subscriptionPlan===x.id&&['active','past_due'].includes(professional?.subscriptionStatus)?'Ενεργό πακέτο':busy===x.id?'Μεταφορά στο checkout…':user?.role==='professional'?'Επιλογή '+x.name:'Ξεκίνα ως επαγγελματίας'}
     </button>
     {x.id==='premium'&&<small className="pricing-note">Η ένδειξη «Προτεινόμενος» αφορά εμπορική προβολή. Το MELEO Verified αφορά ανεξάρτητα τον έλεγχο επαγγελματικών στοιχείων και δεν αγοράζεται.</small>}
   </div>)}</div>
   <div className="pricing-legal">
     <b>Τι περιλαμβάνει η χρέωση</b>
     <p>Μηνιαία συνδρομή με αυτόματη ανανέωση, πληρωμή με κάρτα ή Google&nbsp;Pay μέσω του παρόχου πληρωμών. Οι τιμές αναφέρονται σε ευρώ. Ακύρωση οποτεδήποτε, με ισχύ στο τέλος της τρέχουσας περιόδου χρέωσης.</p>
     <p>Η MELEO <b>δεν</b> λαμβάνει προμήθεια ή ποσοστό από το κόστος των επισκέψεων. Το ποσό της επίσκεψης συμφωνείται και εξοφλείται απευθείας μεταξύ επαγγελματία και χρήστη.</p>
   </div>
 </div></section>
}
function BecomeProfessional({onLogged,user,professional,token,onRefresh,setView,setToast,cfg}:any){
 const [busy,setBusy]=useState(false)
 async function enableExisting(){setBusy(true);try{await api('/me/enable-professional',{method:'POST'},token);await onRefresh();setToast('Η επαγγελματική λειτουργία ενεργοποιήθηκε. Επίλεξε πακέτο για να συνεχίσεις.');setView('pro-dashboard')}catch(e:any){setToast(e.message)}finally{setBusy(false)}}
 if(user?.role==='professional'){const ready=professional?.verified===true&&['active','past_due'].includes(professional?.subscriptionStatus||'')&&professional?.onboardingStage==='approved';return <section className="page"><div className="container narrow"><div className="success-card"><div className="success-icon">{ready?'✓':'…'}</div><h1>{ready?'Ο επαγγελματικός σου λογαριασμός είναι ενεργός.':'Η επαγγελματική εγγραφή σου είναι σε εξέλιξη.'}</h1><p>{ready?'Μπορείς να διαχειρίζεσαι το επαγγελματικό σου προφίλ και παράλληλα να ζητάς υπηρεσίες από άλλους επαγγελματίες.':'Ο λογαριασμός σου παραμένει διαθέσιμος για προσωπική χρήση. Για να ενεργοποιηθεί το Professional Dashboard πρέπει να ολοκληρωθούν συνδρομή, πληρωμή, στοιχεία προφίλ και επαλήθευση από τη MELEO.'}</p><button className="btn btn-dark" onClick={()=>setView('pro-dashboard')}>{ready?'Άνοιγμα Professional Dashboard':'Συνέχεια επαγγελματικής εγγραφής'}</button><button className="btn btn-outline" onClick={()=>setView('patient-dashboard')}>Οι προσωπικές μου κρατήσεις</button></div></div></section>}
 if(user?.role==='patient')return <section className="join-page"><div className="container join-grid"><div><div className="eyebrow light">MELEO PROFESSIONAL</div><h1>Ένας λογαριασμός.<br/><em>Δύο τρόποι χρήσης.</em></h1><p>Ο υπάρχων λογαριασμός σου παραμένει ενεργός για προσωπικές κρατήσεις. Προσθέτουμε επαγγελματική λειτουργία χωρίς δεύτερο email ή δεύτερο λογαριασμό.</p><div className="join-benefits"><div>01 <span><b>Δεν χάνεις τις προσωπικές σου κρατήσεις</b><small>Συνεχίζεις να αναζητάς, να κλείνεις και να αξιολογείς άλλους επαγγελματίες.</small></span></div><div>02 <span><b>Υποχρεωτική ενεργή συνδρομή</b><small>Επιλέγεις BASIC ή PREMIUM και ολοκληρώνεις την πληρωμή πριν το επαγγελματικό προφίλ και το verification.</small></span></div><div>03 <span><b>Ξεχωριστό Professional Space</b><small>Αιτήματα πελατών, διαθεσιμότητα, συνδρομή, verification και analytics παραμένουν διακριτά.</small></span></div></div></div><div className="join-form"><h2>Ενεργοποίηση επαγγελματικής λειτουργίας</h2><p>Μετά την ενεργοποίηση θα οδηγηθείς υποχρεωτικά στη ροή <b>Πακέτο → Checkout → Προφίλ → Verification</b>.</p><button className="btn btn-gold wide" disabled={busy} onClick={enableExisting}>{busy?'Ενεργοποίηση…':'Συνέχεια στην επιλογή συνδρομής'}</button><small className="terms">Δεν δημιουργείται δεύτερος λογαριασμός. Το ίδιο email και user ID χρησιμοποιούνται για προσωπική και επαγγελματική χρήση.</small></div></div></section>
 return <section className="join-page"><div className="container join-grid"><div><div className="eyebrow light">MELEO PROFESSIONAL</div><h1>Χτίσε την παρουσία σου.<br/><em>Με τους δικούς σου όρους.</em></h1><p>Επίλεξε BASIC ή PREMIUM, όρισε πότε και πού θέλεις να εργάζεσαι και διαχειρίσου αιτήματα από ένα premium επαγγελματικό dashboard.</p><div className="join-benefits"><div>01 <span><b>Εσύ ορίζεις τις υπηρεσίες σου</b><small>Επιλέγεις αν θα εμφανίζεται βασικό κόστος «Από Χ€» και ορίζεις την περιοχή εξυπηρέτησης.</small></span></div><div>02 <span><b>Verified, όχι pay-to-trust</b><small>Η επαλήθευση δεν αγοράζεται.</small></span></div><div>03 <span><b>Δύο καθαρά πακέτα</b><small>BASIC 9,99€/μήνα ή PREMIUM 14,99€/μήνα με προτεινόμενη προβολή.</small></span></div></div></div><div className="join-form"><h2>Ξεκίνα σε 2 λεπτά</h2><p>Αν έχεις ήδη λογαριασμό MELEO, συνδέσου πρώτα — δεν χρειάζεται δεύτερη εγγραφή.</p><InlineRegister onLogged={onLogged} setView={setView}/></div></div></section>
}
function InlineRegister({onLogged,setView}:any){const [f,setF]=useState({name:'',email:'',phone:'',password:''});const [accepted,setAccepted]=useState(false);const [error,setError]=useState('');const [busy,setBusy]=useState(false);async function submit(e:any){e.preventDefault();setError('');setBusy(true);try{const r=await api('/auth/register',{method:'POST',body:JSON.stringify({...f,role:'professional',acceptedTerms:accepted})});onLogged('cookie',r.user)}catch(e:any){setError(e.message)}finally{setBusy(false)}}return <form onSubmit={submit}><label>Ονοματεπώνυμο<input required value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></label><label>Email<input type="email" required value={f.email} onChange={e=>setF({...f,email:e.target.value})}/></label><label>Τηλέφωνο<input required value={f.phone} onChange={e=>setF({...f,phone:e.target.value})}/></label><label>Κωδικός<input type="password" minLength={8} required value={f.password} onChange={e=>setF({...f,password:e.target.value})}/><small className="field-hint">Τουλάχιστον 8 χαρακτήρες.</small></label><label className="consent-row"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/><span>Αποδέχομαι τους <button type="button" className="inline-link" onClick={()=>setView('terms')}>Όρους Χρήσης</button> και την <button type="button" className="inline-link" onClick={()=>setView('privacy')}>Πολιτική Απορρήτου</button>.</span></label>{error&&<div className="error">{error}</div>}<button className="btn btn-gold wide" disabled={busy||!accepted}>{busy?'Παρακαλώ…':'Δημιουργία επαγγελματικού λογαριασμού'}</button><small className="terms">Μετά τη δημιουργία λογαριασμού επιλέγεις υποχρεωτικά BASIC ή PREMIUM και ολοκληρώνεις την πληρωμή. Μόνο μετά ενεργοποιείται η διαδικασία επαγγελματικής επαλήθευσης.</small></form>}

function MobileNav({user,view,setView}:any){return <nav className="mobile-nav"><button className={view==='home'?'active':''} onClick={()=>setView('home')}><span>⌂</span>Αρχική</button><button className={view==='search'?'active':''} onClick={()=>setView('search')}><span>⌕</span>Αναζήτηση</button><button className="mobile-center" onClick={()=>setView('now')}><span>⚡</span></button><button onClick={()=>setView('become-pro')}><span>✦</span>Pro</button><button onClick={()=>setView(user?user.role==='professional'?'pro-dashboard':user.role==='admin'?'admin':'patient-dashboard':'auth')}><span>○</span>Προφίλ</button></nav>}
function Empty({title,text}:any){return <div className="empty"><div>◇</div><h3>{title}</h3><p>{text}</p></div>}
