# RC3-D9D - Infrastructure Readiness and Release Evidence

## Objective

Require fresh infrastructure evidence before production release GO.

## Live checks

RC3-D9D introduces an infrastructure readiness report covering:

- Redis endpoint connectivity
- Redis TLS authorization when using rediss
- S3 endpoint connectivity
- S3 HTTPS/TLS authorization
- required S3 bucket identity and credentials

The report is written to:

`reports/infrastructure-readiness.json`

## Release gate

The existing release GO/NO-GO evidence matrix now also requires:

- infrastructure readiness

The same evidence freshness policy applies.

## TLS report identity

The TLS/domain readiness report now inherits the version from
`package.json` rather than using the historical 5.7.0 identity.

## Result

Static production configuration is no longer sufficient for a release GO.

Fresh evidence must prove that required production infrastructure is
reachable before the release can be approved.

RC3-D9D infrastructure evidence: COMPLETE.
