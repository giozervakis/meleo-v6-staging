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
    if(optional){report.push(`SKIP ${label} (pattern not present in this version)`);return}
    console.error(`FAIL ${label}: pattern not found in ${rel}`);failed=true;return
  }
  s=s.replace(oldText,newText);write(rel,s);report.push(`OK   ${label}`)
}
function replaceRegex(rel,re,newText,label){
  let s=read(rel)
  if(s.includes(newText)){report.push(`SKIP ${label} (already applied)`);return}
  if(!re.test(s)){console.error(`FAIL ${label}: pattern not found in ${rel}`);failed=true;return}
  s=s.replace(re,newText);write(rel,s);report.push(`OK   ${label}`)
}

// 1) Header: only call it "Professional Dashboard" after full approval.
replace('src/App.tsx',
  '<Header user={user} view={view} setView={setView} logout={logout}/>',
  '<Header user={user} professional={professional} view={view} setView={setView} logout={logout}/>',
  'Pass professional lifecycle to Header')

replace('src/App.tsx',
  "function Header({user,view,setView,logout}:{user:User|null;view:string;setView:(v:string)=>void;logout:()=>void}){",
  "function Header({user,professional,view,setView,logout}:{user:User|null;professional:Professional|null;view:string;setView:(v:string)=>void;logout:()=>void}){",
  'Header accepts professional lifecycle')

replaceRegex('src/App.tsx',
  /\s*const accountView=user\?\.role==='admin'\?'admin':user\?\.role==='professional'\?'pro-dashboard':'patient-dashboard'\s*const accountLabel=user\?\.role==='admin'\?'Admin Control Center':user\?\.role==='professional'\?'Professional Dashboard':'Οι κρατήσεις μου'/,
  "\n  const professionalReady=user?.role==='professional'&&professional?.verified===true&&['active','past_due'].includes(professional?.subscriptionStatus||'')&&professional?.onboardingStage==='approved'\n  const accountView=user?.role==='admin'?'admin':user?.role==='professional'?'pro-dashboard':'patient-dashboard'\n  const accountLabel=user?.role==='admin'?'Admin Control Center':user?.role==='professional'?(professionalReady?'Professional Dashboard':'Ολοκλήρωση επαγγελματικής εγγραφής'):'Οι κρατήσεις μου'",
  'Gate Professional Dashboard label until approval')

// 2) BecomeProfessional receives the actual professional lifecycle and does not show dashboard prematurely.
replace('src/App.tsx',
  '<BecomeProfessional onLogged={logged} user={user} token={token} onRefresh={()=>refreshMe()} setView={setView} setToast={setToast} cfg={cfg}/>',
  '<BecomeProfessional onLogged={logged} user={user} professional={professional} token={token} onRefresh={()=>refreshMe()} setView={setView} setToast={setToast} cfg={cfg}/>',
  'Pass professional lifecycle to upgrade screen')

replace('src/App.tsx',
  'function BecomeProfessional({onLogged,user,token,onRefresh,setView,setToast,cfg}:any){',
  'function BecomeProfessional({onLogged,user,professional,token,onRefresh,setView,setToast,cfg}:any){',
  'Upgrade screen accepts professional lifecycle')

const oldProBranch=" if(user?.role==='professional')return <section className=\"page\"><div className=\"container narrow\"><div className=\"success-card\"><div className=\"success-icon\">✓</div><h1>Ο λογαριασμός σου έχει επαγγελματική λειτουργία.</h1><p>Μπορείς παράλληλα να αναζητάς και να ζητάς υπηρεσίες από άλλους επαγγελματίες με τον ίδιο λογαριασμό.</p><button className=\"btn btn-dark\" onClick={()=>setView('pro-dashboard')}>Άνοιγμα Professional Dashboard</button><button className=\"btn btn-outline\" onClick={()=>setView('patient-dashboard')}>Οι προσωπικές μου κρατήσεις</button></div></div></section>"
const newProBranch=" if(user?.role==='professional'){const ready=professional?.verified===true&&['active','past_due'].includes(professional?.subscriptionStatus||'')&&professional?.onboardingStage==='approved';return <section className=\"page\"><div className=\"container narrow\"><div className=\"success-card\"><div className=\"success-icon\">{ready?'✓':'…'}</div><h1>{ready?'Ο επαγγελματικός σου λογαριασμός είναι ενεργός.':'Η επαγγελματική εγγραφή σου είναι σε εξέλιξη.'}</h1><p>{ready?'Μπορείς να διαχειρίζεσαι το επαγγελματικό σου προφίλ και παράλληλα να ζητάς υπηρεσίες από άλλους επαγγελματίες.':'Ο λογαριασμός σου παραμένει διαθέσιμος για προσωπική χρήση. Για να ενεργοποιηθεί το Professional Dashboard πρέπει να ολοκληρωθούν συνδρομή, πληρωμή, στοιχεία προφίλ και επαλήθευση από τη MELEO.'}</p><button className=\"btn btn-dark\" onClick={()=>setView('pro-dashboard')}>{ready?'Άνοιγμα Professional Dashboard':'Συνέχεια επαγγελματικής εγγραφής'}</button><button className=\"btn btn-outline\" onClick={()=>setView('patient-dashboard')}>Οι προσωπικές μου κρατήσεις</button></div></div></section>}"
replace('src/App.tsx',oldProBranch,newProBranch,'Do not expose Professional Dashboard before approval')

// 3) Admin rejection reason becomes mandatory.
replaceRegex('src/features/admin/AdminPage.tsx',
  /async function decide\(id:string,status:string\)\{const note=window\.prompt\(status==='approved'\?'Σημείωση έγκρισης \(προαιρετικά\)'\:'Αιτιολογία απόρριψης \(προαιρετικά\)'\)\|\|'';await api\('\/admin\/verifications\/'\+id,\{method:'PATCH',body:JSON\.stringify\(\{status,adminNote:note\}\)\},token\);await refresh\(\);setToast\(status==='approved'\?'Ο επαγγελματίας επαληθεύτηκε':'Το αίτημα απορρίφθηκε'\)\}/,
  "async function decide(id:string,status:string){const approved=status==='approved';const raw=window.prompt(approved?'Σημείωση έγκρισης (προαιρετικά)':'Λόγος απόρριψης (υποχρεωτικός) — π.χ. μη επιβεβαιωμένη πληρωμή, ελλιπή/μη έγκυρα έγγραφα, αδυναμία επαλήθευσης επαγγελματικής ιδιότητας') ;if(raw===null)return;const note=raw.trim();if(!approved&&!note){setToast('Συμπλήρωσε υποχρεωτικά τον λόγο απόρριψης.');return}await api('/admin/verifications/'+id,{method:'PATCH',body:JSON.stringify({status,adminNote:note})},token);await refresh();setToast(approved?'Ο επαγγελματίας επαληθεύτηκε και ενημερώθηκε.':'Το αίτημα απορρίφθηκε και ο χρήστης ενημερώθηκε.')}",
  'Require rejection reason in Admin verification')

// 4) Verification decision endpoint: payment guard + in-app notification + transactional email.
const oldRoute="app.patch('/api/admin/verifications/:id',async(req,res)=>{const v=await one('SELECT * FROM verification_requests WHERE id=$1',[req.params.id]);if(!v)return res.status(404).json({error:'Not found'});const status=req.body.status==='approved'?'approved':'rejected',note=str(req.body.note||req.body.adminNote,1000);await tx(async c=>{await c.query(`UPDATE verification_requests SET status=$1,admin_note=$2,reviewed_by=$3,reviewed_at=now() WHERE id=$4`,[status,note,req.user.id,v.id]);await c.query(`UPDATE professionals SET verified=$1,onboarding_stage=$2,onboarding_completed=$1,updated_at=now() WHERE id=$3`,[status==='approved',status==='approved'?'approved':'verification_rejected',v.professional_id])});await audit(req.user.id,`verification.${status}`,{requestId:v.id,professionalId:v.professional_id});res.json({ok:true})})"
const newRoute="app.patch('/api/admin/verifications/:id',async(req,res)=>{const v=await one('SELECT * FROM verification_requests WHERE id=$1',[req.params.id]);if(!v)return res.status(404).json({error:'Not found'});const status=req.body.status==='approved'?'approved':'rejected',approved=status==='approved',note=str(req.body.note||req.body.adminNote,1000);if(!approved&&!note)return res.status(400).json({error:'Ο λόγος απόρριψης είναι υποχρεωτικός.'});const p=await Professionals.byId(v.professional_id);if(!p)return res.status(404).json({error:'Professional not found'});if(approved&&!['active','past_due'].includes(p.subscriptionStatus||''))return res.status(400).json({error:'Δεν μπορεί να εγκριθεί επαγγελματικός λογαριασμός χωρίς ενεργή ή past-due συνδρομή.'});await tx(async c=>{await c.query(`UPDATE verification_requests SET status=$1,admin_note=$2,reviewed_by=$3,reviewed_at=now() WHERE id=$4`,[status,note,req.user.id,v.id]);await c.query(`UPDATE professionals SET verified=$1,onboarding_stage=$2,onboarding_completed=$1,updated_at=now() WHERE id=$3`,[approved,approved?'approved':'verification_rejected',v.professional_id])});const u=await Users.byId(p.userId);if(u){if(approved){await Notifications.create(u.id,'verification','Ο επαγγελματικός σας λογαριασμός ενεργοποιήθηκε','Η επαλήθευση ολοκληρώθηκε. Από το μενού προφίλ της πλατφόρμας επιλέξτε Professional Dashboard για να διαχειριστείτε το επαγγελματικό σας προφίλ και τα αιτήματα.')}else{await Notifications.create(u.id,'verification','Χρειάζεται ενέργεια για τον επαγγελματικό σας λογαριασμό',`Η επαγγελματική ενεργοποίηση δεν ολοκληρώθηκε. Λόγος: ${note}`)}mail.verificationDecision(u.email,u.name,approved,note).catch(()=>{})}await audit(req.user.id,`verification.${status}`,{requestId:v.id,professionalId:v.professional_id,reason:note});res.json({ok:true})})"
replace('server/relational/app.js',oldRoute,newRoute,'Notify user on admin verification decision')

// 5) Email copy aligned with the in-app lifecycle.
const mailRe=/  verificationDecision: \(to, name, approved, reason = ''\) => deliver\(\{[\s\S]*?\n  \}\),\n  newBooking:/
const mailNew=`  verificationDecision: (to, name, approved, reason = '') => deliver({
    to,
    subject: approved ? 'Ο επαγγελματικός σας λογαριασμός MELEO ενεργοποιήθηκε' : 'Χρειάζεται ενέργεια για τον επαγγελματικό σας λογαριασμό MELEO',
    html: approved
      ? layout('Ο επαγγελματικός σας λογαριασμός ενεργοποιήθηκε', \`<p>Καλησπέρα \${escapeHtml(name)},</p><p>ο επαγγελματικός σας λογαριασμός στο MELEO έχει επιβεβαιωθεί και ενεργοποιηθεί.</p><p>Συνδεθείτε στην πλατφόρμα και από το μενού προφίλ επιλέξτε <b>Professional Dashboard</b> για να διαχειριστείτε το επαγγελματικό σας προφίλ, τα αιτήματα, τη διαθεσιμότητα, τη συνδρομή και τα στατιστικά σας.</p>\`)
      : layout('Χρειάζεται ενέργεια', \`<p>Καλησπέρα \${escapeHtml(name)},</p><p>ο έλεγχος του επαγγελματικού σας λογαριασμού δεν ολοκληρώθηκε.</p><p><b>Λόγος απόρριψης:</b> \${escapeHtml(reason||'Δεν δόθηκε αιτιολογία.')}</p><p>Συνδεθείτε στο MELEO, διορθώστε ή συμπληρώστε τα απαιτούμενα στοιχεία και υποβάλετε ξανά το αίτημα για έλεγχο.</p>\`)
  }),
  newBooking:`
replaceRegex('server/mail.js',mailRe,mailNew,'Upgrade verification decision emails')

for(const x of report)console.log(x)
if(failed){console.error('\nOne or more critical edits could not be applied. Do not commit.');process.exit(1)}
console.log('\nMELEO professional activation/notification patch applied successfully.')
