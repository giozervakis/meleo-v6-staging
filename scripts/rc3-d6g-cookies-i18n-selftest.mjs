import fs from 'node:fs'
const account=fs.readFileSync('src/Account.tsx','utf8')
const i18n=fs.readFileSync('src/i18n.ts','utf8')
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
const failures=[]
const need=(ok,msg)=>{if(!ok)failures.push(msg)}

for(let i=1;i<=3;i++){
  need(account.includes(`t('legalCookies.s${i}.title')`),`missing cookies title key s${i}`)
  need(account.includes(`t('legalCookies.s${i}.body')`),`missing cookies body key s${i}`)
}
need(!account.includes('<h3>\u03a4\u03b9 \u03c7\u03c1\u03b7\u03c3\u03b9\u03bc\u03bf\u03c0\u03bf\u03b9\u03bf\u03cd\u03bc\u03b5</h3>'),'hard-coded cookies body remains')
need(account.includes("t('legalTerms.s1.title')"),'terms i18n surface must remain present')
need(account.includes("t('legalPrivacy.s1.title')"),'privacy i18n surface must remain present')
need(i18n.includes("legalCookies:{s1:{title:'What we use'"),'English legalCookies translations missing')
need(pkg.scripts?.['rc3-d6g-check']==='node scripts/rc3-d6g-cookies-i18n-selftest.mjs','rc3-d6g-check package script missing')
need(pkg.scripts?.['ci:gate']?.includes('npm run rc3-d6f-check && npm run rc3-d6g-check'),'ci:gate must append D6G after D6F')

if(failures.length){
  console.error('RC3-D6-G cookies i18n self-test: FAIL')
  for(const f of failures)console.error(`- ${f}`)
  process.exit(1)
}
console.log('RC3-D6-G cookies i18n self-test: PASS')
