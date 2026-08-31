import fs from 'node:fs'
const file=fs.readFileSync('src/features/professional/ProfessionalDashboard.tsx','utf8')
const i18n=fs.readFileSync('src/i18n.ts','utf8')
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
const start=file.indexOf('function CompactBooking(')
const end=file.indexOf('export default ProfessionalDashboard',start)
const block=file.slice(start,end)
const failures=[]
const need=(ok,msg)=>{if(!ok)failures.push(msg)}
need(start>=0&&end>start,'CompactBooking block missing')
need(block.includes('const {t}=useTranslation()'),'translator missing')
for(const key of [
'professionalBooking.toast.clarificationSent',
'professionalBooking.errors.finalCostRequired',
'professionalBooking.price.from',
'professionalBooking.actions.open',
'professionalBooking.detail.contact',
'professionalBooking.chat.placeholder',
'professionalBooking.decision.quoteTitle',
'professionalBooking.states.acceptedTitle'
]) need(block.includes(`t('${key}'`),`missing ${key}`)
need(!/[Α-Ωα-ωΆΈΉΊΌΎΏάέήίόύώϊϋΐΰ]/.test(block),'Greek residue remains inside CompactBooking block')
need(i18n.includes("professionalBooking:{toast:{clarificationSent:'The request was sent back to the user for clarification'"),'English namespace missing')
need(pkg.scripts?.['rc3-d7g-check']==='node scripts/rc3-d7g-compact-booking-i18n-selftest.mjs','rc3-d7g-check missing')
need(pkg.scripts?.['ci:gate']?.includes('npm run rc3-d7f-check && npm run rc3-d7g-check'),'CI tail missing D7G')
if(failures.length){console.error('RC3-D7-G compact booking i18n self-test: FAIL');for(const f of failures)console.error('- '+f);process.exit(1)}
console.log('RC3-D7-G compact booking i18n self-test: PASS')
