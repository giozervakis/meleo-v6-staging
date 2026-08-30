import fs from 'node:fs'
const r=p=>fs.readFileSync(p,'utf8')
const fail=m=>{console.error('RC3-D3 booking self-test: FAIL - '+m);process.exit(1)}
const flow=r('src/features/booking/BookingFlow.tsx'),css=r('src/features/booking/booking-rc3d.css'),i18n=r('src/i18n.ts'),pkg=JSON.parse(r('package.json'))
for(const x of ["useTranslation","booking-rc3d.css","rc3d-booking-page",'aria-live="polite"','aria-busy={slotsLoading}','aria-pressed={form.time===time}',"aria-current={step===1?'step':undefined}",'autoComplete="street-address"','!form.address.trim()',"stepHeadingRef","statusRef"])if(!flow.includes(x))fail('missing '+x)
for(const x of ['@media(max-width:900px)','@media(max-width:600px)','@media(max-width:390px)','min-height:44px','font-size:16px','overflow-x:clip','prefers-reduced-motion'])if(!css.includes(x))fail('CSS '+x)
for(const x of ["booking:{","title:'When do you need care?'","title:'Πότε χρειάζεσαι φροντίδα;'","submit:'Send request'"])if(!i18n.includes(x))fail('i18n '+x)
if(pkg.scripts?.['rc3-d3-check']!=='node scripts/rc3-d3-booking-selftest.mjs')fail('package script')
if(!pkg.scripts?.['ci:gate']?.includes('rc3-d3-check'))fail('ci gate')
console.log('RC3-D3 booking mobile/a11y/i18n self-test: PASS')
