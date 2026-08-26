import fs from 'node:fs'

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

function fail(message) {
  console.error('[FAIL]', message)
  process.exit(1)
}


// ============================================================
// VITE CONFIG
// ============================================================

const viteFile =
  'vite.config.ts'

let vite =
  read(viteFile)

if (
  !vite.includes(
    "import packageInfo from './package.json'"
  )
) {
  const reactImport =
    "import react from '@vitejs/plugin-react'"

  if (!vite.includes(reactImport)) {
    fail(
      'Could not locate Vite React import'
    )
  }

  vite =
    vite.replace(
      reactImport,
      `${reactImport}
import packageInfo from './package.json'`
    )
}

if (
  !vite.includes(
    "'__MELEO_APP_VERSION__'"
  )
) {
  const marker =
    `export default defineConfig({
  plugins: [react()],`

  if (!vite.includes(marker)) {
    fail(
      'Could not locate Vite config marker'
    )
  }

  vite =
    vite.replace(
      marker,
`export default defineConfig({
  plugins: [react()],

  define: {
    '__MELEO_APP_VERSION__':
      JSON.stringify(
        packageInfo.version
      )
  },`
    )
}

write(
  viteFile,
  vite
)

console.log(
  '[PASS] Vite compile-time version installed'
)


// ============================================================
// VERSION MODULE
// ============================================================

write(
  'src/version.ts',
`declare const __MELEO_APP_VERSION__: string

export const APP_VERSION =
  __MELEO_APP_VERSION__

export const APP_VERSION_LABEL =
  \`v\${APP_VERSION}\`
`
)

console.log(
  '[PASS] src/version.ts uses compile-time identity'
)


// ============================================================
// PACKAGE CI
// ============================================================

const packageFile =
  'package.json'

const pkg =
  JSON.parse(
    fs.readFileSync(
      packageFile,
      'utf8'
    )
  )

pkg.scripts =
  pkg.scripts || {}

pkg.scripts['frontend-version-check'] =
  'node scripts/frontend-version-check.mjs'

const oldGate =
  pkg.scripts['ci:gate']

if (!oldGate) {
  fail(
    'ci:gate script missing'
  )
}

if (
  !oldGate.includes(
    'npm run frontend-version-check'
  )
) {
  pkg.scripts['ci:gate'] =
    oldGate.replace(
      'npm run frontend-architecture-check',
      'npm run frontend-architecture-check && npm run frontend-version-check'
    )
}

write(
  packageFile,
  JSON.stringify(
    pkg,
    null,
    2
  )
)

console.log(
  '[PASS] frontend version guard added to CI'
)


// ============================================================
// package-lock root scripts/version synchronization
// npm install --package-lock-only will finalize it externally.
// ============================================================

console.log('')
console.log(
  'MELEO frontend version architecture finalized.'
)
