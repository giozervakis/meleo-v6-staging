import { migrate, closePool } from '../server/relational/pool.js'
try { await migrate(); console.log('MELEO v5 relational schema: OK') }
finally { await closePool() }
