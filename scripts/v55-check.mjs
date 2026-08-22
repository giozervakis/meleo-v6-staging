import fs from 'node:fs'
const must=['scripts/e2e-critical.mjs','scripts/load-test-v55.mjs','scripts/load-stages.mjs','tests/e2e/auth.spec.ts','playwright.config.ts','PRODUCTION_TESTING_v5.5.md','V5.5_RELEASE_NOTES.md']
const missing=must.filter(x=>!fs.existsSync(x));if(missing.length){console.error('Missing:',missing.join(', '));process.exit(1)}
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));const required=['e2e','e2e:browser','loadtest','loadtest:stages'];const absent=required.filter(x=>!pkg.scripts?.[x]);if(absent.length){console.error('Missing scripts:',absent.join(', '));process.exit(1)}
const load=fs.readFileSync('scripts/load-test-v55.mjs','utf8');for(const term of ['P95_MAX_MS','ERROR_RATE_MAX','MIN_RPS','load-latest.json'])if(!load.includes(term)){console.error('Load gate missing:',term);process.exit(1)}
console.log('MELEO v5.5 quality architecture check: OK')
