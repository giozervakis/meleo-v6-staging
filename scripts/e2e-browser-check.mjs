import { spawnSync } from 'node:child_process'
try{await import('@playwright/test')}catch{console.error('Playwright δεν είναι εγκατεστημένο. Τρέξε: npm install -D @playwright/test && npx playwright install chromium');process.exit(2)}
const r=spawnSync(process.platform==='win32'?'npx.cmd':'npx',['playwright','test'],{stdio:'inherit',env:process.env});process.exit(r.status??1)
