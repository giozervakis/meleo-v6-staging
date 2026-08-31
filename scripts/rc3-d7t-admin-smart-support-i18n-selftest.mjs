import fs from 'node:fs'
const file=fs.readFileSync('src/features/admin/AdminPage.tsx','utf8')
const i18n=fs.readFileSync('src/i18n.ts','utf8')
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
const failures=[]
const need=(ok,msg)=>{if(!ok)failures.push(msg)}

for(const key of [
'adminSmart.loadError','adminSmart.prompts.specialty','adminSmart.prompts.service','adminSmart.prompts.note',
'adminSmart.feedback.learned','adminSmart.feedback.updated','adminSmart.actionError',
'adminSmart.cards.newKicker','adminSmart.cards.newLabel','adminSmart.cards.learnedKicker','adminSmart.cards.learnedLabel',
'adminSmart.cards.patternsKicker','adminSmart.cards.patternsLabel','adminSmart.cards.signalsKicker','adminSmart.cards.signalsLabel',
'adminSmart.title','adminSmart.subtitle','adminSmart.refresh','adminSmart.searchPlaceholder','adminSmart.allStatuses','adminSmart.search',
'adminSmart.occurrenceOne','adminSmart.occurrenceMany','adminSmart.first','adminSmart.last',
'adminSmart.actions.learn','adminSmart.actions.reviewed','adminSmart.actions.ignore','adminSmart.emptyTitle','adminSmart.emptyText',
'adminSupport.replySent','adminSupport.title','adminSupport.subtitle','adminSupport.open',
'adminSupport.replyPlaceholder','adminSupport.send','adminSupport.emptyTitle','adminSupport.emptyText'
]) need(file.includes(key),`missing usage ${key}`)

for(const ns of ['adminSmart:{','adminSupport:{']) need(i18n.includes(ns),`missing namespace ${ns}`)

const smartStart=file.indexOf('function AdminSmartRequests(')
const supportStart=file.indexOf('function AdminSupport(',smartStart)
const exportStart=file.indexOf('export default Admin',supportStart)
need(smartStart>=0&&supportStart>smartStart&&exportStart>supportStart,'function boundaries missing')
const smart=file.slice(smartStart,supportStart)
const support=file.slice(supportStart,exportStart)
need(smart.includes('const {t,i18n}=useTranslation()'),'Smart translator missing')
need(support.includes('const {t,i18n}=useTranslation()'),'Support translator missing')
need(!smart.includes("toLocaleString('el-GR')"),'Smart hardcoded locale remains')
need(!support.includes("toLocaleString('el-GR')"),'Support hardcoded locale remains')
need(pkg.scripts?.['rc3-d7t-check']==='node scripts/rc3-d7t-admin-smart-support-i18n-selftest.mjs','rc3-d7t-check missing')
need(pkg.scripts?.['ci:gate']?.includes('npm run rc3-d7s-check && npm run rc3-d7t-check'),'CI tail missing D7T')

if(failures.length){
 console.error('RC3-D7-T admin Smart Requests/Support i18n self-test: FAIL')
 for(const f of failures)console.error('- '+f)
 process.exit(1)
}
console.log('RC3-D7-T admin Smart Requests/Support i18n self-test: PASS')
