import fs from 'node:fs'
const file=fs.readFileSync('src/features/professional/availability/ProfessionalAvailability.tsx','utf8')
const i18n=fs.readFileSync('src/i18n.ts','utf8')
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
const failures=[]
const need=(ok,msg)=>{if(!ok)failures.push(msg)}
for(const key of [
'proAvailability.errors.load','proAvailability.errors.save','proAvailability.toast.copiedWeekdays','proAvailability.toast.selectExceptionDate','proAvailability.toast.selectExceptionSlot','proAvailability.toast.saved',
'proAvailability.loading','proAvailability.hero.title','proAvailability.hero.text','proAvailability.stats.activeDays','proAvailability.stats.slotsWeek','proAvailability.stats.exceptions',
'proAvailability.weekly.kicker','proAvailability.weekly.title','proAvailability.weekly.copyWeekdays','proAvailability.hours','proAvailability.closed',
'proAvailability.day.title','proAvailability.day.active','proAvailability.day.closedTitle','proAvailability.day.closedText','proAvailability.day.enable','proAvailability.day.selectedSlots','proAvailability.day.clear',
'proAvailability.exceptions.kicker','proAvailability.exceptions.title','proAvailability.exceptions.date','proAvailability.exceptions.specialSchedule','proAvailability.exceptions.note','proAvailability.exceptions.notePlaceholder','proAvailability.exceptions.availableHours','proAvailability.exceptions.add','proAvailability.exceptions.specialScheduleShort','proAvailability.exceptions.unavailable','proAvailability.exceptions.delete',
'proAvailability.summary.kicker','proAvailability.summary.title','proAvailability.summary.available','proAvailability.summary.realAvailabilityTitle','proAvailability.summary.realAvailabilityText','proAvailability.summary.doubleBookingTitle','proAvailability.summary.doubleBookingText',
'proAvailability.save.saving','proAvailability.save.button','proAvailability.save.note'
]) need(file.includes(key),`missing usage ${key}`)
need(file.includes("const {t,i18n}=useTranslation()"),'translator missing')
need(file.includes("formatDate(item.date,i18n.resolvedLanguage==='en'?'en-GB':'el-GR')"),'locale-aware exception date missing')
need(i18n.includes('proAvailability:{'),'proAvailability namespace missing')
need(pkg.scripts?.['rc3-d7u-check']==='node scripts/rc3-d7u-professional-availability-i18n-selftest.mjs','rc3-d7u-check missing')
need(pkg.scripts?.['ci:gate']?.includes('npm run rc3-d7t-check && npm run rc3-d7u-check'),'CI tail missing D7U')
if(failures.length){console.error('RC3-D7-U professional availability i18n self-test: FAIL');for(const f of failures)console.error('- '+f);process.exit(1)}
console.log('RC3-D7-U professional availability i18n self-test: PASS')
