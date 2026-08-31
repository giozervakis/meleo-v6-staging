import fs from 'node:fs'
const file=fs.readFileSync('src/features/admin/AdminPage.tsx','utf8')
const i18n=fs.readFileSync('src/i18n.ts','utf8')
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
const failures=[]
const need=(ok,msg)=>{if(!ok)failures.push(msg)}
for(const key of [
'adminVerification.subtitle','adminVerification.professionalFallback','adminVerification.license','adminVerification.documents','adminVerification.download','adminVerification.approve','adminVerification.reject','adminVerification.emptyTitle','adminVerification.emptyText',
'adminAudit.subtitle','adminAudit.refresh','adminAudit.time'
]) need(file.includes(key),`missing usage ${key}`)
for(const ns of ['adminVerification:{','adminAudit:{']) need(i18n.includes(ns),`missing namespace ${ns}`)
need(!file.includes('>Έγκριση</button>'),'hardcoded verification approve remains')
need(!file.includes('>Απόρριψη</button>'),'hardcoded verification reject remains')
need(pkg.scripts?.['rc3-d7s-check']==='node scripts/rc3-d7s-admin-verification-audit-i18n-selftest.mjs','rc3-d7s-check missing')
need(pkg.scripts?.['ci:gate']?.includes('npm run rc3-d7r-check && npm run rc3-d7s-check'),'CI tail missing D7S')
if(failures.length){console.error('RC3-D7-S admin verification/audit i18n self-test: FAIL');for(const f of failures)console.error('- '+f);process.exit(1)}
console.log('RC3-D7-S admin verification/audit i18n self-test: PASS')
