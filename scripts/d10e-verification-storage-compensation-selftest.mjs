import fs from 'node:fs'

const read=
  path=>
    fs.readFileSync(
      path,
      'utf8'
    )
      .replace(/^\\uFEFF/,'')
      .replace(/\\r\\n/g,'\\n')


function check(condition,message){

  if(!condition){

    console.error(
      '[FAIL]',
      message
    )

    process.exitCode=1
    return
  }

  console.log(
    '[PASS]',
    message
  )
}


const route=
  read(
    'server/routes/professional-verification.routes.js'
  )

const pkg=
  JSON.parse(
    read(
      'package.json'
    )
  )


const uploadStart=
  route.indexOf(
    "app.post('/api/professional/verification-document'"
  )

const listStart=
  route.indexOf(
    "app.get('/api/professional/verification-documents'",
    uploadStart
  )

const upload=
  (
    uploadStart>=0 &&
    listStart>uploadStart
  )
    ? route.slice(
        uploadStart,
        listStart
      )
    : ''


check(
  upload.length>0,
  'verification document upload route isolated'
)

check(
  upload.includes(
    'await putVerificationObject('
  ),
  'verification storage PUT preserved'
)

check(
  upload.includes(
    'INSERT INTO verification_documents'
  ),
  'verification metadata INSERT preserved'
)

check(
  upload.indexOf(
    'await putVerificationObject('
  ) <
  upload.indexOf(
    'INSERT INTO verification_documents'
  ),
  'storage PUT remains before metadata INSERT'
)

check(
  upload.includes(
    'let cleanupError=null'
  ),
  'compensation failure is explicitly tracked'
)

check(
  upload.includes(
    'await deleteVerificationObject('
  ),
  'compensating storage DELETE preserved'
)

check(
  upload.includes(
    'storageKey'
  ),
  'compensation targets original uploaded object'
)

check(
  upload.includes(
    "'db_insert_failed_cleanup_failed'"
  ),
  'orphan recovery reason is explicit'
)

check(
  upload.includes(
    "'verification.document.storage_cleanup_failed'"
  ),
  'compensation failure audit marker exists'
)

check(
  upload.includes(
    'professionalId:p.id'
  ),
  'recovery evidence contains professional identity'
)

check(
  upload.includes(
    'documentId:did'
  ),
  'recovery evidence contains document identity'
)

check(
  upload.includes(
    'storageKey'
  ),
  'recovery evidence contains storage key'
)

check(
  upload.includes(
    'console.error('
  ),
  'operational fallback exists when audit persistence is unavailable'
)

check(
  upload.includes(
    'throw e'
  ),
  'original database error remains authoritative'
)

check(
  !upload.includes(
    'throw cleanupError'
  ),
  'cleanup error does not replace original database error'
)

check(
  !upload.includes(
    'tx('
  ),
  'storage compensation does not open database transaction'
)

const putPos=
  upload.indexOf(
    'await putVerificationObject('
  )

const insertPos=
  upload.indexOf(
    'INSERT INTO verification_documents'
  )

const cleanupPos=
  upload.indexOf(
    'await deleteVerificationObject('
  )

const auditPos=
  upload.indexOf(
    "'verification.document.storage_cleanup_failed'"
  )

const rethrowPos=
  upload.lastIndexOf(
    'throw e'
  )

check(
  putPos>=0 &&
  insertPos>putPos &&
  cleanupPos>insertPos &&
  rethrowPos>cleanupPos,
  'external/local/compensation/rethrow ordering preserved'
)

check(
  auditPos>cleanupPos &&
  auditPos<rethrowPos,
  'failed compensation evidence is attempted before original rethrow'
)

check(
  pkg.scripts?.[
    'verification-storage-compensation-check'
  ] ===
    'node scripts/d10e-verification-storage-compensation-selftest.mjs',
  'D10E.10C package script exists'
)

const gate=
  pkg.scripts?.[
    'ci:gate'
  ]||
  ''

const previous=
  gate.indexOf(
    'npm run profile-photo-storage-compensation-check'
  )

const current=
  gate.indexOf(
    'npm run verification-storage-compensation-check'
  )

check(
  previous>=0 &&
  current>previous,
  'D10E.10C chained after D10E.10B'
)


if(!process.exitCode){

  console.log('')

  console.log(
    'MELEO D10E.10C verification storage compensation self-test: OK'
  )
}
