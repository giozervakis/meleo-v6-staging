import fs from 'node:fs'
import path from 'node:path'
const BASE=(process.env.BASE_URL||'http://localhost:8787').replace(/\/$/,'')
const ORIGIN=(process.env.ORIGIN_URL||'http://localhost:5173').replace(/\/$/,'')
const rows=[];let pass=0,fail=0
function test(name,ok,detail=''){rows.push({name,ok,detail});ok?pass++:fail++;console.log(`${ok?'✓':'✗'} ${name}${detail&&!ok?' — '+detail:''}`)}
async function call(method,p,{cookie='',body}={}){const r=await fetch(BASE+p,{method,redirect:'manual',headers:{'content-type':'application/json',origin:ORIGIN,...(cookie?{cookie}:{})},body:body?JSON.stringify(body):undefined});const setCookie=r.headers.get('set-cookie')||'';let data=null;try{data=await r.json()}catch{}return {status:r.status,data,cookie:setCookie.split(';')[0]}}
async function login(email,password){const r=await call('POST','/api/auth/login',{body:{email,password}});return r}
const started=Date.now();
try{
  const health=await call('GET','/api/health');test('Health endpoint',health.status===200&&health.data?.ok===true,JSON.stringify(health.data))
  const ready=await call('GET','/api/ready');test('Readiness endpoint',ready.status===200&&ready.data?.ok===true,JSON.stringify(ready.data))
  const patient=await login('patient@meleo.gr','demo123');test('Patient login',patient.status===200&&!!patient.cookie,JSON.stringify(patient.data))
  if(patient.cookie){const me=await call('GET','/api/me',{cookie:patient.cookie});test('Patient session /me',me.status===200&&me.data?.user?.role==='patient',JSON.stringify(me.data))}
  const pro=await login('maria@meleo.gr','demo123');test('Professional login',pro.status===200&&!!pro.cookie,JSON.stringify(pro.data))
  if(pro.cookie){const me=await call('GET','/api/me',{cookie:pro.cookie});test('Professional session /me',me.status===200&&me.data?.user?.role==='professional',JSON.stringify(me.data));const sub=await call('GET','/api/professional/subscription',{cookie:pro.cookie});test('Professional subscription endpoint',sub.status===200,JSON.stringify(sub.data))}
  const admin=await login('admin@meleo.gr','admin123');const adminOk=admin.status===200||admin.status===202;test('Admin login / 2FA challenge',adminOk,JSON.stringify(admin.data))
  if(admin.status===200&&admin.cookie){const stats=await call('GET','/api/admin/stats',{cookie:admin.cookie});test('Admin stats authorization',stats.status===200,JSON.stringify(stats.data))}
  const publicPros=await call('GET','/api/professionals?limit=20');test('Public professional search',publicPros.status===200&&Array.isArray(publicPros.data?.items||publicPros.data),JSON.stringify(publicPros.data)?.slice(0,300))
  const invalid=await call('POST','/api/auth/login',{body:{email:'nobody@example.invalid',password:'wrong-password'}});test('Invalid login rejected',invalid.status===401||invalid.status===400,String(invalid.status))
}catch(e){test('Unexpected runner failure',false,e?.stack||String(e))}
const report={version:'5.6.0',timestamp:new Date().toISOString(),base:BASE,durationMs:Date.now()-started,pass,fail,tests:rows,ok:fail===0};fs.mkdirSync('reports',{recursive:true});const f=path.join('reports','e2e-critical-latest.json');fs.writeFileSync(f,JSON.stringify(report,null,2));console.log(`\n${pass} passed · ${fail} failed · report ${f}`);if(fail)process.exitCode=1
