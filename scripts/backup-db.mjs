import {spawnSync} from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'
if (process.loadEnvFile && fs.existsSync('.env')) process.loadEnvFile('.env')
const url=process.env.DATABASE_URL; if(!url){console.error('DATABASE_URL missing');process.exit(1)}
const dir=process.env.BACKUP_DIR||path.resolve('backups'); fs.mkdirSync(dir,{recursive:true}); const stamp=new Date().toISOString().replace(/[:.]/g,'-'); const out=path.join(dir,`meleo-${stamp}.dump`)
const r=spawnSync('pg_dump',['--format=custom','--no-owner','--no-acl','--file',out,url],{stdio:'inherit'})
if(r.error?.code==='ENOENT'){console.error('pg_dump not found. Install PostgreSQL client tools on the backup host.');process.exit(1)}
if(r.status!==0) process.exit(r.status||1)
const meta={version:'5.7.0',createdAt:new Date().toISOString(),file:out,sizeBytes:fs.statSync(out).size,passed:true}; fs.mkdirSync('reports',{recursive:true});fs.writeFileSync('reports/backup-latest.json',JSON.stringify(meta,null,2));console.log('Backup created:',out)
