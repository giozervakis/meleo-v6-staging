# MELEO Backup & Disaster Recovery Policy

Version: 6.2.0

## Scope

This policy covers the primary MELEO PostgreSQL database.

## Recovery Point Objective (RPO)

Target RPO: 24 hours.

A successful production database backup must therefore exist at least once
within every 24-hour period.

## Recovery Time Objective (RTO)

Target RTO: 30 minutes.

A restore drill passes only when:

1. The backup checksum is valid.
2. PostgreSQL accepts the dump.
3. Core MELEO tables are readable after restore.
4. Core table count queries succeed.
5. Total restore/verification time remains within the configured RTO.

## Backup format

PostgreSQL custom-format dumps are used with:

- no ownership restoration
- no ACL restoration
- SHA-256 integrity evidence

## Retention

Default retention:

- 14 days
- maximum 30 retained backup files

Whichever retention rule requires removal first may remove the backup.

## Restore safety

Restore drills MUST:

- target a disposable database
- never target DATABASE_URL
- require ALLOW_RESTORE_DRILL=YES
- verify SHA-256 before pg_restore
- use pg_restore --exit-on-error

## Evidence

Successful runs create:

- reports/backup-latest.json
- reports/restore-drill.json
- reports/restore-drill-latest.json

These files are consumed by MELEO release readiness gates.

## Production operations

Production backup storage must ultimately reside on encrypted,
access-controlled and off-host/offsite infrastructure supplied by the
production hosting environment.

Repository-local backups are intended for development and disaster-recovery
verification only and must not be treated as the sole production backup copy.
