import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
)

const target = path.join(
  root,
  'server',
  'routes',
  'auth-account.routes.js'
)

const buffer = fs.readFileSync(target)
const text = buffer.toString('utf8')
const failures = []

if (
  buffer.length >= 3 &&
  buffer[0] === 0xef &&
  buffer[1] === 0xbb &&
  buffer[2] === 0xbf
) {
  failures.push('auth-account.routes.js contains a UTF-8 BOM')
}

if (text.includes('\uFFFD')) {
  failures.push('auth-account.routes.js contains Unicode replacement characters')
}

if (/[\u0080-\u009F]/u.test(text)) {
  failures.push('auth-account.routes.js contains suspicious C1 control characters')
}

if (text.includes('\u039E')) {
  failures.push('auth-account.routes.js contains historical mojibake marker U+039E')
}

const requiredEscapes = [
  "\\u03A3\\u03C5\\u03BC\\u03C0\\u03BB\\u03AE\\u03C1\\u03C9\\u03C3\\u03B5",
  "\\u039B\\u03AC\\u03B8\\u03BF\\u03C2 email",
  "\\u0391\\u03C0\\u03B1\\u03B9\\u03C4\\u03B5\\u03AF\\u03C4\\u03B1\\u03B9",
  "\\u039F \\u03C3\\u03CD\\u03BD\\u03B4\\u03B5\\u03C3\\u03BC\\u03BF\\u03C2"
]

for (const sentinel of requiredEscapes) {
  if (!text.includes(sentinel)) {
    failures.push(
      'Expected repaired auth escape sentinel is missing: ' + sentinel
    )
  }
}

if (failures.length) {
  console.error('')
  console.error('MELEO auth encoding integrity check FAILED')
  console.error('------------------------------------------')

  for (const failure of failures) {
    console.error(' - ' + failure)
  }

  console.error('')
  process.exit(1)
}

console.log('MELEO auth encoding integrity check: OK')
