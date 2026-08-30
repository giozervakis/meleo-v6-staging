import fs from 'node:fs'
const read=p=>fs.readFileSync(p,'utf8')
const fail=m=>{console.error(`RC3-D2 search mobile/a11y self-test: FAIL - ${m}`);process.exit(1)}

const search=read('src/features/search/SearchPage.tsx')
const css=read('src/features/search/search-rc3d.css')
const app=read('src/App.tsx')
const pkg=JSON.parse(read('package.json'))

if(!search.includes("import './search-rc3d.css'"))fail('D2 CSS import missing')
if(!search.includes('rc3d-search-page'))fail('scoped Search wrapper missing')
if(!search.includes('id="meleo-search-title"'))fail('Search heading id missing')
if(!search.includes('aria-live="polite"'))fail('results live region missing')
if(!search.includes("aria-label={t('searchPage.results')}"))fail('results aria label missing')
if((search.match(/aria-pressed=/g)||[]).length<4)fail('filter pressed states missing')
if(!css.includes('@media (max-width: 390px)'))fail('390px responsive guard missing')
if(!css.includes('min-height:44px'))fail('touch target baseline missing')
if(!css.includes('grid-template-columns:minmax(0,1fr)'))fail('single-column responsive flow missing')
if(!css.includes('overflow-wrap:anywhere'))fail('long-content overflow guard missing')
if(!app.includes('aria-label={`${p.name} · ${displayTitle}`}'))fail('result card accessible name missing')
if(pkg.scripts?.['rc3-d2-check']!=='node scripts/rc3-d2-search-selftest.mjs')fail('D2 package script missing')
if(!pkg.scripts?.['ci:gate']?.includes('rc3-d2-check'))fail('D2 CI gate missing')

console.log('RC3-D2 search mobile/a11y self-test: PASS')
