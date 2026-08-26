import fs from 'node:fs'

const file =
  'scripts/backup-db.mjs'

let source =
  fs.readFileSync(
    file,
    'utf8'
  )
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')


function fail(message) {
  console.error(
    '[FAIL]',
    message
  )

  process.exit(1)
}


const importLine =
  `import { uploadBackupOffsite } from '../server/dr-offsite-storage.js'`

if (
  !source.includes(
    importLine
  )
) {
  const importMatches =
    [
      ...source.matchAll(
        /^import .*$/gm
      )
    ]

  if (
    !importMatches.length
  ) {
    fail(
      'Could not locate import block in backup-db.mjs'
    )
  }

  const last =
    importMatches[
      importMatches.length - 1
    ]

  const insertAt =
    last.index +
    last[0].length

  source =
    source.slice(
      0,
      insertAt
    ) +
    '\n' +
    importLine +
    source.slice(
      insertAt
    )
}


const reportMarker =
  `const report = {`

if (
  !source.includes(
    'uploadBackupOffsite({'
  )
) {
  const index =
    source.indexOf(
      reportMarker
    )

  if (
    index === -1
  ) {
    fail(
      'Could not locate backup report block'
    )
  }

  const block =
`let offsite

try {
  offsite =
    await uploadBackupOffsite({
      file:output,
      checksum
    })

  if (
    offsite.verified
  ) {
    console.log(
      '[PASS] Off-site backup verified'
    )

    console.log(
      'Remote object:',
      offsite.objectKey
    )
  }
  else {
    console.log(
      '[INFO] Off-site backup not required/configured in this environment'
    )
  }
}
catch (err) {
  console.error(
    '[FAIL] Off-site backup failed:',
    err?.message || String(err)
  )

  process.exitCode = 1
  throw err
}


`

  source =
    source.slice(0, index) +
    block +
    source.slice(index)
}


const compressedBlock =
`    compressed:
      true`

if (
  !source.includes(
    'offsite'
  )
) {
  fail(
    'Off-site upload block disappeared unexpectedly'
  )
}


if (
  !source.includes(
    `    offsite,`
  )
) {
  if (
    !source.includes(
      compressedBlock
    )
  ) {
    fail(
      'Could not locate backup metadata block'
    )
  }

  source =
    source.replace(
      compressedBlock,
`    compressed:
      true,

    offsite,`
    )
}


source =
  source
    .split('\n')
    .map(
      line =>
        line.replace(
          /[ \t]+$/,
          ''
        )
    )
    .join('\n')
    .replace(/\n*$/, '') +
    '\n'


fs.writeFileSync(
  file,
  source,
  'utf8'
)


console.log(
  '[PASS] backup-db.mjs imports DR off-site storage'
)

console.log(
  '[PASS] remote upload occurs before evidence report'
)

console.log(
  '[PASS] backup evidence records remote verification'
)
