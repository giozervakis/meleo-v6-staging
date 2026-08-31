import fs from 'node:fs'
const app=fs.readFileSync('src/App.tsx','utf8')
const i18n=fs.readFileSync('src/i18n.ts','utf8')
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
const failures=[]
const need=(ok,msg)=>{if(!ok)failures.push(msg)}
const start=app.indexOf('function InlineRegister(')
const end=app.indexOf('function MobileNav(',start)
need(start>=0&&end>start,'InlineRegister boundary missing')
const surface=start>=0&&end>start?app.slice(start,end):''
for(const key of ['professionalJoin.register.name','professionalJoin.register.email','professionalJoin.register.phone','professionalJoin.register.password','professionalJoin.register.passwordHint','professionalJoin.register.acceptPrefix','professionalJoin.register.terms','professionalJoin.register.and','professionalJoin.register.privacy','professionalJoin.register.submitting','professionalJoin.register.submit','professionalJoin.register.afterCreate']) need(surface.includes(`t('${key}')`),`missing ${key}`)
need(surface.includes('const {t}=useTranslation()'),'InlineRegister translator missing')
need(!/[\u0370-\u03ff\u1f00-\u1fff]/.test(surface),'Greek literal remains in InlineRegister')
need(i18n.includes("register:{name:'Full name'"),'English register translations missing')
need(pkg.scripts?.['rc3-d7c-check']==='node scripts/rc3-d7c-inline-register-i18n-selftest.mjs','rc3-d7c-check package script missing')
need(pkg.scripts?.['ci:gate']?.includes('npm run rc3-d7b-check && npm run rc3-d7c-check'),'ci:gate must append D7C after D7B')
if(failures.length){console.error('RC3-D7-C inline register i18n self-test: FAIL');for(const f of failures)console.error(`- ${f}`);process.exit(1)}
console.log('RC3-D7-C inline register i18n self-test: PASS')
