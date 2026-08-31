import fs from 'node:fs'

const app = fs.readFileSync('src/App.tsx','utf8')
const i18n = fs.readFileSync('src/i18n.ts','utf8')
const pkg = JSON.parse(fs.readFileSync('package.json','utf8'))

const failures = []
const need = (ok,msg) => { if(!ok) failures.push(msg) }

need(app.includes("t('professional.lifecycle.'+s"), 'professional lifecycle must use i18n')
need(app.includes("t('professional.pricing.contact')"), 'priceLabel contact must use i18n')
need(app.includes("t('professional.pricing.contactNote')"), 'priceNote must use i18n')
need(app.includes("t('professional.pricing.professionalOnly')"), 'Pricing role toast missing')
need(app.includes("t('professional.pricing.kicker')"), 'Pricing title block missing')
need(app.includes("t('professional.pricing.recommended')"), 'Pricing recommendation label missing')
need(app.includes("t('professional.pricing.activePlan')"), 'Pricing CTA state missing')
need(app.includes("t('professional.pricing.premiumNote')"), 'Premium note missing')
need(app.includes("t('professional.pricing.legalTitle')"), 'Pricing legal title missing')
need(app.includes("t('professional.pricing.legalBilling')"), 'Pricing legal billing copy missing')
need(app.includes("t('professional.pricing.legalNoCommission')"), 'Pricing legal no-commission copy missing')

const start = app.indexOf('function Pricing(')
const end = app.indexOf('function ', start + 'function Pricing('.length)
need(start >= 0 && end > start, 'Pricing block boundaries missing')
if(start >= 0 && end > start){
  const block = app.slice(start,end)
  need(!/[\u0370-\u03FF\u1F00-\u1FFF]/u.test(block), 'Greek hard-coded text remains in Pricing block')
}

need(i18n.includes('professional:{lifecycle:'), 'professional i18n namespace missing')
need(i18n.includes("premiumNote:"), 'premiumNote translation missing')
need(i18n.includes("features:{publicProfile:"), 'pricing features translations missing')

need(pkg.scripts?.['rc3-d5y-check'] === 'node scripts/rc3-d5y-pricing-professional-i18n-selftest.mjs',
  'rc3-d5y-check package script missing')
need(pkg.scripts?.['ci:gate']?.includes('npm run rc3-d5x-check && npm run rc3-d5y-check'),
  'ci:gate must append D5Y after D5X')

if(failures.length){
  console.error('RC3-D5-Y pricing/professional i18n self-test: FAIL')
  for(const f of failures) console.error(`- ${f}`)
  process.exit(1)
}
console.log('RC3-D5-Y pricing/professional i18n self-test: PASS')