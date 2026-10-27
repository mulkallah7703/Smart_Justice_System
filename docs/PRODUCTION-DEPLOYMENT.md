# PJSR — Production Deployment

Commands match this repository. Replace hostnames and secrets; never commit secrets.

**Deferred:** Nafath (`NAFATH_MODE=inactive`) · Payment (`PAYMENT_PROVIDER=deferred`) — not required for boot or readiness.

**Object storage image:** `pgsty/silo` and client `pgsty/mc` (see the compose file). `minio/minio` and `minio/mc` no longer exist on Docker Hub. The S3 API, bucket init, and `MINIO_*` variables are unchanged.

Operator steps for 11 October 2026: `docs/LAUNCH-CHECKLIST.md`.

The rest of this file is the Docker Compose VPS path. The free-tier test path is the next section and is also written, with the same variables, in `docs/LAUNCH-CHECKLIST.md`.

---

## Free-tier test deployment

Frontend on Vercel. API on one Render free web service. Data stores stay outside both:

| Piece | Where | What the app reads |
|-------|--------|--------------------|
| SPA | Vercel | `VITE_API_MODE`, `VITE_API_URL` or `VITE_API_BASE_URL`, `VITE_AI_ADVISOR_EXPERIMENTAL` |
| HTTP API + BullMQ worker | Render free web (`render.yaml`) | `RUN_WORKER_IN_PROCESS=true` so this process also runs the worker |
| Postgres | Neon | `DATABASE_URL` pooled (`-pooler`), `DIRECT_URL` direct host |
| Redis | Upstash | `REDIS_URL` `rediss://` |
| Vectors | Qdrant Cloud free | `AI_QDRANT_URL`, `AI_QDRANT_API_KEY` |
| Document bytes | Cloudflare R2 | `S3_ENDPOINT`, `S3_REGION=auto`, path-style forced in code |

Prisma is **5.22.0**. Start runs `npx prisma migrate deploy` (not `db push`) and does not seed. Nafath stays `inactive`. Payments stay `deferred`. The advisor stays experimental.

### Exact setup

1. Neon: create a project. `DATABASE_URL` is the pooled string (host contains `-pooler`, `sslmode=require`; keep `pgbouncer=true` on this URL only if Neon included it). `DIRECT_URL` is the direct string (same user and database, host without `-pooler`, `sslmode=require`). Prisma Client uses `DATABASE_URL`. Migrate uses `DIRECT_URL`.
2. Upstash: create Redis and copy the `rediss://default:…@….upstash.io:6379` URL into `REDIS_URL`. The BullMQ connection sets `maxRetriesPerRequest: null`, enables TLS for `rediss`, and sets `enableReadyCheck: false`. Rate limiting uses a different client.
3. Qdrant Cloud: create a free cluster. Set `AI_QDRANT_URL` to the cluster HTTPS URL, `AI_QDRANT_API_KEY` to the key, `AI_QDRANT_COLLECTION=legal_chunks_v1`.
4. R2: create bucket `sjs-documents` and an access key. `S3_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com`, `S3_REGION=auto`, `S3_ACCESS_KEY`, `S3_SECRET`, `S3_BUCKET`. The client always uses path-style addressing, which R2 and MinIO both require.
5. Render: New → Blueprint from `render.yaml` (one `web` service, `plan: free`, `runtime: node`, `region: oregon`, `rootDir: backend`). Connect it to the branch you deploy (`autoDeployTrigger: commit` follows that branch). Health check path is `/health`. Do not point the probe at `/health/ready` (that route may return 503). Do not set `PORT`.
6. Build on Render: `NPM_CONFIG_PRODUCTION=false npm ci` so the Prisma CLI (a devDependency) is installed, then `prisma generate`, `npm run build`, and `npm run ocr:langdata` (fast tessdata into `.ocr-data`). Start: `sh scripts/render-start.sh`, which exports `DIRECT_URL=$DATABASE_URL` when `DIRECT_URL` is empty, runs `npx prisma migrate deploy`, then `exec node dist/main.js`. With `RUN_WORKER_IN_PROCESS=true` the process then starts a second Nest context for the BullMQ worker. Leave the separate `node dist/worker.js` process off.
7. Vercel: import the repo. Root Directory `frontend` uses `frontend/vercel.json` (Vite, rewrite `/(.*)` → `/index.html`). Root Directory `.` uses the repo `vercel.json` (`npm ci --prefix frontend`, output `frontend/dist`, same rewrite). Set the build env below and redeploy after any change. Vercel serves existing files before the rewrite.
8. `CORS_ORIGINS` is the exact Vercel origin, for example `https://your-project.vercel.app`. Add `https://*.vercel.app` only when preview deployments should call the API. Never `*`. The socket URL is derived in the browser: `https://<service>.onrender.com/api/v1` becomes `wss://<service>.onrender.com/api/v1/alerts/ws`. Upgrade requests with an `Origin` must match `CORS_ORIGINS`.
9. Session token stays in `localStorage` and is sent as `Authorization: Bearer`. `fetch` uses `credentials: 'include'`. In production, `Set-Cookie` is rewritten to `SameSite=None; Secure` so a cookie set by `onrender.com` can be stored by a `vercel.app` page. Helmet sends `Cross-Origin-Resource-Policy: cross-origin`.

Free Render limits: sleep after about 15 minutes idle, no custom domain, 512 MB RAM (OCR can be tight), ephemeral disk (tessdata is fetched on each build).

### Render environment

| Variable | Value |
|----------|--------|
| `NODE_ENV` | `production` |
| `RUN_WORKER_IN_PROCESS` | `true` on this single service. `false` when a separate worker process is running |
| `TRUST_PROXY_HOPS` | `1` |
| `NAFATH_MODE` | `inactive` |
| `PAYMENT_PROVIDER` | `deferred` |
| `AI_PROVIDER_MODE` | `openai` |
| `AI_LLM_MODE` | `openai` |
| `AI_EMBEDDING_MODE` | `openai` |
| `AI_VECTOR_STORE_MODE` | `qdrant` |
| `AI_TEXT_EXTRACTOR_MODE` | `pdf` |
| `AI_OCR_MODE` | `local` |
| `AI_OCR_TESSDATA` | `fast` |
| `AI_OCR_LANG_PATH` | `.ocr-data` |
| `AI_OCR_LANGUAGES` | `ara+eng` |
| `AI_ADVISOR_EXPERIMENTAL` | `true` |
| `AI_QDRANT_COLLECTION` | `legal_chunks_v1` |
| `S3_REGION` | `auto` |
| `LOG_LEVEL` | `info` |
| `JWT_ACCESS_EXPIRES_IN` | `15m` |
| `DATABASE_URL` | Neon pooled URL |
| `DIRECT_URL` | Neon direct URL |
| `REDIS_URL` | Upstash `rediss://` URL |
| `CORS_ORIGINS` | `https://<project>.vercel.app` and optionally `https://*.vercel.app` |
| `JWT_ACCESS_SECRET` | Long random secret |
| `OPENAI_API_KEY` | OpenAI secret |
| `AI_QDRANT_URL` | Qdrant Cloud URL |
| `AI_QDRANT_API_KEY` | Qdrant Cloud key |
| `S3_ENDPOINT` | `https://<accountid>.r2.cloudflarestorage.com` |
| `S3_ACCESS_KEY` | R2 access key id |
| `S3_SECRET` | R2 secret |
| `S3_BUCKET` | R2 bucket |
| `PORT` | Set by Render. Do not override |

`PAYMENT_WEBHOOK_SECRET` is unused while payment is deferred.

### Vercel environment

| Variable | Value |
|----------|--------|
| `VITE_API_MODE` | `real` |
| `VITE_API_URL` | `https://<service>.onrender.com/api/v1` |
| `VITE_API_BASE_URL` | Same URL, or empty when `VITE_API_URL` is set |
| `VITE_AI_ADVISOR_EXPERIMENTAL` | `true` |

Smoke: `curl -fsS https://<service>.onrender.com/health`, then sign in on the Vercel URL and confirm the browser calls that `/api/v1` base with no CORS error.

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
