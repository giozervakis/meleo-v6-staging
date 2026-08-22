import pg from 'pg'
const url=process.env.DATABASE_URL;if(!url)throw new Error('DATABASE_URL required')
const db=new pg.Client({connectionString:url});await db.connect()
const {rows}=await db.query(`SELECT status,count(*)::int n FROM background_jobs GROUP BY status ORDER BY status`)
console.table(rows);await db.end()
