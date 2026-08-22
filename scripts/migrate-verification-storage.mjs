import fs from 'node:fs/promises'
import path from 'node:path'
import { config } from '../server/config.js'
import { many, sql, closePool } from '../server/relational/pool.js'
import { verificationObjectKey, putVerificationObject } from '../server/object-storage.js'

if (!config.databaseUrl) throw new Error('DATABASE_URL is required')
if (config.storage.driver !== 's3') throw new Error('Set STORAGE_DRIVER=s3 and S3 credentials before migration')

const root = path.resolve(config.security.verificationStorageDir)
const rows = await many('SELECT id, storage_key FROM verification_documents ORDER BY created_at ASC')
let migrated = 0, skipped = 0, missing = 0

try {
  for (const row of rows) {
    if (String(row.storage_key || '').startsWith('verification/')) { skipped++; continue }
    const candidates = [row.storage_key, `${row.id}.bin`].filter(Boolean).map(k => path.resolve(root, k))
    let encrypted = null
    for (const file of candidates) {
      if (!file.startsWith(root + path.sep)) continue
      try { encrypted = await fs.readFile(file); break } catch (e) { if (e?.code !== 'ENOENT') throw e }
    }
    if (!encrypted) { console.warn(`[storage:migrate] missing local object for ${row.id}`); missing++; continue }
    const newKey = verificationObjectKey(row.id)
    await putVerificationObject(newKey, encrypted)
    await sql('UPDATE verification_documents SET storage_key=$2 WHERE id=$1', [row.id, newKey])
    migrated++
    console.log(`[storage:migrate] ${row.id} -> ${newKey}`)
  }
  console.log(JSON.stringify({ migrated, skipped, missing, total: rows.length }, null, 2))
} finally { await closePool() }
