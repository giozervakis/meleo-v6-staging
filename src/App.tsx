import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { api } from './lib/api'
import { viewFromPath, pathForView, pushView } from './lib/router'
import type { User, Professional, BookingMessage, Booking, Plan, AppConfig } from './domain/types'
import { serviceMap, specialtyOptions } from './domain/catalog'
const AdminPage = lazy(() => import('./features/admin/AdminPage'))
const ProfessionalDashboardPage = lazy(() => import('./features/professional/ProfessionalDashboard'))
const NotificationsPage = lazy(() => import('./features/support/SupportPages').then(m => ({default:m.NotificationsPage})))
const HelpCenter = lazy(() => import('./features/support/SupportPages').then(m => ({default:m.HelpCenter})))
const AccountSettingsView = lazy(() => import('./Account').then(m => ({default:m.AccountSettings})))
const LegalView = lazy(() => import('./Account').then(m => ({default:m.Legal})))
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

const FALLBACK_CONFIG:AppConfig={env:'production',demoAuth:false,demoCheckout:false,paymentsEnabled:false,mailEnabled:false,portalEnabled:false,termsVersion:'—',emergencyNumber:'112',legal:{company:'',vatNumber:'',address:'',supportEmail:'support@meleo.gr',dpoEmail:'privacy@meleo.gr'},plans:[
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
  const setView=(next:string, replace=false)=>{setViewState(next);pushView(next,selected?.id,replace)}
  useEffect(()=>{const onPop=()=>{const v=viewFromPath(window.location.pathname);setViewState(v);if(v==='profile'){const pid=window.location.pathname.split('/')[2];api('/professionals/'+pid).then((d:any)=>setSelected(d.professional||d)).catch(()=>setViewState('search'))}};window.addEventListener('popstate',onPop);if(viewFromPath(window.location.pathname)==='profile'){const pid=window.location.pathname.split('/')[2];api('/professionals/'+pid).then((d:any)=>setSelected(d.professional||d)).catch(()=>setViewState('search'))}return()=>window.removeEventListener('popstate',onPop)},[])
  const [identityOpen,setIdentityOpen]=useState(false)

  async function refreshMe(t=token){ try{const d=await api('/me',{},t);setUser(d.user);setProfessional(d.professional);if(['patient','professional'].includes(d.user.role))setFavorites(await api('/favorites',{},t))}catch{setUser(null);setProfessional(null)}finally{setLoading(false)} }
  async function loadPros(params=search){const qs=new URLSearchParams();if(params.specialty)qs.set('specialty',params.specialty);if(params.service)qs.set('service',params.service);if(params.lat&&params.lon){qs.set('lat',String(params.lat));qs.set('lon',String(params.lon))}else if(params.locationQuery){qs.set('location',params.locationQuery)};qs.set('limit','30');const d=await api('/professionals?'+qs.toString());setPros(Array.isArray(d)?d:(d.items||[]))}
  useEffect(()=>{api('/config').then(setCfg).catch(()=>{});refreshMe();const m=window.location.pathname.match(/^\/care\/([^/]+)\/([^/]+)$/);if(m){api('/seo/resolve?specialty='+encodeURIComponent(m[1])+'&city='+encodeURIComponent(m[2])).then((x:any)=>{const next={...search,specialty:x.specialty||'',service:'',locationQuery:x.city||'',locationLabel:x.city||'',lat:'',lon:''};setSearch(next);loadPros(next)}).catch(()=>loadPros())}else loadPros()},[])
  useEffect(()=>{if(!token){setUser(null);setProfessional(null)}},[token])
	  
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

  function logged(_t:string,u:User){setToken('cookie');setUser(u);setView(u.role==='admin'?'admin':u.role==='professional'?'pro-dashboard':'home');refreshMe('cookie');setToast(`Καλώς ήρθες, ${u.name.split(' ')[0]}`)}
  async function logout(){try{await api('/auth/logout',{method:'POST'},token)}catch{}setToken('cookie');setUser(null);setProfessional(null);setView('home')}
  async function toggleFav(id:string){if(!user){setView('auth');return}if(!['patient','professional'].includes(user.role))return;const r=await api('/favorites/'+id,{method:'POST'},token);setFavorites(x=>r.favorite?[...x,id]:x.filter(v=>v!==id))}
  function openPro(p:Professional){setSelected(p);setViewState('profile');history.pushState({view:'profile'},'',`/professionals/${p.id}`);window.scrollTo({top:0,behavior:'smooth'})}
  function requireAuth(next='home'){if(user){setView(next);return}setAuthReturn(next);setView('auth')}

  if(loading)return <div className="splash"><div className="splash-logo">M</div><div>MELEO</div></div>

  return <div className="app-shell">
    <Header user={user} professional={professional} view={view} setView={setView} logout={logout}/><LiveEvents user={user} setToast={setToast}/>
    <main>
      {view==='home'&&<Home pros={pros} search={search} setSearch={setSearch} loadPros={loadPros} openPro={openPro} favorites={favorites} toggleFav={toggleFav} user={user} setView={setView}/>}
      {view==='smart'&&<SmartRequest search={search} setSearch={setSearch} loadPros={loadPros} setView={setView}/>}
      {view==='now'&&<NowRequest pros={pros} search={search} setSearch={setSearch} loadPros={loadPros} openPro={openPro} setView={setView}/>}  
      {view==='search'&&<SearchPage pros={pros} search={search} setSearch={setSearch} loadPros={loadPros} openPro={openPro} favorites={favorites} toggleFav={toggleFav}/>} 
      {view==='profile'&&selected&&<Profile p={selected} user={user} favorite={favorites.includes(selected.id)} toggleFav={toggleFav} setView={setView} startBooking={()=>{setBookingSeed(null);setView('booking')}}/>} 
      {view==='booking'&&selected&&<BookingFlow p={selected} seed={bookingSeed} user={user} token={token} setView={setView} setToast={setToast}/>} 
      {(view==='auth'||view==='admin-login'||(view==='admin'&&!user))&&<Auth cfg={cfg} setView={setView} onLogged={(t,u)=>{logged(t,u); if(view!=='admin-login'&&authReturn!=='home'&&u.role==='patient')setTimeout(()=>setView(authReturn),0)}}/>}
      {view==='patient-dashboard'&&user&&<PatientDashboard user={user} token={token} openPro={openPro} startBooking={(p:any,seed:any=null)=>{setSelected(p);setBookingSeed(seed);setView('booking')}} cfg={cfg} setView={setView} setToast={setToast}/>}
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

function Header({user,professional,view,setView,logout}:{user:User|null;professional:Professional|null;view:string;setView:(v:string)=>void;logout:()=>void}){
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
  return <>
    <header className="topbar"><div className="container navrow"><button className="brand-btn" onClick={()=>go('home')}><Mark/></button><nav className="desktop-nav"><button className={view==='home'?'active':''} onClick={()=>go('home')}>Αρχική</button><button onClick={()=>go('search')}>Αναζήτηση</button><button onClick={()=>go('smart')}>Smart Request</button><button onClick={()=>go('now')}>MELEO Now</button><button onClick={()=>go('pricing')}>Συνδρομές</button><button onClick={()=>go('become-pro')}>Για επαγγελματίες</button></nav><div className="nav-actions">{user?<div className="account-menu-wrap" onClick={e=>e.stopPropagation()}><button   className={'user-pill '+(accountOpen?'open':'')}   onClick={()=>{     if(window.innerWidth > 980){       setAccountOpen(v=>!v)     }   }}   aria-haspopup="menu"   aria-expanded={accountOpen} >   <IdentityAvatar
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
/><div><b>{user.name}</b><small>{user.email}</small></div></div><button onClick={()=>go(accountView)}>⌂ <span>{accountLabel}</span></button>{user.role==='professional'&&<button onClick={()=>go('patient-dashboard')}>♡ <span>Οι προσωπικές μου κρατήσεις</span></button>}<button onClick={()=>go('notifications')}>🔔 <span>Ειδοποιήσεις</span></button><button onClick={()=>go('help')}>? <span>Help Center</span></button><button onClick={()=>go('account')}>⚙ <span>Ρυθμίσεις λογαριασμού</span></button><div className="account-dropdown-sep"/><button className="danger" onClick={async()=>{setAccountOpen(false);await logout()}}>↪ <span>Αποσύνδεση</span></button></div>}</div>:<button className="btn btn-dark desktop-login" onClick={()=>go('auth')}>Σύνδεση</button>}<button className={'mobile-menu-btn '+(open?'open':'')} aria-label="Άνοιγμα μενού" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><span/><span/><span/></button></div></div></header>
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
      <div className="mobile-menu-account">{user?<><button className="btn btn-dark wide" onClick={()=>go(accountView)}>{accountLabel}</button><button className="btn btn-outline wide" onClick={()=>go('notifications')}>Ειδοποιήσεις</button><button className="btn btn-outline wide" onClick={()=>go('help')}>Help Center</button><button className="btn btn-outline wide" onClick={()=>go('account')}>Ρυθμίσεις λογαριασμού</button><button className="btn btn-outline wide logout-mobile" onClick={async()=>{setOpen(false);await logout()}}>Αποσύνδεση</button></>:<><button className="btn btn-dark wide" onClick={()=>go('auth')}>Σύνδεση / Εγγραφή</button><small>Η αναζήτηση παραμένει διαθέσιμη χωρίς λογαριασμό.</small></>}</div>
      <div className="mobile-menu-foot"><span>MELEO</span><small>Care that comes to you.</small></div>
    </nav></div>}
  </>
}

function Home({pros,search,setSearch,loadPros,openPro,favorites,toggleFav,user,setView}:any){
  return <>
    <section className="hero"><div className="container hero-grid"><div className="hero-copy"><div className="eyebrow"><span className="eyedot"/> ΦΡΟΝΤΙΔΑ ΜΕ ΕΜΠΙΣΤΟΣΥΝΗ</div><h1>Η σωστή φροντίδα,<br/><em>κοντά σου.</em></h1><p>Βρες επαληθευμένους επαγγελματίες υγείας, φροντίδας και ευεξίας, σύγκρινε επιλογές και κλείσε την υπηρεσία που χρειάζεσαι.</p><SearchBox search={search} setSearch={setSearch} onSearch={()=>{loadPros();setView('search')}}/><div className="trust-strip"><span>✓ Επαληθευμένα προφίλ</span><span>✓ Ευέλικτη ενημέρωση κόστους</span><span>✓ Ασφαλής κράτηση</span></div></div><div className="hero-card-wrap"><div className="floating-chip topchip"><span className="pulse-dot"/> Διαθέσιμοι σήμερα</div><div className="phone-card"><div className="phone-head"><span>9:41</span><span className="tiny-brand">MELEO Care</span></div><h3>Βρες φροντίδα κοντά σου</h3><div className="phone-search">⌖ <div><b>Κοντά σου</b><small>GPS ή αναζήτηση οποιασδήποτε περιοχής</small></div></div><div className="chips"><span className="chip active">Νοσηλευτική</span><span className="chip">Φυσικοθεραπεία</span><span className="chip">Διατροφή</span></div><div className="phone-list">{pros.slice(0,3).map((p:Professional)=><MiniCard key={p.id} p={p}/>)}</div></div><div className="floating-chip bottomchip"><b>0€</b><span>για τον συνοδό/ασθενή</span></div></div></div></section>
    <section className="care-modes"><div className="container"><div className="care-mode-grid"><button className="care-mode-card browse" onClick={()=>setView('search')}><span className="mode-kicker">BROWSE</span><i>⌕</i><h3>Ξέρω τι ψάχνω</h3><p>Ειδικότητα → προαιρετική υπηρεσία → τοποθεσία. Σύγκρινε επαγγελματίες και επίλεξε.</p><b>Αναζήτηση επαγγελματία →</b></button><button className="care-mode-card smart" onClick={()=>setView('smart')}><span className="mode-kicker">SMART REQUEST</span><i>✦</i><h3>Πες μας τι χρειάζεσαι</h3><p>Περιέγραψε την ανάγκη με απλά λόγια και η MELEO θα σε κατευθύνει στη σωστή κατηγορία.</p><b>Ξεκίνα Smart Request →</b></button><button className="care-mode-card now" onClick={()=>setView('now')}><span className="mode-kicker">MELEO NOW</span><i>⚡</i><h3>Το χρειάζομαι άμεσα</h3><p>Βρες διαθέσιμους επαγγελματίες που καλύπτουν την περιοχή σου σήμερα.</p><b>Βρες διαθέσιμο τώρα →</b></button></div></div></section>
    <section className="metric-band"><div className="container metrics"><div><strong>3 βήματα</strong><span>μέχρι την κράτηση</span></div><div><strong>Έλεγχος</strong><span>επαγγελματικής ιδιότητας πριν τη δημοσίευση</span></div><div><strong>24/7</strong><span>online αναζήτηση</span></div><div><strong>0€</strong><span>κόστος πλατφόρμας για τον συνοδό/ασθενή</span></div></div></section>
    <section className="section"><div className="container"><SectionTitle over="ΕΠΙΛΟΓΕΣ ΓΙΑ ΕΣΕΝΑ" title="Επαγγελματίες που ξεχωρίζουν" subtitle="Ανακάλυψε επαληθευμένους επαγγελματίες κοντά σου."/><div className="pro-grid">{pros.slice(0,3).map((p:Professional)=><ProCard key={p.id} p={p} open={()=>openPro(p)} favorite={favorites.includes(p.id)} toggle={()=>toggleFav(p.id)}/>)}</div><div className="center"><button className="btn btn-outline" onClick={()=>setView('search')}>Δες όλους τους επαγγελματίες →</button></div></div></section>
    <section className="section soft"><div className="container"><SectionTitle over="ΠΩΣ ΛΕΙΤΟΥΡΓΕΙ" title="Απλό, ανθρώπινο, ξεκάθαρο" subtitle="Από την ανάγκη στη φροντίδα χωρίς περιττή ταλαιπωρία."/><div className="steps"><Step n="01" icon="⌕" title="Αναζήτησε" text="Διάλεξε ειδικότητα, προαιρετικά υπηρεσία και βρες επαγγελματίες κοντά σου ή σε άλλη περιοχή."/><Step n="02" icon="◇" title="Σύγκρινε" text="Δες επαλήθευση, εμπειρία, αξιολογήσεις, διαθεσιμότητα και τιμή."/><Step n="03" icon="✓" title="Κλείσε" text="Στείλε το αίτημα και παρακολούθησε την κράτηση από το dashboard σου."/></div></div></section>
    <section className="section pro-cta"><div className="container cta-grid"><div><div className="eyebrow light">ΓΙΑ ΕΠΑΓΓΕΛΜΑΤΙΕΣ</div><h2>Η εμπειρία σου αξίζει<br/>να σε βρίσκει ο κόσμος.</h2><p>Δημιούργησε επαγγελματικό προφίλ, όρισε υπηρεσίες, τιμές και διαθεσιμότητα και δέξου νέα αιτήματα.</p><button className="btn btn-gold" onClick={()=>setView('become-pro')}>Γίνε Founding Professional</button></div><div className="cta-panel"><div className="cta-stat"><span>BASIC</span><b>9,99€</b><small>/ μήνα · PREMIUM 14,99€</small></div><div className="cta-line"><span>✓</span> Δικό σου επαγγελματικό προφίλ</div><div className="cta-line"><span>✓</span> Ειδοποιήσεις νέων αιτημάτων</div><div className="cta-line"><span>✓</span> Διαχείριση διαθεσιμότητας</div><div className="cta-line"><span>✓</span> Στατιστικά & ιστορικό</div></div></div></section>
  </>
}

function SearchBox({search,setSearch,onSearch}:any){const services=search.specialty?serviceMap[search.specialty]||[]:[];const [geoBusy,setGeoBusy]=useState(false);const [geoError,setGeoError]=useState('');async function nearMe(){setGeoError('');if(!navigator.geolocation){setGeoError('Η συσκευή δεν υποστηρίζει υπηρεσίες τοποθεσίας.');return}setGeoBusy(true);navigator.geolocation.getCurrentPosition(async pos=>{const lat=String(pos.coords.latitude),lon=String(pos.coords.longitude);let label='Η τρέχουσα τοποθεσία μου';try{const r=await api(`/location/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);label=r.label||label}catch{}setSearch({...search,lat,lon,locationQuery:'',locationLabel:label});setGeoBusy(false)},()=>{setGeoError('Δεν δόθηκε πρόσβαση στην τοποθεσία. Μπορείς να πληκτρολογήσεις περιοχή χειροκίνητα.');setGeoBusy(false)},{enableHighAccuracy:true,timeout:10000,maximumAge:60000})}return <><div className="searchbox searchbox-three location-search"><div className="searchfield"><label>1 · Ειδικότητα</label><select value={search.specialty} onChange={e=>setSearch({...search,specialty:e.target.value,service:''})}><option value="">Επίλεξε ειδικότητα</option>{specialtyOptions.map(x=><option key={x}>{x}</option>)}</select></div><div className="divider"/><div className="searchfield"><label>2 · Υπηρεσία <span className="optional">προαιρετικά</span></label><select value={search.service} disabled={!search.specialty} onChange={e=>setSearch({...search,service:e.target.value})}><option value="">{search.specialty?'Όλες οι υπηρεσίες':'Πρώτα επίλεξε ειδικότητα'}</option>{services.map((x:string)=><option key={x}>{x}</option>)}</select></div><div className="divider"/><div className="searchfield location-field"><label>3 · Τοποθεσία</label><div className="location-entry"><input placeholder="Πόλη, περιοχή ή ΤΚ" value={search.locationQuery} onChange={e=>setSearch({...search,locationQuery:e.target.value,locationLabel:'',lat:'',lon:''})}/><button type="button" className="locate-btn" onClick={nearMe} title="Χρήση τρέχουσας τοποθεσίας">{geoBusy?'…':'⌖'}<span>Κοντά μου</span></button></div>{search.locationLabel&&<small className="location-ok">⌖ {search.locationLabel}</small>}</div><button className="search-btn" onClick={()=>onSearch(search)} disabled={!search.specialty}>⌕<span>Αναζήτηση</span></button></div>{geoError&&<div className="location-error">{geoError}</div>}</>}
function SmartRequest({search,setSearch,loadPros,setView}:any){const [text,setText]=useState('');const [suggestion,setSuggestion]=useState<any>(null);function analyze(){const t=text.toLowerCase();let specialty='';let service='';const rules=[['Φυσικοθεραπεία',['φυσιο','ισχίο','γόνατο','κινησιο','αποκατάσταση']],['Νοσηλευτική',['αντιβ','τραύμα','καθετήρ','ένεση','ορό','νοσηλ']],['Διαιτολογία / Διατροφή',['διατροφ','δίαιτα','βάρος','φαγητ']],['Λογοθεραπεία',['λογοθερ','ομιλία','κατάποση']],['Εργοθεραπεία',['εργοθερ','καθημερινές δραστηριότητες']],['Μαιευτική φροντίδα',['θηλασ','λοχεία','μαία']],['Ψυχολογία',['ψυχολ','άγχος','συμβουλ']]];for(const [sp,keys] of rules as any){if(keys.some((k:string)=>t.includes(k))){specialty=sp;break}}if(specialty){const services=serviceMap[specialty]||[];service=services.find((x:string)=>x.toLowerCase().split(' ').some((w:string)=>w.length>5&&t.includes(w.slice(0,6))))||''}const emergency=['δεν αναπν','δυσκολία στην αναπνο','λιποθυμ','χωρίς αισθήσεις','αιμορραγ','πόνος στο στήθος','εγκεφαλικ','σπασμ','αυτοκτον','ανακοπή'].some(k=>t.includes(k)); if(emergency){setSuggestion({emergency:true});return} setSuggestion(specialty?{specialty,service,confidence:'Υψηλή'}:{unmatched:true})}function continueSearch(){const next={...search,specialty:suggestion.specialty,service:suggestion.service||''};setSearch(next);loadPros(next);setView('search')}return <section className="smart-page page"><div className="container smart-layout"><div className="smart-copy"><span className="mode-kicker">MELEO SMART REQUEST</span><h1>Δεν χρειάζεται να ξέρεις<br/><em>πώς λέγεται η υπηρεσία.</em></h1><p>Περιέγραψε με απλά λόγια τι χρειάζεσαι. Η MELEO σε κατευθύνει σε κατάλληλη κατηγορία επαγγελματία — χωρίς να κάνει διάγνωση.</p><div className="smart-examples"><button onClick={()=>setText('Η μητέρα μου έκανε επέμβαση ισχίου και χρειάζεται βοήθεια στην αποκατάσταση')}>Μετά από επέμβαση ισχίου</button><button onClick={()=>setText('Χρειάζομαι νοσηλευτή για αντιβίωση πρωί και βράδυ για μία εβδομάδα')}>Αγωγή πρωί / βράδυ</button><button onClick={()=>setText('Θέλω διαιτολόγο για κατ’ οίκον διατροφική αξιολόγηση')}>Διατροφική αξιολόγηση</button></div></div><div className="smart-card"><label>Τι χρειάζεσαι;</label><textarea value={text} onChange={e=>{setText(e.target.value);setSuggestion(null)}} placeholder="π.χ. Ο πατέρας μου βγήκε από το νοσοκομείο και χρειάζεται καθημερινή υποστήριξη στο σπίτι…"/><div className="smart-safety">✦ Δεν χρησιμοποιείται για διάγνωση ή επείγον περιστατικό.</div><button className="btn btn-dark wide" disabled={text.trim().length<8} onClick={analyze}>Βρες τη σωστή κατεύθυνση</button>{suggestion?.emergency&&<div className="smart-result emergency-result"><span>ΕΠΕΙΓΟΥΣΑ ΕΝΔΕΙΞΗ</span><h3>Η MELEO δεν είναι υπηρεσία επειγόντων.</h3><p>Η περιγραφή περιέχει ένδειξη που μπορεί να απαιτεί άμεση βοήθεια. Μην περιμένεις απάντηση επαγγελματία μέσω marketplace.</p><button className="btn btn-dark wide" onClick={()=>window.location.href='tel:112'}>Κλήση 112</button></div>}{suggestion?.unmatched&&<div className="smart-result"><span>ΧΡΕΙΑΖΟΜΑΣΤΕ ΛΙΓΟ ΑΚΟΜΗ</span><h3>Δεν μπορέσαμε να προσδιορίσουμε με ασφάλεια ειδικότητα.</h3><p>Επίλεξε ειδικότητα χειροκίνητα ή περιέγραψε πιο συγκεκριμένα την ανάγκη χωρίς να καταχωρείς περισσότερα ευαίσθητα δεδομένα από όσα χρειάζονται.</p><button className="btn btn-outline wide" onClick={()=>setView('search')}>Επιλογή ειδικότητας →</button></div>}{suggestion?.specialty&&<div className="smart-result"><span>ΠΡΟΤΕΙΝΟΜΕΝΗ ΚΑΤΕΥΘΥΝΣΗ</span><h3>{suggestion.specialty}</h3><p>{suggestion.service||'Δες όλους τους επαγγελματίες της ειδικότητας'}</p><small>Βεβαιότητα αντιστοίχισης: {suggestion.confidence} · υποβοηθητική αντιστοίχιση, όχι διάγνωση</small><button className="btn btn-gold wide" onClick={continueSearch}>Δες επαγγελματίες →</button></div>}</div></div></section>}

function NowRequest({pros,search,setSearch,loadPros,openPro,setView}:any){const [specialty,setSpecialty]=useState(search.specialty||'Νοσηλευτική');const [busy,setBusy]=useState(false);const [ready,setReady]=useState(false);async function locate(){if(!navigator.geolocation){return}setBusy(true);navigator.geolocation.getCurrentPosition(async pos=>{const next={...search,specialty,service:'',lat:String(pos.coords.latitude),lon:String(pos.coords.longitude),locationQuery:'',locationLabel:'Η τοποθεσία μου'};setSearch(next);await loadPros(next);setReady(true);setBusy(false)},()=>setBusy(false),{enableHighAccuracy:true,timeout:10000})}return <section className="now-page page"><div className="container"><div className="now-hero"><div><span className="mode-kicker">⚡ MELEO NOW</span><h1>Χρειάζεσαι φροντίδα<br/><em>σήμερα;</em></h1><p>Εντόπισε επαγγελματίες που δηλώνουν διαθεσιμότητα και καλύπτουν τη γεωγραφική σου περιοχή.</p></div><div className="now-control"><label>Ειδικότητα<select value={specialty} onChange={e=>setSpecialty(e.target.value)}>{specialtyOptions.map(x=><option key={x}>{x}</option>)}</select></label><button className="btn btn-dark wide" onClick={locate} disabled={busy}>{busy?'Εντοπισμός…':'⌖ Χρήση τοποθεσίας & εύρεση τώρα'}</button><button className="btn btn-outline wide" onClick={()=>setView('search')}>Αναζήτηση άλλης περιοχής</button></div></div>{ready&&<div className="now-results"><div className="section-title left"><div className="eyebrow">ΔΙΑΘΕΣΙΜΟΙ ΚΟΝΤΑ ΣΟΥ</div><h2>{pros.length?`${pros.length} επιλογές για εσένα`:'Δεν βρέθηκαν άμεσα διαθέσιμοι'}</h2></div><div className="pro-grid">{pros.slice(0,6).map((p:Professional)=><ProCard key={p.id} p={p} open={()=>openPro(p)} favorite={false} toggle={()=>{}}/>)}</div></div>}</div></section>}

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
  useEffect(()=>{
    trackProfessionalEvent(p.id,'impression')
  },[p.id])

  const smart=p.smartMatch?.rank<=3?p.smartMatch:null

  const hasDistance=
    p.distance!==undefined &&
    p.distance!==null &&
    Number.isFinite(Number(p.distance))

  const reasons=(smart?.reasons||[]).slice(0,3)

  return (
    <article className={'pro-card unified-pro-card '+(smart?'has-smart-match':'')}>

      {smart&&
        <div className="smart-match-compact">
          <div className="smart-match-brand">
            <span>✦</span>
            <b>MELEO SMART MATCH</b>
          </div>

          <span className="smart-rank">
            #{smart.rank}
          </span>

          <strong>
            {Math.round(smart.score)}%
            <small> match</small>
          </strong>
        </div>
      }

      <div className="pro-card-top">

<IdentityAvatar
  name={p.name}
  photoUrl={p.profilePhotoUrl}
  avatarKey={p.avatarKey}
  size="lg"
/>

        <button
          className={'heart '+(favorite?'on':'')}
          onClick={e=>{
            e.stopPropagation()
            toggle()
          }}
          aria-label={
            favorite
              ? 'Αφαίρεση από την Ομάδα Φροντίδας'
              : 'Προσθήκη στην Ομάδα Φροντίδας'
          }
        >
          {favorite?'♥':'♡'}
        </button>

        {p.subscriptionPlan==='premium'&&
          <span className="featured">
            ΠΡΟΤΕΙΝΟΜΕΝΟΣ · PREMIUM
          </span>
        }

      </div>

      <div className="pro-card-body">

        <div className="pro-name">
          <h3>{p.name}</h3>

          {p.verified&&
            <span
              className="verify-badge"
              title="Επαληθευμένος επαγγελματίας"
            >
              ✓
            </span>
          }
        </div>

        <p className="muted">
          {p.title}
          {p.services?.[0]?' · '+p.services[0]:''}
        </p>

        <div className="rating-row">

          <span className="stars">
            ★ {p.rating||'Νέο'}
          </span>

          <span>
            {p.reviews
              ? `(${p.reviews} αξιολογήσεις)`
              : 'Νέο προφίλ'
            }
          </span>

          {hasDistance&&
            <span>
              · {Number(p.distance).toFixed(1)} χλμ
            </span>
          }

        </div>

        <div className="tag-row">
          {(p.services||[])
            .slice(0,2)
            .map((x:string)=>
              <span key={x}>
                {x}
              </span>
            )
          }
        </div>

        {smart&&
          <div className="smart-match-inline">

            <div className="smart-match-inline-head">
              <span>
                Γιατί σου προτείνεται
              </span>

              {p.trust?.eligible
                ? <b>
                    Trust {p.trust.score}/100
                  </b>
                : <b>
                    MELEO Verified
                  </b>
              }
            </div>

            {reasons.length>0&&
              <div className="smart-match-inline-reasons">
                {reasons.map((reason:string)=>
                  <span key={reason}>
                    ✓ {reason}
                  </span>
                )}
              </div>
            }

          </div>
        }

        <div className="card-footer">

          <div>

            <span className="availability">
              <i/>
              {p.available}
            </span>

            <small>
              <b>{priceLabel(p,true)}</b>
              <br/>
              {priceNote(p)}
            </small>

          </div>

          <button
            className="round-arrow"
            onClick={open}
            aria-label={`Προβολή προφίλ ${p.name}`}
          >
            →
          </button>

        </div>

      </div>

    </article>
  )
}


function SearchPage({pros,search,setSearch,loadPros,openPro,favorites,toggleFav}:any){
 const [sort,setSort]=useState('recommended')
 const sorted=useMemo(()=>{
   const items=[...pros]

   if(sort==='price')
     return items.sort((a,b)=>(a.price||0)-(b.price||0))

   if(sort==='rating')
     return items.sort((a,b)=>(b.rating||0)-(a.rating||0))

   // "recommended" preserves the authoritative server-side
   // MELEO Smart Match ordering.
   return items
 },[pros,sort])
 return <section className="page"><div className="container"><div className="page-head"><div><div className="eyebrow">ΑΝΑΖΗΤΗΣΗ</div><h1>Φροντίδα κοντά σου</h1><p>Επίλεξε ειδικότητα, προαιρετικά υπηρεσία και τοποθεσία. Χρησιμοποίησε GPS ή αναζήτησε οποιαδήποτε πόλη/περιοχή στην Ελλάδα και διεθνώς.</p></div></div><div className="search-toolbar"><SearchBox search={search} setSearch={setSearch} onSearch={()=>loadPros(search)}/><div className="filter-row"><div>{sorted.length} επαγγελματίες</div><select value={sort} onChange={e=>setSort(e.target.value)}><option value="recommended">Προτεινόμενοι</option><option value="rating">Καλύτερη αξιολόγηση</option><option value="price">Χαμηλότερο βασικό κόστος</option></select></div></div>{sorted.length?<div className="search-results">{sorted.map(p=><ProCard key={p.id} p={p} open={()=>openPro(p)} favorite={favorites.includes(p.id)} toggle={()=>toggleFav(p.id)}/>)}</div>:<Empty title="Δεν βρήκαμε αποτελέσματα" text="Δοκίμασε άλλη υπηρεσία ή περιοχή."/>}</div></section>
}

function Profile({p,user,favorite,toggleFav,setView,startBooking}:any){
  const [tab,setTab]=useState('about');const [reviews,setReviews]=useState<any[]>([]);const [trust,setTrust]=useState<any>(p?.trust||null)
  useEffect(()=>{trackProfessionalEvent(p.id,'profile_view');api('/professionals/'+p.id+'/reviews?limit=50').then((d:any)=>setReviews(Array.isArray(d)?d:(d.items||[]))).catch(()=>setReviews([]));api('/professionals/'+p.id).then((d:any)=>setTrust((d.professional||d)?.trust||null)).catch(()=>{})},[p.id])
  const call=()=>{trackProfessionalEvent(p.id,'phone_click')}
  return <section className="page"><div className="container profile-layout"><div className="profile-main"><button className="back" onClick={()=>setView('search')}>← Πίσω στην αναζήτηση</button><div className="profile-hero premium-profile"><IdentityAvatar
  name={p.name}
  photoUrl={p.profilePhotoUrl}
  avatarKey={p.avatarKey}
  size="xl"
/><div className="profile-title"><div className="overline-row">{p.subscriptionPlan==='premium'&&<span className="featured inline">MELEO PREMIUM · ΠΡΟΤΕΙΝΟΜΕΝΟΣ</span>}{p.verified&&<span className="verified-text">✓ MELEO Verified</span>}</div><h1>{p.name}</h1><p>{p.title} · {p.area?p.area+', ':''}{p.city}{p.countryCode?' · '+p.countryCode.toUpperCase():''}</p><div className="rating-row big"><span className="stars">★ {p.rating||'Νέο'}</span><span>{p.reviews} αξιολογήσεις</span><span>· {p.years} έτη εμπειρίας</span>{p.responseTime&&<span>· Απαντά {p.responseTime}</span>}</div></div><button className={'heart standalone '+(favorite?'on':'')} title={favorite?'Στην Ομάδα Φροντίδας μου':'Προσθήκη στην Ομάδα Φροντίδας μου'} aria-label={favorite?'Αφαίρεση από την Ομάδα Φροντίδας':'Προσθήκη στην Ομάδα Φροντίδας'} onClick={()=>toggleFav(p.id)}>{favorite?'♥':'♡'}</button></div><div className="profile-trust-grid"><span><b>✓</b> Επαληθευμένη ιδιότητα</span><span><b>⌖</b> Έως {p.serviceRadiusKm||15} km</span><span><b>⚡</b> {p.available}</span><span><b>◷</b> {p.responseTime||'Συνήθως γρήγορη απάντηση'}</span></div>{trust&&<div className={'meleo-trust-card '+(trust.eligible?'ready':'new')}><div className="trust-mark">M</div><div className="trust-copy"><small>MELEO TRUST</small>{trust.eligible?<><strong>{trust.score}<em>/100</em></strong><b>{trust.label}</b><span>Ανεξάρτητο από το πακέτο συνδρομής · βασίζεται σε επαλήθευση, αξιολογήσεις, ολοκληρώσεις και συνέπεια.</span></>:<><strong className="trust-new">Verified</strong><b>Νέος επαγγελματίας</b><span>Το Trust Score ενεργοποιείται όταν υπάρχουν αρκετές πραγματικές ολοκληρωμένες συνεργασίες και αξιολογήσεις.</span></>}</div>{trust.eligible&&<div className="trust-mini"><span>★ {trust.rating}</span><span>✓ {trust.completionRate}% ολοκλήρωση</span><span>↗ {trust.responseRate}% ανταπόκριση</span></div>}</div>}<div className="profile-tabs">{[['about','Σχετικά'],['services','Υπηρεσίες'],['availability','Διαθεσιμότητα'],['credentials','Προσόντα'],['reviews','Αξιολογήσεις']].map(([k,l])=><button key={k} className={tab===k?'active':''} onClick={()=>setTab(k)}>{l}</button>)}</div>{tab==='about'&&<div className="content-card"><h3>Σχετικά με τον επαγγελματία</h3><p>{p.bio}</p><div className="detail-pills">{(p.languages||['Ελληνικά']).map((x:string)=><span key={x}>🌐 {x}</span>)}</div></div>}{tab==='services'&&<div className="content-card"><h3>Υπηρεσίες</h3><div className="service-list">{p.services.map((s:string)=><div className="service-item" key={s}><span className="service-mark">+</span><div><b>{s}</b><small>Η ακριβής χρέωση διαμορφώνεται από τις ανάγκες του περιστατικού και συμφωνείται πριν την επίσκεψη.</small></div><strong>{(p.pricingMode||'from')==='contact'?'Κατόπιν επικοινωνίας':'Από βασική επίσκεψη'}</strong></div>)}</div></div>}{tab==='availability'&&<div className="content-card"><h3>Επόμενη διαθεσιμότητα</h3><p className="muted">Ενδεικτικές διαθέσιμες ώρες. Η τελική ώρα επιβεβαιώνεται από τον επαγγελματία.</p><div className="time-grid">{p.availability.map((t:string)=><span key={t}>{t}</span>)}</div></div>}{tab==='credentials'&&<div className="content-card"><h3>Επαγγελματικά στοιχεία</h3><div className="credential-list">{(p.credentials||['Επαγγελματική ιδιότητα ελεγμένη από MELEO']).map((x:string)=><div key={x}>✓ <span>{x}</span></div>)}</div></div>}{tab==='reviews'&&<div className="content-card"><h3>{reviews.length?`${reviews.length} αξιολογήσεις`:'Δεν υπάρχουν αξιολογήσεις ακόμη'}</h3>{reviews.length>0&&<div className="review-highlight"><strong>{p.rating}</strong><span>★★★★★<small>Μέση βαθμολογία επαληθευμένων κρατήσεων</small></span></div>}<div className="public-reviews">{reviews.map((r:any)=><div className="public-review" key={r.id}><div><b>{r.patientName}</b><span>{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</span></div>{r.comment&&<p>{r.comment}</p>}<small>✓ Επαληθευμένη κράτηση · {new Date(r.createdAt).toLocaleDateString('el-GR')}</small></div>)}</div><p className="muted">Οι αξιολογήσεις επιτρέπονται μόνο μετά από ολοκληρωμένη κράτηση και επισημαίνονται ως verified booking.</p></div>}</div><aside className="booking-panel sticky-premium"><div className="availability-top"><span className="pulse-dot"/> {p.available}</div><div className="panel-price"><span>Βασικό κόστος επίσκεψης</span><strong>{priceLabel(p)}</strong><small>{priceNote(p)}</small></div><div className="panel-feature">✓ Verified professional</div><div className="panel-feature">✓ Συμφωνία τελικού κόστους πριν την επίσκεψη</div><div className="panel-feature">✓ Αξιολογήσεις μόνο από ολοκληρωμένες κρατήσεις</div>{p.phone&&<a className="btn btn-outline wide phone-cta" href={`tel:${p.phone}`} onClick={call}>☎ Κλήση επαγγελματία</a>}{p.email&&<a className="profile-email-link" href={`mailto:${p.email}`}>✉ {p.email}</a>}<button className="btn btn-dark wide" onClick={()=>user?startBooking():setView('auth')}>{user?'Ζήτησε επίσκεψη':'Συνδέσου για αίτημα'}</button><button className="btn btn-outline wide" onClick={()=>setView('now')}>⚡ Έλεγξε MELEO Now</button><small className="panel-note">Η MELEO είναι marketplace εύρεσης επαγγελματιών και δεν αποτελεί υπηρεσία επείγουσας ιατρικής βοήθειας.</small></aside></div></section>
}

function BookingFlow({p,seed,user,token,setView,setToast}:any){

  const defaultTimeSlots = [
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
    '20:00'
  ]

  const professionalTimes =
    Array.isArray(p?.availability)
      ? p.availability.filter(
          (x:any) => typeof x === 'string' && x.trim() !== ''
        )
      : []

  const availableTimes =
    professionalTimes.length > 0
      ? professionalTimes
      : defaultTimeSlots

  const availableServices =
    Array.isArray(p?.services) && p.services.length > 0
      ? p.services
      : ['Επίσκεψη']

  const [step,setStep] = useState(1)

  const [contactConsent,setContactConsent] = useState(false)

  const [form,setForm] = useState({
    service: seed?.service&&availableServices.includes(seed.service)?seed.service:availableServices[0],
    date: new Date(Date.now()+86400000).toISOString().slice(0,10),
    time: availableTimes[0] || '10:00',
    address: seed?.address||'',
    notes: '',
    repeat: seed?.repeat||'once'
  })

  const [busy,setBusy] = useState(false)

  async function submit(){
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
      setToast('Το αίτημα κράτησης καταχωρήθηκε')

    }catch(e:any){
      setToast(e.message)
    }finally{
      setBusy(false)
    }
  }

  if(!['patient','professional'].includes(user?.role)){
    return (
      <section className="page">
        <div className="container narrow">

          <Empty
            title="Χρειάζεται λογαριασμός συνοδού/ασθενή"
            text="Οι κρατήσεις δημιουργούνται από λογαριασμό χρήστη."
          />

          <button
            className="btn btn-dark wide"
            onClick={()=>setView('home')}
          >
            Επιστροφή
          </button>

        </div>
      </section>
    )
  }

  return (
    <section className="page">

      <div className="container booking-layout">

        <div className="booking-flow">

          <button
            className="back"
            onClick={()=>setView('profile')}
          >
            ← {p.name}
          </button>

          <div className="booking-progress">
            <span className={step>=1?'on':''}>1</span>
            <i/>
            <span className={step>=2?'on':''}>2</span>
            <i/>
            <span className={step>=3?'on':''}>3</span>
          </div>


          {/* =========================
              STEP 1
          ========================== */}

          {step===1 && (

            <div className="form-card">

              <div className="eyebrow">
                ΒΗΜΑ 1 ΑΠΟ 2
              </div>

              <h1>
                Πότε χρειάζεσαι φροντίδα;
              </h1>


              <label>
                Υπηρεσία

                <select
                  value={form.service}
                  onChange={e=>
                    setForm({
                      ...form,
                      service:e.target.value
                    })
                  }
                >
                  {availableServices.map((x:string)=>(
                    <option
                      key={x}
                      value={x}
                    >
                      {x}
                    </option>
                  ))}
                </select>

              </label>


              <div className="two">

                <label>
                  Ημερομηνία

                  <input
                    type="date"
                    value={form.date}
                    min={new Date().toISOString().slice(0,10)}
                    onChange={e=>
                      setForm({
                        ...form,
                        date:e.target.value
                      })
                    }
                  />

                </label>


                <label>
                  Ώρα

                  <select
                    value={form.time}
                    onChange={e=>
                      setForm({
                        ...form,
                        time:e.target.value
                      })
                    }
                  >

                    {availableTimes.map((x:string)=>(

                      <option
                        key={x}
                        value={x}
                      >
                        {x}
                      </option>

                    ))}

                  </select>

                </label>

              </div>


              <label>
                Επανάληψη

                <select
                  value={form.repeat}
                  onChange={e=>
                    setForm({
                      ...form,
                      repeat:e.target.value
                    })
                  }
                >

                  <option value="once">
                    Μία επίσκεψη
                  </option>

                  <option value="daily7">
                    Καθημερινά για 7 ημέρες
                  </option>

                  <option value="twice7">
                    Πρωί & βράδυ για 7 ημέρες
                  </option>

                </select>

              </label>


              <button
                className="btn btn-dark wide"
                onClick={()=>setStep(2)}
              >
                Συνέχεια →
              </button>

            </div>

          )}


          {/* =========================
              STEP 2
          ========================== */}

          {step===2 && (

            <div className="form-card">

              <div className="eyebrow">
                ΒΗΜΑ 2 ΑΠΟ 2
              </div>

              <h1>
                Στοιχεία επίσκεψης
              </h1>


              <label>
                Διεύθυνση επίσκεψης

                <input
                  placeholder="Οδός, αριθμός, περιοχή"
                  value={form.address}
                  onChange={e=>
                    setForm({
                      ...form,
                      address:e.target.value
                    })
                  }
                />

              </label>


              <label>
                Σημειώσεις

                <textarea
                  placeholder="Προαιρετικές πληροφορίες για τον επαγγελματία. Μην καταχωρείτε περισσότερα ευαίσθητα δεδομένα από όσα είναι απαραίτητα."
                  value={form.notes}
                  onChange={e=>
                    setForm({
                      ...form,
                      notes:e.target.value
                    })
                  }
                />

              </label>


              <div className="summary-box">

                <div>
                  <span>Υπηρεσία</span>
                  <b>{form.service}</b>
                </div>

                <div>
                  <span>Ημερομηνία</span>
                  <b>
                    {form.date} · {form.time}
                  </b>
                </div>

                <div>
                  <span>Βασικό κόστος επίσκεψης</span>
                  <b>{priceLabel(p,true)}</b>
                </div>

                <div>
                  <span>Τελικό κόστος</span>
                  <b>
                    Κατόπιν τηλεφωνικής συνεννόησης
                  </b>
                </div>

              </div>


              <label className="consent-row booking-consent">

                <input
                  type="checkbox"
                  checked={contactConsent}
                  onChange={e=>
                    setContactConsent(e.target.checked)
                  }
                />

                <span>
                  Συμφωνώ να κοινοποιηθούν το email και
                  το τηλέφωνό μου στον συγκεκριμένο
                  επαγγελματία για τη διαχείριση αυτού
                  του αιτήματος.
                </span>

              </label>


              <button
                className="btn btn-dark wide"
                disabled={
                  !form.address ||
                  !contactConsent ||
                  busy
                }
                onClick={submit}
              >
                {busy
                  ? 'Καταχώρηση...'
                  : 'Αποστολή αιτήματος'
                }
              </button>


              <button
                className="text-btn"
                onClick={()=>setStep(1)}
              >
                ← Αλλαγή ώρας
              </button>

            </div>

          )}


          {/* =========================
              SUCCESS
          ========================== */}

          {step===3 && (

            <div className="success-card">

              <div className="success-icon">
                ✓
              </div>

              <div className="eyebrow">
                ΤΟ ΑΙΤΗΜΑ ΣΤΑΛΘΗΚΕ
              </div>

              <h1>
                Η κράτησή σου είναι σε αναμονή
                επιβεβαίωσης.
              </h1>

              <p>
                Ο επαγγελματίας θα δει το αίτημα στο
                dashboard του. Μπορείς να παρακολουθείς
                την κατάσταση από τις κρατήσεις σου.
              </p>

              <button
                className="btn btn-dark"
                onClick={()=>setView('patient-dashboard')}
              >
                Οι κρατήσεις μου
              </button>

            </div>

          )}

        </div>


        {/* =========================
            SIDEBAR
        ========================== */}

        <aside className="booking-side">

          <MiniCard p={p}/>

          <hr/>

          <p>
            <b>Τι ακολουθεί;</b>
          </p>

          <ol>
            <li>
              Στέλνεις το αίτημα.
            </li>

            <li>
              Ο επαγγελματίας επικοινωνεί μαζί σου
              για ανάγκες και τελικό κόστος.
            </li>

            <li>
              Μετά τη συμφωνία επιβεβαιώνεται
              η επίσκεψη.
            </li>
          </ol>

        </aside>

      </div>

    </section>
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
 async function submit(e:React.FormEvent){e.preventDefault();setError('');setInfo('');setBusy(true);try{
   if(mode==='forgot'){const r=await api('/auth/forgot-password',{method:'POST',body:JSON.stringify({email:form.email})});setInfo(r.message||'Έλεγξε το email σου.');return}
   const body=mode==='login'?{email:form.email,password:form.password,totp}:{...form,role,acceptedTerms:accepted}
   const r=await api('/auth/'+mode,{method:'POST',body:JSON.stringify(body)});onLogged('cookie',r.user)
 }catch(e:any){setError(e.message);if(String(e.message).includes('2FA'))setNeeds2fa(true)}finally{setBusy(false)}}
 async function social(provider:string){setSocialBusy(provider);setError('');try{const r=await api('/auth/social-demo',{method:'POST',body:JSON.stringify({provider})});onLogged('cookie',r.user)}catch(e:any){setError(e.message)}finally{setSocialBusy('')}}
 function demo(kind:'patient'|'professional'|'admin'){const accounts={patient:{email:'patient@meleo.gr',password:'demo123'},professional:{email:'maria@meleo.gr',password:'demo123'},admin:{email:'admin@meleo.gr',password:'admin123'}};setMode('login');setForm({...form,...accounts[kind]})}
 return <section className="auth-page"><div className="auth-art"><Mark/><div className="auth-quote"><span>“</span><h2>Η φροντίδα είναι προσωπική.<br/>Η τεχνολογία πρέπει να την κάνει απλούστερη.</h2><p>MELEO · Care, beautifully connected.</p></div></div><div className="auth-panel"><div className="auth-mobile-brand"><Mark/></div><div className="auth-inner"><div className="auth-tabs"><button className={mode==='login'?'active':''} onClick={()=>{setMode('login');setError('');setInfo('')}}>Σύνδεση</button><button className={mode==='register'?'active':''} onClick={()=>{setMode('register');setError('');setInfo('')}}>Νέα εγγραφή</button></div><h1>{mode==='login'?'Καλώς ήρθες ξανά':mode==='forgot'?'Επαναφορά κωδικού':'Δημιούργησε λογαριασμό'}</h1><p>{mode==='login'?'Συνδέσου για να συνεχίσεις στη MELEO.':mode==='forgot'?'Δώσε το email του λογαριασμού σου και θα λάβεις σύνδεσμο επαναφοράς.':'Επίλεξε πώς θέλεις να χρησιμοποιήσεις τη MELEO.'}</p>{mode==='register'&&<div className="role-toggle"><button className={role==='patient'?'active':''} onClick={()=>setRole('patient')}><Icon>⌂</Icon><b>Χρειάζομαι φροντίδα</b><small>Συνοδός / ασθενής</small></button><button className={role==='professional'?'active':''} onClick={()=>setRole('professional')}><Icon>✦</Icon><b>Είμαι επαγγελματίας</b><small>Απαιτείται συνδρομή BASIC ή PREMIUM</small></button></div>}<form onSubmit={submit}>{mode==='register'&&<><label>Ονοματεπώνυμο<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Κινητό / Τηλέφωνο<input required value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label></>}<label>Email<input type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>{mode!=='forgot'&&<label>Κωδικός<input type="password" minLength={8} required value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/>{mode==='register'&&<small className="field-hint">Τουλάχιστον 8 χαρακτήρες.</small>}</label>}{mode==='login'&&needs2fa&&<label>Κωδικός 2FA<input inputMode="numeric" maxLength={6} placeholder="123456" value={totp} onChange={e=>setTotp(e.target.value.replace(/\D/g,''))}/><small className="field-hint">Άνοιξε την εφαρμογή Authenticator του διαχειριστή.</small></label>}{mode==='register'&&<label className="consent-row"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/><span>Αποδέχομαι τους <button type="button" className="inline-link" onClick={()=>setView('terms')}>Όρους Χρήσης</button> και την <button type="button" className="inline-link" onClick={()=>setView('privacy')}>Πολιτική Απορρήτου</button>.</span></label>}{error&&<div className="error">{error}</div>}{info&&<div className="info-box">{info}</div>}<button className="btn btn-dark wide" disabled={busy||(mode==='register'&&!accepted)}>{busy?'Παρακαλώ...':mode==='login'?'Σύνδεση':mode==='forgot'?'Αποστολή συνδέσμου':'Δημιουργία λογαριασμού'}</button></form>{mode==='login'&&<button className="text-btn" onClick={()=>{setMode('forgot');setError('');setInfo('')}}>Ξέχασα τον κωδικό μου</button>}{mode==='forgot'&&<button className="text-btn" onClick={()=>{setMode('login');setError('');setInfo('')}}>← Επιστροφή στη σύνδεση</button>}{cfg.demoAuth&&<div className="auth-secondary"><div className="auth-divider"><span>ή συνέχισε γρήγορα</span></div><div className="secondary-social"><button onClick={()=>social('google')} disabled={!!socialBusy}><b>G</b><span>{socialBusy==='google'?'Σύνδεση…':'Google'}</span></button><button onClick={()=>social('apple')} disabled={!!socialBusy}><b>●</b><span>{socialBusy==='apple'?'Σύνδεση…':'Apple'}</span></button></div><small>Demo σύνδεση — διαθέσιμη μόνο εκτός production.</small></div>}{cfg.demoAuth&&mode==='login'&&<div className="demo-box"><small>DEMO ACCOUNTS</small><div><button onClick={()=>demo('patient')}>Συνοδός</button><button onClick={()=>demo('professional')}>Επαγγελματίας</button><button onClick={()=>demo('admin')}>Admin</button></div><p>Πάτησε ρόλο και μετά «Σύνδεση».</p></div>}</div></div></section>
}
function ResetPassword({token,setView,setToast}:any){
 const [password,setPassword]=useState('');const [confirm,setConfirm]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false)
 async function submit(e:React.FormEvent){e.preventDefault();setError('');if(password.length<8)return setError('Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.');if(password!==confirm)return setError('Οι κωδικοί δεν ταιριάζουν.');setBusy(true);try{await api('/auth/reset-password',{method:'POST',body:JSON.stringify({token,password})});setToast('Ο κωδικός άλλαξε. Συνδέσου με τον νέο κωδικό.');setView('auth')}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 return <section className="page"><div className="container narrow"><div className="form-card"><div className="eyebrow">ΑΣΦΑΛΕΙΑ ΛΟΓΑΡΙΑΣΜΟΥ</div><h1>Όρισε νέο κωδικό</h1><form onSubmit={submit}><label>Νέος κωδικός<input type="password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)}/></label><label>Επιβεβαίωση κωδικού<input type="password" minLength={8} required value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>{error&&<div className="error">{error}</div>}<button className="btn btn-dark wide" disabled={busy}>{busy?'Αποθήκευση…':'Αποθήκευση νέου κωδικού'}</button></form><small className="terms">Για ασφάλεια, όλες οι ενεργές συνεδρίες αποσυνδέονται μετά την αλλαγή.</small></div></div></section>
}
function PatientDashboard({user,token,openPro,startBooking,cfg,setView,setToast}:any){
 const [bookings,setBookings]=useState<Booking[]>([]);const [careTeam,setCareTeam]=useState<any[]>([]);const [open,setOpen]=useState<string>('');const [reply,setReply]=useState('');const [recovery,setRecovery]=useState<Record<string,any[]>>({});const [recoveryBusy,setRecoveryBusy]=useState<string>('')
 async function refresh(){const scope=user?.role==='professional'?'&scope=requested':'';const [d,team]=await Promise.all([api('/bookings?limit=50'+scope,{},token),api('/care-team',{},token).catch(()=>({items:[]}))]);setBookings(Array.isArray(d)?d:(d.items||[]));setCareTeam(team.items||[])}useEffect(()=>{refresh();const f=()=>refresh();window.addEventListener('meleo:live',f);return()=>window.removeEventListener('meleo:live',f)},[])
 async function loadRecovery(id:string){setRecoveryBusy(id);try{const d=await api('/bookings/'+id+'/recovery-candidates',{},token);setRecovery(x=>({...x,[id]:d.items||[]}))}catch(e:any){setToast(e.message)}finally{setRecoveryBusy('')}}
 async function cancel(id:string){await api('/bookings/'+id+'/status',{method:'PATCH',body:JSON.stringify({status:'cancelled'})},token);setOpen(id);await refresh();await loadRecovery(id)}
 async function recover(id:string,professionalId:string){setRecoveryBusy(id);try{await api('/bookings/'+id+'/recover',{method:'POST',body:JSON.stringify({professionalId})},token);setToast('Το ίδιο αίτημα στάλθηκε σε νέο επαγγελματία.');setRecovery(x=>({...x,[id]:[]}));await refresh()}catch(e:any){setToast(e.message)}finally{setRecoveryBusy('')}}
 async function sendReply(id:string){if(!reply.trim())return;await api('/bookings/'+id+'/message',{method:'POST',body:JSON.stringify({text:reply})},token);setReply('');refresh()}
 async function quoteDecision(id:string,decision:string){await api('/bookings/'+id+'/quote-decision',{method:'POST',body:JSON.stringify({decision})},token);refresh()}
 async function bookAgain(b:any){try{const d=await api('/professionals/'+b.professionalId);const p=d.professional||d;startBooking(p,{service:b.service,address:b.address,repeat:b.repeat||'once'});setToast('Έτοιμο — επίλεξε νέα ημερομηνία και ώρα.')}catch(e:any){setToast(e.message)}}

 return <section className="page dashboard-page"><div className="container"><VerifyEmailBanner user={user} token={token} cfg={cfg} setToast={setToast}/><DashboardHead eyebrow="Ο ΛΟΓΑΡΙΑΣΜΟΣ ΜΟΥ" title={`Καλησπέρα, ${user.name.split(' ')[0]}`} subtitle="Οι κρατήσεις, οι διευκρινίσεις και οι αξιολογήσεις σου σε ένα σημείο."/><div className="dash-grid"><div className="dash-main">{careTeam.length>0&&<section className="care-team-section"><div className="care-team-head"><div><span>Η ΟΜΑΔΑ ΦΡΟΝΤΙΔΑΣ ΜΟΥ</span><h3>Οι άνθρωποι που εμπιστεύεσαι.</h3><p>Αγαπημένοι επαγγελματίες και γρήγορη επανάληψη φροντίδας χωρίς νέα αναζήτηση.</p></div></div><div className="care-team-grid">{careTeam.slice(0,6).map((p:any)=><article className="care-team-card" key={p.id}><div className="care-team-top"><div className="avatar">{initials(p.name)}</div><div><b>{p.name}</b><span>{p.title} · {p.city}</span></div>{p.trust?.eligible?<strong className="care-trust">{p.trust.score}</strong>:<strong className="care-trust new">NEW</strong>}</div><div className="care-team-meta"><span>★ {p.rating||'Νέο'}</span>{p.lastCompleted&&<span>Τελευταία επίσκεψη · {new Date(p.lastCompleted.date).toLocaleDateString('el-GR')}</span>}</div><div className="care-team-actions"><button className="btn btn-dark" onClick={()=>startBooking(p,p.lastCompleted?{service:p.lastCompleted.service,address:p.lastCompleted.address,repeat:'once'}:null)}>Ζήτησε ξανά επίσκεψη</button><button className="btn btn-outline" onClick={()=>openPro(p)}>Προφίλ</button></div></article>)}</div></section>}<h3>Οι κρατήσεις μου</h3>{bookings.length?bookings.map(b=><div className="patient-request-wrap" key={b.id}><div
  className={`booking-row booking-card-premium clickable booking-${b.status}`}
  onClick={()=>setOpen(open===b.id?'':b.id)}
>
  <div className="booking-accent"/>

  <div className="date-tile premium-date">
    <b>{b.date.slice(8,10)}</b>
    <span>{b.date.slice(5,7)}</span>
  </div>

  <div className="booking-info premium-booking-info">
    <b className="booking-service">{b.service}</b>

    <span className="booking-professional">
      {b.professionalName}
    </span>

    <div className="booking-meta">
      <span>◷ {b.time}</span>
      {b.address && <span>⌖ {b.address}</span>}
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
        : '—'}
    </b>

    <span className={'status premium-status '+b.status}>
      {statusLabel(b.status)}
    </span>

    <button
      className="small-action premium-details-btn"
      onClick={e=>{
        e.stopPropagation()
        setOpen(open===b.id?'':b.id)
      }}
    >
      {open===b.id ? 'Κλείσιμο' : 'Λεπτομέρειες'}

      <span className="details-arrow">
        {open===b.id ? '↑' : '›'}
      </span>
    </button>

  </div>
</div>{open===b.id&&<div className="patient-request-detail"><div className="request-detail-grid"><div><small>Επαγγελματίας</small><b>{b.professionalName}</b><span>{b.professionalEmail}</span><span>{b.professionalPhone}</span></div><div><small>Αίτημα</small><b>{b.service}</b><span>{b.date} · {b.time}</span><span>{repeatLabel(b.repeat)}</span></div></div>{b.notes&&<div className="request-description"><small>Περιγραφή ανάγκης</small><p>{b.notes}</p></div>}<Conversation messages={b.messages||[]}/><CalendarActions booking={b}/>{b.status==='quoted'&&<div className="quote-box"><span>Προτεινόμενο τελικό κόστος</span><strong>{b.proposedPrice}€</strong><small>Επιβεβαίωσε μόνο εφόσον έχεις συμφωνήσει με τον επαγγελματία.</small><div><button className="accept" onClick={()=>quoteDecision(b.id,'accept')}>Αποδοχή & επιβεβαίωση</button><button className="small-action" onClick={()=>quoteDecision(b.id,'reject')}>Δεν συμφωνώ</button></div></div>}{['pending','clarification','quoted'].includes(b.status)&&<div className="reply-box"><textarea placeholder="Απάντησε ή πρόσθεσε διευκρινίσεις…" value={reply} onChange={e=>setReply(e.target.value)}/><button className="btn btn-dark" onClick={()=>sendReply(b.id)}>Αποστολή απάντησης</button></div>}{['pending','clarification','quoted','accepted'].includes(b.status)&&<button className="text-btn danger" onClick={()=>cancel(b.id)}>Ακύρωση αιτήματος</button>}{b.status==='cancelled'&&<div className="smart-recovery"><div className="recovery-head"><span>MELEO SMART RECOVERY</span><h4>Η φροντίδα σου μπορεί να συνεχιστεί χωρίς νέα αναζήτηση.</h4><p>Δεν έχει σημασία που δεν προχώρησε η συνεργασία με τον συγκεκριμένο επαγγελματία. Η MELEO μπορεί να προτείνει έως 3 άλλους κατάλληλους επαγγελματίες για την ίδια υπηρεσία, με προτεραιότητα στην ίδια περιοχή.</p></div>{!recovery[b.id]&&<button className="btn btn-dark" disabled={recoveryBusy===b.id} onClick={()=>loadRecovery(b.id)}>{recoveryBusy===b.id?'Αναζήτηση…':'Βρες νέους επαγγελματίες'}</button>}{recovery[b.id]?.length===0&&<p className="muted">Δεν βρέθηκαν αυτή τη στιγμή άλλοι συμβατοί επαγγελματίες. Μπορείς να κάνεις νέα αναζήτηση.</p>}{recovery[b.id]?.map((p:any)=><div className="recovery-card" key={p.id}><div className="avatar">{initials(p.name)}</div><div><b>{p.name}</b><span>{p.title} · {p.city}</span><small>★ {p.rating||'Νέο'} · {priceLabel(p,true)}</small></div><button className="btn btn-outline" disabled={recoveryBusy===b.id} onClick={()=>recover(b.id,p.id)}>Αποστολή ίδιου αιτήματος</button></div>)}</div>}{b.status==='completed'&&<><div className="call-again-box"><div><span>ΓΝΩΡΙΜΗ ΦΡΟΝΤΙΔΑ</span><b>Χρειάζεσαι ξανά τον ίδιο επαγγελματία;</b><small>Η υπηρεσία και η διεύθυνση θα συμπληρωθούν αυτόματα. Εσύ επιλέγεις νέα ημερομηνία και ώρα.</small></div><button className="btn btn-dark" onClick={()=>bookAgain(b)}>Ζήτησε ξανά επίσκεψη</button></div><ReviewComposer booking={b} token={token} onDone={refresh} setToast={setToast}/></>}</div>}</div>):<Empty title="Δεν έχεις ακόμη κρατήσεις" text="Η επόμενη φροντίδα σου απέχει λίγα clicks."/>}</div><aside className="dash-side"><div className="identity-card"><div className="avatar large">{initials(user.name)}</div><h3>{user.name}</h3><p>{user.email}</p><p>{user.phone}</p><span>Λογαριασμός συνοδού / ασθενή</span></div><div className="safety-card"><b>Ασφάλεια πρώτα</b><p>Σε επείγουσα κατάσταση κάλεσε <b>{cfg?.emergencyNumber||'112'}</b>. Η MELEO δεν είναι υπηρεσία επειγόντων και δεν παρέχει ιατρικές συμβουλές.</p></div><button className="btn btn-outline wide" onClick={()=>setView('account')}>Ρυθμίσεις λογαριασμού</button></aside></div></div></section>
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
function SubscriptionPanel({professional,token,onRefresh,setToast,cfg}:any){
 const [info,setInfo]=useState<any>(null);const [busy,setBusy]=useState('');const [error,setError]=useState('')
 async function load(){try{setInfo(await api('/professional/subscription',{},token))}catch(e:any){setError(e.message)}}
 useEffect(()=>{load()},[])
 const current=professional?.subscriptionPlan||'basic'
 const plans:Plan[]=cfg?.plans?.length?cfg.plans:FALLBACK_CONFIG.plans
 async function act(kind:string,plan?:string){
   setError('');setBusy(kind+(plan||''))
   try{
     if(kind==='change'){
       const r=await api('/professional/subscription/checkout',{method:'POST',body:JSON.stringify({plan})},token)
       if(r.mode==='stripe'&&r.url){window.location.href=r.url;return}
       setToast(`Το πακέτο ενημερώθηκε σε ${String(plan).toUpperCase()}`)
     }
     if(kind==='portal'){const r=await api('/professional/subscription/portal',{method:'POST'},token);if(r.url){window.location.href=r.url;return}}
     if(kind==='cancel'){if(!window.confirm('Να ακυρωθεί η συνδρομή στο τέλος της τρέχουσας περιόδου; Το προφίλ σου θα σταματήσει να εμφανίζεται στις αναζητήσεις.'))return;await api('/professional/subscription/cancel',{method:'POST'},token);setToast('Η συνδρομή θα ακυρωθεί στο τέλος της περιόδου.')}
     if(kind==='resume'){await api('/professional/subscription/resume',{method:'POST'},token);setToast('Η συνδρομή συνεχίζεται κανονικά.')}
     await onRefresh();await load()
   }catch(e:any){setError(e.message)}finally{setBusy('')}
 }
 const statusLabelMap:any={active:'Ενεργή',past_due:'Εκκρεμεί πληρωμή',cancelled:'Ακυρωμένη',pending:'Σε εκκρεμότητα',none:'Χωρίς συνδρομή'}
 return <div className="panel subscription-panel">
   <div className="panel-heading"><div><h3>Η συνδρομή σου</h3><span>MELEO Professional membership</span></div><span className={'plan-pill '+current}>{current.toUpperCase()} · {money(professional?.subscriptionPrice||0)}/μήνα</span></div>
   <div className="sub-facts">
     <div><small>Κατάσταση</small><b>{statusLabelMap[professional?.subscriptionStatus]||professional?.subscriptionStatus||'—'}</b></div>
     <div><small>{professional?.cancelAtPeriodEnd?'Λήγει':'Επόμενη ανανέωση'}</small><b>{info?.currentPeriodEnd?new Date(info.currentPeriodEnd).toLocaleDateString('el-GR'):'—'}</b></div>
     <div><small>Τρόπος χρέωσης</small><b>{info?.billingMode==='stripe'?'Κάρτα / Google Pay':info?.billingMode==='demo'?'Demo (καμία χρέωση)':'—'}</b></div>
   </div>
   {error&&<div className="error">{error}</div>}
   <div className="subscription-choice">{plans.map(p=><div key={p.id} className={(p.id==='premium'?'premium ':'')+(current===p.id?'active':'')}>
     {p.recommended&&<span>ΠΡΟΤΕΙΝΟΜΕΝΟ</span>}
     <b>{p.name}</b><strong>{money(p.price)}<small>/μήνα</small></strong>
     <p>{p.features.slice(0,2).join(' · ')}</p>
     <button className={'btn wide '+(p.id==='premium'?'btn-gold':'btn-outline')} disabled={current===p.id||!!busy} onClick={()=>act('change',p.id)}>{current===p.id?'Ενεργό':busy==='change'+p.id?'…':(p.price>(professional?.subscriptionPrice||0)?'Αναβάθμιση':'Μετάβαση')+' σε '+p.name}</button>
   </div>)}</div>
   <div className="sub-actions">
     {info?.portalAvailable&&<button className="btn btn-outline" disabled={!!busy} onClick={()=>act('portal')}>{busy==='portal'?'…':'Κάρτα, τιμολόγια & ακύρωση'}</button>}
     {professional?.cancelAtPeriodEnd
       ? <button className="btn btn-dark" disabled={!!busy} onClick={()=>act('resume')}>Συνέχιση συνδρομής</button>
       : <button className="text-btn danger" disabled={!!busy} onClick={()=>act('cancel')}>Ακύρωση συνδρομής</button>}
   </div>
   {!!info?.invoices?.length&&<div className="invoice-list"><b>Ιστορικό χρεώσεων</b>{info.invoices.map((x:any)=><div key={x.id}><span>{new Date(x.createdAt).toLocaleDateString('el-GR')}</span><span>{money(x.amount)}</span><span className={'status '+(x.status==='paid'?'completed':'cancelled')}>{x.status==='paid'?'Πληρωμένο':'Απέτυχε'}</span>{x.hostedInvoiceUrl&&<a href={x.hostedInvoiceUrl} target="_blank" rel="noreferrer">Απόδειξη</a>}</div>)}</div>}
   <div className="notice">Η αλλαγή πακέτου χρεώνεται αναλογικά (proration). Η ακύρωση ισχύει στο τέλος της τρέχουσας περιόδου και δεν συνεπάγεται επιστροφή για τον χρόνο που έχει χρησιμοποιηθεί. Η MELEO <b>δεν</b> κρατά προμήθεια από τις επισκέψεις σου.</div>
 </div>
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
