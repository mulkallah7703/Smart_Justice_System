# Production backup and restore

**Authoritative data**

| Store | Role |
|-------|------|
| **PostgreSQL** | Authoritative application data (users, cases, documents metadata, pages, chunks, jobs, …) |
| **MinIO / S3** | Authoritative uploaded file bytes (`storageKey`) |
| **Qdrant Cloud** | **Derived** vectors — rebuildable from TRUSTED `DocumentChunk` rows + OpenAI embeddings |
| **Redis** | Ephemeral queues/cache — not the system of record |

Backups described here are **manual / operator-driven** unless you add external automation.  
This repository does **not** claim automated backups are configured.

---

## PostgreSQL

### Backup

With production compose running:

```bash
docker compose -f infra/docker/docker-compose.production.yml \
  --env-file infra/docker/.env.production \
  exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc \
  > "sjs-pg-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Store the dump in encrypted off-host storage.

### Restore

1. Stop API and worker (avoid writes).  
2. Restore into an empty or replaced database volume (destructive — confirm).  

```bash
docker compose -f infra/docker/docker-compose.production.yml \
  --env-file infra/docker/.env.production \
  exec -T postgres \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists \
  < sjs-pg-YYYYMMDD.dump
```

3. Run `prisma migrate deploy` if schema lags.  
4. Start API/worker.  
5. Rebuild Qdrant vectors if needed (below).

---

## MinIO / object storage

MinIO data lives in Docker volume `sjs_prod_minio_data`.

### Backup (volume / `mc mirror`)

Example using MinIO client against the **internal** endpoint from a jump host or one-off container on the compose network:

```bash
mc alias set prod http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
mc mirror --overwrite prod/"$S3_BUCKET" /backup/sjs-documents/
```

Alternatively, snapshot the Docker volume with your host backup tool while containers are briefly quiesced.

### Restore

Mirror objects back into the bucket, or restore the volume snapshot, then verify document download via the API.

Restarting containers **must not** lose objects when the named volume is intact.

---

## Qdrant Cloud

### Backup

Use Qdrant Cloud’s snapshot / backup features in the Qdrant console for collection `legal_chunks_v1`.

### Rebuild strategy (application-level)

If vectors are lost but Postgres chunks remain:

1. Ensure payload indexes exist (`userId`, `trust`, `embeddingModel`, `pipelineVersion`) — created by `QdrantVectorStore.ensureCollection`.  
2. Re-queue document analysis / embedding for affected documents (TRUSTED chunks only).  
3. Arabic TEXT_LAYER and OCR remain `REVIEW_REQUIRED` and are **not** embedded (unchanged policy).

Vectors are **not** the source of truth for citation text — Postgres `DocumentChunk.text` is.

---

## Redis

### Persistence

Production compose runs Redis with `--appendonly yes` and a named volume.

### Recovery

- Lost Redis: queues reset; in-flight BullMQ jobs may need re-enqueue from Postgres `AiJob` rows still `PENDING`/`PROCESSING`.  
- Do not treat Redis as a backup of legal content.

---

## Suggested retention (operator policy)

| Asset | Suggested minimum |
|-------|-------------------|
| Postgres dumps | Daily, retain ≥ 14 days |
| MinIO / objects | Daily incremental + weekly full |
| Qdrant snapshots | Weekly or after large ingest batches |

Automate outside this repo (cron, cloud backup agent, etc.).

---

## Verification after restore

1. `/health/ready` → `ok`  
2. Login + `/users/me`  
3. Download a known document  
4. Retrieve/answer against a known embedded document  
5. Confirm IDOR: another user cannot see restored private evidence  
