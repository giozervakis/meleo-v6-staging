# MELEO v6.1.2

Release date: 2026-08-26

## Runtime resilience

- Graceful SIGTERM/SIGINT shutdown.
- Readiness transitions to draining during shutdown.
- HTTP server stops accepting new connections.
- SSE clients are closed before HTTP drain completion.
- Idle keep-alive connections are closed where supported.
- Redis connections are closed cleanly.
- PostgreSQL listener and pool are closed cleanly.
- Fatal process handlers added for uncaught exceptions and unhandled rejections.
- Forced shutdown safety timeout added.

## Production verification

Validated successfully with:

- TypeScript typecheck
- Vite production build
- Frontend architecture check
- Backend architecture check
- v5.5 quality architecture check
- v5.6 security/CI architecture check
- Secret scan
- Security self-test
- Production configuration self-test
- Docker runtime shutdown drill
- SIGTERM clean exit code 0
- API restart/recovery test
- Critical endpoint post-restart verification
- git diff --check
- GitHub MELEO CI
- GitHub MELEO Quality Gate
- Render staging deployment

## Release status

MELEO v6.1.2 runtime resilience: GREEN.
