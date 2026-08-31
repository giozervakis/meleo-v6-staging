import fs from 'node:fs'
const app=fs.readFileSync('src/App.tsx','utf8')
const i18n=fs.readFileSync('src/i18n.ts','utf8')
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
const failures=[]
const need=(ok,msg)=>{if(!ok)failures.push(msg)}

const start=app.indexOf('function BecomeProfessional(')
const end=app.indexOf('function InlineRegister(',start)
need(start>=0&&end>start,'BecomeProfessional boundary missing')
const surface=start>=0&&end>start?app.slice(start,end):''

for(const key of [
 'professionalJoin.enabledToast',
 'professionalJoin.existing.readyTitle',
 'professionalJoin.existing.pendingTitle',
 'professionalJoin.existing.openDashboard',
 'professionalJoin.existing.personalBookings',
 'professionalJoin.patient.title',
 'professionalJoin.patient.b1Title',
 'professionalJoin.patient.b2Title',
 'professionalJoin.patient.b3Title',
 'professionalJoin.patient.formTitle',
 'professionalJoin.patient.flow',
 'professionalJoin.patient.continue',
 'professionalJoin.guest.title',
 'professionalJoin.guest.b1Title',
 'professionalJoin.guest.b2Title',
 'professionalJoin.guest.b3Title',
 'professionalJoin.guest.formTitle'
]) need(surface.includes(`t('${key}')`),`missing ${key}`)

need(surface.includes('const {t}=useTranslation()'),'BecomeProfessional translator missing')
need(!/[\u0370-\u03ff\u1f00-\u1fff]/.test(surface.replace(/[✓…]/g,'')),'Greek literal remains in BecomeProfessional')
need(i18n.includes("professionalJoin:{enabledToast:'Professional mode has been enabled."),'English professionalJoin namespace missing')
need(pkg.scripts?.['rc3-d7b-check']==='node scripts/rc3-d7b-professional-join-i18n-selftest.mjs','rc3-d7b-check package script missing')
need(pkg.scripts?.['ci:gate']?.includes('npm run rc3-d7a-check && npm run rc3-d7b-check'),'ci:gate must append D7B after D7A')

if(failures.length){
 console.error('RC3-D7-B professional join i18n self-test: FAIL')
 for(const f of failures)console.error(`- ${f}`)
 process.exit(1)
}
console.log('RC3-D7-B professional join i18n self-test: PASS')
