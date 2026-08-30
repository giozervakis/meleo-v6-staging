import fs from 'node:fs'
const read=p=>fs.readFileSync(p,'utf8')
const fail=m=>{console.error(`RC3-D2 language-nav self-test: FAIL - ${m}`);process.exit(1)}

const app=read('src/App.tsx')
const home=read('src/features/home/HomeExperience.tsx')
const language=read('src/components/LanguageSwitcher.tsx')
const css=read('src/components/language-switcher.css')
const d1=read('scripts/rc3-d1-home-i18n-selftest.mjs')
const pkg=JSON.parse(read('package.json'))

if((app.match(/<LanguageSwitcher\/>/g)||[]).length!==1)fail('global switcher count != 1')
if(!app.includes('<div className="nav-actions"><LanguageSwitcher/>'))fail('switcher not in nav-actions')
if(home.includes('rc3d-language-switch'))fail('hero language control remains')
if(home.includes('switchLanguage'))fail('hero language handler remains')
if(!language.includes("i18n.changeLanguage(next)"))fail('language switching missing')
if(!language.includes('aria-haspopup="menu"'))fail('menu semantics missing')
if(!language.includes('role="menuitemradio"'))fail('selected language semantics missing')
if(!language.includes("e.key==='Escape'"))fail('Escape handling missing')
if(!css.includes('@media(max-width:760px)'))fail('mobile dropdown guard missing')
if(d1.includes("home.includes('rc3d-language-switch')"))fail('D1 gate still hardcodes obsolete hero placement')
if(pkg.scripts?.['rc3-d2-language-check']!=='node scripts/rc3-d2-language-nav-selftest.mjs')fail('package script missing')
if(!pkg.scripts?.['ci:gate']?.includes('rc3-d2-language-check'))fail('CI gate missing')

console.log('RC3-D2 language-nav self-test: PASS')
