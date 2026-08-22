// MELEO — επίπεδο αποθήκευσης (storage layer).
//
// Υποστηρίζονται δύο drivers, με ΤΟ ΙΔΙΟ async API:
//
//   1. postgres  — όταν υπάρχει DATABASE_URL. Είναι ο μόνος driver που
//                  υποστηρίζεται σε production: αντέχει πολλαπλά instances,
//                  έχει transactions και κανονικά backups (pg_dump).
//   2. json      — αρχείο db.json με atomic writes. ΜΟΝΟ για τοπική ανάπτυξη
//                  και δοκιμές. Ένα process κάθε φορά.
//
// Μοντέλο δεδομένων στην Postgres: ένας πίνακας `meleo_docs` με μία γραμμή ανά
// εγγραφή (collection, id, doc jsonb). Κάθε αίτημα που γράφει παίρνει advisory
// lock, διαβάζει φρέσκο snapshot, εκτελεί τη λογική και κάνει commit μόνο τις
// γραμμές που άλλαξαν. Έτσι ο κώδικας των endpoints δουλεύει με απλά objects,
// αλλά οι εγγραφές είναι ασφαλείς ακόμη και με πολλά instances πίσω από load
// balancer.
import fs from 'node:fs'
import path from 'node:path'
import { config } from './config.js'

export const COLLECTIONS = [
  'users', 'professionals', 'bookings', 'sessions', 'favorites', 'reviews',
  'verificationRequests', 'notifications', 'supportTickets', 'reports', 'payments',
  'subscriptions', 'tokens', 'webhookEvents', 'auditLog', 'verificationDocuments', 'professionalAnalytics', 'analyticsEvents'
]

export const emptyDb = () => Object.fromEntries(COLLECTIONS.map(c => [c, []]))

const clone = v => (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)))
const stable = v => JSON.stringify(v)

/* ------------------------------------------------------------------ *
 * Driver: JSON αρχείο (development)
 * ------------------------------------------------------------------ */

function jsonDriver() {
  const dataFile = path.join(config.dataDir, 'db.json')
  const backupFile = path.join(config.dataDir, 'db.backup.json')
  let queue = Promise.resolve()

  const readFile = () => {
    if (!fs.existsSync(dataFile)) return null
    try {
      return JSON.parse(fs.readFileSync(dataFile, 'utf8'))
    } catch (err) {
      if (fs.existsSync(backupFile)) {
        console.error('[MELEO] db.json κατεστραμμένο — ανάκτηση από db.backup.json')
        return JSON.parse(fs.readFileSync(backupFile, 'utf8'))
      }
      throw err
    }
  }

  const writeFile = db => {
    fs.mkdirSync(path.dirname(dataFile), { recursive: true })
    const tmp = `${dataFile}.${process.pid}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2))
    if (fs.existsSync(dataFile)) { try { fs.copyFileSync(dataFile, backupFile) } catch { /* best effort */ } }
    fs.renameSync(tmp, dataFile)
  }

  return {
    name: 'json',
    multiInstanceSafe: false,
    async init(initial) {
      if (!readFile()) writeFile(initial)
    },
    async snapshot() {
      return readFile() || emptyDb()
    },
    /** Σειριοποίηση εγγραφών μέσα στο process (Node = single threaded). */
    async begin() {
      let release
      const done = new Promise(r => { release = r })
      const prev = queue
      queue = queue.then(() => done)
      await prev
      return {
        db: readFile() || emptyDb(),
        async commit(db) { writeFile(db); release() },
        async rollback() { release() }
      }
    },
    async replaceAll(db) { writeFile(db) },
    async close() {}
  }
}

/* ------------------------------------------------------------------ *
 * Driver: PostgreSQL (production)
 * ------------------------------------------------------------------ */

const LOCK_KEY = 748213 // αυθαίρετο σταθερό κλειδί για pg_advisory_xact_lock

async function pgDriver() {
  const { default: pg } = await import('pg')
  const needsSsl = /[?&]sslmode=require/.test(config.databaseUrl) || config.databaseSsl
  const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    max: config.databasePoolMax,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    application_name: 'meleo'
  })
  pool.on('error', err => console.error('[MELEO] pg pool error:', err.message))

  const rowsToDb = rows => {
    const db = emptyDb()
    for (const r of rows) {
      if (!Array.isArray(db[r.collection])) db[r.collection] = []
      db[r.collection].push(r.doc)
    }
    return db
  }

  const snapshotFrom = async client => {
    const { rows } = await client.query('SELECT collection, doc FROM meleo_docs ORDER BY seq ASC')
    return rowsToDb(rows)
  }

  /** Γράφει ΜΟΝΟ ό,τι άλλαξε ανάμεσα στο snapshot και το τελικό αντικείμενο. */
  const persistDiff = async (client, before, after) => {
    for (const collection of Object.keys(after)) {
      const nextRows = Array.isArray(after[collection]) ? after[collection] : []
      const prevMap = new Map((before[collection] || []).map(d => [String(d?.id), d]))
      const seen = new Set()
      for (const doc of nextRows) {
        if (!doc || typeof doc !== 'object') continue
        const key = String(doc.id)
        seen.add(key)
        const prev = prevMap.get(key)
        if (prev && stable(prev) === stable(doc)) continue
        await client.query(
          `INSERT INTO meleo_docs (collection, id, doc, updated_at) VALUES ($1,$2,$3,now())
           ON CONFLICT (collection, id) DO UPDATE SET doc = EXCLUDED.doc, updated_at = now()`,
          [collection, key, doc]
        )
      }
      const removed = [...prevMap.keys()].filter(k => !seen.has(k))
      if (removed.length) {
        await client.query('DELETE FROM meleo_docs WHERE collection = $1 AND id = ANY($2::text[])', [collection, removed])
      }
    }
  }

  return {
    name: 'postgres',
    multiInstanceSafe: true,
    async init(initial) {
      const client = await pool.connect()
      try {
        // Το CREATE TABLE IF NOT EXISTS ΔΕΝ είναι race-safe: αν δύο instances
        // ξεκινήσουν ταυτόχρονα, το ένα σκάει με duplicate key. Σειριοποιούμε
        // το schema setup με advisory lock και ανεχόμαστε τα σφάλματα
        // «υπάρχει ήδη» (42P07/42710/23505).
        await client.query('BEGIN')
        await client.query('SELECT pg_advisory_xact_lock($1)', [LOCK_KEY + 1])
        const ddl = [
          `CREATE TABLE IF NOT EXISTS meleo_docs (
            collection text NOT NULL,
            id         text NOT NULL,
            doc        jsonb NOT NULL,
            seq        bigserial,
            updated_at timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY (collection, id)
          )`,
          'CREATE INDEX IF NOT EXISTS meleo_docs_collection_idx ON meleo_docs (collection)',
          `CREATE TABLE IF NOT EXISTS meleo_meta (key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`
        ]
        for (const sql of ddl) await client.query(sql)
        const { rows } = await client.query('SELECT count(*)::int AS n FROM meleo_docs')
        if (rows[0].n === 0) await persistDiff(client, emptyDb(), initial)
        await client.query('COMMIT')
      } catch (err) {
        try { await client.query('ROLLBACK') } catch { /* ignore */ }
        if (['42P07', '42710', '23505'].includes(err?.code)) {
          // Το schema δημιουργήθηκε από άλλο instance την ίδια στιγμή.
          console.warn('[MELEO] schema δημιουργήθηκε παράλληλα από άλλο instance — συνεχίζουμε.')
        } else throw err
      } finally {
        client.release()
      }
    },
    async snapshot() {
      const client = await pool.connect()
      try { return await snapshotFrom(client) } finally { client.release() }
    },
    async begin() {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query('SELECT pg_advisory_xact_lock($1)', [LOCK_KEY])
        const db = await snapshotFrom(client)
        const before = clone(db)
        let settled = false
        return {
          db,
          async commit(final) {
            if (settled) return
            settled = true
            try {
              await persistDiff(client, before, final)
              await client.query('COMMIT')
            } catch (err) {
              try { await client.query('ROLLBACK') } catch { /* ignore */ }
              throw err
            } finally { client.release() }
          },
          async rollback() {
            if (settled) return
            settled = true
            try { await client.query('ROLLBACK') } catch { /* ignore */ } finally { client.release() }
          }
        }
      } catch (err) {
        client.release()
        throw err
      }
    },
    async replaceAll(db) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query('SELECT pg_advisory_xact_lock($1)', [LOCK_KEY])
        const before = await snapshotFrom(client)
        await persistDiff(client, before, db)
        await client.query('COMMIT')
      } catch (err) {
        try { await client.query('ROLLBACK') } catch { /* ignore */ }
        throw err
      } finally { client.release() }
    },
    async close() { await pool.end() }
  }
}

/* ------------------------------------------------------------------ *
 * Δημόσιο API
 * ------------------------------------------------------------------ */

let driver = null

export function storeInfo() {
  return { driver: driver?.name || 'uninitialised', multiInstanceSafe: !!driver?.multiInstanceSafe }
}

export async function initStore(initial = emptyDb()) {
  driver = config.databaseUrl ? await pgDriver() : jsonDriver()
  if (!config.databaseUrl && config.isProd) {
    throw new Error('DATABASE_URL δεν έχει οριστεί. Σε production απαιτείται PostgreSQL — ο JSON driver δεν υποστηρίζεται.')
  }
  await driver.init(initial)
  return driver
}

export const snapshot = () => driver.snapshot()
export const begin = () => driver.begin()
export const replaceAll = db => driver.replaceAll(db)
export const closeStore = async () => { if (driver) await driver.close(); driver = null }
