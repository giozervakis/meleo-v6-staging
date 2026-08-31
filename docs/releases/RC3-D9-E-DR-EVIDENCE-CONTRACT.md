# RC3-D9E - DR Evidence Contract Hardening

## Objective

Eliminate schema and filename drift between backup, restore and
production release DR gates.

## Findings

Two release-critical contract mismatches were identified.

### Restore evidence filename

The restore drill generated:

`reports/restore-drill.json`

while the DR evidence gate consumed:

`reports/restore-drill-latest.json`

RC3-D9E standardizes the canonical artifact as:

`reports/restore-drill-latest.json`

The release GO/NO-GO matrix uses the same artifact.

### Off-site backup evidence

The backup producer records remote evidence under:

`backup.offsite`

inside the backup report.

The DR evidence consumer previously inspected only a top-level
`offsite` property.

RC3-D9E now consumes:

`backup.backup.offsite`

with legacy top-level fallback for compatibility.

## Existing DR guarantees preserved

The existing DR evidence gate continues to validate:

- backup freshness
- restore-drill freshness
- real backup artifact existence
- non-empty backup artifact
- SHA-256 integrity
- declared size consistency
- restore RTO
- restore-to-backup checksum identity
- production off-site backup policy
- signed DR evidence

## Release identity

The release DR gate now inherits the package version rather than
displaying historical version 6.2.0.

## Result

Backup producer, restore producer, DR evidence validator and
release GO/NO-GO now use one consistent evidence contract.

RC3-D9E DR evidence contract: COMPLETE.
