import fs from 'node:fs'
const read=p=>fs.readFileSync(p,'utf8')
const fail=m=>{console.error(`RC3-D1 feedback fixes self-test: FAIL - ${m}`);process.exit(1)}

const home=read('src/features/home/HomeExperience.tsx')
const search=read('src/features/search/SearchPage.tsx')
const app=read('src/App.tsx')
const catalog=read('src/domain/catalog-i18n.ts')
const i18n=read('src/i18n.ts')
const pkg=JSON.parse(read('package.json'))

if(!home.includes("meleo.scrollSearchResults"))fail('Home -> results marker missing')
if(!home.includes('await loadPros(criteria)'))fail('Home does not use explicit criteria')
if(!search.includes("sessionStorage.getItem('meleo.scrollSearchResults')"))fail('Search mount scroll handoff missing')
if(!search.includes('window.scrollTo({'))fail('robust results scroll missing')
if(!search.includes('tabIndex={-1}'))fail('results focus target missing')
if(!catalog.includes("'Νοσηλευτική':'Nursing'"))fail('specialty translation missing')
if(!catalog.includes("'Περιποίηση τραύματος':'Wound care'"))fail('service translation missing')
if(!home.includes('catalogLabel(x,i18n.language)'))fail('translated dropdown display missing')
if(!search.includes("t('searchPage.results')"))fail('Search page chrome not translated')
if(!app.includes("t('card.viewProfile')"))fail('card chrome not translated')
if(!app.includes('catalogLabel(service,language)'))fail('card services not translated')
if(!app.includes('localizedPriceLabel(p,language)'))fail('card price not localized')
if(!i18n.includes("title1:'Find the right care.'"))fail('EN Search page resources missing')
if(pkg.scripts?.['rc3-d1-feedback-check']!=='node scripts/rc3-d1-feedback-selftest.mjs')fail('script missing')
if(!pkg.scripts?.['ci:gate']?.includes('rc3-d1-feedback-check'))fail('CI gate missing')

console.log('RC3-D1 feedback fixes self-test: PASS')
