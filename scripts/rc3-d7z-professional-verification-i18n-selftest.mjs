import fs from 'node:fs'

const app=
  fs.readFileSync(
    'src/features/professional/verification/ProfessionalVerification.tsx',
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

const need=(value,message)=>{
  if(!value){
    failures.push(message)
  }
}


for(const key of [
  'proVerification.errors.loadDocuments',
  'proVerification.errors.fileType',
  'proVerification.errors.fileSize',
  'proVerification.status.approved.label',
  'proVerification.status.pending.title',
  'proVerification.status.rejected.title',
  'proVerification.status.required.title',
  'proVerification.alerts.rejected.title',
  'proVerification.alerts.pending.title',
  'proVerification.readiness.membership.title',
  'proVerification.readiness.profile.title',
  'proVerification.readiness.verification.title',
  'proVerification.form.title',
  'proVerification.form.license.label',
  'proVerification.form.notes.label',
  'proVerification.form.submit.submit',
  'proVerification.guide.title',
  'proVerification.documents.title',
  'proVerification.documents.upload.add',
  'proVerification.documents.saved',
  'proVerification.footer'
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
  'locale selection missing'
)


need(
  app.includes(
    "dateLabel("
  ) &&
  app.includes(
    "document.createdAt,"
  ),
  'localized document date missing'
)


need(
  app.includes(
    'VERIFICATION_FILE_READ_ERROR'
  ),
  'stable file read error missing'
)


need(
  (
    i18n.match(
      /proVerification:\{/g
    )||[]
  ).length===2,
  'expected two proVerification namespaces'
)


need(
  pkg.scripts?.[
    'rc3-d7z-check'
  ]===
  'node scripts/rc3-d7z-professional-verification-i18n-selftest.mjs',
  'package D7Z script missing'
)


need(
  pkg.scripts?.[
    'ci:gate'
  ]?.includes(
    'npm run rc3-d7y-check && npm run rc3-d7z-check'
  ),
  'D7Z missing from CI chain'
)


if(failures.length){

  console.error(
    'RC3-D7-Z professional verification i18n self-test: FAIL'
  )

  failures.forEach(
    failure=>
      console.error(
        '- '+failure
      )
  )

  process.exit(1)
}


console.log(
  'RC3-D7-Z professional verification i18n self-test: PASS'
)
