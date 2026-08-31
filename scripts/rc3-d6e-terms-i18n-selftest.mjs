import fs from 'node:fs'
const account=fs.readFileSync('src/Account.tsx','utf8')
const i18n=fs.readFileSync('src/i18n.ts','utf8')
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
const failures=[]
const need=(ok,msg)=>{if(!ok)failures.push(msg)}

for(let i=1;i<=9;i++){
  need(account.includes(`t('legalTerms.s${i}.title')`),`missing terms title key s${i}`)
  need(account.includes(`t('legalTerms.s${i}.body`),`missing terms body key s${i}`)
}
need(account.includes("provider,vat,address"),'terms provider interpolation missing')
need(account.includes("emergency:cfg?.emergencyNumber || '112'"),'terms emergency interpolation missing')
need(account.includes("t('legalTerms.s9.body',{support})"),'terms support interpolation missing')

need(!account.includes('<h3>1. \u03a0\u03bf\u03b9\u03bf\u03b9 \u03b5\u03af\u03bc\u03b1\u03c3\u03c4\u03b5 \u03ba\u03b1\u03b9 \u03c4\u03b9 \u03ba\u03ac\u03bd\u03bf\u03c5\u03bc\u03b5</h3>'),'hard-coded terms body remains')
need(account.includes("t('legalPrivacy.s2.title')") || account.includes('\u03a0\u03bf\u03b9\u03b1 \u03b4\u03b5\u03b4\u03bf\u03bc\u03ad\u03bd\u03b1 \u03c3\u03c5\u03bb\u03bb\u03ad\u03b3\u03bf\u03c5\u03bc\u03b5'),'privacy surface must remain present after D6E')
need(account.includes('\u03a4\u03b9 \u03c7\u03c1\u03b7\u03c3\u03b9\u03bc\u03bf\u03c0\u03bf\u03b9\u03bf\u03cd\u03bc\u03b5'),'cookies body must remain untouched in D6E')
need(i18n.includes("legalTerms:{s1:{title:'1. Who we are and what we do'"),'English legalTerms translations missing')
need(pkg.scripts?.['rc3-d6e-check']==='node scripts/rc3-d6e-terms-i18n-selftest.mjs','rc3-d6e-check package script missing')
need(pkg.scripts?.['ci:gate']?.includes('npm run rc3-d6d-check && npm run rc3-d6e-check'),'ci:gate must append D6E after D6D')

if(failures.length){
  console.error('RC3-D6-E terms i18n self-test: FAIL')
  for(const f of failures)console.error(`- ${f}`)
  process.exit(1)
}
console.log('RC3-D6-E terms i18n self-test: PASS')
