# MELEO v6.2.0 — Disaster Recovery Policy

## Recovery objectives

Default production targets:

- Database backup evidence: maximum age 24 hours
- Restore-drill evidence: maximum age 7 days
- Restore RTO: maximum 900 seconds
- Production backups: remote/off-site storage required
- DR evidence: SHA-256 manifest
- Production evidence: HMAC-SHA256 signing required

## Evidence

The DR system consumes:

- `reports/backup-latest.json`
- `reports/restore-drill-latest.json`

It generates:

- `reports/dr-evidence-gate-latest.json`
- `reports/dr-evidence-manifest.json`

A release must not be promoted when DR evidence is missing, invalid,
stale or exceeds the configured recovery objective.

## Production policy

Production must define:

- `DR_OFFSITE_REQUIRED=true`
- `DR_OFFSITE_PROVIDER`
- `DR_OFFSITE_BUCKET`
- `DR_EVIDENCE_SIGNING_KEY`

The signing secret must not be stored in Git.

## Recommended cadence

Database backup:
- at least daily
- preferably every 6 hours once real customer data exists

Restore drill:
- automatically at least weekly

Production release:
- verify current backup evidence
- verify current restore-drill evidence
- verify RTO
- verify remote-copy configuration
- verify evidence signature

## Important

The existing MELEO database backup and restore scripts remain the
authoritative backup/restore implementation.

Part 3C deliberately adds enforcement around those scripts instead of
replacing a backup process already proven by the Part 3B restore drill.
