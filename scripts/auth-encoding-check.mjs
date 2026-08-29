import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
)

const productionRoots = ['server/', 'src/']

const allowedExtensions = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.jsx',
  '.css'
])

const legacyDebt = new Set([
  'server/relational/repositories.js',
  'src/Account.tsx',
  'src/App.tsx',
  'src/features/admin/AdminPage.tsx',
  'src/features/home/HomeExperience.tsx',
  'src/features/professional/ProfessionalDashboard.tsx',
  'src/features/professional/availability/ProfessionalAvailability.tsx',
  'src/features/professional/billing/ProfessionalBilling.tsx',
  'src/features/professional/reputation/ProfessionalReputation.tsx',
  'src/features/professional/verification/ProfessionalVerification.tsx',
  'src/features/profile/Profile.tsx',
  'src/styles.css'
])

function suspiciousPairCount(text) {
  let total = 0

  for (const line of text.split(/\r?\n/u)) {
    const matches =
      line.match(/[\u039E\u039F][\u0370-\u03FF\u0080-\u00FF]/gu) || []

    if (matches.length >= 2) {
      total += matches.length
    }
  }

  return total
}

function inspectText(text) {
  const failures = []

  if (text.includes('\uFFFD')) {
    failures.push('contains Unicode replacement character U+FFFD')
  }

  if (/[\u0080-\u009F]/u.test(text)) {
    failures.push('contains suspicious C1 control characters')
  }

  const pairCount = suspiciousPairCount(text)

  if (pairCount > 0) {
    failures.push(
      'contains repeated Greek mojibake prefix pairs (' +
      pairCount +
      ')'
    )
  }

  return failures
}

function detectorSelfTest() {
  const clean =
    '\u039F \u03C4\u03C1\u03AD\u03C7\u03C9\u03BD \u03BA\u03C9\u03B4\u03B9\u03BA\u03CC\u03C2.'

  const broken = String.fromCodePoint(
    0x039e, 0x03bc,
    0x039e, 0x03b1,
    0x039f, 0x0083
  )

  if (inspectText(clean).length !== 0) {
    throw new Error(
      'Encoding detector self-test rejected valid Greek'
    )
  }

  if (inspectText(broken).length === 0) {
    throw new Error(
      'Encoding detector self-test failed to detect mojibake'
    )
  }
}

detectorSelfTest()

const tracked = execFileSync(
  'git',
  ['ls-files', '-z'],
  {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024
  }
)
  .split('\0')
  .filter(Boolean)

const failures = []
const observedDebt = new Set()

for (const relative of tracked) {
  const normalized =
    relative.replaceAll('\\', '/')

  if (
    !productionRoots.some(
      prefix => normalized.startsWith(prefix)
    )
  ) {
    continue
  }

  if (
    !allowedExtensions.has(
      path.extname(normalized).toLowerCase()
    )
  ) {
    continue
  }

  const absolute = path.join(root, relative)

  if (!fs.existsSync(absolute)) {
    continue
  }

  const text = fs.readFileSync(absolute, 'utf8')
  const fileFailures = inspectText(text)

  if (fileFailures.length === 0) {
    continue
  }

  if (legacyDebt.has(normalized)) {
    observedDebt.add(normalized)
    continue
  }

  for (const failure of fileFailures) {
    failures.push(
      normalized + ': ' + failure
    )
  }
}

for (const debtFile of legacyDebt) {
  if (!observedDebt.has(debtFile)) {
    failures.push(
      debtFile +
      ': legacy encoding debt allowlist entry is stale'
    )
  }
}

const authRelative =
  'server/routes/auth-account.routes.js'

const authText =
  fs.readFileSync(
    path.join(root, authRelative),
    'utf8'
  )

const requiredAuthEscapes = [
  "\\u03A3\\u03C5\\u03BC\\u03C0\\u03BB\\u03AE\\u03C1\\u03C9\\u03C3\\u03B5",
  "\\u039B\\u03AC\\u03B8\\u03BF\\u03C2 email",
  "\\u0391\\u03C0\\u03B1\\u03B9\\u03C4\\u03B5\\u03AF\\u03C4\\u03B1\\u03B9",
  "\\u039F \\u03C3\\u03CD\\u03BD\\u03B4\\u03B5\\u03C3\\u03BC\\u03BF\\u03C2"
]

for (const sentinel of requiredAuthEscapes) {
  if (!authText.includes(sentinel)) {
    failures.push(
      authRelative +
      ': repaired auth sentinel missing: ' +
      sentinel
    )
  }
}

const privacyRelative =
  'server/routes/account-privacy.routes.js'

const privacyText =
  fs.readFileSync(
    path.join(root, privacyRelative),
    'utf8'
  )

const requiredPrivacyEscapes = [
  "\\u039F \\u03C4\\u03C1\\u03AD\\u03C7\\u03C9\\u03BD \\u03BA\\u03C9\\u03B4\\u03B9\\u03BA\\u03CC\\u03C2",
  "\\u039B\\u03AC\\u03B8\\u03BF\\u03C2 \\u03BA\\u03C9\\u03B4\\u03B9\\u03BA\\u03CC\\u03C2",
  "\\u0397 \\u03B4\\u03B9\\u03B1\\u03B3\\u03C1\\u03B1\\u03C6\\u03AE \\u03B8\\u03B1 \\u03BF\\u03BB\\u03BF\\u03BA\\u03BB\\u03B7\\u03C1\\u03C9\\u03B8\\u03B5\\u03AF"
]

for (const sentinel of requiredPrivacyEscapes) {
  if (!privacyText.includes(sentinel)) {
    failures.push(
      privacyRelative +
      ': repaired privacy sentinel missing: ' +
      sentinel
    )
  }
}

if (inspectText(privacyText).length !== 0) {
  failures.push(
    privacyRelative +
    ': privacy route still has encoding corruption'
  )
}

if (failures.length) {
  console.error('')
  console.error(
    'MELEO production-source encoding integrity check FAILED'
  )
  console.error(
    '------------------------------------------------------'
  )

  for (const failure of failures) {
    console.error(' - ' + failure)
  }

  console.error('')
  process.exit(1)
}

console.log(
  'MELEO production-source encoding integrity check: OK'
)
console.log(
  'Known legacy encoding debt isolated: ' +
  observedDebt.size +
  ' files'
)