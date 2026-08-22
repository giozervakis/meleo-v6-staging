import {spawnSync} from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'
if (process.loadEnvFile && fs.existsSync('.env')) process.loadEnvFile('.env')
if(process.env.ALLOW_RESTORE_DRILL!=='YES'){console.error('Safety stop: set ALLOW_RESTORE_DRILL=YES explicitly. The drill must target a disposable database.');process.exit(1)}
const target=process.env.RESTORE_DATABASE_URL; if(!target){console.error('RESTORE_DATABASE_URL missing');process.exit(1)}
if(target===process.env.DATABASE_URL){console.error('Refusing restore drill: RESTORE_DATABASE_URL equals DATABASE_URL');process.exit(1)}
const backup=process.env.RESTORE_BACKUP_FILE || JSON.parse(fs.readFileSync('reports/backup-latest.json','utf8')).file
if(!fs.existsSync(backup)){console.error('Backup file not found:',backup);process.exit(1)}
const r=spawnSync('pg_restore',['--clean','--if-exists','--no-owner','--no-acl','--dbname',target,backup],{stdio:'inherit'})
if(r.error?.code==='ENOENT'){console.error('pg_restore not found. Install PostgreSQL client tools.');process.exit(1)}
if(r.status!==0) process.exit(r.status||1)
const report={version:'5.7.0',checkedAt:new Date().toISOString(),backup:path.resolve(backup),targetRedacted:new URL(target).host,passed:true};fs.mkdirSync('reports',{recursive:true});fs.writeFileSync('reports/restore-drill.json',JSON.stringify(report,null,2));console.log('Restore drill: PASS')
