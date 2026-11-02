# PHASE X.3 — Hostinger Readiness Fixes

**Date:** 2026-11-02  
**Mode:** Repository-only (no VPS SSH, no container build/start/stop)  
**Inputs:** `docs/PHASE-X2-FINAL-DEPLOYMENT-REVIEW.md` outstanding findings  
**Depends on:** Phase X.1 Hostinger co-tenancy profile (`pjsr`, `127.0.0.1:8083`)

---

## Final recommendation

### **GO — private SSH-tunnel testing**

| Scope | Decision |
|-------|----------|
| Private bring-up of Compose `pjsr` + tunnel to `127.0.0.1:8083` | **GO** (after operator secrets + free-port check) |
| Public domain / host Nginx / TLS | **NO-GO** (unchanged; out of profile) |
| Use of unmodified `sjs-prod` / `docker-compose.production.yml` on this VPS | **NO-GO** |

X.2’s four findings are addressed in-repo. Residual risk is operational (OCR under 768 MiB, Redis capacity, live host RAM) — acceptable for private tunnel testing with the staged OCR plan and Redis monitoring below.

---

## Changed files

| File | Change |
|------|--------|
| `infra/nginx/nginx.hostinger-private.conf` | WebSocket `map` + `Upgrade` / `Connection` on `/api/` |
| `infra/docker/docker-compose.hostinger.yml` | Default `AI_WORKER_CONCURRENCY=1`, `AI_OCR_CONCURRENCY=1`; OCR comment |
| `infra/docker/.env.hostinger.example` | Document concurrency defaults for co-tenancy |
| `docs/HOSTINGER-BACKUP-RESTORE.md` | **New** — `pjsr`-scoped backup/restore |
| `docs/PRODUCTION-BACKUP-RESTORE.md` | Pointer to Hostinger doc (commands for `sjs-prod` preserved) |
| `docs/PHASE-X1-HOSTINGER-DEPLOYMENT.md` | WS, backup, OCR, Redis sections |
| `docs/PHASE-X3-HOSTINGER-READINESS-FIXES.md` | This deliverable |

**Not modified:** `docker-compose.production.yml`, host Nginx configs, application business logic, VPS state.

---

## 1. WebSocket support (X2-1) — FIXED

### Evidence (implementation)

| Item | Location |
|------|----------|
| Path | `/api/v1/alerts/ws?access_token=` |
| Server | `backend/src/modules/alerts/alerts.gateway.ts` — `WebSocketServer({ noServer: true })` + HTTP `upgrade` |
| Client | Frontend derives `ws://` / `wss://` from `VITE_API_BASE_URL` |

### Private Nginx change

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
# inside location /api/:
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection $connection_upgrade;
proxy_buffering off;
```

| Requirement | Status |
|-------------|--------|
| Upgrade + Connection handling | Done via `$connection_upgrade` |
| `/api/` routing preserved | Same `proxy_pass http://pjsr_api` |
| Normal HTTP continues | Empty Upgrade → `Connection: close` |
| Host-level Nginx untouched | Yes |
| WS not public | Still only `127.0.0.1:8083` |

---

## 2. Backup and restore (X2-2) — FIXED (docs)

Authoritative Hostinger procedure: **`docs/HOSTINGER-BACKUP-RESTORE.md`**.

| Requirement | Status |
|-------------|--------|
| Replace `sjs-prod` in Hostinger procedures | Hostinger doc uses `-p pjsr` only |
| Target only PJSR resources | Volumes `pjsr_pg_data`, `pjsr_redis_data`, `pjsr_minio_data` |
| PostgreSQL + MinIO backup/restore | Documented |
| Redis per actual role | AOF noted; Redis **not** legal SoR; no mandatory Redis dump |
| Never delete volumes/backups | Explicit forbidden list |
| Verify before restore | Checklist in Hostinger doc |

`docs/PRODUCTION-BACKUP-RESTORE.md` still documents **`sjs-prod`** for dedicated hosts and now links to the Hostinger doc.

---

## 3. Worker memory and OCR (X2-3) — ASSESSED (limit kept)

### Implementation (VERIFIED)

| Knob | Default (code) | Hostinger profile |
|------|----------------|-------------------|
| Worker `mem_limit` | — | **768m** (not raised) |
| `AI_WORKER_CONCURRENCY` | 2 | **1** |
| `AI_OCR_CONCURRENCY` | 2 (capped ≤4) | **1** |
| OCR stack | `tesseract.js` + PDF page raster (`AI_OCR_DPI` default **300**) | `AI_OCR_MODE=local`, tessdata `fast` |
| PDF page cap | `AI_PDF_MAX_PAGES` default **100** | unchanged |

### Is 768 MiB sufficient?

| Workload | Expectation |
|----------|-------------|
| Text-layer PDF (little/no OCR) | Likely OK under 768 MiB |
| Short scanned Arabic/English PDF, concurrency 1 | Plausible within 768 MiB (**ASSUMPTION** until Stage B on VPS) |
| Large multi-page scans, high DPI, or concurrency >1 | **OOM risk** — worker killed by Docker `mem_limit` |

**Do not raise `mem_limit` arbitrarily.** Prefer concurrency=1 and staged validation. Raise memory only with measured evidence and free host RAM.

### Possible OOM conditions

1. Page raster buffers at 300 DPI for large pages + tesseract.js WASM heap.  
2. Concurrent BullMQ jobs if concurrency is raised above 1.  
3. Host free RAM < ~2.5 GiB while other apps spike (kernel pressure).  
4. Multiple large PDFs queued while a prior OCR job still holds memory.

### Staged OCR validation plan (on VPS — after authorized bring-up)

| Stage | Input | Pass criteria | On fail |
|-------|--------|---------------|---------|
| **A** | Small text-layer PDF (≤5 pages) | Job `DONE`; worker stays Up; no OOM in `docker events` / inspect | Fix AI/config first |
| **B** | Short scan (≤10 pages, ara+eng) | Job completes or fails gracefully (not OOMKill); RSS under 768m | Keep concurrency=1; shorten pages / lower DPI only if needed |
| **C** | Larger scan (≤30 pages) in a quiet window | Same as B; note duration | Defer heavy OCR; do **not** bump mem without free-RAM proof |
| **D** (optional) | Two jobs back-to-back | Queue drains; Redis memory stable | Inspect BullMQ waiting + Redis §4 |

Commands (operator, later — **not** run in this phase):

```bash
docker compose -p pjsr -f infra/docker/docker-compose.hostinger.yml \
  --env-file infra/docker/.env.hostinger logs -f worker
docker stats --no-stream $(docker compose -p pjsr -f infra/docker/docker-compose.hostinger.yml ps -q worker)
```

---

## 4. Redis and BullMQ monitoring (X2-4) — DOCUMENTED

### Policy

| Setting | Value | Decision |
|---------|-------|----------|
| `maxmemory` | 192mb | Keep |
| `maxmemory-policy` | **`noeviction`** | **Keep** — protects BullMQ keys; no evidence supports `allkeys-lru` here |
| AOF | yes | Keep |
| Job retention | removeOnComplete/Fail age+count bounds | Unchanged in app |

### Thresholds (below 192 MB)

| Level | `used_memory` | Action |
|-------|---------------|--------|
| OK | < 150 MB | Routine |
| **Warning** | ≥ **150 MB** (~78% of 192) | Inspect queue depth; pause bulk uploads; confirm worker healthy |
| **Critical** | ≥ **180 MB** (~94%) | Stop new analysis enqueues; drain/fail stale jobs; free Redis memory; restart Redis **only** as last resort (queues lost; Postgres remains SoR) |

### Monitoring commands (PJSR only)

```bash
COMPOSE='docker compose -p pjsr -f infra/docker/docker-compose.hostinger.yml --env-file infra/docker/.env.hostinger'

# Memory + policy
$COMPOSE exec -T redis redis-cli -a "$REDIS_PASSWORD" INFO memory | egrep 'used_memory_human|maxmemory_human'
$COMPOSE exec -T redis redis-cli -a "$REDIS_PASSWORD" CONFIG GET maxmemory-policy

# Avoid logging the password in shell history where possible; prefer env already loaded.
```

BullMQ key prefix defaults to `sjs:ai` (`AI_QUEUE_PREFIX`). Inspect waiting/active/failed via application logs or a one-off BullMQ inspection against `REDIS_URL` inside the API/worker network — do not expose Redis on the host.

### Queue backpressure and recovery

1. **Symptom:** Enqueue errors, Redis OOM / “command not allowed when used memory”, worker unhealthy, waiting depth rising.  
2. **Immediate:** Stop bulk document uploads; confirm `$COMPOSE ps` worker/api.  
3. **Drain:** Let worker finish active jobs; do not raise concurrency.  
4. **Stale jobs:** Reconcile Postgres `AiJob` rows still `PENDING`/`PROCESSING` after Redis pressure clears; re-enqueue deliberately.  
5. **Redis restart:** Accept queue loss; **never** `docker volume rm pjsr_redis_data` as cleanup.  
6. **Do not** switch to an eviction policy without a written exception — eviction can drop BullMQ lock/job keys silently.

---

## 5. Validation (this phase)

| Check | Result |
|-------|--------|
| Hostinger Compose config parse | See §5.1 |
| Nginx syntax (config file) | See §5.1 |
| Backup commands use `pjsr` | Pass — `HOSTINGER-BACKUP-RESTORE.md` |
| No `sjs-prod` volume/project ops in Hostinger backup | Pass |
| No VPS connection | Pass |
| No container start/build/stop | Pass |
| `docker-compose.production.yml` / `sjs-prod` untouched | Pass |
| Application business logic unchanged | Pass (gateway/OCR code not modified) |

### 5.1 Static checks (repo machine)

| Check | Result | Notes |
|-------|--------|-------|
| `docker compose -p pjsr -f …hostinger.yml --env-file …example config` | **Pass** (`config_exit=0`) | `name: pjsr`; volumes `pjsr_*`; `host_ip: 127.0.0.1` + `published: "8083"`; worker `mem_limit: 805306368` (768 MiB); `AI_WORKER_CONCURRENCY` / `AI_OCR_CONCURRENCY` = `1` |
| Host 80/443 publish | **Pass** (absent) | Only publish is loopback 8083 |
| Redis `maxmemory` / `noeviction` in rendered config | **Pass** | Present under redis command |
| `nginx -t` via `nginx:1.27-alpine` | **Skipped** | Docker Desktop Linux engine not running on this workstation (`docker run` failed); no local `nginx` binary |
| Nginx conf static review | **Pass** | `map $http_upgrade $connection_upgrade`; `/api/` has `Upgrade` + `Connection $connection_upgrade`; `/` and health locations unchanged |
| Hostinger backup project names | **Pass** | Operational commands use `-p pjsr` / `pjsr_*`; `sjs-prod` appears only as “do not use” warnings |

---

## 6. Remaining risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| OCR OOM under 768 MiB on large scans | Medium | Concurrency=1; Stages A–C before trusting OCR |
| Redis fill → enqueue failures | Medium | 150/180 MB thresholds; job retention; noeviction |
| Host free RAM drop (other tenants) | Medium | Re-check free memory at deploy |
| WS untested live until tunnel up | Low | Headers fixed in-repo; verify after bring-up |
| Secrets not yet on VPS | Blocker for deploy | Operator `.env.hostinger` |
| Public TLS/domain | Out of scope | Separate cutover |

---

## 7. Operator preconditions before tunnel test

1. Create `infra/docker/.env.hostinger` (secrets) on VPS only.  
2. Confirm `8083` free; host 80/443 remain host Nginx.  
3. Free RAM ≳ 2.5 GiB.  
4. Bring up with `-p pjsr` + Hostinger compose file only.  
5. Tunnel: `ssh -L 8083:127.0.0.1:8083 …` → `http://localhost:8083`.  
6. Smoke: `/health`, login, upload small PDF, Stage A OCR, open UI long enough to exercise alerts WS.

---

## 8. Summary vs X.2 findings

| Finding | Resolution |
|---------|------------|
| WS Upgrade/Connection missing | Fixed in `nginx.hostinger-private.conf` |
| Backup docs wrong project | `HOSTINGER-BACKUP-RESTORE.md` + X.1 pointer |
| Worker 768 MiB / OCR unknown | Assessed; limit kept; concurrency=1; staged plan |
| Redis monitoring / policy | Documented; `noeviction` retained; 150/180 MB thresholds |
