# RC3-D9C - Production Configuration Completeness

## Objective

Move critical production dependencies from runtime assumptions to
explicit pre-boot release validation.

## Required production configuration

Production now requires the validator to confirm:

- HTTPS APP_URL
- PostgreSQL DATABASE_URL
- REDIS_URL
- REDIS_REQUIRED=1
- STORAGE_DRIVER=s3
- S3 endpoint, bucket and credentials
- ADMIN_PASSWORD
- ADMIN_TOTP_SECRET
- SENSITIVE_DATA_KEY
- OBSERVABILITY_TOKEN
- RESEND_API_KEY
- live Stripe configuration

## Security requirements

The validator also rejects:

- weak ADMIN_PASSWORD
- weak SENSITIVE_DATA_KEY
- insecure database TLS overrides
- DATABASE_SSL_REJECT_UNAUTHORIZED=false
- local production verification-document storage
- non-HTTPS production application URLs

## Result

A production process cannot pass the pre-boot configuration gate
with only safe defaults. The required infrastructure must actually
be configured.

RC3-D9C production configuration completeness: COMPLETE.
