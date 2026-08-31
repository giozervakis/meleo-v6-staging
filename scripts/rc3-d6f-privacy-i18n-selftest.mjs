import fs from 'node:fs'
const account=fs.readFileSync('src/Account.tsx','utf8')
const i18n=fs.readFileSync('src/i18n.ts','utf8')
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
const failures=[]
const need=(ok,msg)=>{if(!ok)failures.push(msg)}

for(let i=1;i<=8;i++){
  need(account.includes(`t('legalPrivacy.s${i}.title')`),`missing privacy title key s${i}`)
  need(account.includes(`t('legalPrivacy.s${i}.body`),`missing privacy body key s${i}`)
}
need(account.includes("t('legalPrivacy.s1.body',{provider,vat,address,dpo})"),'privacy controller interpolation missing')
need(!account.includes('<h3>\u03a5\u03c0\u03b5\u03cd\u03b8\u03c5\u03bd\u03bf\u03c2 \u03b5\u03c0\u03b5\u03be\u03b5\u03c1\u03b3\u03b1\u03c3\u03af\u03b1\u03c2</h3>'),'hard-coded privacy body remains')
need(account.includes('\u03a4\u03b9 \u03c7\u03c1\u03b7\u03c3\u03b9\u03bc\u03bf\u03c0\u03bf\u03b9\u03bf\u03cd\u03bc\u03b5'),'cookies body must remain untouched in D6F')
need(i18n.includes("legalPrivacy:{s1:{title:'Data controller'"),'English legalPrivacy translations missing')
need(pkg.scripts?.['rc3-d6f-check']==='node scripts/rc3-d6f-privacy-i18n-selftest.mjs','rc3-d6f-check package script missing')
need(pkg.scripts?.['ci:gate']?.includes('npm run rc3-d6e-check && npm run rc3-d6f-check'),'ci:gate must append D6F after D6E')

if(failures.length){
  console.error('RC3-D6-F privacy i18n self-test: FAIL')
  for(const f of failures)console.error(`- ${f}`)
  process.exit(1)
}
console.log('RC3-D6-F privacy i18n self-test: PASS')
