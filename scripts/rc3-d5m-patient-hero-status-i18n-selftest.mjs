import fs from 'node:fs'

const read = p => fs.readFileSync(p,'utf8')
const fail = m => {
  console.error('RC3-D5-M FAIL - '+m)
  process.exit(1)
}

const x = read('src/features/patient/PatientDashboard.tsx')
const i = read('src/i18n.ts')
const p = JSON.parse(read('package.json'))

for (const q of [
  "t('patient.hero.journey.regular')",
  "t('patient.hero.journey.active')",
  "t('patient.hero.journey.started')",
  "t('patient.hero.journey.gettingStarted')",
  "t('patient.hero.attention',{count:needsAttention})",
  "t('patient.hero.upToDate')",
  "aria-label={t('patient.hero.memberAria')}",
  "aria-label={t('patient.metrics.aria')}"
]) {
  if (!x.includes(q)) fail('missing dashboard token: '+q)
}

for (const q of [
  "attention_one:",
  "attention_other:",
  "upToDate:",
  "memberAria:",
  "aria:'Personal care overview'",
  "attention_one:'{{count}} item needs attention'",
  "attention_other:'{{count}} items need attention'",
  "upToDate:'Everything is up to date'",
  "memberAria:'MELEO member details'"
]) {
  if (!i.includes(q)) fail('missing i18n token: '+q)
}

if (x.includes('aria-label="Personal care overview"')) {
  fail('hard-coded metrics aria remains')
}

if (
  p.scripts?.['rc3-d5m-check'] !==
  'node scripts/rc3-d5m-patient-hero-status-i18n-selftest.mjs'
) {
  fail('package script')
}

console.log('RC3-D5-M patient hero status i18n self-test: PASS')