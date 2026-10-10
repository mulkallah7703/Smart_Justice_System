# Backup and restore (operational)

Development and delivery environments for the Smart Judicial System.

## What to back up

| Asset | Why |
|-------|-----|
| PostgreSQL (`sjs_*`) | Authoritative users, cases, documents metadata, AI jobs, alerts, kiosk sessions, judicial cards |
| MinIO / S3 bucket | Document binaries referenced by `Document.storageKey` |
| Qdrant storage (if `AI_VECTOR_STORE_MODE=qdrant`) | Vector index; can be rebuilt from trusted chunks + embeddings, but restore is faster |
| Redis AOF/RDB (optional) | Queue durability only; jobs can be re-enqueued. Prefer short RPO, not long-term archive |

Do **not** back up as secrets in git: `.env`, JWT secrets, OpenAI keys, MinIO root passwords.

## Suggested cadence (manager demo / staging)

- **PostgreSQL**: daily dump; before any migration
- **MinIO/S3**: daily or continuous versioning if the object store supports it
- **Qdrant**: weekly snapshot, or after large embedding backfills
- **Retention**: keep at least 7 daily + 4 weekly PostgreSQL dumps

## PostgreSQL dump (example)

```bash
# From a host that can reach Postgres (localhost binding in docker-compose.dev.yml)
pg_dump -h 127.0.0.1 -U sjs -d sjs_dev -Fc -f sjs_dev_$(date +%Y%m%d).dump
```

## PostgreSQL restore (example)

```bash
# Prefer restore into an empty database; stop API/worker first
pg_restore -h 127.0.0.1 -U sjs -d sjs_dev --clean --if-exists sjs_dev_YYYYMMDD.dump
cd backend
npx prisma migrate status
npx prisma generate
```

## MinIO / S3

Use `mc mirror` or cloud-native bucket replication. After restore, verify a known `storageKey` downloads through `GET /api/v1/documents/:id/download` with a JWT that owns the document.

## Qdrant

Use Qdrant snapshots (`POST /collections/{name}/snapshots`) or volume backup of `qdrant/storage`. After restore, confirm `AI_QDRANT_COLLECTION` and `AI_EMBEDDING_DIMENSIONS` still match.

## Restore drill

At least once before production cutover:

1. Restore Postgres + MinIO into a scratch environment
2. Start API + worker with staging secrets
3. Login → list cases → download one document → open judicial card
4. Confirm `/health` and `/health/ready` return ok

## Out of scope

Automated multi-region DR, PITR platforms, and payment settlement backups are not part of this phase.
