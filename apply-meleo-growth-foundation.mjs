import fs from 'node:fs'
import path from 'node:path'

const root=process.cwd()
const results=[]
let failed=false
function read(rel){return fs.readFileSync(path.join(root,rel),'utf8')}
function write(rel,s){fs.writeFileSync(path.join(root,rel),s)}
function replaceOnce(rel,label,find,repl,{critical=true}={}){
  let s=read(rel)
  let needle=find, replacement=repl
  if(!s.includes(needle)&&find.includes('\n')){const crlf=find.replace(/\n/g,'\r\n');if(s.includes(crlf)){needle=crlf;replacement=repl.replace(/\n/g,'\r\n')}}
  if(s.includes(replacement)){results.push(['SKIP',label,'already applied']);return}
  const i=s.indexOf(needle)
  if(i<0){results.push(['FAIL',label,`pattern not found in ${rel}`]);if(critical)failed=true;return}
  s=s.slice(0,i)+replacement+s.slice(i+needle.length);write(rel,s);results.push(['OK',label,''])
}
function insertBefore(rel,label,anchor,block,{critical=true}={}){
  let s=read(rel)
  if(s.includes(block.trim())){results.push(['SKIP',label,'already applied']);return}
  const i=s.indexOf(anchor)
  if(i<0){results.push(['FAIL',label,`anchor not found in ${rel}`]);if(critical)failed=true;return}
  s=s.slice(0,i)+block+'\n'+s.slice(i);write(rel,s);results.push(['OK',label,''])
}
function appendOnce(rel,label,marker,block){
  let s=read(rel)
  if(s.includes(marker)){results.push(['SKIP',label,'already applied']);return}
  write(rel,s+'\n'+block+'\n');results.push(['OK',label,''])
}

/* ========================= BACKEND: TRUST SCORE ========================= */
const trustHelper=`
async function meleoTrustForProfessional(professionalId){
  const p=await one(\`SELECT id,verified,rating,reviews_count "reviewsCount" FROM professionals WHERE id=$1\`,[professionalId])
  if(!p)return null
  const stats=await one(\`
    SELECT
      count(*)::int total,
      count(*) FILTER (WHERE status='completed')::int completed,
      count(*) FILTER (WHERE status='cancelled')::int cancelled,
      count(*) FILTER (WHERE status<>'pending')::int progressed,
      count(*) FILTER (WHERE status='completed' AND created_at>=now()-interval '90 days')::int recent_completed
    FROM bookings WHERE professional_id=$1
  \`,[professionalId])
  const total=Number(stats?.total||0),completed=Number(stats?.completed||0),cancelled=Number(stats?.cancelled||0)
  const reviews=Number(p.reviewsCount||0),rating=Number(p.rating||0)
  const closed=completed+cancelled
  const completionRate=closed?Math.round((completed/closed)*100):100
  const responseRate=total?Math.round((Number(stats?.progressed||0)/total)*100):100
  const cancellationReliability=closed?Math.round((completed/closed)*100):100
  const eligible=completed>=5&&reviews>=3
  if(!eligible)return {eligible:false,label:'MELEO Verified · Νέος επαγγελματίας',completed,reviews,minCompleted:5,minReviews:3}
  const verificationPoints=p.verified?20:0
  const reviewPoints=Math.round(Math.max(0,Math.min(25,(rating/5)*25)))
  const completionPoints=Math.round(Math.max(0,Math.min(20,(completionRate/100)*20)))
  const responsePoints=Math.round(Math.max(0,Math.min(15,(responseRate/100)*15)))
  const reliabilityPoints=Math.round(Math.max(0,Math.min(10,(cancellationReliability/100)*10)))
  const recent=Number(stats?.recent_completed||0)
  const activityPoints=recent>=8?10:recent>=5?8:recent>=2?6:4
  const score=Math.max(0,Math.min(100,verificationPoints+reviewPoints+completionPoints+responsePoints+reliabilityPoints+activityPoints))
  const label=score>=90?'Εξαιρετική αξιοπιστία':score>=80?'Πολύ υψηλή αξιοπιστία':score>=70?'Υψηλή αξιοπιστία':score>=60?'Καλή αξιοπιστία':'Αναπτυσσόμενη αξιοπιστία'
  return {eligible:true,score,label,completed,reviews,rating:Number(rating.toFixed(1)),completionRate,responseRate,breakdown:{verification:verificationPoints,reviews:reviewPoints,completion:completionPoints,response:responsePoints,reliability:reliabilityPoints,activity:activityPoints}}
}
`
insertBefore('server/relational/app.js','Add MELEO Trust engine',"app.get('/api/professionals',",trustHelper)

replaceOnce('server/relational/app.js','Expose Trust Score on professional profile',
"app.get('/api/professionals/:id',limits.profile,async(req,res)=>{const p=await Professionals.byId(req.params.id);if(!p||!p.verified||p.adminSuspended||!allowsVisibility(p))return res.status(404).json({error:'Ο επαγγελματίας δεν είναι διαθέσιμος.'});res.json({professional:p})})",
"app.get('/api/professionals/:id',limits.profile,async(req,res)=>{const p=await Professionals.byId(req.params.id);if(!p||!p.verified||p.adminSuspended||!allowsVisibility(p))return res.status(404).json({error:'Ο επαγγελματίας δεν είναι διαθέσιμος.'});const trust=await meleoTrustForProfessional(p.id);res.json({professional:{...p,trust}})})"
)

/* ========================= BACKEND: CARE TEAM ========================= */
const careTeamRoute=`
app.get('/api/care-team',auth,async(req,res)=>{
  if(!['patient','professional'].includes(req.user.role))return res.status(403).json({error:'Δεν επιτρέπεται.'})
  const favs=await many('SELECT professional_id "professionalId" FROM favorites WHERE user_id=$1 ORDER BY created_at DESC',[req.user.id])
  const items=[]
  for(const f of favs){
    const p=await Professionals.byId(f.professionalId)
    if(!p||!p.verified||p.adminSuspended||!allowsVisibility(p))continue
    const last=await one(\`SELECT id,service,date,time,address,status,agreed_price "agreedPrice" FROM bookings WHERE patient_id=$1 AND professional_id=$2 AND status='completed' ORDER BY date DESC,time DESC,created_at DESC LIMIT 1\`,[req.user.id,p.id])
    const trust=await meleoTrustForProfessional(p.id)
    items.push({...p,trust,lastCompleted:last||null})
  }
  res.json({items})
})
`
insertBefore('server/relational/app.js','Add Care Team endpoint',"app.post('/api/reports'",careTeamRoute)

/* ========================= FRONTEND: BOOKING SEED ========================= */
replaceOnce('src/App.tsx','Add repeat booking seed state',
"  const [resetToken,setResetToken]=useState('')",
"  const [resetToken,setResetToken]=useState('')\n  const [bookingSeed,setBookingSeed]=useState<any>(null)"
)

replaceOnce('src/App.tsx','Pass seeded booking to BookingFlow',
"{view==='booking'&&selected&&<BookingFlow p={selected} user={user} token={token} setView={setView} setToast={setToast}/>} ",
"{view==='booking'&&selected&&<BookingFlow p={selected} seed={bookingSeed} user={user} token={token} setView={setView} setToast={setToast}/>} "
)

replaceOnce('src/App.tsx','Wire Profile direct booking',
"{view==='profile'&&selected&&<Profile p={selected} user={user} favorite={favorites.includes(selected.id)} toggleFav={toggleFav} setView={setView}/>} ",
"{view==='profile'&&selected&&<Profile p={selected} user={user} favorite={favorites.includes(selected.id)} toggleFav={toggleFav} setView={setView} startBooking={()=>{setBookingSeed(null);setView('booking')}}/>} "
)

replaceOnce('src/App.tsx','Wire Patient Dashboard repeat booking',
"{view==='patient-dashboard'&&user&&<PatientDashboard user={user} token={token} openPro={openPro} cfg={cfg} setView={setView} setToast={setToast}/>}",
"{view==='patient-dashboard'&&user&&<PatientDashboard user={user} token={token} openPro={openPro} startBooking={(p:any,seed:any=null)=>{setSelected(p);setBookingSeed(seed);setView('booking')}} cfg={cfg} setView={setView} setToast={setToast}/>}"
)

/* Profile: trust + care-team semantics */
replaceOnce('src/App.tsx','Profile accepts direct booking',
"function Profile({p,user,favorite,toggleFav,setView}:any){",
"function Profile({p,user,favorite,toggleFav,setView,startBooking}:any){"
)
replaceOnce('src/App.tsx','Load Trust Score in Profile',
"  const [tab,setTab]=useState('about');const [reviews,setReviews]=useState<any[]>([])\n  useEffect(()=>{trackProfessionalEvent(p.id,'profile_view');api('/professionals/'+p.id+'/reviews?limit=50').then((d:any)=>setReviews(Array.isArray(d)?d:(d.items||[]))).catch(()=>setReviews([]))},[p.id])",
"  const [tab,setTab]=useState('about');const [reviews,setReviews]=useState<any[]>([]);const [trust,setTrust]=useState<any>(p?.trust||null)\n  useEffect(()=>{trackProfessionalEvent(p.id,'profile_view');api('/professionals/'+p.id+'/reviews?limit=50').then((d:any)=>setReviews(Array.isArray(d)?d:(d.items||[]))).catch(()=>setReviews([]));api('/professionals/'+p.id).then((d:any)=>setTrust((d.professional||d)?.trust||null)).catch(()=>{})},[p.id])"
)
replaceOnce('src/App.tsx','Rename favorite action as Care Team',
"<button className={'heart standalone '+(favorite?'on':'')} onClick={()=>toggleFav(p.id)}>♡</button>",
"<button className={'heart standalone '+(favorite?'on':'')} title={favorite?'Στην Ομάδα Φροντίδας μου':'Προσθήκη στην Ομάδα Φροντίδας μου'} aria-label={favorite?'Αφαίρεση από την Ομάδα Φροντίδας':'Προσθήκη στην Ομάδα Φροντίδας'} onClick={()=>toggleFav(p.id)}>{favorite?'♥':'♡'}</button>"
)
replaceOnce('src/App.tsx','Render Trust Score card',
"<div className=\"profile-trust-grid\"><span><b>✓</b> Επαληθευμένη ιδιότητα</span><span><b>⌖</b> Έως {p.serviceRadiusKm||15} km</span><span><b>⚡</b> {p.available}</span><span><b>◷</b> {p.responseTime||'Συνήθως γρήγορη απάντηση'}</span></div>",
"<div className=\"profile-trust-grid\"><span><b>✓</b> Επαληθευμένη ιδιότητα</span><span><b>⌖</b> Έως {p.serviceRadiusKm||15} km</span><span><b>⚡</b> {p.available}</span><span><b>◷</b> {p.responseTime||'Συνήθως γρήγορη απάντηση'}</span></div>{trust&&<div className={'meleo-trust-card '+(trust.eligible?'ready':'new')}><div className=\"trust-mark\">M</div><div className=\"trust-copy\"><small>MELEO TRUST</small>{trust.eligible?<><strong>{trust.score}<em>/100</em></strong><b>{trust.label}</b><span>Ανεξάρτητο από το πακέτο συνδρομής · βασίζεται σε επαλήθευση, αξιολογήσεις, ολοκληρώσεις και συνέπεια.</span></>:<><strong className=\"trust-new\">Verified</strong><b>Νέος επαγγελματίας</b><span>Το Trust Score ενεργοποιείται όταν υπάρχουν αρκετές πραγματικές ολοκληρωμένες συνεργασίες και αξιολογήσεις.</span></>}</div>{trust.eligible&&<div className=\"trust-mini\"><span>★ {trust.rating}</span><span>✓ {trust.completionRate}% ολοκλήρωση</span><span>↗ {trust.responseRate}% ανταπόκριση</span></div>}</div>}"
)
replaceOnce('src/App.tsx','Profile visit button uses booking seed reset',
"<button className=\"btn btn-dark wide\" onClick={()=>setView(user?'booking':'auth')}>{user?'Ζήτησε επίσκεψη':'Συνδέσου για αίτημα'}</button>",
"<button className=\"btn btn-dark wide\" onClick={()=>user?startBooking():setView('auth')}>{user?'Ζήτησε επίσκεψη':'Συνδέσου για αίτημα'}</button>"
)

/* BookingFlow seed */
replaceOnce('src/App.tsx','BookingFlow accepts repeat seed',
"function BookingFlow({p,user,token,setView,setToast}:any){",
"function BookingFlow({p,seed,user,token,setView,setToast}:any){"
)
replaceOnce('src/App.tsx','Prefill repeated booking',
"    service: availableServices[0],\n    date: new Date(Date.now()+86400000).toISOString().slice(0,10),\n    time: availableTimes[0] || '10:00',\n    address: '',\n    notes: '',\n    repeat: 'once'",
"    service: seed?.service&&availableServices.includes(seed.service)?seed.service:availableServices[0],\n    date: new Date(Date.now()+86400000).toISOString().slice(0,10),\n    time: availableTimes[0] || '10:00',\n    address: seed?.address||'',\n    notes: '',\n    repeat: seed?.repeat||'once'"
)

/* Patient Dashboard care team and repeat */
replaceOnce('src/App.tsx','PatientDashboard accepts repeat booking',
"function PatientDashboard({user,token,openPro,cfg,setView,setToast}:any){",
"function PatientDashboard({user,token,openPro,startBooking,cfg,setView,setToast}:any){"
)
replaceOnce('src/App.tsx','Add Care Team state and load',
" const [bookings,setBookings]=useState<Booking[]>([]);const [open,setOpen]=useState<string>('');const [reply,setReply]=useState('');const [recovery,setRecovery]=useState<Record<string,any[]>>({});const [recoveryBusy,setRecoveryBusy]=useState<string>('')\n async function refresh(){const scope=user?.role==='professional'?'&scope=requested':'';const d=await api('/bookings?limit=50'+scope,{},token);setBookings(Array.isArray(d)?d:(d.items||[]))}",
" const [bookings,setBookings]=useState<Booking[]>([]);const [careTeam,setCareTeam]=useState<any[]>([]);const [open,setOpen]=useState<string>('');const [reply,setReply]=useState('');const [recovery,setRecovery]=useState<Record<string,any[]>>({});const [recoveryBusy,setRecoveryBusy]=useState<string>('')\n async function refresh(){const scope=user?.role==='professional'?'&scope=requested':'';const [d,team]=await Promise.all([api('/bookings?limit=50'+scope,{},token),api('/care-team',{},token).catch(()=>({items:[]}))]);setBookings(Array.isArray(d)?d:(d.items||[]));setCareTeam(team.items||[])}"
)
insertBefore('src/App.tsx','Add repeat booking helper',
" return <section className=\"page dashboard-page\">",
` async function bookAgain(b:any){try{const d=await api('/professionals/'+b.professionalId);const p=d.professional||d;startBooking(p,{service:b.service,address:b.address,repeat:b.repeat||'once'});setToast('Έτοιμο — επίλεξε νέα ημερομηνία και ώρα.')}catch(e:any){setToast(e.message)}}
`)
replaceOnce('src/App.tsx','Render Care Team above bookings',
"<div className=\"dash-grid\"><div className=\"dash-main\"><h3>Οι κρατήσεις μου</h3>",
"<div className=\"dash-grid\"><div className=\"dash-main\">{careTeam.length>0&&<section className=\"care-team-section\"><div className=\"care-team-head\"><div><span>Η ΟΜΑΔΑ ΦΡΟΝΤΙΔΑΣ ΜΟΥ</span><h3>Οι άνθρωποι που εμπιστεύεσαι.</h3><p>Αγαπημένοι επαγγελματίες και γρήγορη επανάληψη φροντίδας χωρίς νέα αναζήτηση.</p></div></div><div className=\"care-team-grid\">{careTeam.slice(0,6).map((p:any)=><article className=\"care-team-card\" key={p.id}><div className=\"care-team-top\"><div className=\"avatar\">{initials(p.name)}</div><div><b>{p.name}</b><span>{p.title} · {p.city}</span></div>{p.trust?.eligible?<strong className=\"care-trust\">{p.trust.score}</strong>:<strong className=\"care-trust new\">NEW</strong>}</div><div className=\"care-team-meta\"><span>★ {p.rating||'Νέο'}</span>{p.lastCompleted&&<span>Τελευταία επίσκεψη · {new Date(p.lastCompleted.date).toLocaleDateString('el-GR')}</span>}</div><div className=\"care-team-actions\"><button className=\"btn btn-dark\" onClick={()=>startBooking(p,p.lastCompleted?{service:p.lastCompleted.service,address:p.lastCompleted.address,repeat:'once'}:null)}>Ζήτησε ξανά επίσκεψη</button><button className=\"btn btn-outline\" onClick={()=>openPro(p)}>Προφίλ</button></div></article>)}</div></section>}<h3>Οι κρατήσεις μου</h3>"
)
replaceOnce('src/App.tsx','Add Call Again after completed booking',
"{b.status==='completed'&&<ReviewComposer booking={b} token={token} onDone={refresh} setToast={setToast}/>}</div>}",
"{b.status==='completed'&&<><div className=\"call-again-box\"><div><span>ΓΝΩΡΙΜΗ ΦΡΟΝΤΙΔΑ</span><b>Χρειάζεσαι ξανά τον ίδιο επαγγελματία;</b><small>Η υπηρεσία και η διεύθυνση θα συμπληρωθούν αυτόματα. Εσύ επιλέγεις νέα ημερομηνία και ώρα.</small></div><button className=\"btn btn-dark\" onClick={()=>bookAgain(b)}>Ζήτησε ξανά επίσκεψη</button></div><ReviewComposer booking={b} token={token} onDone={refresh} setToast={setToast}/></>}</div>}"
)

/* CSS */
appendOnce('src/styles.css','Add Trust/Care Team premium styling','MELEO GROWTH FOUNDATION — TRUST + CARE TEAM',`
/* =========================================================
   MELEO GROWTH FOUNDATION — TRUST + CARE TEAM
   ========================================================= */
.meleo-trust-card{margin:18px 0 22px;display:grid;grid-template-columns:auto 1fr auto;gap:18px;align-items:center;padding:20px 22px;border:1px solid rgba(151,116,53,.18);border-radius:24px;background:linear-gradient(135deg,#fffdf8 0%,#f5efe2 100%);box-shadow:0 16px 38px rgba(61,50,32,.07)}
.trust-mark{width:52px;height:52px;border-radius:17px;display:grid;place-items:center;background:#173749;color:#d7b36a;font-family:serif;font-size:26px;font-weight:800;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)}
.trust-copy{display:flex;flex-direction:column;gap:3px}.trust-copy small{font-size:10px;font-weight:900;letter-spacing:.18em;color:#a17b37}.trust-copy strong{font-size:30px;line-height:1;color:#173749}.trust-copy strong em{font-size:13px;font-style:normal;color:#7f8987;margin-left:3px}.trust-copy b{font-size:14px;color:#334b55}.trust-copy span{font-size:12px;line-height:1.45;color:#7b817e;max-width:640px}.trust-copy .trust-new{font-size:22px}.trust-mini{display:flex;flex-direction:column;align-items:flex-end;gap:5px;font-size:12px;color:#50645f;font-weight:700}
.care-team-section{margin:0 0 30px;padding:25px;border:1px solid rgba(151,116,53,.12);border-radius:28px;background:linear-gradient(145deg,rgba(255,253,248,.98),rgba(244,237,223,.92));box-shadow:0 18px 42px rgba(58,51,39,.06)}
.care-team-head span,.call-again-box>div>span{display:block;font-size:10px;letter-spacing:.16em;font-weight:900;color:#a17b37}.care-team-head h3{margin:5px 0 3px;color:#173749;font-size:24px}.care-team-head p{margin:0 0 18px;color:#7c817c}
.care-team-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.care-team-card{padding:17px;border:1px solid rgba(23,55,73,.08);border-radius:20px;background:rgba(255,255,255,.83);box-shadow:0 10px 24px rgba(43,46,39,.05)}
.care-team-top{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center}.care-team-top>div:nth-child(2){display:flex;flex-direction:column;min-width:0}.care-team-top b{color:#173749}.care-team-top span{font-size:12px;color:#808984;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.care-trust{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:#173749;color:#d9b772;font-size:13px}.care-trust.new{font-size:9px}
.care-team-meta{display:flex;gap:12px;flex-wrap:wrap;margin:12px 0;font-size:12px;color:#6f7874}.care-team-actions{display:flex;gap:8px}.care-team-actions .btn{flex:1;min-height:40px;padding:8px 10px;font-size:12px}
.call-again-box{display:flex;justify-content:space-between;align-items:center;gap:18px;margin:18px 0;padding:18px 20px;border:1px solid rgba(151,116,53,.16);border-radius:20px;background:linear-gradient(135deg,#fffdf9,#f4ecdc)}.call-again-box>div{display:flex;flex-direction:column;gap:4px}.call-again-box b{color:#173749;font-size:16px}.call-again-box small{color:#7e837e;line-height:1.4}
@media(max-width:700px){.meleo-trust-card{grid-template-columns:auto 1fr;padding:17px;gap:13px}.trust-mini{grid-column:1/-1;flex-direction:row;align-items:center;justify-content:flex-start;flex-wrap:wrap;padding-top:8px;border-top:1px solid rgba(23,55,73,.08)}.care-team-section{padding:18px 14px;border-radius:24px;margin-left:-2px;margin-right:-2px}.care-team-grid{grid-template-columns:1fr}.care-team-card{border-radius:19px}.care-team-actions{flex-direction:column}.call-again-box{align-items:stretch;flex-direction:column}.call-again-box .btn{width:100%}}
`)

for(const [status,label,msg] of results)console.log(`${status.padEnd(5)} ${label}${msg?`: ${msg}`:''}`)
if(failed){console.error('\nOne or more critical edits could not be applied. Review above; do not commit.');process.exit(1)}
console.log('\nMELEO Trust + Care Team + Call Again patch applied successfully.')
