import fs from 'node:fs';
const must=['.github/workflows/quality-gate.yml','scripts/secret-scan.mjs','SECURITY_HARDENING_v5.6.md','V5.6_RELEASE_NOTES.md'];const miss=must.filter(x=>!fs.existsSync(x));if(miss.length){console.error('Missing:',miss.join(', '));process.exit(1)}
const a=fs.readFileSync('server/relational/app.js','utf8'),c=fs.readFileSync('server/config.js','utf8'),d=fs.readFileSync('docker-compose.yml','utf8'),p=JSON.parse(fs.readFileSync('package.json','utf8'));
for(const x of ['loginAccount','adminIpGuard','security.admin_login_failed','/api/me/sessions','ADMIN_SESSION_TTL_MS'])if(!a.includes(x)){console.error('Security control missing:',x);process.exit(1)}
for(const x of ['ADMIN_IP_ALLOWLIST','ADMIN_SESSION_TTL_HOURS','ADMIN_BIND_USER_AGENT'])if(!c.includes(x)){console.error('Config missing:',x);process.exit(1)}
if(!d.includes('cap_drop:')||!d.includes('read_only: true')){console.error('Container hardening missing');process.exit(1)}
for(const x of ['security:secrets','security:audit','ci:gate'])if(!p.scripts?.[x]){console.error('Script missing:',x);process.exit(1)}console.log('MELEO v5.6 security/CI architecture check: OK')
