# PHASE X.2 — Final Hostinger Deployment Review

**Date:** 2026-11-02  
**Mode:** READ-ONLY repository review  
**Not performed:** VPS SSH, Docker build/up, host Nginx edits, application code changes (except creating this review document as the required deliverable).

**Inputs reviewed**

- `infra/docker/docker-compose.hostinger.yml`
- `infra/nginx/nginx.hostinger-private.conf`
- `infra/docker/.env.hostinger.example`
- `docs/PHASE-X1-HOSTINGER-DEPLOYMENT.md`
- `docs/PHASE-X-DEPLOYMENT-COMPATIBILITY-AUDIT.md`
- Related: API entrypoint, env validation (prod mock refusal), upload limit, BullMQ queue options, frontend `httpClient` / `mode` / WebSocket helpers, `docs/PRODUCTION-BACKUP-RESTORE.md`

---

## Final recommendation

### **CONDITIONAL GO — private SSH-tunnel deployment only**

| Scope | Decision |
|-------|----------|
| Bring-up of Compose project `pjsr` on the shared Hostinger VPS with loopback `127.0.0.1:8083` + SSH tunnel | **GO**, after operator preconditions in §9 |
| Public internet exposure / domain / TLS cutover | **NO-GO** until host Nginx vhost + certs + frontend rebuild (documented in X.1; not part of this profile’s default) |
| Unmodified use of `docker-compose.production.yml` (`sjs-prod`) on this VPS | **NO-GO** (Phase X — ports 80/443 conflict) |

This is **not** a claim of full production readiness. It is approval of the **co-tenancy private-test profile** as structurally compatible with the shared host, subject to corrections and preconditions below.

---

## Evidence classes

| Label | Meaning |
|-------|---------|
| **VERIFIED** | Observed in the listed repository files |
| **ASSUMPTION** | Reasonable inference; must be confirmed at deploy time on the live host |

---

## 1. Docker isolation — PASS (VERIFIED)

| Check | Result | Evidence |
|-------|--------|----------|
| Unique Compose project | Pass | `name: pjsr` |
| Unique network | Pass | `pjsr_internal` with explicit `name:` |
| Unique volumes | Pass | `pjsr_pg_data`, `pjsr_redis_data`, `pjsr_minio_data` with explicit `name:` |
| Unique image prefixes | Pass | `pjsr-api`, `pjsr-worker`, `pjsr-frontend` |
| No `external:` networks/volumes | Pass | None in Hostinger Compose |
| Standard prod stack untouched | Pass | Separate file; `docker-compose.production.yml` remains `name: sjs-prod` |
| Destructive global commands | Pass | Docs instruct `docker compose -p pjsr … stop` only; warn against prune |

**ASSUMPTION:** Operator will always pass `-p pjsr` / rely on compose `name:` and will not run host-wide prune.

---

## 2. Network security — PASS with one functional gap

| Check | Result | Evidence |
|-------|--------|----------|
| Only host publish | Pass | `127.0.0.1:8083:80` on `edge` only |
| No host 80/443 | Pass | No other `ports:` mappings |
| Postgres/Redis/MinIO private | Pass | `expose` only |
| API/worker not published | Pass | API `expose: 3000`; worker no ports |
| Edge routes `/` → frontend | Pass | `proxy_pass http://pjsr_frontend` |
| Edge routes `/api/` → API | Pass | `proxy_pass http://pjsr_api` |
| Health routes | Pass | `/health`, `/health/ready`, `/readyz` → API |
| Browser uses Docker DNS names | Pass | Example `VITE_API_BASE_URL=http://localhost:8083/api/v1` — browser hits tunnel origin; Docker names only inside Nginx upstreams |

### Critical finding — WebSocket upgrade headers missing (VERIFIED)

Private edge `/api/` sets `proxy_http_version 1.1` but does **not** set:

- `proxy_set_header Upgrade $http_upgrade;`
- `proxy_set_header Connection "upgrade";`

Frontend alerts use `WebSocket` derived from the API base (`http` → `ws`, path `/api/v1/alerts/ws`) (**VERIFIED** in `frontend/src/shared/api/mode.ts`).

**Impact:** HTTP API/auth/uploads can work; **live alert WebSocket may fail** through the private edge until upgrade headers are added (recommended correction — not applied in this read-only phase).

**ASSUMPTION:** REST polling / initial alert fetch may still partially work without WS.

---

## 3. Frontend / API — PASS for tunnel same-origin HTTP

| Check | Result | Notes |
|-------|--------|-------|
| Production build mode | Pass | Dockerfile requires `VITE_API_MODE=real` + non-empty `VITE_API_BASE_URL` |
| API base for tunnel | Pass (config) | Example uses `http://localhost:8083/api/v1` |
| CORS | Pass (config) | Example `CORS_ORIGINS=http://localhost:8083`; validation forbids `*` |
| Same-origin via edge | Pass | Page and `/api` share `localhost:8083` through tunnel → CSP `connect-src 'self'` is consistent |
| Auth transport | Pass | Bearer JWT from `localStorage` + `Authorization` header; `credentials: 'include'` present but session is not cookie-primary (Phase V.1) |
| Cookie/SameSite for tunnel | N/A / low risk | Tunnel same-origin HTTP; no cross-site cookie dependency for core auth |
| Uploads / body size | Pass | Nest `DOCUMENT_MAX_BYTES = 10 MiB`; edge `client_max_body_size 12m` |
| Domain required? | Pass | Profile designed for IP/tunnel without purchased domain |

**ASSUMPTION:** After image build, operators will not point the browser at a different origin than the baked `VITE_API_BASE_URL` without rebuilding.

---

## 4. Redis / BullMQ — PASS with capacity caveats

| Setting | Value (VERIFIED) | Assessment |
|---------|------------------|------------|
| AOF | `appendonly yes` | Persistence of queue keys across Redis restart |
| Auth | `requirepass` | Required |
| `maxmemory` | `192mb` | Fits under container `mem_limit: 256m` (leaves ~64m for Redis overhead) |
| Policy | `noeviction` | Correct for BullMQ — will **error on write** when full instead of evicting job keys |
| Job retention | `removeOnComplete` age 3600 / count 1000; `removeOnFail` age 86400 / count 1000 | Bounds Redis growth (**VERIFIED** `ai-queue.module.ts`) |
| System of record | Postgres `AiJob` + docs | Redis is not authoritative legal storage (**VERIFIED** backup docs) |

### Risks when Redis hits 192mb

- New enqueues / locks may fail with OOM-style Redis errors.
- Worker/API may mark jobs failed or retry; **document content in MinIO/Postgres should remain**.
- Large backlogs of failed job payloads increase pressure.

### Monitoring thresholds (recommendations — not implemented)

| Signal | Suggest alert when |
|--------|--------------------|
| `used_memory` | \> **150mb** (~80% of 192mb) |
| `used_memory` | \> **180mb** critical |
| BullMQ waiting depth | Sustained growth while worker unhealthy |
| Redis `rejected` / OOM logs | Any occurrence |
| Worker healthcheck failures | \> 2 consecutive |

---

## 5. Memory — CONDITIONAL

### Configured limits (VERIFIED)

| Service | mem_limit |
|---------|-----------|
| postgres | 512 MiB |
| redis | 256 MiB |
| minio | 256 MiB |
| api | 512 MiB |
| worker | 768 MiB |
| frontend | 64 MiB |
| edge | 64 MiB |
| **Sum** | **2432 MiB (~2.38 GiB)** |

### OCR / worker 768 MiB

- **VERIFIED:** Worker image bakes tessdata; OCR is local WASM/tesseract.js path in production mode.
- **ASSUMPTION:** Light/medium Arabic OCR jobs can succeed within 768 MiB.
- **ASSUMPTION:** Large multi-page scanned PDFs, concurrent jobs, or peak Node heap + canvas may **OOM-kill** the worker under `mem_limit: 768m`.

### Possible OOM scenarios (do not treat limits as workload proof)

1. Worker OCR on large scans while API also peaks.  
2. Postgres spikes during migrate + heavy reads (512m).  
3. Host free RAM drops below ~2.5 GiB due to other apps → kernel pressure even if Compose limits are set.  
4. Redis process + AOF buffers approaching container 256m while `maxmemory` 192m.

**Statement:** Configured caps are **budget controls**, not a guarantee of OCR/AI stability under real documents.

---

## 6. Database and storage — PASS (profile) / PARTIAL (ops docs)

| Check | Result | Evidence |
|-------|--------|----------|
| Postgres named volume | Pass | `pjsr_pg_data` |
| MinIO named volume | Pass | `pjsr_minio_data` |
| Redis volume | Pass | `pjsr_redis_data` + AOF |
| Migrate command | Pass | API image entrypoint: `prisma migrate deploy` then `node dist/main.js`; no seed |
| Startup order | Pass | API waits for postgres/redis/minio healthy + minio-init completed; worker waits for api healthy |
| Prod mock AI refused | Pass | `validateEnv` + Compose `NODE_ENV=production` + openai/qdrant modes in example |

### Backup / restore gap (VERIFIED)

`docs/PRODUCTION-BACKUP-RESTORE.md` commands target **`docker-compose.production.yml`** / `sjs-prod` naming — **not** the Hostinger `-p pjsr` / `docker-compose.hostinger.yml` profile.

**Recommended correction (not applied here):** Add Hostinger-equivalent `pg_dump` / `mc mirror` examples using:

```text
docker compose -p pjsr -f infra/docker/docker-compose.hostinger.yml --env-file infra/docker/.env.hostinger …
```

Until then, backup procedure is **documented for the wrong Compose file** relative to this profile.

---

## 7. AI / RAG — PASS (configuration)

| Check | Result |
|-------|--------|
| OpenAI / Qdrant modes in example | Pass (`openai` / `qdrant`) |
| Silent mock fallback in production | Pass — refused by `env.validation.ts` |
| Separate worker container | Pass — `RUN_WORKER_IN_PROCESS=false` |
| Worker depends on healthy API (migrations first) | Pass |
| Failure handling | Pass (design) — BullMQ attempts/backoff; jobs retained bounded; durable state in Postgres/MinIO (**ASSUMPTION** that operators monitor failed jobs) |

Empty `OPENAI_API_KEY` / Qdrant vars in the **example** are placeholders; production boot will fail closed without real values (**VERIFIED** validation behavior) — correct.

---

## 8. Operations — PASS with gaps

| Check | Result | Notes |
|-------|--------|-------|
| Manage PJSR alone | Pass | `-p pjsr` scoped compose commands |
| API healthcheck | Pass | `GET /health` |
| Worker healthcheck | Pass | Redis ping via `ioredis` |
| Edge healthcheck | Pass (config) | `wget` spider `/health` — **ASSUMPTION** that `nginx:1.27-alpine` includes `wget` |
| Log rotation | Pass | `json-file` max-size/max-file on key services |
| Rollback instructions | **Gap** | X.1 docs lack explicit previous-image rollback steps for `pjsr-*` tags |
| minio-init | Soft fail | `\|\| true` on policy/user steps can hide init errors (**VERIFIED**) |

---

## 9. Critical findings and recommended corrections

Ordered by severity. **None of these were fixed in this read-only phase.**

| ID | Severity | Finding | Recommended correction |
|----|----------|---------|------------------------|
| X2-1 | **High** | Private Nginx lacks WebSocket `Upgrade` / `Connection` headers on `/api/` | Add standard WS proxy headers before relying on live alerts |
| X2-2 | **High** (ops) | Backup/restore docs still reference production Compose, not Hostinger `pjsr` | Document Hostinger-specific dump/mirror commands |
| X2-3 | **Medium** | Worker 768m may OOM on heavy OCR | Single-job discipline; monitor; raise limit only if host RAM allows |
| X2-4 | **Medium** | Redis 192mb `noeviction` can block new AI jobs under backlog | Monitor memory; drain failed jobs; optional raise maxmemory carefully |
| X2-5 | **Medium** | No Hostinger rollback runbook (image tag pin / previous tag) | Record `IMAGE_TAG` + commit SHA per deploy; document `up` with prior tag |
| X2-6 | **Low** | Edge healthcheck depends on `wget` in alpine image | Confirm image has `wget`, or switch to `nginx -t` / `curl` |
| X2-7 | **Low** | minio-init `\|\| true` | Fail closed on critical user/policy errors after first successful bootstrap |
| X2-8 | **Info** | Tunneled HTTP has no TLS | Acceptable for private admin testing only; not for public users |

---

## 10. Operator preconditions before first `up` (GO gate)

All must be true:

1. `infra/docker/.env.hostinger` created on the server (`chmod 600`) with real secrets — OpenAI, Qdrant, DB/Redis/MinIO/JWT (**never commit**).  
2. `ss -tlnp` shows **8083 free**.  
3. `free -h` shows enough free RAM (target **≥ ~2.5–3 GiB** free before start) — **ASSUMPTION** of current free memory; re-measure.  
4. Deploy uses only:

   `docker compose -p pjsr -f infra/docker/docker-compose.hostinger.yml --env-file infra/docker/.env.hostinger …`

5. Access only via:

   `ssh -L 8083:127.0.0.1:8083 …` → `http://localhost:8083`

6. No edits to existing host Nginx site files for this private test.

---

## 11. GO / NO-GO summary

| Question | Answer |
|----------|--------|
| Is the Hostinger profile isolated and non-colliding with SIDRA/DSM/Daqiqattayaran resources? | **YES (VERIFIED)** |
| Is private tunnel testing architecturally supported without a domain? | **YES (VERIFIED)** |
| Are Postgres/Redis/MinIO kept off the public interface? | **YES (VERIFIED)** |
| Is stock production Compose safe on this VPS? | **NO** |
| Are memory limits a guarantee of OCR/RAG stability? | **NO** |
| Are automated Hostinger backups defined? | **NO** (generic prod docs only) |
| Final call for authorized private bring-up | **CONDITIONAL GO** after §9 + preferably fixing **X2-1** (WebSocket) and **X2-2** (backup commands) before treating the environment as operationally complete |

---

## 12. What this review did not verify

- Live container start or health on `76.13.40.84`  
- Actual free RAM / port 8083 at deploy time  
- Real OpenAI/Qdrant connectivity from the VPS  
- End-to-end upload → OCR → embed → retrieve on this profile  
- Restore drill success  
- WebSocket behavior through the private edge (expected issue per X2-1)
