import fs from 'node:fs'

const professional =
  'src/features/professional/ProfessionalDashboard.tsx'

const admin =
  'src/features/admin/AdminPage.tsx'

const versionFile =
  'src/version.ts'

const guardFile =
  'scripts/frontend-version-check.mjs'

function fail(message) {
  console.error('[FAIL]', message)
  process.exit(1)
}

function read(file) {
  return fs
    .readFileSync(file, 'utf8')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
}

function write(file, source) {
  fs.writeFileSync(
    file,
    source
      .replace(/\r\n/g, '\n')
      .replace(/\n*$/, '') + '\n',
    'utf8'
  )
}

function addImport(source) {
  const line =
    `import { APP_VERSION } from '../../version'`

  if (source.includes(line)) {
    return source
  }

  const matches =
    [...source.matchAll(/^import .*$/gm)]

  if (!matches.length) {
    fail('Could not locate import block')
  }

  const last =
    matches[matches.length - 1]

  const at =
    last.index + last[0].length

  return (
    source.slice(0, at) +
    '\n' +
    line +
    source.slice(at)
  )
}


// ------------------------------------------------------------
// 1. Canonical browser version
// package.json becomes the release source of truth.
// ------------------------------------------------------------

write(
  versionFile,
`import packageInfo from '../package.json'

export const APP_VERSION =
  packageInfo.version

export const APP_VERSION_LABEL =
  \`v\${APP_VERSION}\`
`
)

console.log(
  '[PASS] src/version.ts created'
)


// ------------------------------------------------------------
// 2. Professional Dashboard
// ------------------------------------------------------------

let pro =
  read(professional)

if (
  /Ξµ|Ξ±|Οƒ|Ο„|β™|Β«|Β»/.test(pro)
) {
  fail(
    'ProfessionalDashboard is still mojibake-corrupted after restore'
  )
}

pro =
  addImport(pro)

if (
  pro.includes(
    'MELEO Professional v5.0'
  )
) {
  pro =
    pro.replace(
      'MELEO Professional v5.0',
      'MELEO Professional v{APP_VERSION}'
    )
}
else if (
  pro.includes(
    'MELEO Professional v6.2.0'
  )
) {
  pro =
    pro.replace(
      'MELEO Professional v6.2.0',
      'MELEO Professional v{APP_VERSION}'
    )
}
else if (
  !pro.includes(
    'MELEO Professional v{APP_VERSION}'
  )
) {
  fail(
    'Could not locate Professional Dashboard version label'
  )
}

write(
  professional,
  pro
)

console.log(
  '[PASS] Professional version is dynamic'
)


// ------------------------------------------------------------
// 3. Admin Control Center
// ------------------------------------------------------------

let adm =
  read(admin)

adm =
  addImport(adm)

if (
  adm.includes(
    'eyebrow="MELEO v4 · FOUNDER & OPERATIONS"'
  )
) {
  adm =
    adm.replace(
      'eyebrow="MELEO v4 · FOUNDER & OPERATIONS"',
      'eyebrow={`MELEO v${APP_VERSION} · FOUNDER & OPERATIONS`}'
    )
}
else if (
  !adm.includes(
    'MELEO v${APP_VERSION} · FOUNDER & OPERATIONS'
  )
) {
  fail(
    'Could not locate Admin version label'
  )
}

write(
  admin,
  adm
)

console.log(
  '[PASS] Admin version is dynamic'
)


// ------------------------------------------------------------
// 4. CI architecture guard
// ------------------------------------------------------------

write(
  guardFile,
`import fs from 'node:fs'
import path from 'node:path'

const root = 'src/features'

const violations = []

function walk(dir) {
  for (
    const entry of fs.readdirSync(
      dir,
      { withFileTypes:true }
    )
  ) {
    const full =
      path.join(
        dir,
        entry.name
      )

    if (entry.isDirectory()) {
      walk(full)
      continue
    }

    if (
      !/\\.(tsx|ts)$/.test(entry.name) ||
      /\\.bak$/i.test(entry.name)
    ) {
      continue
    }

    const source =
      fs.readFileSync(
        full,
        'utf8'
      )

    const patterns = [
      /MELEO Professional v\\d+\\.\\d+(?:\\.\\d+)?/,
      /MELEO v\\d+(?:\\.\\d+){0,2}\\s*·\\s*FOUNDER/
    ]

    for (const re of patterns) {
      if (re.test(source)) {
        violations.push(
          \`\${full}: \${re}\`
        )
      }
    }
  }
}

walk(root)

if (violations.length) {
  console.error(
    'Hardcoded frontend release identity detected:'
  )

  for (const item of violations) {
    console.error(
      ' -',
      item
    )
  }

  process.exit(1)
}

console.log(
  'MELEO frontend version identity check: OK'
)
`
)

console.log(
  '[PASS] Frontend version CI guard created'
)
