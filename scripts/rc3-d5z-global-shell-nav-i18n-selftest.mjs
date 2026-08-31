import fs from 'node:fs'

const app = fs.readFileSync('src/App.tsx','utf8')
const i18n = fs.readFileSync('src/i18n.ts','utf8')
const pkg = JSON.parse(fs.readFileSync('package.json','utf8'))

const failures = []
const need = (ok,msg) => { if(!ok) failures.push(msg) }

for (const token of [
  "t('shell.footer.disclaimerBefore')",
  "t('shell.footer.terms')",
  "t('shell.header.notifications')",
  "t('shell.header.accountSettings')",
  "t('shell.header.logout')",
  "t('shell.header.openMenu')",
  "t('shell.header.mainMenu')",
  "t('shell.header.closeMenu')",
  "t('shell.mobile.home')",
  "t('shell.mobile.guestSearch')"
]) {
  need(app.includes(token), `missing App token: ${token}`)
}

const headerStart = app.indexOf('function Header(')
const headerEnd = app.indexOf('function SectionTitle(', headerStart)
need(headerStart >= 0 && headerEnd > headerStart, 'Header boundaries missing')
if(headerStart >= 0 && headerEnd > headerStart){
  const header = app.slice(headerStart,headerEnd)
  need(!/[\u0370-\u03FF\u1F00-\u1FFF]/u.test(header), 'Greek hard-coded text remains in Header')
}

const footerStart = app.indexOf('function Footer(')
const footerEnd = app.indexOf('function Header(', footerStart)
need(footerStart >= 0 && footerEnd > footerStart, 'Footer boundaries missing')
if(footerStart >= 0 && footerEnd > footerStart){
  const footer = app.slice(footerStart,footerEnd)
  need(!/[\u0370-\u03FF\u1F00-\u1FFF]/u.test(footer), 'Greek hard-coded text remains in Footer')
}

need(i18n.includes('shell:{nav:'), 'shell i18n namespace missing')
need(i18n.includes("footer:{disclaimerBefore:"), 'footer translations missing')
need(i18n.includes("header:{adminCenter:"), 'header translations missing')

need(pkg.scripts?.['rc3-d5z-check'] === 'node scripts/rc3-d5z-global-shell-nav-i18n-selftest.mjs',
  'rc3-d5z-check package script missing')
need(pkg.scripts?.['ci:gate']?.includes('npm run rc3-d5y-check && npm run rc3-d5z-check'),
  'ci:gate must append D5Z after D5Y')

if(failures.length){
  console.error('RC3-D5-Z global shell/navigation i18n self-test: FAIL')
  for(const f of failures) console.error(`- ${f}`)
  process.exit(1)
}
console.log('RC3-D5-Z global shell/navigation i18n self-test: PASS')