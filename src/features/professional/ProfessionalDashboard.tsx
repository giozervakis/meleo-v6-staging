import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { serviceMap, specialtyOptions } from '../../domain/catalog'
import type { Booking, Plan } from '../../domain/types'
import { NotificationsPage, HelpCenter } from '../support/SupportPages'

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

function ProfessionalDashboard({user,professional,token,onRefresh,setToast,cfg,setView}:any){
 const [bookings,setBookings]=useState<Booking[]>([]);const [analytics,setAnalytics]=useState<any>(null);const [tab,setTab]=useState('overview');const [form,setForm]=useState<any>(professional||{});const [vr,setVr]=useState({licenseNumber:'',notes:''}); const [docs,setDocs]=useState<any[]>([]); const [uploadBusy,setUploadBusy]=useState(false)
 async function refresh(){const [bs,an]=await Promise.all([api('/bookings?limit=50',{},token),api('/professional/analytics',{},token).catch(()=>null)]);setBookings(Array.isArray(bs)?bs:(bs.items||[]));if(an)setAnalytics(an)} useEffect(()=>{refresh();const f=()=>refresh();window.addEventListener('meleo:live',f);return()=>window.removeEventListener('meleo:live',f)},[]);useEffect(()=>setForm(professional||{}),[professional])
 async function status(id:string,s:string,agreedPrice?:number){await api('/bookings/'+id+'/status',{method:'PATCH',body:JSON.stringify({status:s,agreedPrice})},token);refresh();setToast(s==='accepted'?'Η επίσκεψη επιβεβαιώθηκε':'Η κατάσταση ενημερώθηκε')}
 async function saveProfile(){const payload={...form,price:Number(form.price),years:Number(form.years),services:typeof form.services==='string'?form.services.split(',').map((x:string)=>x.trim()).filter(Boolean):form.services,availability:typeof form.availability==='string'?form.availability.split(',').map((x:string)=>x.trim()).filter(Boolean):form.availability};await api('/professional/profile',{method:'PUT',body:JSON.stringify(payload)},token);await onRefresh();setToast('Το προφίλ ενημερώθηκε')}
 async function uploadVerificationFile(file:File){try{setUploadBusy(true);const dataBase64=await fileToBase64(file);const d=await api('/professional/verification-document',{method:'POST',body:JSON.stringify({name:file.name,mime:file.type||'application/octet-stream',type:'professional_credential',dataBase64})},token);setDocs((x:any[])=>[...x,d]);setToast('Το δικαιολογητικό ανέβηκε κρυπτογραφημένο.')}catch(e:any){setToast(e.message)}finally{setUploadBusy(false)}}
 async function verifyReq(){try{await api('/professional/verification',{method:'POST',body:JSON.stringify(vr)},token);setToast('Το αίτημα επαλήθευσης καταχωρήθηκε')}catch(e:any){setToast(e.message)}}
 const income=bookings.filter(b=>b.status==='completed').reduce((a,b)=>a+Number(b.agreedPrice??b.price??0),0)
 const completion=(()=>{const f=[professional?.title,professional?.specialty,professional?.city,professional?.bio,(professional?.services||[]).length,(professional?.availability||[]).length,professional?.years,professional?.verified];return Math.round(f.filter(Boolean).length/f.length*100)})()
 if(!professional || !['active','past_due'].includes(professional.subscriptionStatus) || !professional.onboardingCompleted) return <ProfessionalOnboarding user={user} professional={professional} token={token} onRefresh={onRefresh} setToast={setToast} cfg={cfg}/>
 return <section className="dashboard-pro"><div className="pro-sidebar"><Mark/><div className="pro-user"><div className="avatar">{initials(user.name)}</div><div><b>{user.name}</b><small>{professional?.verified?'✓ Verified':'Αναμονή επαλήθευσης'}</small></div></div><nav>{[['overview','⌂','Επισκόπηση'],['requests','◇','Αιτήματα'],['profile','○','Προφίλ'],['availability','◷','Διαθεσιμότητα'],['subscription','◆','Συνδρομή'],['verification','✓','Επαλήθευση'],['notifications','🔔','Ειδοποιήσεις'],['support','?','Υποστήριξη']].map(x=><button key={x[0]} className={tab===x[0]?'active':''} onClick={()=>setTab(x[0])}><span>{x[1]}</span>{x[2]}{x[0]==='requests'&&bookings.filter(b=>['pending','clarification'].includes(b.status)).length>0&&<i>{bookings.filter(b=>['pending','clarification'].includes(b.status)).length}</i>}</button>)}</nav><button className="pro-personal-care-link" onClick={()=>setView('patient-dashboard')}>♡ <span>Οι προσωπικές μου κρατήσεις</span></button><small className="side-version">MELEO Professional v5.0</small></div><div className="pro-content"><VerifyEmailBanner user={user} token={token} cfg={cfg} setToast={setToast}/>{professional?.subscriptionStatus==='past_due'&&<div className="alert-banner">Η τελευταία χρέωση της συνδρομής απέτυχε. Ενημέρωσε τον τρόπο πληρωμής από τη «Συνδρομή», ώστε το προφίλ σου να μη απενεργοποιηθεί.</div>}{professional?.cancelAtPeriodEnd&&<div className="alert-banner soft">Η συνδρομή έχει προγραμματιστεί για ακύρωση{professional?.currentPeriodEnd?` στις ${new Date(professional.currentPeriodEnd).toLocaleDateString('el-GR')}`:''}.</div>}<div className="pro-top"><div><small>PROFESSIONAL SPACE</small><h2>{tab==='overview'?'Επισκόπηση':tab==='requests'?'Αιτήματα επισκέψεων':tab==='profile'?'Επαγγελματικό προφίλ':tab==='availability'?'Διαθεσιμότητα':tab==='subscription'?'Συνδρομή MELEO':tab==='notifications'?'Ειδοποιήσεις':tab==='support'?'Υποστήριξη':'Επαλήθευση στοιχείων'}</h2></div><div className="status-pill"><i/> {professional?.verified?'Verified':'Pending verification'}</div></div>{tab==='overview'&&<><div className="stat-grid"><Stat label="Νέα αιτήματα" value={bookings.filter(b=>b.status==='pending').length} note="χρειάζονται απάντηση"/><Stat label="Επιβεβαιωμένες" value={bookings.filter(b=>b.status==='accepted').length} note="προσεχείς επισκέψεις"/><Stat label="Έσοδά σου" value={money(income)} note="από ολοκληρωμένες επισκέψεις · η MELEO δεν κρατά προμήθεια"/><Stat label="Αξιολόγηση" value={professional?.rating||'—'} note={`${professional?.reviews||0} αξιολογήσεις`}/></div><ProfessionalPerformance analytics={analytics}/><div className="pro-panels"><div className="panel"><div className="panel-heading"><h3>Πρόσφατα αιτήματα</h3><button onClick={()=>setTab('requests')}>Προβολή όλων</button></div>{bookings.slice(0,4).map(b=><CompactBooking key={b.id} b={b} status={status} token={token} onRefresh={refresh} setToast={setToast}/>)||null}{!bookings.length&&<Empty title="Δεν υπάρχουν αιτήματα ακόμη" text="Μόλις κάποιος σε επιλέξει, θα εμφανιστεί εδώ."/>}</div><div className="panel"><div className="panel-heading"><h3>Το προφίλ σου</h3></div><div className="completion"><div className="completion-ring">{completion}%</div><div><b>{completion>=90?'Το προφίλ είναι πλήρες':professional?.verified?'Συμπλήρωσε τα υπόλοιπα στοιχεία':'Ολοκλήρωσε την επαλήθευση'}</b><p>Ένα πλήρες προφίλ βοηθά τον χρήστη να αποφασίσει με σιγουριά.</p></div></div><button className="btn btn-outline wide" onClick={()=>setTab('profile')}>Επεξεργασία προφίλ</button></div></div></>}{tab==='requests'&&<div className="panel large-panel">{bookings.length?bookings.map(b=><CompactBooking key={b.id} b={b} status={status} full token={token} onRefresh={refresh} setToast={setToast}/>):<Empty title="Δεν υπάρχουν αιτήματα" text="Τα νέα requests θα εμφανίζονται εδώ."/>}</div>}{tab==='profile'&&<div className="panel form-panel"><div className="form-grid"><label>Επαγγελματικός τίτλος<input value={form.title||''} onChange={e=>setForm({...form,title:e.target.value})}/></label><label>Ειδικότητα<select value={form.specialty||'Νοσηλευτική'} onChange={e=>setForm({...form,specialty:e.target.value})}>{specialtyOptions.map(x=><option key={x}>{x}</option>)}</select></label><ProfessionalLocationEditor form={form} setForm={setForm}/><label>Εμφάνιση κόστους<select value={form.pricingMode||'from'} onChange={e=>setForm({...form,pricingMode:e.target.value})}><option value="from">Ναι · Από βασικό κόστος επίσκεψης</option><option value="contact">Όχι · Κατόπιν επικοινωνίας</option></select></label>{form.pricingMode!=='contact'&&<label>Βασικό κόστος απλής επίσκεψης (€)<input type="number" min="0" value={form.price||''} onChange={e=>setForm({...form,price:e.target.value})}/></label>}<div className="full contact-privacy-card"><b>Δημόσια στοιχεία επικοινωνίας</b><p className="muted">Εσύ αποφασίζεις ποια προσωπικά στοιχεία εμφανίζονται στο δημόσιο προφίλ σου.</p><label className="consent-row"><input type="checkbox" checked={form.showPhone!==false} onChange={e=>setForm({...form,showPhone:e.target.checked})}/><span>Εμφάνιση τηλεφώνου / κουμπιού κλήσης</span></label><label className="consent-row"><input type="checkbox" checked={form.showEmail!==false} onChange={e=>setForm({...form,showEmail:e.target.checked})}/><span>Εμφάνιση email</span></label><label className="consent-row"><input type="checkbox" checked={Boolean(form.preferPlatformContact)} onChange={e=>setForm({...form,preferPlatformContact:e.target.checked})}/><span>Προτιμώ επικοινωνία μέσω MELEO</span></label></div><div className="full notice">Το ποσό εμφανίζεται ως <b>«Από Χ€»</b>. Το τελικό κόστος συμφωνείται τηλεφωνικά με τον πελάτη ανάλογα με τις πραγματικές ανάγκες της επίσκεψης.</div><label>Έτη εμπειρίας<input type="number" value={form.years||''} onChange={e=>setForm({...form,years:e.target.value})}/></label><label className="full">Σύντομο βιογραφικό<textarea value={form.bio||''} onChange={e=>setForm({...form,bio:e.target.value})}/></label><label className="full">Υπηρεσίες που παρέχεις (χωρισμένες με κόμμα)<input value={Array.isArray(form.services)?form.services.join(', '):form.services||''} onChange={e=>setForm({...form,services:e.target.value})}/></label></div><button className="btn btn-dark" onClick={saveProfile}>Αποθήκευση προφίλ</button></div>}{tab==='availability'&&<div className="panel form-panel"><h3>Διαθέσιμες ώρες</h3><p className="muted">Για το MVP αποθηκεύουμε τις ώρες ως λίστα. Στην production έκδοση αυτό εξελίσσεται σε εβδομαδιαίο calendar.</p><label>Ώρες, χωρισμένες με κόμμα<input value={Array.isArray(form.availability)?form.availability.join(', '):form.availability||''} onChange={e=>setForm({...form,availability:e.target.value})}/></label><div className="time-grid">{(Array.isArray(form.availability)?form.availability:[]).map((t:string)=><span key={t}>{t}</span>)}</div><button className="btn btn-dark" onClick={saveProfile}>Αποθήκευση</button></div>}{tab==='subscription'&&<SubscriptionPanel professional={professional} token={token} onRefresh={onRefresh} setToast={setToast} cfg={cfg}/>}{tab==='notifications'&&<NotificationsPage user={user} token={token} setToast={setToast} embedded/>}{tab==='support'&&<HelpCenter user={user} token={token} setToast={setToast} cfg={cfg} embedded/>}{tab==='verification'&&<div className="verification-layout"><div className="panel form-panel"><div className="verify-hero"><span>✓</span><div><h3>Professional Verification</h3><p>Η επαλήθευση είναι ξεχωριστή από οποιοδήποτε εμπορικό πακέτο.</p></div></div><label>Αριθμός άδειας / μητρώου<input value={vr.licenseNumber} onChange={e=>setVr({...vr,licenseNumber:e.target.value})}/></label><label>Δικαιολογητικό επαλήθευσης<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={uploadBusy} onChange={e=>{const f=e.target.files?.[0];if(f)uploadVerificationFile(f)}}/><small className="field-hint">PDF/JPG/PNG/WEBP έως 5MB.</small></label>{docs.length>0&&<div className="uploaded-docs">{docs.map((d:any)=><span key={d.id}>✓ {d.name}</span>)}</div>}<label>Σημειώσεις<textarea value={vr.notes} onChange={e=>setVr({...vr,notes:e.target.value})}/></label><button className="btn btn-dark" onClick={verifyReq}>Υποβολή για έλεγχο</button></div><div className="panel"><h3>Τι ελέγχεται</h3><ul className="clean-list"><li>Ταυτότητα επαγγελματία</li><li>Επαγγελματική ιδιότητα</li><li>Απαιτούμενα νόμιμα δικαιολογητικά</li><li>Στοιχεία επικοινωνίας</li></ul><div className="notice">Τα δικαιολογητικά αποθηκεύονται κρυπτογραφημένα και είναι διαθέσιμα μόνο στη ροή επαλήθευσης.</div></div></div>}</div></section>
}
function ProfessionalPerformance({analytics}:any){
 const a=analytics||{impressions:0,profileViews:0,phoneClicks:0,requests:0,newClients:0,reviews:0,requestConversion:0,clientConversion:0}
 const items=[['👁','Εμφανίσεις',a.impressions,'Πόσες φορές εμφανίστηκε το προφίλ σου στα αποτελέσματα'],['👤','Επισκέψεις προφίλ',a.profileViews,'Χρήστες που άνοιξαν το επαγγελματικό σου προφίλ'],['📞','Πατήματα τηλεφώνου',a.phoneClicks,'Άμεσο ενδιαφέρον για επικοινωνία'],['💬','Αιτήματα',a.requests,'Αιτήματα επίσκεψης που έλαβες'],['✅','Νέοι πελάτες',a.newClients,'Μοναδικοί πελάτες με ολοκληρωμένη επίσκεψη'],['⭐','Νέες αξιολογήσεις',a.reviews,'Αξιολογήσεις από verified bookings']]
 return <section className="performance-panel"><div className="performance-head"><div><span className="performance-kicker">MELEO PERFORMANCE</span><h3>Η απόδοση του προφίλ σου</h3><p>Δες αν η παρουσία σου στη MELEO μετατρέπεται σε πραγματικό ενδιαφέρον και νέους πελάτες.</p></div><div className="performance-conversion"><b>{a.requestConversion||0}%</b><span>profile → request</span></div></div><div className="performance-grid">{items.map(([icon,label,value,note]:any)=><div className="performance-card" key={label}><span className="performance-icon">{icon}</span><div><strong>{Number(value||0).toLocaleString('el-GR')}</strong><b>{label}</b><small>{note}</small></div></div>)}</div><div className="performance-foot"><span>Conversion σε νέο πελάτη: <b>{a.clientConversion||0}%</b></span><small>Τα στοιχεία ενημερώνονται αυτόματα από πραγματικές ενέργειες χρηστών και ολοκληρωμένες κρατήσεις.</small></div></section>
}
function ProfessionalOnboarding({user,professional,token,onRefresh,setToast,cfg}:any){
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
     if(r.mode==='stripe'&&r.url){window.location.href=r.url;return}          // ανακατεύθυνση στο ασφαλές Checkout
     sessionStorage.removeItem('meleo_selected_plan')
     await onRefresh();setStep(3)
     setToast(r.mode==='demo'?`Η συνδρομή ${plan.toUpperCase()} ενεργοποιήθηκε (demo — καμία χρέωση)`:`Το πακέτο άλλαξε σε ${plan.toUpperCase()}`)
   }catch(e:any){setError(e.message)}finally{setBusy(false)}
 }
 async function saveProfessional(){setError('');if(!pf.title||!pf.specialty||!pf.city){setError('Συμπλήρωσε τίτλο, ειδικότητα και βάση εξυπηρέτησης.');return}setBusy(true);try{const payload={...pf,years:Number(pf.years||0),price:Number(pf.price||0),serviceRadiusKm:Number(pf.serviceRadiusKm||15),services:Array.isArray(pf.services)?pf.services:[],availability:Array.isArray(pf.availability)?pf.availability:[]};await api('/professional/profile',{method:'PUT',body:JSON.stringify(payload)},token);await onRefresh();setStep(4);setToast('Τα επαγγελματικά στοιχεία αποθηκεύτηκαν')}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 async function uploadVerificationFile(file:File){setError('');setUploadBusy(true);try{if(file.size>5*1024*1024)throw new Error('Το αρχείο πρέπει να είναι έως 5MB');const dataBase64=await fileToBase64(file);const d=await api('/professional/verification-document',{method:'POST',body:JSON.stringify({name:file.name,mime:file.type||'application/octet-stream',type:'professional_credential',dataBase64})},token);setDocs((x:any[])=>[...x,d]);setToast('Το δικαιολογητικό ανέβηκε κρυπτογραφημένο.')}catch(e:any){setError(e.message)}finally{setUploadBusy(false)}}
 async function submitVerification(){setError('');if(!vr.licenseNumber.trim()){setError('Συμπλήρωσε αριθμό άδειας / μητρώου.');return}setBusy(true);try{await api('/professional/verification',{method:'POST',body:JSON.stringify(vr)},token);await onRefresh();setToast('Η αίτηση επαλήθευσης υποβλήθηκε. Το προφίλ σου είναι σε αναμονή ελέγχου.')}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 function toggleService(service:string){setPf((x:any)=>({...x,services:(x.services||[]).includes(service)?x.services.filter((v:string)=>v!==service):[...(x.services||[]),service]}))}
 return <section className="onboarding-page"><div className="onboarding-shell"><div className="onboarding-brand"><Mark/><span>PROFESSIONAL ONBOARDING</span></div><div className="onboarding-progress">{[['1','Πακέτο'],['2','Checkout'],['3','Προφίλ'],['4','Verification']].map(([n,l],i)=><div className={(step>=i+1?'active ':'')+(step===i+1?'current':'')} key={n}><i>{n}</i><span>{l}</span></div>)}</div>
 {step===1&&<div className="onboarding-card"><div className="onboarding-heading"><span>ΒΗΜΑ 1 ΑΠΟ 4</span><h1>Επίλεξε τη συνδρομή σου</h1><p>Ο επαγγελματικός λογαριασμός ενεργοποιείται μόνο με BASIC ή PREMIUM. Δεν δημιουργούμε αυτόματα συνδρομή κατά την εγγραφή.</p></div><div className="onboarding-plans"><button className={plan==='basic'?'selected':''} onClick={()=>setPlan('basic')}><span>BASIC</span><strong>9,99€<small>/μήνα</small></strong><p>Δημόσιο προφίλ, αιτήματα, κρατήσεις και βασικά στατιστικά.</p><b>{plan==='basic'?'✓ Επιλεγμένο':'Επιλογή BASIC'}</b></button><button className={'premium '+(plan==='premium'?'selected':'')} onClick={()=>setPlan('premium')}><em>ΠΡΟΤΕΙΝΟΜΕΝΟ</em><span>PREMIUM</span><strong>14,99€<small>/μήνα</small></strong><p>Προτεραιότητα στα αποτελέσματα, σήμανση «Προτεινόμενος» και advanced analytics.</p><b>{plan==='premium'?'✓ Επιλεγμένο':'Επιλογή PREMIUM'}</b></button></div><button className="btn btn-dark onboarding-next" onClick={()=>setStep(2)}>Συνέχεια στο checkout →</button></div>}
 {step===2&&<div className="onboarding-card checkout-card"><button className="back" onClick={()=>setStep(1)}>← Αλλαγή πακέτου</button><div className="onboarding-heading"><span>ΒΗΜΑ 2 ΑΠΟ 4</span><h1>Ενεργοποίηση {plan.toUpperCase()}</h1><p>Μηνιαία συνδρομή <b>{money(price)}</b>, με αυτόματη ανανέωση. Μπορείς να ακυρώσεις οποτεδήποτε — η ακύρωση ισχύει στο τέλος της τρέχουσας περιόδου.</p></div><div className="checkout-layout"><div className="checkout-form">
   <div className="pay-methods"><span className="pay-chip">💳 Κάρτα</span><span className="pay-chip">Google&nbsp;Pay</span><span className="pay-chip">Apple&nbsp;Pay</span></div>
   <ul className="checkout-facts"><li>✓ Η πληρωμή ολοκληρώνεται στο ασφαλές περιβάλλον του παρόχου πληρωμών (Stripe).</li><li>✓ Η MELEO δεν βλέπει και δεν αποθηκεύει στοιχεία κάρτας.</li><li>✓ Απόδειξη/τιμολόγιο αποστέλλεται στο email σου σε κάθε χρέωση.</li><li>✓ Η συνδρομή δεν αγοράζει επαλήθευση: το MELEO Verified κρίνεται ξεχωριστά.</li></ul>
   {!cfg?.paymentsEnabled&&cfg?.demoCheckout&&<div className="notice">Τοπική δοκιμαστική λειτουργία: δεν θα γίνει πραγματική χρέωση.</div>}
   {!cfg?.paymentsEnabled&&!cfg?.demoCheckout&&<div className="error">Οι πληρωμές δεν είναι ενεργοποιημένες σε αυτό το περιβάλλον.</div>}
   {error&&<div className="error">{error}</div>}
   <button className="btn btn-gold wide" disabled={busy} onClick={checkout}>{busy?'Μεταφορά στο ασφαλές checkout…':`Πληρωμή ${money(price)} / μήνα`}</button>
   <small className="terms">Με την ολοκλήρωση αποδέχεσαι τους Όρους Χρήσης. Δικαίωμα υπαναχώρησης: η υπηρεσία ενεργοποιείται άμεσα κατόπιν ρητής συναίνεσής σου.</small>
 </div><aside className="checkout-summary"><span>MELEO PROFESSIONAL</span><h3>{plan.toUpperCase()}</h3><div><b>{money(price)}</b><small>/ μήνα</small></div><p>Μετά την πληρωμή συνεχίζεις στην ολοκλήρωση του προφίλ και στο verification.</p></aside></div></div>}
 {step===3&&<div className="onboarding-card"><div className="onboarding-heading"><span>ΒΗΜΑ 3 ΑΠΟ 4</span><h1>Δημιούργησε το επαγγελματικό σου προφίλ</h1><p>Αυτά τα στοιχεία χρησιμοποιούνται για το matching και θα εμφανιστούν δημόσια μόνο μετά την έγκριση του verification.</p></div><div className="form-grid"><label>Επαγγελματικός τίτλος<input value={pf.title||''} onChange={e=>setPf({...pf,title:e.target.value})} placeholder="π.χ. Φυσικοθεραπευτής"/></label><label>Ειδικότητα<select value={pf.specialty||''} onChange={e=>setPf({...pf,specialty:e.target.value,services:[]})}><option value="">Επίλεξε ειδικότητα</option>{specialtyOptions.map(x=><option key={x}>{x}</option>)}</select></label><ProfessionalLocationEditor form={pf} setForm={setPf}/><label>Έτη εμπειρίας<input type="number" min="0" value={pf.years||''} onChange={e=>setPf({...pf,years:e.target.value})}/></label><label>Εμφάνιση βασικού κόστους<select value={pf.pricingMode||'contact'} onChange={e=>setPf({...pf,pricingMode:e.target.value})}><option value="contact">Κατόπιν επικοινωνίας</option><option value="from">Ναι · Από Χ€</option></select></label>{pf.pricingMode==='from'&&<label>Βασικό κόστος επίσκεψης (€)<input type="number" min="0" value={pf.price||''} onChange={e=>setPf({...pf,price:e.target.value})}/></label>}<label className="full">Σύντομο βιογραφικό<textarea value={pf.bio||''} onChange={e=>setPf({...pf,bio:e.target.value})}/></label>{pf.specialty&&<div className="full onboarding-services"><b>Υπηρεσίες που παρέχεις</b><div>{(serviceMap[pf.specialty]||[]).map(x=><button type="button" key={x} className={(pf.services||[]).includes(x)?'selected':''} onClick={()=>toggleService(x)}>{(pf.services||[]).includes(x)?'✓ ':''}{x}</button>)}</div></div>}</div>{error&&<div className="error">{error}</div>}<button className="btn btn-dark onboarding-next" disabled={busy} onClick={saveProfessional}>{busy?'Αποθήκευση…':'Αποθήκευση & συνέχεια →'}</button></div>}
 {step===4&&<div className="onboarding-card"><div className="onboarding-heading"><span>ΒΗΜΑ 4 ΑΠΟ 4</span><h1>Professional Verification</h1><p>Το MELEO Verified είναι ανεξάρτητο από το πακέτο συνδρομής. Η πληρωμή δεν αγοράζει επαλήθευση ή έγκριση.</p></div><div className="verification-layout"><div className="checkout-form"><label>Αριθμός άδειας / επαγγελματικού μητρώου<input value={vr.licenseNumber} onChange={e=>setVr({...vr,licenseNumber:e.target.value})}/></label><label>Δικαιολογητικά επαλήθευσης<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={uploadBusy} onChange={e=>{const f=e.target.files?.[0];if(f)uploadVerificationFile(f)}}/><small className="field-hint">PDF/JPG/PNG/WEBP έως 5MB · αποθηκεύεται κρυπτογραφημένο.</small></label>{docs.length>0&&<div className="uploaded-docs">{docs.map((d:any)=><span key={d.id}>✓ {d.name}</span>)}</div>}<label>Σημειώσεις προς την ομάδα ελέγχου<textarea value={vr.notes} onChange={e=>setVr({...vr,notes:e.target.value})} placeholder="Προαιρετικές πληροφορίες…"/></label>{error&&<div className="error">{error}</div>}<button className="btn btn-gold wide" disabled={busy} onClick={submitVerification}>{busy?'Υποβολή…':'Υποβολή για έλεγχο'}</button></div><aside className="checkout-summary"><span>ΜΕΤΑ ΤΗΝ ΥΠΟΒΟΛΗ</span><h3>Pending Verification</h3><p>Ο Admin βλέπει πλέον το αίτημά σου ως Pending. Μόνο μετά την έγκριση ενεργοποιείται η δημόσια εμφάνιση του προφίλ.</p></aside></div></div>}
 <div className="onboarding-foot">Σειρά ενεργοποίησης: <b>Λογαριασμός → Πακέτο → Checkout → Προφίλ → Verification → Admin approval → Public profile.</b></div></div></section>
}
function ProfessionalLocationEditor({form,setForm}:any){const [busy,setBusy]=useState(false);const [msg,setMsg]=useState('');async function resolveTyped(){if(!form.city)return;setBusy(true);setMsg('');try{const r=await api('/location/search?q='+encodeURIComponent(form.city));if(!r[0])throw new Error('Δεν βρέθηκε η τοποθεσία');const x=r[0];setForm({...form,city:x.city||form.city,region:x.region||'',countryCode:x.countryCode||'',latitude:x.lat,longitude:x.lon});setMsg('Η βάση τοποθεσίας αποθηκεύτηκε στον χάρτη.')}catch(e:any){setMsg(e.message)}finally{setBusy(false)}}function gps(){if(!navigator.geolocation){setMsg('Η συσκευή δεν υποστηρίζει GPS.');return}setBusy(true);navigator.geolocation.getCurrentPosition(async pos=>{try{const x=await api(`/location/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);setForm({...form,city:x.city||form.city,region:x.region||'',countryCode:x.countryCode||'',latitude:pos.coords.latitude,longitude:pos.coords.longitude});setMsg('Χρησιμοποιήθηκε η τρέχουσα τοποθεσία ως βάση εξυπηρέτησης.')}catch(e:any){setMsg(e.message)}finally{setBusy(false)}},()=>{setMsg('Δεν δόθηκε πρόσβαση στην τοποθεσία.');setBusy(false)},{enableHighAccuracy:true,timeout:10000})}return <><label>Πόλη / βάση εξυπηρέτησης<div className="pro-location-entry"><input value={form.city||''} onChange={e=>setForm({...form,city:e.target.value,latitude:null,longitude:null})} placeholder="π.χ. Ηράκλειο, Athens, Berlin"/><button type="button" onClick={resolveTyped} disabled={busy||!form.city}>Εύρεση</button></div></label><label>Ακτίνα εξυπηρέτησης (km)<input type="number" min="1" max="300" value={form.serviceRadiusKm||15} onChange={e=>setForm({...form,serviceRadiusKm:Number(e.target.value)})}/></label><div className="full location-professional-box"><button type="button" className="btn btn-outline" onClick={gps} disabled={busy}>⌖ Χρήση τοποθεσίας μου ως βάση</button><div><b>{form.latitude&&form.longitude?'✓ Βάση τοποθεσίας ενεργή':'Ορισμός γεωγραφικής βάσης'}</b><small>{form.city||'Δεν έχει οριστεί πόλη'}{form.region?' · '+form.region:''}{form.countryCode?' · '+String(form.countryCode).toUpperCase():''} · ακτίνα {form.serviceRadiusKm||15} km</small>{msg&&<small className="location-msg">{msg}</small>}</div></div></>}
function CompactBooking({b,status,full=false,token,onRefresh,setToast}:any){
 const [expanded,setExpanded]=useState(false);const [question,setQuestion]=useState('');const [quote,setQuote]=useState(String(b.proposedPrice||b.agreedPrice||b.price||''));const [msg,setMsg]=useState('');const [chat,setChat]=useState(''); async function sendChat(){if(!chat.trim())return;await api('/bookings/'+b.id+'/message',{method:'POST',body:JSON.stringify({text:chat})},token);setChat('');await onRefresh()}
 async function clarify(){if(!question.trim())return;await api('/bookings/'+b.id+'/clarification',{method:'POST',body:JSON.stringify({question})},token);setQuestion('');setExpanded(true);await onRefresh();setToast('Το αίτημα επέστρεψε στον χρήστη για διευκρινίσεις')}
 async function sendQuote(){const value=Number(quote);if(!value||value<=0)return setMsg('Συμπλήρωσε το τελικό κόστος.');await api('/bookings/'+b.id+'/quote',{method:'POST',body:JSON.stringify({amount:value,message:msg})},token);setMsg('');await onRefresh();setToast('Η πρόταση κόστους στάλθηκε στον χρήστη')}
 return <div className={'request-card-pro '+(expanded?'expanded ':'')+(full?'full':'')}><div className="request-row" onClick={()=>setExpanded(!expanded)}><div className="request-icon">⌂</div><div><b>{b.patientName}</b><span>{b.service}</span><small>{b.date} · {b.time} · {b.address}</small></div><div className="request-price">{b.agreedPrice?`${b.agreedPrice}€`:b.proposedPrice?`${b.proposedPrice}€`:b.price?`Από ${b.price}€`:'Κατόπιν συνεννόησης'}</div><span className={'status '+b.status}>{statusLabel(b.status)}</span><button className="small-action" onClick={e=>{e.stopPropagation();setExpanded(!expanded)}}>{expanded?'Κλείσιμο':'Άνοιγμα αιτήματος'}</button></div>{expanded&&<div className="pro-request-detail"><div className="request-contact-strip"><div><small>ΣΤΟΙΧΕΙΑ ΕΠΙΚΟΙΝΩΝΙΑΣ</small><b>{b.patientName}</b></div><a href={`mailto:${b.patientEmail}`}>✉ {b.patientEmail}</a>{b.patientPhone&&<a href={`tel:${b.patientPhone}`}>☎ {b.patientPhone}</a>}</div><div className="request-detail-grid three"><div><small>Υπηρεσία</small><b>{b.service}</b><span>{repeatLabel(b.repeat)}</span></div><div><small>Επίσκεψη</small><b>{b.date} · {b.time}</b><span>{b.address}</span></div><div><small>Ενδεικτική τιμή</small><b>{b.price?`Από ${b.price}€`:'Κατόπιν επικοινωνίας'}</b><span>Το τελικό κόστος καθορίζεται μετά την αξιολόγηση.</span></div></div><div className="request-description important"><small>ΑΝΑΛΥΣΗ ΑΙΤΗΜΑΤΟΣ</small><p>{b.notes||'Ο χρήστης δεν έχει προσθέσει επιπλέον περιγραφή. Επικοινώνησε μαζί του πριν οριστικοποιήσεις κόστος ή επίσκεψη.'}</p></div><Conversation messages={b.messages||[]}/><CalendarActions booking={b}/>{b.status!=='cancelled'&&<div className="reply-box realtime-chat-box"><textarea placeholder="Μήνυμα προς τον συνοδό…" value={chat} onChange={e=>setChat(e.target.value)}/><button className="btn btn-dark" onClick={sendChat}>Αποστολή μηνύματος</button><small>Live chat · ενημερώνεται σε πραγματικό χρόνο</small></div>}{['pending','clarification'].includes(b.status)&&<div className="professional-decision-grid"><div className="decision-panel"><h4>Χρειάζεσαι περισσότερες πληροφορίες;</h4><textarea placeholder="π.χ. Θα ήθελα να γνωρίζω αν υπάρχει ιατρική οδηγία, πόσες ημέρες απαιτείται η φροντίδα…" value={question} onChange={e=>setQuestion(e.target.value)}/><button className="btn btn-outline wide" onClick={clarify}>↩ Ζήτησε διευκρινίσεις</button></div><div className="decision-panel highlight"><h4>Καθόρισε τελικό κόστος</h4><label>Τελικό ποσό που προτείνεις (€)<input type="number" min="1" value={quote} onChange={e=>setQuote(e.target.value)}/></label><textarea placeholder="Προαιρετικό μήνυμα για το τι περιλαμβάνει η τιμή…" value={msg} onChange={e=>setMsg(e.target.value)}/><button className="btn btn-dark wide" onClick={sendQuote}>Αποστολή πρότασης κόστους</button></div></div>}{b.status==='quoted'&&<div className="quote-waiting"><b>Αναμονή απάντησης χρήστη</b><span>Έχεις προτείνει τελικό κόστος {b.proposedPrice}€.</span></div>}{b.status==='accepted'&&<div className="accepted-actions"><div><b>✓ Επιβεβαιωμένη επίσκεψη</b><span>Συμφωνημένο κόστος: {b.agreedPrice||b.proposedPrice||b.price}€</span></div><button className="small-action" onClick={()=>status(b.id,'completed')}>Ολοκλήρωση επίσκεψης</button></div>}{['pending','clarification'].includes(b.status)&&<div className="reject-line"><button className="text-btn danger" onClick={()=>status(b.id,'cancelled')}>Απόρριψη αιτήματος</button></div>}</div>}</div>
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

export default ProfessionalDashboard
