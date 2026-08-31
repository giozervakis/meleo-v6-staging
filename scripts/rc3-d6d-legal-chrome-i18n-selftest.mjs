import fs from 'node:fs'
const account=fs.readFileSync('src/Account.tsx','utf8')
const i18n=fs.readFileSync('src/i18n.ts','utf8')
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
const failures=[]
const need=(ok,msg)=>{if(!ok)failures.push(msg)}

for(const token of [
  "t('legalUi.placeholders.provider')",
  "t('legalUi.placeholders.vat')",
  "t('legalUi.placeholders.address')",
  "t('legalUi.back')",
  "t('legalUi.pending')",
  "t('legalUi.draftWarning')",
  "t('legalUi.providerRequired')",
  "t('legalUi.kicker')",
  "t('legalUi.termsTitle')",
  "t('legalUi.privacyTitle')",
  "t('legalUi.cookiesTitle')",
  "t('legalUi.version')"
]) need(account.includes(token),`missing legal UI token: ${token}`)

const greekShell=[
  '\u2190 \u03a0\u03af\u03c3\u03c9',
  '<b>\u0395\u03ba\u03ba\u03c1\u03b5\u03bc\u03b5\u03af:</b>',
  '<div className="eyebrow">\u039d\u039f\u039c\u0399\u039a\u0391</div><h1>\u038c\u03c1\u03bf\u03b9 \u03a7\u03c1\u03ae\u03c3\u03b7\u03c2</h1>',
  '<div className="eyebrow">\u039d\u039f\u039c\u0399\u039a\u0391</div><h1>\u03a0\u03bf\u03bb\u03b9\u03c4\u03b9\u03ba\u03ae \u0391\u03c0\u03bf\u03c1\u03c1\u03ae\u03c4\u03bf\u03c5</h1>',
  '<div className="eyebrow">\u039d\u039f\u039c\u0399\u039a\u0391</div><h1>Cookies & \u03c4\u03bf\u03c0\u03b9\u03ba\u03ae \u03b1\u03c0\u03bf\u03b8\u03ae\u03ba\u03b5\u03c5\u03c3\u03b7</h1>'
]
for(const hardcoded of greekShell) need(!account.includes(hardcoded),`hard-coded legal chrome remains: ${hardcoded}`)

need(account.includes("t('legalTerms.s1.title')") || account.includes('1. \u03a0\u03bf\u03b9\u03bf\u03b9 \u03b5\u03af\u03bc\u03b1\u03c3\u03c4\u03b5 \u03ba\u03b1\u03b9 \u03c4\u03b9 \u03ba\u03ac\u03bd\u03bf\u03c5\u03bc\u03b5'),'terms surface must remain present after D6D')
need(account.includes("t('legalPrivacy.s2.title')") || account.includes('\u03a0\u03bf\u03b9\u03b1 \u03b4\u03b5\u03b4\u03bf\u03bc\u03ad\u03bd\u03b1 \u03c3\u03c5\u03bb\u03bb\u03ad\u03b3\u03bf\u03c5\u03bc\u03b5'),'privacy surface must remain present after D6D')
need(account.includes("t('legalCookies.s1.title')") || account.includes('\u03a4\u03b9 \u03c7\u03c1\u03b7\u03c3\u03b9\u03bc\u03bf\u03c0\u03bf\u03b9\u03bf\u03cd\u03bc\u03b5'),'cookies surface must remain present after prior legal tranche')
need(i18n.includes("legalUi:{back:'Back'"),'English legalUi translations missing')
need(pkg.scripts?.['rc3-d6d-check']==='node scripts/rc3-d6d-legal-chrome-i18n-selftest.mjs','rc3-d6d-check package script missing')
need(pkg.scripts?.['ci:gate']?.includes('npm run rc3-d6c-check && npm run rc3-d6d-check'),'ci:gate must append D6D after D6C')

if(failures.length){
  console.error('RC3-D6-D legal chrome i18n self-test: FAIL')
  for(const f of failures)console.error(`- ${f}`)
  process.exit(1)
}
console.log('RC3-D6-D legal chrome i18n self-test: PASS')
