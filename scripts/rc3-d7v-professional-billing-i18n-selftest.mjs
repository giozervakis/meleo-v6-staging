import fs from 'node:fs'
const f=fs.readFileSync('src/features/professional/billing/ProfessionalBilling.tsx','utf8')
const i=fs.readFileSync('src/i18n.ts','utf8')
const p=JSON.parse(fs.readFileSync('package.json','utf8'))
const fail=[]
const need=(x,m)=>{if(!x)fail.push(m)}
for(const k of ['proBilling.errors.load','proBilling.confirmCancel','proBilling.toast.changeScheduled','proBilling.hero.title','proBilling.currentPlan','proBilling.pastDue.title','proBilling.scheduledChange.title','proBilling.cancellation.title','proBilling.facts.status','proBilling.membership.title','proBilling.plan.active','proBilling.management.title','proBilling.history.title','proBilling.footerNote']) need(f.includes(k),'missing '+k)
need(f.includes("const {t,i18n}=useTranslation()"),'translator missing')
need(f.includes("dateLabel(invoice.createdAt,i18n.resolvedLanguage==='en'?'en-GB':'el-GR')"),'invoice locale missing')
need(i.includes('proBilling:{'),'namespace missing')
need(p.scripts?.['rc3-d7v-check']==='node scripts/rc3-d7v-professional-billing-i18n-selftest.mjs','script missing')
need(p.scripts?.['ci:gate']?.includes('npm run rc3-d7u-check && npm run rc3-d7v-check'),'ci tail missing')
if(fail.length){console.error('RC3-D7-V professional billing i18n self-test: FAIL');fail.forEach(x=>console.error('- '+x));process.exit(1)}
console.log('RC3-D7-V professional billing i18n self-test: PASS')
