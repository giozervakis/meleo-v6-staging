const production =
  process.env.NODE_ENV ===
  'production'

const bool = value =>
  [
    '1',
    'true',
    'yes',
    'on'
  ].includes(
    String(value || '')
      .toLowerCase()
  )

const failures = []
const warnings = []

const backupMaxAge =
  Number(
    process.env
      .DR_BACKUP_MAX_AGE_HOURS ||
    24
  )

const restoreMaxAge =
  Number(
    process.env
      .DR_RESTORE_MAX_AGE_HOURS ||
    168
  )

const rto =
  Number(
    process.env
      .DR_MAX_RTO_SECONDS ||
    900
  )

if (
  !Number.isFinite(backupMaxAge) ||
  backupMaxAge <= 0 ||
  backupMaxAge > 72
) {
  failures.push(
    'DR_BACKUP_MAX_AGE_HOURS must be between 0 and 72'
  )
}

if (
  !Number.isFinite(restoreMaxAge) ||
  restoreMaxAge <= 0 ||
  restoreMaxAge > 720
) {
  failures.push(
    'DR_RESTORE_MAX_AGE_HOURS must be between 0 and 720'
  )
}

if (
  !Number.isFinite(rto) ||
  rto <= 0 ||
  rto > 3600
) {
  failures.push(
    'DR_MAX_RTO_SECONDS must be between 0 and 3600'
  )
}

if (production) {
  if (
    !bool(
      process.env
        .DR_OFFSITE_REQUIRED
    )
  ) {
    failures.push(
      'DR_OFFSITE_REQUIRED=true is required in production'
    )
  }

  if (
    String(
      process.env
        .DR_EVIDENCE_SIGNING_KEY ||
      ''
    ).length < 32
  ) {
    failures.push(
      'DR_EVIDENCE_SIGNING_KEY must be >=32 characters in production'
    )
  }

  const provider =
    String(
      process.env
        .DR_OFFSITE_PROVIDER ||
      ''
    )
      .trim()
      .toLowerCase()

  if (
    ![
      's3',
      'r2',
      'b2',
      'azure',
      'gcs'
    ].includes(provider)
  ) {
    failures.push(
      'DR_OFFSITE_PROVIDER must identify a supported remote object-storage provider'
    )
  }

  if (
    !process.env
      .DR_OFFSITE_BUCKET
  ) {
    failures.push(
      'DR_OFFSITE_BUCKET is required in production'
    )
  }
}

if (warnings.length) {
  console.warn(
    warnings
      .map(
        x=>`[WARN] ${x}`
      )
      .join('\n')
  )
}

if (failures.length) {
  console.error(
    failures
      .map(
        x=>`[FAIL] ${x}`
      )
      .join('\n')
  )

  process.exit(1)
}

console.log(
  '[PASS] DR policy configuration'
)
