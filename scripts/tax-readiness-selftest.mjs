import fs from 'node:fs'

const config = fs.readFileSync(
  new URL('../server/config.js', import.meta.url),
  'utf8'
)

const required = [
  "taxCode: String(process.env.STRIPE_TAX_CODE || '').trim()",
  "if (!config.stripe.collectTaxId) fatal.push('STRIPE_COLLECT_TAX_ID=1:",
  "if (!config.stripe.automaticTax) fatal.push('STRIPE_AUTOMATIC_TAX=1:",
  "if (!config.stripe.taxCode) fatal.push('STRIPE_TAX_CODE:"
]

for (const marker of required) {
  if (!config.includes(marker)) {
    throw new Error(`RC3-B5 missing production tax-readiness marker: ${marker}`)
  }
}

console.log('MELEO RC3-B5 production tax readiness self-test: OK')