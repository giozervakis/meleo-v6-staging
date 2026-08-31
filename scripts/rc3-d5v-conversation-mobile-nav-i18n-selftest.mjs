import fs from 'node:fs'

const read=p=>fs.readFileSync(p,'utf8')
const fail=m=>{console.error('RC3-D5-V conversation/mobile-nav i18n self-test: FAIL - '+m);process.exit(1)}

const x=read('src/App.tsx')
const i=read('src/i18n.ts')
const p=JSON.parse(read('package.json'))

for(const q of [
  "t('patient.conversation.history')",
  "i18n.resolvedLanguage==='en'?'en-GB':'el-GR'",
  "aria-label={t('patient.mobileNav.aria')}",
  "t('patient.mobileNav.home')",
  "t('patient.mobileNav.search')",
  "t('patient.mobileNav.now')",
  "t('patient.mobileNav.profile')"
]){
  if(!x.includes(q)) fail('App.tsx '+q)
}

if((i.match(/conversation:\{history:/g)||[]).length!==2) fail('conversation object count')
if((i.match(/mobileNav:\{aria:/g)||[]).length!==2) fail('mobileNav object count')

if(p.scripts?.['rc3-d5v-check']!=='node scripts/rc3-d5v-conversation-mobile-nav-i18n-selftest.mjs') fail('package script')
if(!p.scripts?.['ci:gate']?.includes('npm run rc3-d5u-check && npm run rc3-d5v-check')) fail('ci gate sequence')

console.log('RC3-D5-V conversation/mobile-nav i18n self-test: PASS')