import fs from 'node:fs'

const read=p=>fs.readFileSync(p,'utf8')
const fail=m=>{console.error('RC3-D5-T ReviewComposer i18n self-test: FAIL - '+m);process.exit(1)}

const x=read('src/App.tsx')
const i=read('src/i18n.ts')
const p=JSON.parse(read('package.json'))

for(const q of [
  "function ReviewComposer({booking,token,onDone,setToast}:any){\n const {t}=useTranslation()",
  "t('patient.review.complete')",
  "t('patient.review.verifiedLabel')",
  "t('patient.review.selectRating')",
  "t('patient.review.published')",
  "t('patient.review.kicker')",
  "t('patient.review.title',{name:booking.professionalName})",
  "t('patient.review.textBefore')",
  "t('patient.review.textAfter')",
  "aria-label={t('patient.review.ratingAria')}",
  "aria-label={t('patient.review.starAria',{count:n})}",
  "placeholder={t('patient.review.placeholder')}",
  "t('patient.review.submitting')",
  "t('patient.review.publish')"
]){
  if(!x.includes(q)) fail('App.tsx '+q)
}

if((i.match(/review:\{complete:/g)||[]).length!==2) fail('i18n review object count')
const chunks=i.split('review:{complete:').slice(1).map(v=>v.split('},bookings:{tablistAria:')[0])
if(chunks.length!==2) fail('i18n chunks')
for(const q of ['verifiedLabel:','selectRating:','published:','kicker:','title:','textBefore:','textAfter:','ratingAria:','starAria:','placeholder:','submitting:','publish:']){
  if(chunks.some(c=>!c.includes(q))) fail('i18n '+q)
}

if(p.scripts?.['rc3-d5t-check']!=='node scripts/rc3-d5t-review-composer-i18n-selftest.mjs') fail('package script')
if(!p.scripts?.['ci:gate']?.includes('npm run rc3-d5s-check && npm run rc3-d5t-check')) fail('ci gate sequence')

console.log('RC3-D5-T ReviewComposer i18n self-test: PASS')