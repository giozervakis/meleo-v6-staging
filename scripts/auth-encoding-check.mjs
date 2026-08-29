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
])

function suspiciousPairCount(text) {
  let total = 0

  const suspiciousFollower =
    /[\u039E\u039F](?:[\u0080-\u00FF\u0370-\u038F]|\u0152|\u0153|\u0160|\u0161|\u0178|\u017D|\u017E|\u0192|\u02C6|\u02DC|[\u2013-\u2022]|\u2026|\u2030|\u2039|\u203A|\u20AC|\u2122)/gu

  for (const line of text.split(/\r?\n/u)) {
    const matches = line.match(suspiciousFollower) || []

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

  const cleanUppercase = '\u03A0\u03A1\u039F\u03A4\u0391\u03A3\u0397 \u039A\u039F\u03A3\u03A4\u039F\u03A5\u03A3'

  const cleanForensicSamples =
    '\u039E\u03AD\u03C1\u03C9 \u039E\u03B5\u03BA\u03AF\u03BD\u03B1 ' +
    '\u0395\u03A0\u0395\u0399\u0393\u039F\u03A5\u03A3\u0391 \u0395\u039D\u0394\u0395\u0399\u039E\u0397 ' +
    '\u0395\u039E\u0391\u0399\u03A1\u0395\u03A3\u0395\u0399\u03A3 \u0397\u039C\u0395\u03A1\u039F\u039C\u0397\u039D\u0399\u0391\u03A3 ' +
    '\u03A0\u03A1\u039F\u0393\u03A1\u0391\u039C\u039C\u0391\u03A4\u0399\u03A3\u039C\u0395\u039D\u0397 \u039B\u0397\u039E\u0397 ' +
    '\u0391\u039E\u0399\u039F\u039B\u039F\u0393\u0397\u03A3\u0395\u0399\u03A3'

  const brokenWithoutC1 = String.fromCodePoint(
    0x039e, 0x00b5,
    0x039e, 0x00bd,
    0x039f, 0x0192
  )

  if (inspectText(clean).length !== 0) {
    throw new Error(
      'Encoding detector self-test rejected valid Greek'
    )
  }

  if (inspectText(cleanUppercase).length !== 0) {
    throw new Error(
      'Encoding detector self-test rejected valid uppercase Greek'
    )
  }

  if (inspectText(cleanForensicSamples).length !== 0) {
    throw new Error(
      'Encoding detector self-test rejected valid forensic Greek samples'
    )
  }

  if (inspectText(brokenWithoutC1).length === 0) {
    throw new Error(
      'Encoding detector self-test missed no-C1 mojibake'
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