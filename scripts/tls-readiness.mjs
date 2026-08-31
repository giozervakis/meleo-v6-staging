const packageInfo=JSON.parse(fs.readFileSync('package.json','utf8'))
import tls from 'node:tls'; import fs from 'node:fs'
if (process.loadEnvFile && fs.existsSync('.env')) process.loadEnvFile('.env')
const target=new URL(process.env.APP_URL||'https://meleo.gr'); const host=target.hostname; const port=Number(target.port||443)
const result=await new Promise((resolve)=>{
 const s=tls.connect({host,port,servername:host,rejectUnauthorized:true,timeout:7000},()=>{
   const c=s.getPeerCertificate(); const days=Math.floor((new Date(c.valid_to)-Date.now())/86400000)
   resolve({ok:true,authorized:s.authorized,protocol:s.getProtocol(),validTo:c.valid_to,daysRemaining:days,subject:c.subject,issuer:c.issuer}); s.end()
 });
 s.on('error',e=>resolve({ok:false,error:e.message})); s.on('timeout',()=>{s.destroy();resolve({ok:false,error:'TLS connection timeout'})})
})
let health=null
try { const r=await fetch(new URL('/api/health',target),{signal:AbortSignal.timeout(7000)}); health={ok:r.ok,status:r.status,body:await r.text()} } catch(e){ health={ok:false,error:e.message} }
const passed=Boolean(result.ok && result.authorized && result.daysRemaining>=14 && health?.ok)
const report={version:packageInfo.version,checkedAt:new Date().toISOString(),target:target.origin,tls:result,health,passed}
fs.mkdirSync('reports',{recursive:true}); fs.writeFileSync('reports/tls-readiness.json',JSON.stringify(report,null,2))
console.log(`MELEO v${packageInfo.version} TLS/domain readiness: ${passed?'PASS':'FAIL'}`); console.log(JSON.stringify(report,null,2)); process.exitCode=passed?0:1
