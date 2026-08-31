import fs from 'node:fs'

const src=fs.readFileSync(
  'src/features/support/SupportPages.tsx',
  'utf8'
)

const i18n=fs.readFileSync(
  'src/i18n.ts',
  'utf8'
)

const pkg=JSON.parse(
  fs.readFileSync(
    'package.json',
    'utf8'
  )
)

const failures=[]

function need(v,m){
  if(!v){
    failures.push(m)
  }
}

for(const key of [
 'supportPages.notifications.hero.title',
 'supportPages.notifications.filters.all',
 'supportPages.notifications.time.minutes',
 'supportPages.notifications.markAll',
 'supportPages.notifications.live.title',
 'supportPages.help.title',
 'supportPages.help.quick.bookingQ',
 'supportPages.help.create.title',
 'supportPages.help.categories.billing',
 'supportPages.help.reply.placeholder'
]){
 need(
  src.includes(key),
  'missing '+key
 )
}

need(
 src.includes('{n.title}'),
 'notification backend title changed'
)

need(
 src.includes('{n.text}'),
 'notification backend text changed'
)

need(
 src.includes('{m.text}'),
 'ticket message body changed'
)

need(
 src.includes('{t.status}'),
 'ticket status domain value changed'
)

need(
 (
  i18n.match(
   /supportPages:\{/g
  )||[]
 ).length===2,
 'expected two supportPages namespaces'
)

need(
 pkg.scripts?.['rc3-d8c-check']===
 'node scripts/rc3-d8c-support-pages-i18n-selftest.mjs',
 'D8C package script missing'
)

need(
 pkg.scripts?.['ci:gate']?.includes(
  'npm run rc3-d8b-check && npm run rc3-d8c-check'
 ),
 'D8C missing after D8B in CI gate'
)

if(failures.length){
 console.error(
  'RC3-D8-C support pages i18n self-test: FAIL'
 )

 for(const f of failures){
  console.error('- '+f)
 }

 process.exit(1)
}

console.log(
 'RC3-D8-C support pages i18n self-test: PASS'
)
