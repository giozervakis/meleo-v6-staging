import fs from 'node:fs'
const file=fs.readFileSync('src/features/professional/ProfessionalDashboard.tsx','utf8')
const i18n=fs.readFileSync('src/i18n.ts','utf8')
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
const failures=[]
const need=(ok,msg)=>{if(!ok)failures.push(msg)}
for(const key of ['professionalDashboard.sidebar.pendingVerification','professionalDashboard.tabs.overview','professionalDashboard.tabs.requests','professionalDashboard.tabs.messages','professionalDashboard.tabs.profile','professionalDashboard.tabs.availability','professionalDashboard.tabs.reputation','professionalDashboard.tabs.subscription','professionalDashboard.tabs.verification','professionalDashboard.tabs.notifications','professionalDashboard.tabs.support','professionalDashboard.sidebar.personalBookings','professionalDashboard.alerts.pastDue','professionalDashboard.alerts.cancelScheduled','professionalDashboard.headings.overview','professionalDashboard.headings.requests','professionalDashboard.headings.profile','professionalDashboard.overview.recentRequests','professionalDashboard.overview.viewAll','professionalDashboard.profile.title','professionalDashboard.profile.specialty','professionalDashboard.profile.pricingMode','professionalDashboard.profile.publicContactTitle']) need(file.includes(`t('${key}')`),`missing ${key}`)
need(file.includes("import { useTranslation } from 'react-i18next'"),'useTranslation import missing')
need(file.includes('const {t,i18n}=useTranslation()'),'ProfessionalDashboard translator missing')
need(i18n.includes("professionalDashboard:{toast:{messageFailed:'Message sending failed."),'English professionalDashboard namespace missing')
need(pkg.scripts?.['rc3-d7d-check']==='node scripts/rc3-d7d-professional-dashboard-shell-i18n-selftest.mjs','rc3-d7d-check package script missing')
need(pkg.scripts?.['ci:gate']?.includes('npm run rc3-d7c-check && npm run rc3-d7d-check'),'ci:gate must append D7D after D7C')
if(failures.length){console.error('RC3-D7-D professional dashboard shell i18n self-test: FAIL');for(const f of failures)console.error(`- ${f}`);process.exit(1)}
console.log('RC3-D7-D professional dashboard shell i18n self-test: PASS')
