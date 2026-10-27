# PJSR — Production Deployment

Commands match this repository. Replace hostnames and secrets; never commit secrets.

**Deferred:** Nafath (`NAFATH_MODE=inactive`) · Payment (`PAYMENT_PROVIDER=deferred`) — not required for boot or readiness.

---

## 1. Server requirements

| Resource | Guidance |
|----------|----------|
| OS | Linux x86_64 (Ubuntu 22.04+ or similar) |
| CPU / RAM | ≥ 4 vCPU, ≥ 8 GB RAM (worker OCR + Nest) |
| Disk | ≥ 40 GB SSD (Postgres + MinIO volumes) |
| Software | Docker Engine 24+, Docker Compose v2, optional Certbot |
| Network | Public 80/443 only; DNS for the app hostname |
| External | OpenAI API key; Qdrant Cloud cluster URL + API key |

---

## 2. Architecture (runtime)

```
Browser → Nginx (TLS) → Frontend (static)
                      → Nest API → Postgres / Redis / MinIO
                                 → BullMQ → Nest AI Worker
                                              → OpenAI
                                              → Qdrant Cloud
```

Do **not** run `npm run dev` or Nest `--watch` in production.

---

## 3. Environment

```bash
cp infra/docker/.env.production.example infra/docker/.env.production
# Edit: passwords, JWT, CORS_ORIGINS, VITE_API_BASE_URL, OPENAI_*, AI_QDRANT_*
chmod 600 infra/docker/.env.production
```

Set these in `infra/docker/.env.production` (compose) and keep the same values in `backend/.env.production` if you run the API outside compose. Frontend `VITE_*` values are build args, not runtime env.

| Variable | Production value |
|----------|------------------|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Strong password; database name you choose |
| `DATABASE_URL` | Set by compose: `postgresql://…@postgres:5432/<db>?schema=public` |
| `REDIS_PASSWORD` | Strong password. Compose builds `REDIS_URL` |
| `S3_ACCESS_KEY` / `S3_SECRET` / `S3_BUCKET` | MinIO app key, not the root user. Endpoint inside compose is `http://minio:9000` |
| `JWT_ACCESS_SECRET` | Long random secret |
| `CORS_ORIGINS` | `https://<your-domain>` |
| `OPENAI_API_KEY` | Real key. `AI_PROVIDER_MODE=openai`, `AI_LLM_MODE=openai`, `AI_EMBEDDING_MODE=openai` |
| `AI_QDRANT_URL` / `AI_QDRANT_API_KEY` / `AI_QDRANT_COLLECTION` | Qdrant Cloud URL, key, collection `legal_chunks_v1`. `AI_VECTOR_STORE_MODE=qdrant` |
| `AI_TEXT_EXTRACTOR_MODE` | `pdf` |
| `AI_OCR_MODE` | `local` |
| `AI_OCR_LANG_PATH` | `.ocr-data` (image) or `/app/.ocr-data` (compose worker) |
| `AI_OCR_TESSDATA` | `fast` (default). `best` stays selectable and is slower without an accuracy gain on the real-document retest |
| `AI_ADVISOR_EXPERIMENTAL` | `true` (default). Document Q&A stays marked experimental |
| `VITE_API_MODE` | `real` |
| `VITE_API_BASE_URL` | `https://<your-domain>/api/v1` |
| `VITE_AI_ADVISOR_EXPERIMENTAL` | `true` so the static build shows the تجريبي badge |
| `NAFATH_MODE` | `inactive` — Nafath stays hidden and is not a boot dependency |
| `PAYMENT_PROVIDER` | `deferred` — payments stay hidden and are not a boot dependency |

See also `backend/.env.production.example` and `frontend/.env.production.example`.

---

## 4. TLS certificates

Follow `docs/HTTPS.md`. Place `fullchain.pem` and `privkey.pem` under
`infra/docker/certs/` (or set `TLS_CERTS_HOST_PATH`).

---

## 5. Validate compose (no deploy yet)

From **repository root**:

```bash
docker compose -f infra/docker/docker-compose.production.yml \
  --env-file infra/docker/.env.production \
  config
```

---

## 6. Build images

```bash
docker compose -f infra/docker/docker-compose.production.yml \
  --env-file infra/docker/.env.production \
  build
```

Equivalent manual builds:

```bash
docker build -f infra/docker/backend.Dockerfile -t sjs-api:local .
docker build -f infra/docker/worker.Dockerfile -t sjs-worker:local .
docker build -f infra/docker/frontend.Dockerfile \
  --build-arg VITE_API_MODE=real \
  --build-arg VITE_API_BASE_URL=https://app.example.com/api/v1 \
  -t sjs-frontend:local .
```

---

## 7. Startup order

Compose encodes dependencies. Conceptual order:

1. **Postgres**, **Redis**, **MinIO** healthy  
2. **minio-init** creates bucket  
3. **API** runs `npx prisma migrate deploy` then `node dist/main.js`  
4. **Worker** `node dist/worker.js` (after API healthy)  
5. **Frontend** static Nginx  
6. **Edge Nginx** publishes 80/443  

```bash
docker compose -f infra/docker/docker-compose.production.yml \
  --env-file infra/docker/.env.production \
  up -d
```

### Migrations

Production uses **Prisma migrate deploy** only (Prisma **5.22.0** via project lockfile).

- API image entrypoint: `backend/scripts/docker-api-entrypoint.sh`  
- **Do not** use `prisma db push` in production.

Manual (if needed):

```bash
docker compose -f infra/docker/docker-compose.production.yml \
  --env-file infra/docker/.env.production \
  run --rm api npx prisma migrate deploy
```

### Seeding

Do not seed production. `npm run seed` / `npx prisma db seed` loads demo users and is for development only. The API entrypoint runs migrations and does not seed.

### Services that must be up

| Service | Role | Production placement |
|---------|------|----------------------|
| Postgres 16 | Application data | Compose service `postgres`, private network |
| Redis | BullMQ and rate limits | Compose service `redis`, private network |
| S3 (MinIO) | Document bytes | Compose service `minio` plus `minio-init` bucket |
| Qdrant | Chunk vectors | External Qdrant Cloud (`AI_QDRANT_URL`), not in compose |
| API | Nest `node dist/main.js` | After migrate deploy |
| Worker | `node dist/worker.js` | OCR and AI jobs; no public port |
| Frontend | Static Nginx | Built with the `VITE_*` args above |
| Edge Nginx | HTTPS | Public 80/443 only. Certificate steps are in `docs/HTTPS.md` |

Point DNS for the app hostname at this host before issuing the certificate. The public origin is `https://<your-domain>`. Nafath and payments have no public screen in this launch: leave `NAFATH_MODE=inactive` and `PAYMENT_PROVIDER=deferred`.

---

## 8. Health checks

```bash
curl -fsS https://app.example.com/health
curl -fsS https://app.example.com/health/ready
curl -fsS https://app.example.com/readyz
```

Readiness requires Postgres, Redis, object storage, Qdrant (when mode=qdrant), and AI config shape.  
**Does not** require Nafath or Payment.

Worker has no HTTP port; confirm via logs and job completion.

---

## 9. Smoke test

Follow `docs/PRODUCTION-SMOKE-TEST.md`.

---

## 10. Rollback

1. Keep previous image tags (`IMAGE_TAG`).  
2. Re-deploy previous tag:

```bash
IMAGE_TAG=<previous> docker compose -f infra/docker/docker-compose.production.yml \
  --env-file infra/docker/.env.production \
  up -d
```

3. Database: restore from backup if a migration must be undone (`docs/PRODUCTION-BACKUP-RESTORE.md`).  
   Prefer forward-fix migrations; do not casually reset production DB.

---

## 11. What is not public

| Port / service | Exposure |
|----------------|----------|
| 5432 Postgres | Internal network only |
| 6379 Redis | Internal only |
| 9000/9001 MinIO | Internal only |
| Qdrant Cloud | External HTTPS; not hosted in compose |
| 80/443 Nginx | Public |

---

## 12. Dev vs production compose

| File | Purpose |
|------|---------|
| `infra/docker/docker-compose.dev.yml` | Local infra only (binds 127.0.0.1) |
| `infra/docker/docker-compose.production.yml` | Full stack for production-like deploy |
