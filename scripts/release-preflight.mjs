import fs from 'node:fs'
import path from 'node:path'

if (process.loadEnvFile && fs.existsSync('.env')) process.loadEnvFile('.env')
const env = process.env
const required = [
  'APP_URL','DATABASE_URL','REDIS_URL','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_BASIC','STRIPE_PRICE_PREMIUM','RESEND_API_KEY','ADMIN_PASSWORD',
  'ADMIN_TOTP_SECRET','SENSITIVE_DATA_KEY','OBSERVABILITY_TOKEN','LEGAL_COMPANY_NAME',
  'LEGAL_VAT_NUMBER','LEGAL_ADDRESS','DPO_EMAIL','S3_ENDPOINT','S3_BUCKET',
  'S3_ACCESS_KEY_ID','S3_SECRET_ACCESS_KEY'
]
const placeholders = /CHANGE_ME|ΑΛΛΑΞΕ|example\.com|your_|replace_|changeme/i
const failures=[]; const warnings=[]
if (env.NODE_ENV !== 'production') failures.push('NODE_ENV must be production')
for (const k of required) {
  const v=String(env[k]||'').trim()
  if (!v) failures.push(`${k} is missing`)
  else if (placeholders.test(v)) failures.push(`${k} still contains a placeholder`)
}
if (env.APP_URL && !/^https:\/\//i.test(env.APP_URL)) failures.push('APP_URL must use https://')
if (env.STORAGE_DRIVER !== 's3') failures.push('STORAGE_DRIVER must be s3 in production')
if (env.REDIS_REQUIRED !== '1') warnings.push('REDIS_REQUIRED should be 1')
if ((env.ADMIN_PASSWORD||'').length < 12) failures.push('ADMIN_PASSWORD must be at least 12 characters')
if ((env.SENSITIVE_DATA_KEY||'').length < 32) failures.push('SENSITIVE_DATA_KEY must be at least 32 characters')
if ((env.ADMIN_TOTP_SECRET||'').length < 16) failures.push('ADMIN_TOTP_SECRET looks too short')
if (!String(env.STRIPE_SECRET_KEY||'').startsWith('sk_live_')) warnings.push('Stripe secret key is not sk_live_; use test mode only for a pre-launch rehearsal')
if (!env.ADMIN_IP_ALLOWLIST) warnings.push('ADMIN_IP_ALLOWLIST is empty')
if (env.SEED_DEMO !== '0' || env.DEMO_AUTH !== '0' || env.DEMO_CHECKOUT !== '0') failures.push('All demo flags must be 0')
const packageInfo=JSON.parse(fs.readFileSync('package.json','utf8'))
const report={version:packageInfo.version,checkedAt:new Date().toISOString(),passed:failures.length===0,failures,warnings}
fs.mkdirSync('reports',{recursive:true}); fs.writeFileSync('reports/release-preflight.json',JSON.stringify(report,null,2))
console.log(`MELEO v${packageInfo.version} production preflight: ${report.passed?'PASS':'FAIL'}`)
for(const x of failures) console.error('  ✗',x)
for(const x of warnings) console.warn('  !',x)
process.exitCode=report.passed?0:1
