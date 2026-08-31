import fs from 'node:fs'

const app=
  fs.readFileSync(
    'src/features/professional/notifications/ProfessionalNotifications.tsx',
    'utf8'
  )

const i18n=
  fs.readFileSync(
    'src/i18n.ts',
    'utf8'
  )

const pkg=
  JSON.parse(
    fs.readFileSync(
      'package.json',
      'utf8'
    )
  )

const failures=[]

function need(value,message){
  if(!value){
    failures.push(message)
  }
}

for(const key of [
  'proNotifications.errors.load',
  'proNotifications.errors.markRead',
  'proNotifications.errors.markAllRead',
  'proNotifications.toast.allRead',
  'proNotifications.types.support',
  'proNotifications.types.request',
  'proNotifications.types.review',
  'proNotifications.types.verification',
  'proNotifications.types.subscription',
  'proNotifications.hero.title',
  'proNotifications.hero.total',
  'proNotifications.filters.all',
  'proNotifications.filters.unread',
  'proNotifications.search.placeholder',
  'proNotifications.actions.markAllRead',
  'proNotifications.actions.markRead',
  'proNotifications.actions.read',
  'proNotifications.loading',
  'proNotifications.empty.unread',
  'proNotifications.empty.all',
  'proNotifications.empty.text',
  'proNotifications.fallbackTitle'
]){
  need(
    app.includes(key),
    'missing '+key
  )
}

need(
  app.includes(
    "const {t,i18n}=useTranslation()"
  ),
  'translator missing'
)

need(
  app.includes(
    "i18n.resolvedLanguage==='en'"
  ),
  'locale selector missing'
)

need(
  app.includes(
    'query.trim().toLocaleLowerCase(locale)'
  ),
  'localized query normalization missing'
)

need(
  app.includes(
    '.toLocaleLowerCase(locale)'
  ),
  'localized item normalization missing'
)

need(
  app.includes(
    'createdAt(item),'
  ) &&
  app.includes(
    'locale'
  ),
  'localized date rendering missing'
)

need(
  (
    i18n.match(
      /proNotifications:\{/g
    )||[]
  ).length===2,
  'expected two proNotifications namespaces'
)

need(
  pkg.scripts?.[
    'rc3-d8a-check'
  ]===
  'node scripts/rc3-d8a-professional-notifications-i18n-selftest.mjs',
  'package D8A script missing'
)

need(
  pkg.scripts?.[
    'ci:gate'
  ]?.includes(
    'npm run rc3-d7z-check && npm run rc3-d8a-check'
  ),
  'D8A missing after D7Z in CI gate'
)

if(failures.length){
  console.error(
    'RC3-D8-A professional notifications i18n self-test: FAIL'
  )

  for(const failure of failures){
    console.error(
      '- '+failure
    )
  }

  process.exit(1)
}

console.log(
  'RC3-D8-A professional notifications i18n self-test: PASS'
)
