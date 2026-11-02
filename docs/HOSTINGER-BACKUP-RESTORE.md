# Hostinger co-tenancy — backup and restore (project `pjsr`)

**Scope:** Compose project **`pjsr`** only (`infra/docker/docker-compose.hostinger.yml`).  
**Do not** use `sjs-prod` / `docker-compose.production.yml` commands on this VPS profile.  
**Do not** delete existing Docker volumes or prior backup files.  
**Do not** run host-wide `docker system prune` / `docker volume prune`.

Standard production backup docs (`docs/PRODUCTION-BACKUP-RESTORE.md`) remain valid for a dedicated `sjs-prod` host. This file is the authoritative procedure for Hostinger private-edge testing.

---

## Authoritative data (same model as production)

| Store | Volume / location | Role |
|-------|-------------------|------|
| **PostgreSQL** | `pjsr_pg_data` | System of record |
| **MinIO** | `pjsr_minio_data` | Uploaded object bytes |
| **Qdrant Cloud** | External | Derived vectors — rebuildable |
| **Redis** | `pjsr_redis_data` (AOF) | Queues/cache — **not** legal SoR |

---

## Preconditions

```bash
# Always pin project + file + env
export COMPOSE="docker compose -p pjsr -f infra/docker/docker-compose.hostinger.yml --env-file infra/docker/.env.hostinger"

# Confirm you are touching PJSR only
$COMPOSE ps
docker volume ls | grep pjsr_
```

Never substitute `sjs-prod` or omit `-p pjsr` on a shared Hostinger host.

---

## PostgreSQL

### Backup

```bash
mkdir -p /var/backups/pjsr
$COMPOSE exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc \
  > "/var/backups/pjsr/pjsr-pg-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Load `POSTGRES_*` from `.env.hostinger` (or export them) before substituting. Store dumps off-host when possible. **Never overwrite** an existing dump path without copying it aside first.

### Restore (destructive to DB contents — verify first)

1. **Verify the dump** (read-only):

```bash
pg_restore -l /var/backups/pjsr/pjsr-pg-YYYYMMDD.dump | head
# Or inside a throwaway container with the dump mounted — do not restore yet.
```

2. Stop writers (API + worker only — other host apps untouched):

```bash
$COMPOSE stop api worker
```

3. Restore into the **existing** `pjsr` Postgres (does **not** delete the volume):

```bash
$COMPOSE exec -T postgres \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists \
  < /var/backups/pjsr/pjsr-pg-YYYYMMDD.dump
```

4. Start API (runs `prisma migrate deploy` via entrypoint) then worker:

```bash
$COMPOSE start api
# wait until healthy
$COMPOSE start worker
```

5. Confirm `/health/ready` via the private edge / tunnel.

---

## MinIO / object storage

Volume name: **`pjsr_minio_data`** (not `sjs_prod_minio_data`).

### Backup (`mc mirror` from the compose network)

```bash
$COMPOSE run --rm --no-deps \
  -v /var/backups/pjsr/minio:/backup \
  --entrypoint /bin/sh minio-init -c '
    mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" &&
    mc mirror --overwrite "local/$S3_BUCKET" /backup/documents/
  '
```

Alternatively, quiesce MinIO briefly and snapshot volume `pjsr_minio_data` with the host backup tool. Prefer additive destination directories (timestamped), never `rm -rf` of prior backups.

### Restore

Mirror objects back into the bucket, or restore a volume snapshot onto **`pjsr_minio_data` only**. Then verify a known document download through the API. Do **not** point restore at SIDRA/DSM/other volumes.

---

## Redis

### What is persisted

Hostinger Redis runs with `--appendonly yes` on volume `pjsr_redis_data`, `maxmemory 192mb`, policy **`noeviction`** (BullMQ-safe).

### Backup / restore policy

| Action | Guidance |
|--------|----------|
| Routine backup of Redis RDB/AOF | **Optional.** Queues are ephemeral relative to Postgres `AiJob`. |
| After Redis loss | Accept empty queues; re-enqueue jobs still `PENDING` / stuck `PROCESSING` from Postgres. |
| Volume delete | **Forbidden** as a “cleanup” step on this shared host. |

Do not treat Redis dump/restore as recovery of legal content.

---

## Qdrant Cloud

Use Qdrant Cloud console snapshots for the configured collection. If vectors are lost but Postgres chunks remain, re-queue analysis for TRUSTED chunks (see `docs/PRODUCTION-BACKUP-RESTORE.md` rebuild strategy). Collection name comes from `AI_QDRANT_COLLECTION` in `.env.hostinger`.

---

## Safe verification before any restore

| Step | Check |
|------|--------|
| 1 | Backup file exists, size > 0, listing (`pg_restore -l` / `mc ls`) succeeds |
| 2 | Target project is `pjsr` (`$COMPOSE ps`); no `sjs-prod` containers involved |
| 3 | Target volumes are `pjsr_*` only |
| 4 | Copy of current dump/objects kept beside the restore source |
| 5 | API + worker stopped before Postgres `--clean` restore |
| 6 | After restore: `/health/ready`, login, download known document, sample retrieve |

---

## What never to run on this VPS for PJSR restore

```bash
# FORBIDDEN examples — do not use
docker volume rm pjsr_pg_data          # destroys live data
docker volume prune
docker system prune -a --volumes
docker compose -p sjs-prod ...         # wrong project on this profile
rm -rf /var/backups/pjsr               # destroys backup history
```
