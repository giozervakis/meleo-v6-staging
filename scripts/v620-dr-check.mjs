import fs from 'node:fs'


const backup =
  fs.readFileSync(
    'scripts/backup-db.mjs',
    'utf8'
  )

const restore =
  fs.readFileSync(
    'scripts/restore-drill.mjs',
    'utf8'
  )

const policy =
  fs.readFileSync(
    'DISASTER_RECOVERY.md',
    'utf8'
  )

const env =
  fs.readFileSync(
    '.env.example',
    'utf8'
  )


function assert(
  condition,
  message
) {

  if (!condition) {
    throw new Error(message)
  }
}


assert(
  backup.includes(
    "createHash("
  ),
  'backup SHA-256 missing'
)


assert(
  backup.includes(
    'BACKUP_RETENTION_DAYS'
  ),
  'backup retention days missing'
)


assert(
  backup.includes(
    'BACKUP_RETENTION_COUNT'
  ),
  'backup retention count missing'
)


assert(
  backup.includes(
    'backup-latest.json'
  ),
  'backup evidence missing'
)


assert(
  restore.includes(
    'integrity validation FAILED'
  ),
  'restore checksum enforcement missing'
)


assert(
  restore.includes(
    '--exit-on-error'
  ),
  'pg_restore fail-fast missing'
)


assert(
  restore.includes(
    'RESTORE_DATABASE_URL equals DATABASE_URL'
  ),
  'production restore safety guard missing'
)


assert(
  restore.includes(
    'coreTablesVerified'
  ),
  'post-restore core table verification missing'
)


assert(
  restore.includes(
    'BACKUP_RTO_MINUTES'
  ),
  'RTO enforcement missing'
)


assert(
  policy.includes(
    'Recovery Point Objective'
  ),
  'RPO policy missing'
)


assert(
  policy.includes(
    'Recovery Time Objective'
  ),
  'RTO policy missing'
)


assert(
  env.includes(
    'BACKUP_RPO_HOURS=24'
  ),
  'RPO env config missing'
)


assert(
  env.includes(
    'BACKUP_RTO_MINUTES=30'
  ),
  'RTO env config missing'
)


console.log(
  'MELEO v6.2 Backup/DR self-test: OK'
)
