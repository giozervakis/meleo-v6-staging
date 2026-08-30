import fs from 'node:fs'
const r=p=>fs.readFileSync(p,'utf8')
const fail=m=>{console.error('RC3-D2 header premium self-test: FAIL - '+m);process.exit(1)}

const app=r('src/App.tsx')
const i18n=r('src/i18n.ts')
const comp=r('src/components/LanguageSwitcher.tsx')
const css=r('src/components/language-switcher.css')
const pkg=JSON.parse(r('package.json'))

const start=app.indexOf('function Header(')
if(start<0)fail('Header missing')
const end=app.indexOf('function MobileNav',start)
const header=end>start?app.slice(start,end):app.slice(start)

if(!header.includes('const {t}=useTranslation()'))fail('Header translation hook missing')
for(const key of ['nav.home','nav.search','nav.smart','nav.now','nav.pricing','nav.professionals']){
  if(!header.includes(`t('${key}')`))fail('header key '+key)
}
for(const value of ["home:'Home'","search:'Search'","pricing:'Plans'","professionals:'For professionals'"]){
  if(!i18n.includes(value))fail('EN nav '+value)
}
if(comp.includes('>◎</span>'))fail('utility icon remains')
if(!comp.includes('meleo-language-monogram'))fail('premium monogram missing')
if(!css.includes('linear-gradient'))fail('premium treatment missing')
if(!css.includes('prefers-reduced-motion'))fail('reduced motion missing')
if(pkg.scripts?.['rc3-d2-header-premium-check']!=='node scripts/rc3-d2-header-premium-selftest.mjs')fail('package script missing')
if(!pkg.scripts?.['ci:gate']?.includes('rc3-d2-header-premium-check'))fail('ci gate missing')
console.log('RC3-D2 header premium self-test: PASS')
