import fs from 'node:fs'
import process from 'node:process'

const required=['render.yaml','scripts/render-staging-start.mjs','server/config.js','server/relational/app.js']
const missing=required.filter(x=>!fs.existsSync(x))
const cfg=fs.readFileSync('server/config.js','utf8')
const app=fs.readFileSync('server/relational/app.js','utf8')
const yaml=fs.readFileSync('render.yaml','utf8')
const errors=[...missing.map(x=>`missing ${x}`)]
if(!cfg.includes("const isStaging = NODE_ENV === 'staging'"))errors.push('staging environment detection missing')
if(!cfg.includes('RENDER_EXTERNAL_HOSTNAME'))errors.push('automatic Render APP_URL fallback missing')
if(!app.includes('config.isHosted&&fs.existsSync(dist)'))errors.push('hosted static frontend serving missing')
if(!yaml.includes('plan: free'))errors.push('free plan not declared')
if(!yaml.includes('meleo-staging-db'))errors.push('staging postgres missing')
if(!yaml.includes('meleo-staging-redis'))errors.push('staging redis missing')
if(errors.length){console.error('MELEO Render staging check: FAIL\n'+errors.map(x=>' - '+x).join('\n'));process.exit(1)}
console.log('MELEO Render staging check: OK')
