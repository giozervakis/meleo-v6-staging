import fs from 'node:fs'
const file=fs.readFileSync('src/features/professional/ProfessionalDashboard.tsx','utf8')
const i18n=fs.readFileSync('src/i18n.ts','utf8')
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
const failures=[]
const need=(ok,msg)=>{if(!ok)failures.push(msg)}
for(const key of [
'professionalGrowth.value.completedValue',
'professionalGrowth.value.completedValueNote',
'professionalGrowth.value.monthlySubscription',
'professionalGrowth.value.roi',
'professionalGrowth.value.roiDisclaimer',
'professionalGrowth.value.discovery',
'professionalGrowth.value.intent',
'professionalGrowth.value.conversion',
'professionalGrowth.insightsTitle'
]) need(file.includes(`t('${key}'`),`missing ${key}`)
for(const stale of [
'Αξία ολοκληρωμένων επισκέψεων',
'Με βάση τις τιμές των completed bookings.',
'Μηνιαία συνδρομή',
'Αναλογία αξίας / συνδρομής',
'Δεν αποτελεί εγγύηση μελλοντικού εισοδήματος.',
'Εμφάνιση → Προφίλ',
'Προφίλ → Επικοινωνία',
'Αίτημα → Πελάτης',
'Τι μπορείς να κάνεις τώρα'
]) need(!file.includes(stale),`stale literal ${stale}`)
need(i18n.includes("completedValue:'Value of completed visits'"),'English D7K translations missing')
need(pkg.scripts?.['rc3-d7k-check']==='node scripts/rc3-d7k-professional-value-i18n-selftest.mjs','rc3-d7k-check missing')
need(pkg.scripts?.['ci:gate']?.includes('npm run rc3-d7j-check && npm run rc3-d7k-check'),'CI tail missing D7K')
if(failures.length){console.error('RC3-D7-K professional value i18n self-test: FAIL');for(const f of failures)console.error('- '+f);process.exit(1)}
console.log('RC3-D7-K professional value i18n self-test: PASS')
