import fs from 'node:fs'

const app = fs.readFileSync('src/App.tsx','utf8')
const i18n = fs.readFileSync('src/i18n.ts','utf8')
const pkg = JSON.parse(fs.readFileSync('package.json','utf8'))

const failures = []
const need = (ok,msg) => { if(!ok) failures.push(msg) }

need(app.includes("t('global.loading')"), 'RouteFallback must use global.loading')
need(app.includes("t('global.identity.profileFallback')"), 'profile fallback must be localized')
need(app.includes("t('global.identity.avatarFallback')"), 'avatar fallback must be localized')
need(app.includes("i18n.t('global.errors.fileRead')"), 'file read helper error must be localized')
need(app.includes("i18n.t('global.errors.canvasUnavailable')"), 'canvas helper error must be localized')
need(app.includes("i18n.t('global.errors.imageLoad')"), 'image load helper error must be localized')

need(!app.includes("alt={name||'MELEO profile'}"), 'hard-coded profile fallback must be removed')
need(!app.includes("aria-label={name||'MELEO avatar'}"), 'hard-coded avatar fallback must be removed')
need(!app.includes("new Error('Canvas unavailable')"), 'hard-coded canvas error must be removed')

for (const token of [
  "global:{loading:",
  "profileFallback:",
  "avatarFallback:",
  "fileRead:",
  "canvasUnavailable:",
  "imageLoad:"
]) {
  need(i18n.includes(token), `missing i18n token: ${token}`)
}

need(pkg.scripts?.['rc3-d5x-check'] === 'node scripts/rc3-d5x-global-helper-i18n-selftest.mjs',
  'rc3-d5x-check package script missing')
need(pkg.scripts?.['ci:gate']?.includes('npm run rc3-d5w-check && npm run rc3-d5x-check'),
  'ci:gate must append D5X after D5W')

if(failures.length){
  console.error('RC3-D5-X global/helper i18n self-test: FAIL')
  for(const f of failures) console.error(`- ${f}`)
  process.exit(1)
}

console.log('RC3-D5-X global/helper i18n self-test: PASS')