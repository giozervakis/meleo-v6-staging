# MELEO v5.3 — Production Object Storage Deployment

Use a **private** S3-compatible bucket dedicated to verification documents. Create credentials restricted to that bucket only and allow the minimum object actions needed by MELEO (read, write, delete, and bucket/head access). Do not expose the bucket as a static website and do not grant public read.

Set the v5.3 variables in `.env` before starting the production compose stack. `SENSITIVE_DATA_KEY` must remain stable and securely backed up: it encrypts the file contents before upload. Losing or changing it without a rotation/migration procedure makes existing encrypted documents unreadable.

Run:

```bash
docker compose up -d --build
docker compose ps
curl https://YOUR_DOMAIN/api/ready
```

`/api/ready` must report `objectStorage: true`. `/api/health` reports `documents: "s3"` in production.

For development, `docker-compose.dev.yml` intentionally keeps `STORAGE_DRIVER=local`, so developers do not need cloud credentials.
