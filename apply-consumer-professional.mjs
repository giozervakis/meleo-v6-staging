import fs from 'node:fs'
import path from 'node:path'

const root=process.cwd()
const report=[]
let failed=false

function file(rel){return path.join(root,rel)}
function read(rel){return fs.readFileSync(file(rel),'utf8')}
function write(rel,s){fs.writeFileSync(file(rel),s)}
function replace(rel,oldText,newText,label,{optional=false}={}){
  let s=read(rel)
  if(s.includes(newText)){report.push(`SKIP ${label} (already applied)`);return}
  if(!s.includes(oldText)){
    if(optional){report.push(`SKIP ${label} (not present in this version)`);return}
    console.error(`FAIL ${label}: pattern not found in ${rel}`);failed=true;return
  }
  s=s.replace(oldText,newText);write(rel,s);report.push(`OK   ${label}`)
}
function insertAfter(rel,needle,addition,label){
  let s=read(rel)
  if(s.includes(addition.trim())){report.push(`SKIP ${label} (already applied)`);return}
  if(!s.includes(needle)){console.error(`FAIL ${label}: anchor not found in ${rel}`);failed=true;return}
  s=s.replace(needle,needle+addition);write(rel,s);report.push(`OK   ${label}`)
}
function replaceBetween(rel,startMarker,endMarker,newBlock,label){
  let s=read(rel)
  if(s.includes('Ένας λογαριασμός.<br/><em>Δύο τρόποι χρήσης.</em>')){report.push(`SKIP ${label} (already applied)`);return}
  const a=s.indexOf(startMarker),b=s.indexOf(endMarker,a)
  if(a<0||b<0){console.error(`FAIL ${label}: boundaries not found in ${rel}`);failed=true;return}
  s=s.slice(0,a)+newBlock+s.slice(b);write(rel,s);report.push(`OK   ${label}`)
}

// 1) Repository/data semantics
replace('server/relational/repositories.js',
  "const allowed={name:'name',phone:'phone',email_verified:'email_verified'",
  "const allowed={role:'role',name:'name',phone:'phone',email_verified:'email_verified'",
  'Allow controlled user role promotion')

replace('server/relational/repositories.js',
  "async listForUser(user,q={}){const {page,limit,offset}=pagination(q,{defaultLimit:20,maxLimit:100});let where,params;if(user.role==='patient'){where='b.patient_id=$1';params=[user.id]}else if(user.role==='professional'){const p=await Professionals.byUser(user.id);where='b.professional_id=$1';params=[p?.id||'__none__']}else{where='true';params=[]}",
  "async listForUser(user,q={}){const {page,limit,offset}=pagination(q,{defaultLimit:20,maxLimit:100});let where,params;if(user.role==='patient'){where='b.patient_id=$1';params=[user.id]}else if(user.role==='professional'){const p=await Professionals.byUser(user.id);if(String(q.scope||'')==='requested'){where='b.patient_id=$1';params=[user.id]}else if(String(q.scope||'')==='all'){where='(b.patient_id=$1 OR b.professional_id=$2)';params=[user.id,p?.id||'__none__']}else{where='b.professional_id=$1';params=[p?.id||'__none__']}}else{where='true';params=[]}",
  'Separate professional incoming vs personal bookings')

replace('server/relational/repositories.js',
  "async addMessage(booking,sender,text,kind='message'){const mid=id('msg');await sql(`INSERT INTO booking_messages(id,booking_id,sender_user_id,sender_role,sender_name,body_encrypted,kind) VALUES($1,$2,$3,$4,$5,$6,$7)`,[mid,booking.id,sender.id,sender.role,sender.name,encryptSensitive(text),kind]);return this.byId(booking.id)}",
  "async addMessage(booking,sender,text,kind='message'){const mid=id('msg');const bookingRole=sender.id===booking.patientId?'patient':sender.role;await sql(`INSERT INTO booking_messages(id,booking_id,sender_user_id,sender_role,sender_name,body_encrypted,kind) VALUES($1,$2,$3,$4,$5,$6,$7)`,[mid,booking.id,sender.id,bookingRole,sender.name,encryptSensitive(text),kind]);return this.byId(booking.id)}",
  'Preserve requester/provider semantics in booking chat')

// 2) Authorization semantics
replace('server/relational/authorization.js',
`export function canViewBooking(user, booking, professional){
  if(!user||!booking)return false
  if(user.role==='admin')return true
  if(user.role==='patient')return booking.patientId===user.id
  if(user.role==='professional')return professional?.userId===user.id
  return false
}`,
`export function canViewBooking(user, booking, professional){
  if(!user||!booking)return false
  if(user.role==='admin')return true
  if(booking.patientId===user.id&&['patient','professional'].includes(user.role))return true
  if(user.role==='professional'&&professional?.userId===user.id)return true
  return false
}`,
  'Professional can view bookings requested as consumer')
replace('server/relational/authorization.js',
  "export function canReviewBooking(user, booking){ return user?.role==='patient'&&booking?.patientId===user.id&&booking?.status==='completed' }",
  "export function canReviewBooking(user, booking){ return ['patient','professional'].includes(user?.role)&&booking?.patientId===user.id&&booking?.status==='completed' }",
  'Professional requester can review completed booking')

// 3) API capability middleware + upgrade flow
insertAfter('server/relational/app.js',
  "const requireRole=role=>(req,res,next)=>req.user.role===role?next():res.status(403).json({error:role==='admin'?'Admin only':'Δεν επιτρέπεται για αυτόν τον τύπο λογαριασμού'})",
  "\nconst requireConsumer=(req,res,next)=>['patient','professional'].includes(req.user.role)?next():res.status(403).json({error:'Η συγκεκριμένη ενέργεια είναι διαθέσιμη σε χρήστες και επαγγελματίες.'})",
  'Consumer capability middleware')

replace('server/relational/app.js',
  "if(await Users.byEmail(email))return res.status(409).json({error:'Υπάρχει ήδη λογαριασμός με αυτό το email.'});",
  "const existing=await Users.byEmail(email);if(existing){const roleLabel=existing.role==='professional'?'Επαγγελματίας':existing.role==='patient'?'Συνοδός / Ασθενής':'Διαχειριστής';const wantsProfessional=role==='professional';return res.status(409).json({error:wantsProfessional&&existing.role==='patient'?`Υπάρχει ήδη λογαριασμός MELEO με αυτό το email ως ${roleLabel}. Συνδέσου στον υπάρχοντα λογαριασμό σου και επίλεξε «Γίνε επαγγελματίας». Δεν χρειάζεται δεύτερος λογαριασμός.`:`Είσαι ήδη εγγεγραμμένος στη MELEO ως ${roleLabel} με αυτό το email. Συνδέσου στον υπάρχοντα λογαριασμό σου.`,code:'ACCOUNT_EXISTS',existingRole:existing.role})};",
  'Role-aware duplicate email registration')

replace('server/relational/app.js',
  "app.get('/api/me',auth,async(req,res)=>{const u=await Users.byId(req.user.id);res.json({user:publicUser(u),professional:u.role==='professional'?await Professionals.byUser(u.id):null})})",
  "app.get('/api/me',auth,async(req,res)=>{const u=await Users.byId(req.user.id);res.json({user:publicUser(u),professional:await Professionals.byUser(u.id)})})\napp.post('/api/me/enable-professional',auth,requireVerifiedEmail,limits.write,async(req,res)=>{const u=await Users.byId(req.user.id);if(u.role==='admin')return res.status(403).json({error:'Ο λογαριασμός διαχειριστή δεν μπορεί να ενεργοποιηθεί ως επαγγελματικός.'});let p=await Professionals.byUser(u.id);if(!p)p=await Professionals.createForUser(u.id);if(u.role!=='professional')await Users.update(u.id,{role:'professional'});await Professionals.update(p.id,{onboardingStage:p.onboardingStage||'plan',onboardingCompleted:false});await audit(u.id,'professional.enable',{source:'existing_consumer_account'});const updated=await Users.byId(u.id);res.json({ok:true,user:publicUser(updated),professional:await Professionals.byUser(u.id),next:'professional_onboarding'})})",
  'Enable professional capability on existing account')

for(const [oldv,newv,label,opt] of [
  ["app.post('/api/bookings',auth,requireRole('patient'),","app.post('/api/bookings',auth,requireConsumer,",'Professional can request service',false],
  ["app.post('/api/bookings/:id/quote-decision',auth,requireRole('patient'),","app.post('/api/bookings/:id/quote-decision',auth,requireConsumer,",'Professional requester quote decision',false],
  ["app.post('/api/bookings/:id/review',auth,requireRole('patient'),","app.post('/api/bookings/:id/review',auth,requireConsumer,",'Professional requester review',false],
  ["app.post('/api/favorites/:professionalId',auth,requireRole('patient'),","app.post('/api/favorites/:professionalId',auth,requireConsumer,",'Professional favorites',false],
  ["app.get('/api/bookings/:id/recovery-candidates',auth,requireRole('patient'),","app.get('/api/bookings/:id/recovery-candidates',auth,requireConsumer,",'Professional Smart Recovery candidates',true],
  ["app.post('/api/bookings/:id/recover',auth,requireRole('patient'),","app.post('/api/bookings/:id/recover',auth,requireConsumer,",'Professional Smart Recovery resend',true]
]) replace('server/relational/app.js',oldv,newv,label,{optional:opt})

replace('server/relational/app.js',
  "const p=await Professionals.byId(pid);if(!p||!p.verified||!allowsVisibility(p))return res.status(404).json({error:'Ο επαγγελματίας δεν είναι διαθέσιμος.'});const bid=id('bkg');",
  "const p=await Professionals.byId(pid);if(!p||!p.verified||!allowsVisibility(p))return res.status(404).json({error:'Ο επαγγελματίας δεν είναι διαθέσιμος.'});if(p.userId===req.user.id)return res.status(400).json({error:'Δεν μπορείς να δημιουργήσεις αίτημα προς το δικό σου επαγγελματικό προφίλ.'});const bid=id('bkg');",
  'Block self-booking')

// Safer status transitions for dual-capability professionals.
const statusOld="app.patch('/api/bookings/:id/status',auth,limits.write,async(req,res)=>{const b=await Bookings.byId(req.params.id);if(!b)return res.status(404).json({error:'Not found'});const p=await Professionals.byId(b.professionalId);if(!canEditBooking(req.user,b,p))return res.status(403).json({error:'Δεν επιτρέπεται.'});const status=str(req.body.status,30);if(!['pending','clarification','quoted','accepted','completed','cancelled'].includes(status))return res.status(400).json({error:'Invalid status'});const updated=await Bookings.update(b.id,{status});await Notifications.create(req.user.role==='professional'?b.patientId:p.userId,'booking',`Ενημέρωση κράτησης: ${status}`,b.service);res.json({booking:updated})})"
const statusNew="app.patch('/api/bookings/:id/status',auth,limits.write,async(req,res)=>{const b=await Bookings.byId(req.params.id);if(!b)return res.status(404).json({error:'Not found'});const p=await Professionals.byId(b.professionalId);if(!canEditBooking(req.user,b,p))return res.status(403).json({error:'Δεν επιτρέπεται.'});const status=str(req.body.status,30);if(!['pending','clarification','quoted','accepted','completed','cancelled'].includes(status))return res.status(400).json({error:'Invalid status'});const isRequester=b.patientId===req.user.id;const isProvider=req.user.role==='professional'&&p?.userId===req.user.id;if(isRequester&&status!=='cancelled')return res.status(403).json({error:'Ως αιτών μπορείς να ακυρώσεις το αίτημα, όχι να αλλάξεις την επαγγελματική κατάστασή του.'});if(isProvider&&!['accepted','completed','cancelled'].includes(status))return res.status(403).json({error:'Μη επιτρεπτή αλλαγή κατάστασης.'});const updated=await Bookings.update(b.id,{status});await Notifications.create(isProvider?b.patientId:p.userId,'booking',`Ενημέρωση κράτησης: ${status}`,b.service);res.json({booking:updated})})"
replace('server/relational/app.js',statusOld,statusNew,'Safe booking status transitions')

// 4) Frontend consumer capability
replace('src/App.tsx',
  "if(d.user.role==='patient')setFavorites(await api('/favorites',{},t))",
  "if(['patient','professional'].includes(d.user.role))setFavorites(await api('/favorites',{},t))",
  'Load favorites for professional consumer')
replace('src/App.tsx',
  "if(user.role!=='patient')return;const r=await api('/favorites/'+id",
  "if(!['patient','professional'].includes(user.role))return;const r=await api('/favorites/'+id",
  'Toggle favorites as professional')
replace('src/App.tsx',
  "if(user?.role!=='patient'){",
  "if(!['patient','professional'].includes(user?.role)){",
  'Allow professional in BookingFlow')
replace('src/App.tsx',
  "async function refresh(){const d=await api('/bookings?limit=50',{},token);setBookings(Array.isArray(d)?d:(d.items||[]))}",
  "async function refresh(){const scope=user?.role==='professional'?'&scope=requested':'';const d=await api('/bookings?limit=50'+scope,{},token);setBookings(Array.isArray(d)?d:(d.items||[]))}",
  'Patient dashboard loads professional personal bookings')
replace('src/App.tsx',
  "<BecomeProfessional onLogged={logged} user={user} setView={setView} cfg={cfg}/>",
  "<BecomeProfessional onLogged={logged} user={user} token={token} onRefresh={()=>refreshMe()} setView={setView} setToast={setToast} cfg={cfg}/>",
  'Wire existing-account professional activation')
replace('src/App.tsx',
  "if(user.role!=='professional'){setToast('Τα πακέτα αφορούν επαγγελματικούς λογαριασμούς.');return}",
  "if(user.role==='patient'){sessionStorage.setItem('meleo_selected_plan',plan);setView('become-pro');return}if(user.role!=='professional'){setToast('Τα πακέτα αφορούν επαγγελματικούς λογαριασμούς.');return}",
  'Pricing sends existing patient through upgrade flow')
replace('src/App.tsx',
  "<button onClick={()=>go(accountView)}>⌂ <span>{accountLabel}</span></button><button onClick={()=>go('notifications')}",
  "<button onClick={()=>go(accountView)}>⌂ <span>{accountLabel}</span></button>{user.role==='professional'&&<button onClick={()=>go('patient-dashboard')}>♡ <span>Οι προσωπικές μου κρατήσεις</span></button>}<button onClick={()=>go('notifications')}",
  'Professional account menu personal bookings')

const become=`function BecomeProfessional({onLogged,user,token,onRefresh,setView,setToast,cfg}:any){
 const [busy,setBusy]=useState(false)
 async function enableExisting(){setBusy(true);try{await api('/me/enable-professional',{method:'POST'},token);await onRefresh();setToast('Η επαγγελματική λειτουργία ενεργοποιήθηκε. Επίλεξε πακέτο για να συνεχίσεις.');setView('pro-dashboard')}catch(e:any){setToast(e.message)}finally{setBusy(false)}}
 if(user?.role==='professional')return <section className="page"><div className="container narrow"><div className="success-card"><div className="success-icon">✓</div><h1>Ο λογαριασμός σου έχει επαγγελματική λειτουργία.</h1><p>Μπορείς παράλληλα να αναζητάς και να ζητάς υπηρεσίες από άλλους επαγγελματίες με τον ίδιο λογαριασμό.</p><button className="btn btn-dark" onClick={()=>setView('pro-dashboard')}>Άνοιγμα Professional Dashboard</button><button className="btn btn-outline" onClick={()=>setView('patient-dashboard')}>Οι προσωπικές μου κρατήσεις</button></div></div></section>
 if(user?.role==='patient')return <section className="join-page"><div className="container join-grid"><div><div className="eyebrow light">MELEO PROFESSIONAL</div><h1>Ένας λογαριασμός.<br/><em>Δύο τρόποι χρήσης.</em></h1><p>Ο υπάρχων λογαριασμός σου παραμένει ενεργός για προσωπικές κρατήσεις. Προσθέτουμε επαγγελματική λειτουργία χωρίς δεύτερο email ή δεύτερο λογαριασμό.</p><div className="join-benefits"><div>01 <span><b>Δεν χάνεις τις προσωπικές σου κρατήσεις</b><small>Συνεχίζεις να αναζητάς, να κλείνεις και να αξιολογείς άλλους επαγγελματίες.</small></span></div><div>02 <span><b>Υποχρεωτική ενεργή συνδρομή</b><small>Επιλέγεις BASIC ή PREMIUM και ολοκληρώνεις την πληρωμή πριν το επαγγελματικό προφίλ και το verification.</small></span></div><div>03 <span><b>Ξεχωριστό Professional Space</b><small>Αιτήματα πελατών, διαθεσιμότητα, συνδρομή, verification και analytics παραμένουν διακριτά.</small></span></div></div></div><div className="join-form"><h2>Ενεργοποίηση επαγγελματικής λειτουργίας</h2><p>Μετά την ενεργοποίηση θα οδηγηθείς υποχρεωτικά στη ροή <b>Πακέτο → Checkout → Προφίλ → Verification</b>.</p><button className="btn btn-gold wide" disabled={busy} onClick={enableExisting}>{busy?'Ενεργοποίηση…':'Συνέχεια στην επιλογή συνδρομής'}</button><small className="terms">Δεν δημιουργείται δεύτερος λογαριασμός. Το ίδιο email και user ID χρησιμοποιούνται για προσωπική και επαγγελματική χρήση.</small></div></div></section>
 return <section className="join-page"><div className="container join-grid"><div><div className="eyebrow light">MELEO PROFESSIONAL</div><h1>Χτίσε την παρουσία σου.<br/><em>Με τους δικούς σου όρους.</em></h1><p>Επίλεξε BASIC ή PREMIUM, όρισε πότε και πού θέλεις να εργάζεσαι και διαχειρίσου αιτήματα από ένα premium επαγγελματικό dashboard.</p><div className="join-benefits"><div>01 <span><b>Εσύ ορίζεις τις υπηρεσίες σου</b><small>Επιλέγεις αν θα εμφανίζεται βασικό κόστος «Από Χ€» και ορίζεις την περιοχή εξυπηρέτησης.</small></span></div><div>02 <span><b>Verified, όχι pay-to-trust</b><small>Η επαλήθευση δεν αγοράζεται.</small></span></div><div>03 <span><b>Δύο καθαρά πακέτα</b><small>BASIC 9,99€/μήνα ή PREMIUM 14,99€/μήνα με προτεινόμενη προβολή.</small></span></div></div></div><div className="join-form"><h2>Ξεκίνα σε 2 λεπτά</h2><p>Αν έχεις ήδη λογαριασμό MELEO, συνδέσου πρώτα — δεν χρειάζεται δεύτερη εγγραφή.</p><InlineRegister onLogged={onLogged} setView={setView}/></div></div></section>
}
`
replaceBetween('src/App.tsx','function BecomeProfessional(','function InlineRegister',become,'Existing patient → professional onboarding UX')

// Professional dashboard shortcut
replace('src/features/professional/ProfessionalDashboard.tsx',
  '</nav><small className="side-version">MELEO Professional v5.0</small>',
  '</nav><button className="pro-personal-care-link" onClick={()=>setView(\'patient-dashboard\')}>♡ <span>Οι προσωπικές μου κρατήσεις</span></button><small className="side-version">MELEO Professional v5.0</small>',
  'Professional dashboard personal-use shortcut')

const css='\n/* Professional account can also use MELEO as a consumer */\n.pro-personal-care-link{margin:10px 14px 4px;padding:11px 12px;border:1px solid rgba(255,255,255,.18);border-radius:12px;background:rgba(255,255,255,.07);color:inherit;display:flex;gap:8px;align-items:center;cursor:pointer}.pro-personal-care-link:hover{background:rgba(255,255,255,.12)}\n'
let cssText=read('src/styles.css');if(!cssText.includes('.pro-personal-care-link{')){write('src/styles.css',cssText+css);report.push('OK   Professional personal-use shortcut styling')}else report.push('SKIP Professional personal-use shortcut styling (already applied)')

for(const x of report)console.log(x)
if(failed){console.error('\nOne or more critical edits could not be applied. Review above; do not commit.');process.exit(1)}
console.log('\nMELEO consumer/professional capability patch applied successfully.')
