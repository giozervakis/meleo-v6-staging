import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from './lib/api'
import { viewFromPath, pathForView, pushView } from './lib/router'
import type { User, Professional, BookingMessage, Booking, Plan, AppConfig } from './domain/types'
import { serviceMap, specialtyOptions } from './domain/catalog'
import { availabilityLabel, catalogLabel, localizedPriceLabel, localizedPriceNote } from './domain/catalog-i18n'
import { Home, SearchBox, SmartRequest, NowRequest } from './features/home/HomeExperience'
import LanguageSwitcher from './components/LanguageSwitcher'
import i18n from './i18n'
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
function RouteFallback(){const {t}=i18nGlobal();return <div className="route-loading" role="status" aria-live="polite"><span className="route-spinner"/>{t('global.loading')}</div>}


function i18nGlobal(){return {t:i18n.t.bind(i18n)}}
function initials(name:string){ return name.split(' ').slice(0,2).map(x=>x[0]).join('').toUpperCase() }
function IdentityAvatar({
  name,
  photoUrl,
  avatarKey,
  size='md',
  className=''
}:any){
  const {t}=i18nGlobal()
  if(photoUrl){
    return (
      <div className={`identity-avatar ${size} ${className}`}>
        <img
          src={photoUrl}
          alt={name||t('global.identity.profileFallback')}
          loading="lazy"
        />
      </div>
    )
  }

  if(avatarKey){
    return (
      <div
        className={`identity-avatar ${size} meleo-avatar ${avatarKey} ${className}`}
        aria-label={name||t('global.identity.avatarFallback')}
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
  const {t}=useTranslation()
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
        t('patient.profileIdentity.avatarUpdated')
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
        t('patient.profileIdentity.invalidType')
      )
      return
    }

    if(file.size>6_000_000){
      setToast(
        t('patient.profileIdentity.tooLarge')
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
        t('patient.profileIdentity.photoSaved')
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
        t('patient.profileIdentity.photoRemoved')
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
            <small>{t('patient.profileIdentity.kicker')}</small>
            <h2>{t('patient.profileIdentity.title')}</h2>
            <p>
              {t('patient.profileIdentity.intro')}
            </p>
          </div>

          <button
            className="identity-close"
            onClick={onClose}
            aria-label={t('patient.profileIdentity.close')}
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
              {t('patient.profileIdentity.optional')}
            </small>
          </div>

        </div>

        <div className="identity-section">
          <h3>{t('patient.profileIdentity.chooseAvatar')}</h3>

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
                aria-label={t('patient.profileIdentity.avatarAria',{key})}
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
          <span>{t('patient.profileIdentity.or')}</span>
        </div>

        <div className="identity-section">
          <h3>{t('patient.profileIdentity.uploadTitle')}</h3>

          <label className="identity-upload-btn">
            {t('patient.profileIdentity.choosePhoto')}

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
                {t('patient.profileIdentity.zoom')}
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
                  aria-label={t('patient.profileIdentity.moveUp')}
                >
                  ↑
                </button>

                <button
                  onClick={()=>setOffsetX(v=>v-10)}
                  aria-label={t('patient.profileIdentity.moveLeft')}
                >
                  ←
                </button>

                <button
                  onClick={()=>setOffsetX(v=>v+10)}
                  aria-label={t('patient.profileIdentity.moveRight')}
                >
                  →
                </button>

                <button
                  onClick={()=>setOffsetY(v=>v+10)}
                  aria-label={t('patient.profileIdentity.moveDown')}
                >
                  ↓
                </button>
              </div>

              <button
                className="btn btn-dark wide"
                onClick={savePhoto}
                disabled={busy}
              >
                {busy ? t('patient.profileIdentity.saving') : t('patient.profileIdentity.savePhoto')}
              </button>

            </div>
          }

          {user?.profilePhotoUrl&&
            <button
              className="btn btn-outline wide identity-remove-photo"
              onClick={removePhoto}
              disabled={busy}
            >
              {t('patient.profileIdentity.removePhoto')}
            </button>
          }
        </div>

      </div>
    </div>
  )
}
function statusLabel(s:string){const {t}=i18nGlobal();return t('patient.bookingLabels.status.'+s,{defaultValue:s})}
function professionalLifecycleLabel(s:string){const {t}=i18nGlobal();return t('professional.lifecycle.'+s,{defaultValue:'\u2014'})}
function professionalLifecycleClass(s:string){return s==='approved'?'yes':s==='pending_verification'?'pending':s==='verification_rejected'?'no':'neutral'}
async function fileToBase64(file:File){return await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||'').split(',')[1]||'');r.onerror=()=>reject(new Error(i18n.t('global.errors.fileRead')));r.readAsDataURL(file)})}
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
        reject(new Error(i18n.t('global.errors.canvasUnavailable')))
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
      new Error(i18n.t('global.errors.imageLoad'))
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
  {id:'basic',name:'BASIC',price:9.99,currency:'EUR',interval:'month',recommended:false,features:[i18n.t('professional.pricing.features.publicProfile'),i18n.t('professional.pricing.features.bookingManagement'),i18n.t('professional.pricing.features.serviceArea'),i18n.t('professional.pricing.features.basicStats')]},
  {id:'premium',name:'PREMIUM',price:14.99,currency:'EUR',interval:'month',recommended:true,features:[i18n.t('professional.pricing.features.allBasic'),i18n.t('professional.pricing.features.recommendedBadge'),i18n.t('professional.pricing.features.rankingPriority'),i18n.t('professional.pricing.features.advancedAnalytics')]}
]}
const money=(v:number)=>`${Number(v||0).toFixed(2).replace('.',',')}€`
function Mark(){return <div className="brand"><span className="brand-glyph">M</span><span>MELEO</span></div>}
function priceLabel(p:Professional, compact=false){const {t}=i18nGlobal();if((p.pricingMode||'from')==='contact')return t('professional.pricing.contact');return t('professional.pricing.from',{price:p.price})}
function priceNote(p:Professional){const {t}=i18nGlobal();return (p.pricingMode||'from')==='contact'?t('professional.pricing.contactNote'):t('professional.pricing.fromNote')}
function Icon({children}:{children:React.ReactNode}){return <span className="iconbox">{children}</span>}
function Toast({text,onClose}:{text:string,onClose:()=>void}){useEffect(()=>{const t=setTimeout(onClose,3200);return()=>clearTimeout(t)},[]);return <div className="toast">{text}</div>}

function LiveEvents({user,setToast}:any){
 useEffect(()=>{if(!user)return;const es=new EventSource('/api/live',{withCredentials:true} as any);const handler=(ev:any)=>{try{const d=JSON.parse(ev.data||'{}');const n=d.notification;if(n){setToast(n.title);window.dispatchEvent(new CustomEvent('meleo:live',{detail:d}));if('Notification'in window&&Notification.permission==='granted'&&document.visibilityState!=='visible')new Notification(n.title,{body:n.text,tag:n.id})}}catch{}};es.addEventListener('meleo',handler);return()=>es.close()},[user?.id])
 return null
}

function CalendarActions({booking}:any){
  const {t}=useTranslation()

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
    `MELEO · ${booking?.service || t('patient.calendar.visit')}`

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
        {t('patient.calendar.add')}
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
  const {t}=useTranslation()
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
        setToast(t('accountFlow.checkout.confirming'))
        const authToken='cookie'
        for(let i=0;i<6;i++){
          try{
            const r=await api('/professional/subscription/sync',{method:'POST',body:JSON.stringify({sessionId})},authToken)
            if(['active','past_due'].includes(r?.professional?.subscriptionStatus)){setToast(t('accountFlow.checkout.activated'));break}
          }catch{}
          await new Promise(res=>setTimeout(res,1500))
        }
        await refreshMe('cookie')
        setView('pro-dashboard')
      }
      if(checkout==='cancel')setToast(t('accountFlow.checkout.cancelled'))
      if(billing==='return'){await refreshMe('cookie');setView('pro-dashboard')}
      if(verify){try{await api('/auth/verify-email',{method:'POST',body:JSON.stringify({token:verify})});setToast(t('accountFlow.email.verified'));await refreshMe('cookie')}catch(e:any){setToast(e.message)}}
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
  setToast(t('accountFlow.welcome',{name:u.name.split(' ')[0]}))
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
  const {t}=useTranslation()
  const [sent,setSent]=useState(false)
  if(!user||user.emailVerified||!cfg.mailEnabled)return null
  async function resend(){try{await api('/auth/verify-email/resend',{method:'POST'},token);setSent(true);setToast(t('accountFlow.email.resendSuccess'))}catch(e:any){setToast(e.message)}}
  return <div className="verify-banner">
    <span>{t('accountFlow.email.unverified')}</span>
    <button onClick={resend} disabled={sent}>{sent?t('accountFlow.email.sent'):t('accountFlow.email.resend')}</button>
  </div>
}
function Footer({cfg,setView}:any){
  const {t}=useTranslation()

  return <footer className="site-footer"><div className="container footer-grid">
    <div>
      <Mark/>
      <p>{t('shell.footer.disclaimerBefore')} <b>{cfg.emergencyNumber}</b>.</p>
      {cfg.legal.company&&<small>{cfg.legal.company}{cfg.legal.vatNumber?` \u00b7 ${t('shell.footer.vat')} ${cfg.legal.vatNumber}`:''}{cfg.legal.address?` \u00b7 ${cfg.legal.address}`:''}</small>}
    </div>
    <div className="footer-links">
      <b>{t('shell.footer.platform')}</b>
      <button onClick={()=>setView('search')}>{t('shell.nav.search')}</button>
      <button onClick={()=>setView('pricing')}>{t('shell.nav.pricing')}</button>
      <button onClick={()=>setView('become-pro')}>{t('shell.nav.professionals')}</button>
      <button onClick={()=>setView('help')}>{t('shell.nav.help')}</button>
    </div>
    <div className="footer-links">
      <b>{t('shell.footer.legal')}</b>
      <button onClick={()=>setView('terms')}>{t('shell.footer.terms')}</button>
      <button onClick={()=>setView('privacy')}>{t('shell.footer.privacy')}</button>
      <button onClick={()=>setView('cookies')}>{t('shell.footer.cookies')}</button>
    </div>
    <div className="footer-links">
      <b>{t('shell.footer.contact')}</b>
      <a href={`mailto:${cfg.legal.supportEmail}`}>{cfg.legal.supportEmail}</a>
      <a href={`mailto:${cfg.legal.dpoEmail}`}>{t('shell.footer.dpo')}</a>
    </div>
  </div><div className="container footer-base"><span>{'\u00A9'} {new Date().getFullYear()} MELEO</span><span>{t('shell.footer.termsVersion',{version:cfg.termsVersion})}</span></div></footer>
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
  const {t}=useTranslation()
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
  const accountLabel=user?.role==='admin'?t('shell.header.adminCenter'):user?.role==='professional'?(professionalReady?t('shell.header.professionalDashboard'):t('shell.header.completeProfessional')):t('shell.header.myBookings')
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
    <header className="topbar"><div className="container navrow"><button className="brand-btn" onClick={()=>go('home')}><Mark/></button><nav className="desktop-nav"><button className={view==='home'?'active':''} onClick={()=>go('home')}>{t('nav.home')}</button><button onClick={()=>go('search')}>{t('nav.search')}</button><button onClick={()=>go('smart')}>{t('nav.smart')}</button><button onClick={()=>go('now')}>{t('nav.now')}</button><button onClick={()=>go('pricing')}>{t('nav.pricing')}</button><button onClick={()=>go('become-pro')}>{t('nav.professionals')}</button></nav><div className="nav-actions"><LanguageSwitcher/>{user?<div className="account-menu-wrap" onClick={e=>e.stopPropagation()}><button   className={'user-pill '+(accountOpen?'open':'')}   onClick={()=>{     if(window.innerWidth > 980){       setAccountOpen(v=>!v)     }   }}   aria-haspopup="menu"   aria-expanded={accountOpen} >   <IdentityAvatar
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
/><div><b>{user.name}</b><small>{user.email}</small></div></div><button onClick={()=>go(accountView)}>⌂ <span>{accountLabel}</span></button>{user.role==='professional'&&<button onClick={()=>go('patient-dashboard')}>♡ <span>{t('shell.header.personalBookings')}</span></button>}<button
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
    <strong>{t('shell.header.notifications')}</strong>

    {unreadTotal>0
      ? <small>
          {unreadNotifications>0&&
            t('shell.header.newNotifications',{count:notificationLabel})
          }

          {unreadNotifications>0&&unreadMessages>0
            ? ' · '
            : ''
          }

          {unreadMessages>0&&
            t('shell.header.newMessages',{count:messageLabel})
          }
        </small>
      : <small>
          {t('shell.header.noNew')}
        </small>
    }
  </span>

  {unreadTotal>0&&
    <span className="account-live-dot"/>
  }
</button><button onClick={()=>go('help')}>? <span>{t('shell.nav.help')}</span></button><button onClick={()=>go('account')}>⚙ <span>{t('shell.header.accountSettings')}</span></button><div className="account-dropdown-sep"/><button className="danger" onClick={async()=>{setAccountOpen(false);await logout()}}>↪ <span>{t('shell.header.logout')}</span></button></div>}</div>:<button className="btn btn-dark desktop-login" onClick={()=>go('auth')}>{t('shell.header.login')}</button>}<button className={'mobile-menu-btn '+(open?'open':'')} aria-label="{t('shell.header.openMenu')}" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><span/><span/><span/></button></div></div></header>
    {open&&<div className="mobile-menu-overlay" role="presentation" onClick={()=>setOpen(false)}><nav className="mobile-menu-panel" aria-label="{t('shell.header.mainMenu')}" onClick={e=>e.stopPropagation()}>
      <div className="mobile-menu-head"><button className="mobile-menu-brand" onClick={()=>go('home')}><Mark/></button><button className="mobile-menu-close" aria-label="{t('shell.header.closeMenu')}" onClick={()=>setOpen(false)}>×</button></div>
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
        <button className={view==='home'?'active':''} onClick={()=>go('home')}><span className="mobile-menu-icon">⌂</span><div><b>{t('shell.mobile.home')}</b><small>{t('shell.mobile.homeHelp')}</small></div><em>›</em></button>
        <button className={view==='search'?'active':''} onClick={()=>go('search')}><span className="mobile-menu-icon">⌕</span><div><b>{t('shell.nav.search')}</b><small>{t('shell.mobile.searchHelp')}</small></div><em>›</em></button>
        <button className={view==='smart'?'active':''} onClick={()=>go('smart')}><span className="mobile-menu-icon">✦</span><div><b>Smart Request</b><small>{t('shell.mobile.smartHelp')}</small></div><em>›</em></button>
        <button className={view==='now'?'active':''} onClick={()=>go('now')}><span className="mobile-menu-icon">⚡</span><div><b>MELEO Now</b><small>{t('shell.mobile.nowHelp')}</small></div><em>›</em></button>
        <button className={view==='pricing'?'active':''} onClick={()=>go('pricing')}><span className="mobile-menu-icon">◇</span><div><b>{t('shell.nav.pricing')}</b><small>{t('shell.mobile.pricingHelp')}</small></div><em>›</em></button>
        <button className={view==='become-pro'?'active':''} onClick={()=>go('become-pro')}><span className="mobile-menu-icon">＋</span><div><b>{t('shell.nav.professionals')}</b><small>{t('shell.mobile.professionalsHelp')}</small></div><em>›</em></button>
      </div>
      <div className="mobile-menu-account">{user?<><button className="btn btn-dark wide" onClick={()=>go(accountView)}>{accountLabel}</button><button
  className={
    'btn btn-outline wide mobile-notification-button '+
    (unreadTotal>0?'has-unread':'')
  }
  onClick={()=>go('notifications')}
>
  <span>
    🔔 {t('shell.header.notifications')}
  </span>

  {unreadTotal>0&&
    <b className="mobile-notification-badge">
      {unreadLabel}
    </b>
  }
</button><button className="btn btn-outline wide" onClick={()=>go('help')}>{t('shell.nav.help')}</button><button className="btn btn-outline wide" onClick={()=>go('account')}>{t('shell.header.accountSettings')}</button><button className="btn btn-outline wide logout-mobile" onClick={async()=>{setOpen(false);await logout()}}>{t('shell.header.logout')}</button></>:<><button className="btn btn-dark wide" onClick={()=>go('auth')}>{t('shell.header.loginRegister')}</button><small>{t('shell.mobile.guestSearch')}</small></>}</div>
      <div className="mobile-menu-foot"><span>MELEO</span><small>Care that comes to you.</small></div>
    </nav></div>}
  </>
}

function SectionTitle({over,title,subtitle}:any){return <div className="section-title"><div className="eyebrow">{over}</div><h2>{title}</h2><p>{subtitle}</p></div>}
function Step({n,icon,title,text}:any){return <div className="step"><div className="step-top"><span className="step-icon">{icon}</span><span className="step-num">{n}</span></div><h3>{title}</h3><p>{text}</p></div>}
function MiniCard({p}:{p:Professional}){
  const {t}=useTranslation()

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
            ★ {p.rating || t('appCard.new')}
          </span>

          {hasDistance && (
            <span>
              {' · '}
              {Number(p.distance).toFixed(1)} {t('common.distanceKm')}
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
                {distance!.toFixed(1)} {t('common.distanceKm')}
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
  const {t}=useTranslation()
  const checks = getPasswordChecks(password)
  const items = [
    ['length', t('auth.password.length')],
    ['uppercase', t('auth.password.uppercase')],
    ['lowercase', t('auth.password.lowercase')],
    ['number', t('auth.password.number')],
    ['special', t('auth.password.special')]
  ] as const
  return (
    <div className="password-checklist">
      <strong>{t('auth.password.checklistTitle')}</strong>
      {items.map(([key,label])=>(
        <div key={key} className={checks[key]?'password-rule ok':'password-rule'}>
          <span>{checks[key]?'\u2713':'\u25cb'}</span>
          <span>{label}</span>
        </div>
      ))}
    </div>
  )
}

function PasswordStrength({password}:{password:string}) {
  const {t}=useTranslation()
  const checks=getPasswordChecks(password)
  const score=Object.values(checks).filter(Boolean).length
  const label=
    score<=1?t('auth.password.veryWeak'):
    score===2?t('auth.password.weak'):
    score===3?t('auth.password.medium'):
    score===4?t('auth.password.strong'):
    t('auth.password.veryStrong')
  return (
    <div className="password-strength">
      <div className="password-strength-head">
        <span>{t('auth.password.strength')}</span>
        <strong>{label}</strong>
      </div>
      <div className="password-strength-bar"><span style={{width:`${(score/5)*100}%`}}/></div>
    </div>
  )
}


function Auth({onLogged,cfg,setView}:{onLogged:(t:string,u:User)=>void;cfg:AppConfig;setView:(v:string)=>void}){
 const {t}=useTranslation()
 const [mode,setMode]=useState<'login'|'register'|'forgot'>('login')
 const [role,setRole]=useState<'patient'|'professional'>('patient')
 const [form,setForm]=useState({name:'',email:'',phone:'',password:''})
 const [accepted,setAccepted]=useState(false)
 const [error,setError]=useState('')
 const [info,setInfo]=useState('')
 const [busy,setBusy]=useState(false)
 const [socialBusy,setSocialBusy]=useState('')
 const [needs2fa,setNeeds2fa]=useState(false)
 const [totp,setTotp]=useState('')
 const [showPassword,setShowPassword]=useState(false)

 async function submit(e:React.FormEvent){
  e.preventDefault();setError('');setInfo('')
  if(mode==='register'&&!isStrongPassword(form.password)){setError(t('auth.password.policy'));return}
  setBusy(true)
  try{
    if(mode==='forgot'){
      const r=await api('/auth/forgot-password',{method:'POST',body:JSON.stringify({email:form.email})})
      setInfo(r.message||t('auth.checkEmail'));return
    }
    const body=mode==='login'?{email:form.email,password:form.password,totp}:{...form,role,acceptedTerms:accepted}
    const r=await api('/auth/'+mode,{method:'POST',body:JSON.stringify(body)})
    onLogged('cookie',r.user)
  }catch(e:any){setError(e.message);if(String(e.message).includes('2FA'))setNeeds2fa(true)}
  finally{setBusy(false)}
 }

 async function startGoogleOAuth(){
  setError('');setInfo('');setSocialBusy('google-production')
  try{window.location.assign('/api/auth/google/start')}
  catch(e:any){setSocialBusy('');setError(e?.message||t('auth.googleFailed'))}
 }
 async function social(provider:string){setSocialBusy(provider);setError('');try{const r=await api('/auth/social-demo',{method:'POST',body:JSON.stringify({provider})});onLogged('cookie',r.user)}catch(e:any){setError(e.message)}finally{setSocialBusy('')}}
 function demo(kind:'patient'|'professional'|'admin'){const accounts={patient:{email:'patient@meleo.gr',password:'demo123'},professional:{email:'maria@meleo.gr',password:'demo123'},admin:{email:'admin@meleo.gr',password:'admin123'}};setMode('login');setForm({...form,...accounts[kind]})}

 return <section className="auth-page">
  <div className="auth-art"><Mark/><div className="auth-quote"><span>{'\u201c'}</span><h2>{t('auth.quoteLine1')}<br/>{t('auth.quoteLine2')}</h2><p>MELEO {'\u00b7'} Care, beautifully connected.</p></div></div>
  <div className="auth-panel"><div className="auth-mobile-brand"><Mark/></div><div className="auth-inner">
   <div className="auth-tabs"><button className={mode==='login'?'active':''} onClick={()=>{setMode('login');setError('');setInfo('')}}>{t('auth.login')}</button><button className={mode==='register'?'active':''} onClick={()=>{setMode('register');setError('');setInfo('')}}>{t('auth.register')}</button></div>
   <h1>{mode==='login'?t('auth.welcome'):mode==='forgot'?t('auth.resetTitle'):t('auth.createAccount')}</h1>
   <p>{mode==='login'?t('auth.loginIntro'):mode==='forgot'?t('auth.forgotIntro'):t('auth.registerIntro')}</p>
   {mode!=='forgot'&&cfg.googleOAuthEnabled&&<div className="auth-secondary auth-google-production" data-meleo-google-oauth="production"><div className="secondary-social"><button type="button" onClick={startGoogleOAuth} disabled={!!socialBusy}><b>G</b><span>{socialBusy==='google-production'?t('auth.googleConnecting'):t('auth.googleContinue')}</span></button></div><small>{t('auth.googleSecure')}</small><div className="auth-divider"><span>{t('auth.emailDivider')}</span></div></div>}
   {mode==='register'&&<div className="role-toggle"><button className={role==='patient'?'active':''} onClick={()=>setRole('patient')}><Icon>{'\u2302'}</Icon><b>{t('auth.patientRole')}</b><small>{t('auth.patientRoleHelp')}</small></button><button className={role==='professional'?'active':''} onClick={()=>setRole('professional')}><Icon>{'\u2726'}</Icon><b>{t('auth.professionalRole')}</b><small>{t('auth.professionalRoleHelp')}</small></button></div>}
   <form onSubmit={submit}>
    {mode==='register'&&<><label>{t('auth.fullName')}<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>{t('auth.phone')}<input required value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label></>}
    <label>Email<input type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
    {mode!=='forgot'&&<label>{t('auth.password.label')}<input type={showPassword?'text':'password'} minLength={8} required value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/><button type="button" className="password-toggle" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?t('auth.password.hideAria'):t('auth.password.showAria')}>{showPassword?t('auth.password.hide'):t('auth.password.show')}</button>{mode==='register'&&<PasswordChecklist password={form.password}/>}</label>}
    {mode==='login'&&needs2fa&&<label>{t('auth.twoFactor')}<input inputMode="numeric" maxLength={6} placeholder="123456" value={totp} onChange={e=>setTotp(e.target.value.replace(/\D/g,''))}/><small className="field-hint">{t('auth.twoFactorHelp')}</small></label>}
    {mode==='register'&&<label className="consent-row"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/><span>{t('auth.consentBefore')}{' '}<button type="button" className="inline-link" onClick={()=>setView('terms')}>{t('auth.terms')}</button>{' '}{t('auth.consentAnd')}{' '}<button type="button" className="inline-link" onClick={()=>setView('privacy')}>{t('auth.privacy')}</button>.</span></label>}
    {error&&<div className="error">{error}</div>}{info&&<div className="info-box">{info}</div>}
    <button className="btn btn-dark wide" disabled={busy||(mode==='register'&&!accepted)}>{busy?t('auth.pleaseWait'):mode==='login'?t('auth.login'):mode==='forgot'?t('auth.sendLink'):t('auth.createButton')}</button>
   </form>
   {mode==='login'&&<button className="text-btn" onClick={()=>{setMode('forgot');setError('');setInfo('')}}>{t('auth.forgotPassword')}</button>}
   {mode==='forgot'&&<button className="text-btn" onClick={()=>{setMode('login');setError('');setInfo('')}}>{'\u2190'} {t('auth.backToLogin')}</button>}
   {cfg.demoAuth&&<div className="auth-secondary"><div className="auth-divider"><span>{t('auth.quickDivider')}</span></div><div className="secondary-social">{!cfg.googleOAuthEnabled&&<button onClick={()=>social('google')} disabled={!!socialBusy}><b>G</b><span>{socialBusy==='google'?t('auth.googleConnecting'):'Google Demo'}</span></button>}<button onClick={()=>social('apple')} disabled={!!socialBusy}><b>{'\u25cf'}</b><span>{socialBusy==='apple'?t('auth.googleConnecting'):'Apple Demo'}</span></button></div><small>{t('auth.demoOnly')}</small></div>}
   {cfg.demoAuth&&mode==='login'&&<div className="demo-box"><small>DEMO ACCOUNTS</small><div><button onClick={()=>demo('patient')}>{t('auth.demoPatient')}</button><button onClick={()=>demo('professional')}>{t('auth.demoProfessional')}</button><button onClick={()=>demo('admin')}>Admin</button></div><p>{t('auth.demoHint')}</p></div>}
  </div></div>
 </section>
}

function ResetPassword({token,setView,setToast}:any){
 const {t}=useTranslation()
 const [password,setPassword]=useState('')
 const [confirm,setConfirm]=useState('')
 const [error,setError]=useState('')
 const [busy,setBusy]=useState(false)
 const [showPassword,setShowPassword]=useState(false)
 const [showConfirm,setShowConfirm]=useState(false)
 async function submit(e:React.FormEvent){
  e.preventDefault();setError('')
  if(!isStrongPassword(password)){setError(t('auth.password.policy'));return}
  if(password!==confirm){setError(t('auth.password.mismatch'));return}
  setBusy(true)
  try{await api('/auth/reset-password',{method:'POST',body:JSON.stringify({token,password})});setToast(t('auth.reset.changed'));setView('auth')}
  catch(e:any){setError(e.message)}finally{setBusy(false)}
 }
 return <section className="page"><div className="container narrow"><div className="form-card">
  <div className="eyebrow">{t('auth.reset.kicker')}</div><h1>{t('auth.reset.title')}</h1>
  <form onSubmit={submit}>
   <label>{t('auth.password.newPassword')}<input type={showPassword?'text':'password'} minLength={8} required value={password} onChange={e=>setPassword(e.target.value)}/><button type="button" className="password-toggle" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?t('auth.password.hideAria'):t('auth.password.showAria')}>{showPassword?t('auth.password.hide'):t('auth.password.show')}</button></label>
   <PasswordStrength password={password}/><PasswordChecklist password={password}/>
   <label>{t('auth.password.confirmPassword')}<input type={showConfirm?'text':'password'} minLength={8} required value={confirm} onChange={e=>setConfirm(e.target.value)}/><button type="button" className="password-toggle" onClick={()=>setShowConfirm(v=>!v)} aria-label={showConfirm?t('auth.password.hideAria'):t('auth.password.showAria')}>{showConfirm?t('auth.password.hide'):t('auth.password.show')}</button></label>
   {confirm&&password!==confirm&&<small className="field-hint">{t('auth.password.mismatch')}</small>}
   {error&&<div className="error">{error}</div>}
   <button className="btn btn-dark wide" disabled={busy||!isStrongPassword(password)||password!==confirm}>{busy?t('auth.reset.saving'):t('auth.reset.save')}</button>
  </form>
  <small className="terms">{t('auth.reset.sessions')}</small>
 </div></div></section>
}

function ReviewComposer({booking,token,onDone,setToast}:any){
 const {t}=useTranslation()
 const [rating,setRating]=useState(Number(booking.review?.rating||0));const [comment,setComment]=useState(booking.review?.comment||'');const [busy,setBusy]=useState(false)
 if(booking.reviewed)return <div className="review-complete"><span>✓ {t('patient.review.complete')}</span><strong>{'★'.repeat(Number(booking.review?.rating||5))}{'☆'.repeat(5-Number(booking.review?.rating||5))}</strong>{booking.review?.comment&&<p>{booking.review.comment}</p>}<small>{t('patient.review.verifiedLabel')}</small></div>
 async function submit(){if(!rating)return setToast(t('patient.review.selectRating'));setBusy(true);try{await api('/bookings/'+booking.id+'/review',{method:'POST',body:JSON.stringify({rating,comment})},token);setToast(t('patient.review.published'));await onDone()}catch(e:any){setToast(e.message)}finally{setBusy(false)}}
 return <div className="review-composer"><div><span className="review-kicker">{t('patient.review.kicker')}</span><h4>{t('patient.review.title',{name:booking.professionalName})}</h4><p>{t('patient.review.textBefore')} <b>Verified booking</b> {t('patient.review.textAfter')}</p></div><div className="review-stars" aria-label={t('patient.review.ratingAria')}>{[1,2,3,4,5].map(n=><button key={n} type="button" className={rating>=n?'active':''} onClick={()=>setRating(n)} aria-label={t('patient.review.starAria',{count:n})}>★</button>)}</div><textarea placeholder={t('patient.review.placeholder')} value={comment} maxLength={1000} onChange={e=>setComment(e.target.value)}/><button className="btn btn-gold" disabled={busy||!rating} onClick={submit}>{busy?t('patient.review.submitting'):t('patient.review.publish')}</button></div>
}

function repeatLabel(r:string){const {t}=i18nGlobal();return t('patient.bookingLabels.repeat.'+r,{defaultValue:r})}
function Conversation({messages}:any){const {t,i18n}=useTranslation();if(!messages?.length)return null;const locale=i18n.resolvedLanguage==='en'?'en-GB':'el-GR';return <div className="conversation"><div className="conversation-title">{t('patient.conversation.history')}</div>{messages.map((m:any)=><div key={m.id} className={'conversation-msg '+m.fromRole}><div><b>{m.fromName}</b><small>{new Date(m.createdAt).toLocaleString(locale)}</small></div><p>{m.text}</p></div>)}</div>}

function Stat({label,value,note}:any){return <div className="stat-card"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>}
function DashboardHead({eyebrow,title,subtitle}:any){return <div className="dashboard-head"><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>}

function Pricing({user,token,professional,onRefresh,setView,setToast,cfg}:any){
 const {t}=useTranslation()
 const plans:Plan[]=cfg?.plans?.length?cfg.plans:FALLBACK_CONFIG.plans
 const [busy,setBusy]=useState('')
 async function choose(plan:string){
   if(!user){sessionStorage.setItem('meleo_selected_plan',plan);setView('auth');return}
   if(user.role==='patient'){sessionStorage.setItem('meleo_selected_plan',plan);setView('become-pro');return}if(user.role!=='professional'){setToast(t('professional.pricing.professionalOnly'));return}
   sessionStorage.setItem('meleo_selected_plan',plan)
   setBusy(plan)
   try{
     const r=await api('/professional/subscription/checkout',{method:'POST',body:JSON.stringify({plan})},token)
     if(r.mode==='stripe'&&r.url){window.location.href=r.url;return}
     await onRefresh();setView('pro-dashboard')
     setToast(r.mode==='demo'?t('professional.pricing.demoActivated'):t('professional.pricing.planUpdated'))
   }catch(e:any){setToast(e.message);setView('pro-dashboard')}finally{setBusy('')}
 }
 return <section className="pricing-page page"><div className="container">
   <SectionTitle over={t('professional.pricing.kicker')} title={t('professional.pricing.title')} subtitle={t('professional.pricing.subtitle')}/>
   <div className="pricing-grid">{plans.map(x=><div key={x.id} className={'pricing-card '+(x.id==='premium'?'premium':'')}>
     <div className="pricing-head"><span>{x.recommended?t('professional.pricing.recommended'):t('professional.pricing.presence')}</span><h2>{x.name}</h2><div><strong>{money(x.price)}</strong><small>{t('professional.pricing.perMonth')}</small></div></div>
     <ul>{x.features.map(f=><li key={f}>✓ {f}</li>)}</ul>
     <button className={'btn wide '+(x.id==='premium'?'btn-gold':'btn-dark')} disabled={busy===x.id} onClick={()=>choose(x.id)}>
       {professional?.subscriptionPlan===x.id&&['active','past_due'].includes(professional?.subscriptionStatus)?t('professional.pricing.activePlan'):busy===x.id?t('professional.pricing.checkout'):user?.role==='professional'?t('professional.pricing.choosePlan',{name:x.name}):t('professional.pricing.startProfessional')}
     </button>
     {x.id==='premium'&&<small className="pricing-note">{t('professional.pricing.premiumNote')}</small>}
   </div>)}</div>
   <div className="pricing-legal">
     <b>{t('professional.pricing.legalTitle')}</b>
     <p>{t('professional.pricing.legalBilling')}</p>
     <p>{t('professional.pricing.legalNoCommission')}</p>
   </div>
 </div></section>
}
function BecomeProfessional({onLogged,user,professional,token,onRefresh,setView,setToast,cfg}:any){
 const {t}=useTranslation()
 const [busy,setBusy]=useState(false)
 async function enableExisting(){setBusy(true);try{await api('/me/enable-professional',{method:'POST'},token);await onRefresh();setToast(t('professionalJoin.enabledToast'));setView('pro-dashboard')}catch(e:any){setToast(e.message)}finally{setBusy(false)}}
 if(user?.role==='professional'){
   const ready=professional?.verified===true&&['active','past_due'].includes(professional?.subscriptionStatus||'')&&professional?.onboardingStage==='approved'
   return <section className="page"><div className="container narrow"><div className="success-card">
     <div className="success-icon">{ready?'✓':'…'}</div>
     <h1>{ready?t('professionalJoin.existing.readyTitle'):t('professionalJoin.existing.pendingTitle')}</h1>
     <p>{ready?t('professionalJoin.existing.readyBody'):t('professionalJoin.existing.pendingBody')}</p>
     <button className="btn btn-dark" onClick={()=>setView('pro-dashboard')}>{ready?t('professionalJoin.existing.openDashboard'):t('professionalJoin.existing.continueOnboarding')}</button>
     <button className="btn btn-outline" onClick={()=>setView('patient-dashboard')}>{t('professionalJoin.existing.personalBookings')}</button>
   </div></div></section>
 }
 if(user?.role==='patient')return <section className="join-page"><div className="container join-grid"><div>
   <div className="eyebrow light">MELEO PROFESSIONAL</div>
   <h1>{t('professionalJoin.patient.title')}<br/><em>{t('professionalJoin.patient.titleEm')}</em></h1>
   <p>{t('professionalJoin.patient.body')}</p>
   <div className="join-benefits">
     <div>01 <span><b>{t('professionalJoin.patient.b1Title')}</b><small>{t('professionalJoin.patient.b1Body')}</small></span></div>
     <div>02 <span><b>{t('professionalJoin.patient.b2Title')}</b><small>{t('professionalJoin.patient.b2Body')}</small></span></div>
     <div>03 <span><b>{t('professionalJoin.patient.b3Title')}</b><small>{t('professionalJoin.patient.b3Body')}</small></span></div>
   </div>
 </div><div className="join-form">
   <h2>{t('professionalJoin.patient.formTitle')}</h2>
   <p>{t('professionalJoin.patient.formBodyBefore')} <b>{t('professionalJoin.patient.flow')}</b>.</p>
   <button className="btn btn-gold wide" disabled={busy} onClick={enableExisting}>{busy?t('professionalJoin.patient.enabling'):t('professionalJoin.patient.continue')}</button>
   <small className="terms">{t('professionalJoin.patient.accountNote')}</small>
 </div></div></section>
 return <section className="join-page"><div className="container join-grid"><div>
   <div className="eyebrow light">MELEO PROFESSIONAL</div>
   <h1>{t('professionalJoin.guest.title')}<br/><em>{t('professionalJoin.guest.titleEm')}</em></h1>
   <p>{t('professionalJoin.guest.body')}</p>
   <div className="join-benefits">
     <div>01 <span><b>{t('professionalJoin.guest.b1Title')}</b><small>{t('professionalJoin.guest.b1Body')}</small></span></div>
     <div>02 <span><b>{t('professionalJoin.guest.b2Title')}</b><small>{t('professionalJoin.guest.b2Body')}</small></span></div>
     <div>03 <span><b>{t('professionalJoin.guest.b3Title')}</b><small>{t('professionalJoin.guest.b3Body')}</small></span></div>
   </div>
 </div><div className="join-form">
   <h2>{t('professionalJoin.guest.formTitle')}</h2>
   <p>{t('professionalJoin.guest.formBody')}</p>
   <InlineRegister onLogged={onLogged} setView={setView}/>
 </div></div></section>
}
function InlineRegister({onLogged,setView}:any){
 const {t}=useTranslation()
 const [f,setF]=useState({name:'',email:'',phone:'',password:''})
 const [accepted,setAccepted]=useState(false)
 const [error,setError]=useState('')
 const [busy,setBusy]=useState(false)
 async function submit(e:any){
   e.preventDefault()
   setError('')
   setBusy(true)
   try{
     const r=await api('/auth/register',{method:'POST',body:JSON.stringify({...f,role:'professional',acceptedTerms:accepted})})
     onLogged('cookie',r.user)
   }catch(e:any){setError(e.message)}finally{setBusy(false)}
 }
 return <form onSubmit={submit}>
   <label>{t('professionalJoin.register.name')}<input required value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></label>
   <label>{t('professionalJoin.register.email')}<input type="email" required value={f.email} onChange={e=>setF({...f,email:e.target.value})}/></label>
   <label>{t('professionalJoin.register.phone')}<input required value={f.phone} onChange={e=>setF({...f,phone:e.target.value})}/></label>
   <label>{t('professionalJoin.register.password')}<input type="password" minLength={8} required value={f.password} onChange={e=>setF({...f,password:e.target.value})}/><small className="field-hint">{t('professionalJoin.register.passwordHint')}</small></label>
   <label className="consent-row"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/><span>{t('professionalJoin.register.acceptPrefix')} <button type="button" className="inline-link" onClick={()=>setView('terms')}>{t('professionalJoin.register.terms')}</button> {t('professionalJoin.register.and')} <button type="button" className="inline-link" onClick={()=>setView('privacy')}>{t('professionalJoin.register.privacy')}</button>.</span></label>
   {error&&<div className="error">{error}</div>}
   <button className="btn btn-gold wide" disabled={busy||!accepted}>{busy?t('professionalJoin.register.submitting'):t('professionalJoin.register.submit')}</button>
   <small className="terms">{t('professionalJoin.register.afterCreate')}</small>
 </form>
}
function MobileNav({user,view,setView}:any){const {t}=useTranslation();return <nav className="mobile-nav" aria-label={t('patient.mobileNav.aria')}><button className={view==='home'?'active':''} onClick={()=>setView('home')}><span>⌂</span>{t('patient.mobileNav.home')}</button><button className={view==='search'?'active':''} onClick={()=>setView('search')}><span>⌕</span>{t('patient.mobileNav.search')}</button><button className="mobile-center" onClick={()=>setView('now')} aria-label={t('patient.mobileNav.now')}><span>⚡</span></button><button onClick={()=>setView('become-pro')}><span>✦</span>Pro</button><button onClick={()=>setView(user?user.role==='professional'?'pro-dashboard':user.role==='admin'?'admin':'patient-dashboard':'auth')}><span>○</span>{t('patient.mobileNav.profile')}</button></nav>}
function Empty({title,text}:any){return <div className="empty"><div>◇</div><h3>{title}</h3><p>{text}</p></div>}
