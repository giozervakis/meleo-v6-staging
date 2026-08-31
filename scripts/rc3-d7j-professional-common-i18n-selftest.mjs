import fs from 'node:fs'
const file=fs.readFileSync('src/features/professional/ProfessionalDashboard.tsx','utf8')
const i18n=fs.readFileSync('src/i18n.ts','utf8')
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
const failures=[]
const need=(ok,msg)=>{if(!ok)failures.push(msg)}
for(const key of [
'professionalCommon.status.pending',
'professionalCommon.repeat.once',
'professionalCommon.verifyEmail.title',
'professionalCommon.calendar.add',
'professionalCommon.conversation.title',
'professionalDashboard.profile.priceNoticeBefore',
'professionalDashboard.profile.years',
'professionalDashboard.profile.save'
]) need(file.includes(key),`missing usage ${key}`)
need(file.includes('function VerifyEmailBanner({user,token,cfg,setToast}:any){\n const {t}=useTranslation()'),'VerifyEmailBanner translator missing')
need(file.includes('function CalendarActions({booking}:any){\n  const {t}=useTranslation()'),'CalendarActions translator missing')
need(file.includes('function Conversation({messages}:any){const {t,i18n}=useTranslation()'),'Conversation translator missing')
need(!file.includes("statusLabel(b.status)"),'stale statusLabel call remains')
need(!file.includes("repeatLabel(b.repeat)"),'stale repeatLabel call remains')
need(i18n.includes("professionalCommon:{"),'professionalCommon namespace missing')
need(i18n.includes("title:'Verify your email'"),'English professionalCommon missing')
need(i18n.includes("priceNoticeBefore:'The amount is shown as'"),'English profile additions missing')
need(pkg.scripts?.['rc3-d7j-check']==='node scripts/rc3-d7j-professional-common-i18n-selftest.mjs','rc3-d7j-check missing')
need(pkg.scripts?.['ci:gate']?.includes('npm run rc3-d7i-check && npm run rc3-d7j-check'),'CI tail missing D7J')
if(failures.length){console.error('RC3-D7-J professional common i18n self-test: FAIL');for(const f of failures)console.error('- '+f);process.exit(1)}
console.log('RC3-D7-J professional common i18n self-test: PASS')
