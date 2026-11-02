# PHASE X — Deployment Compatibility Audit (Shared Hostinger VPS)

**Date:** 2026-11-02  
**Mode:** READ-ONLY — repository inspection + operator-provided VPS inventory already captured in the local SSH terminal transcript.  
**Actions not taken:** no code edits (except creating this document), no SSH from the agent, no container/network/volume changes, no installs, no deploys.

**Target host:** `76.13.40.84` (Hostinger, Ubuntu 24.04.3 LTS)  
**Constraint:** multi-tenant production VPS; no domain purchase at this stage; existing apps must remain untouched.

---

## 0. Evidence classes

| Class | Meaning |
|-------|---------|
| **VERIFIED (repo)** | Observed in committed files under this repository |
| **VERIFIED (VPS inventory)** | Observed in operator terminal output from `ss` / `nginx -T` / `docker volume ls` / `docker network ls` / login banner (session on `root@76.13.40.84`) |
| **ASSUMPTION** | Inferred; must be re-checked before any deploy |

---

## 1. Executive verdict

| Question | Answer |
|----------|--------|
| Can PJSR be added **without sharing** existing DBs/networks/volumes? | **YES (repo)** — Compose project `sjs-prod` creates its own network and named volumes; services do not `external:`-attach to SIDRA/DSM/Daqiqattayaran resources. |
| Can default Compose be started **as-is** on this VPS? | **NO** — default publish of host **80** and **443** conflicts with the **host Nginx** already bound there (**VERIFIED VPS**). Edge config also **forces HTTPS** and requires TLS files (**VERIFIED repo**). |
| Are Postgres / Redis / MinIO published publicly by PJSR Compose? | **NO (repo)** — only `expose:` (internal). Good for shared-host safety. |
| Can private testing use **VPS IP + dedicated port**, no domain/HTTPS? | **Not with the stock edge config.** Stock `nginx.production.conf` redirects all HTTP → HTTPS and mounts certs. Achievable only after a **future** HTTP-only / alternate-port profile (out of scope for this audit — no changes made). |
| Resource fit on ~7.8 GB RAM / ~96 GB disk with other apps? | **HIGH RISK** — banner shows ~**59–61%** RAM already used; Compose memory **limits** sum ≈ **5.25 GiB**. Headroom is likely insufficient without lowering limits/concurrency or adding RAM (**ASSUMPTION** on exact free bytes; limits ≠ reservations). |

**Compatibility status:** **NOT DEPLOYABLE AS-SHIPPED on this shared VPS.** Isolation design is sound; port/TLS/RAM/nginx-edge assumptions are incompatible with the live host without a dedicated co-tenancy profile.

---

## 2. Repository production topology (VERIFIED repo)

**File:** `infra/docker/docker-compose.production.yml`  
**Compose project `name`:** `sjs-prod`

```
[ published host ports: HTTP_PORT→80, HTTPS_PORT→443 ]
        ↓
  nginx (compose)  →  frontend:80
                   →  api:3000
  api / worker     →  postgres:5432, redis:6379, minio:9000  (internal only)
  worker           →  OpenAI + Qdrant Cloud (external HTTPS)
```

| Concern | Finding |
|---------|---------|
| Migration | `backend/scripts/docker-api-entrypoint.sh` → `npx prisma migrate deploy` then `node dist/main.js` — no seed |
| Worker | `node dist/worker.js`; OCR tessdata baked; no host ports |
| Health | API Compose healthcheck hits `http://127.0.0.1:3000/health`; readiness also probes Postgres/Redis/S3/Qdrant/AI config |
| Secrets | Runtime `env_file: .env.production`; not baked into images |
| CI/CD | `.github/workflows/ci.yml` builds/tests images — **no VPS deploy job** |
| Backup | Docs only (`docs/PRODUCTION-BACKUP-RESTORE.md`); **no automated scripts** in repo |
| Deploy scripts | No `scripts/deploy-production.sh` (etc.) for VPS Compose path |

---

## 3. Port conflict table

### 3.1 Ports PJSR Compose publishes (VERIFIED repo)

| Compose mapping | Default host port | Container | Purpose |
|-----------------|-------------------|-----------|---------|
| `${HTTP_PORT:-80}:80` | **80** | `nginx` | Edge HTTP (ACME + redirect) |
| `${HTTPS_PORT:-443}:443` | **443** | `nginx` | Edge HTTPS |

Internal-only (`expose`, **not** published):

| Internal port | Service | Public conflict risk |
|---------------|---------|----------------------|
| 5432 | postgres | None from PJSR publish |
| 6379 | redis | None from PJSR publish |
| 9000 / 9001 | minio | None from PJSR publish |
| 3000 | api | None from PJSR publish (container network only) |
| 80 | frontend | None from PJSR publish |

`HTTP_PORT` / `HTTPS_PORT` are overridable via env (**VERIFIED repo**), but the **bundled nginx config still listens on container 80/443 and redirects to HTTPS**, so changing host ports alone does **not** enable HTTP-only IP testing without a different nginx config (**VERIFIED repo**).

### 3.2 Ports already in use on the VPS (VERIFIED VPS inventory)

| Host port | Bind | Process / note | Conflict with PJSR default? |
|-----------|------|----------------|------------------------------|
| **22** | `*:22` | sshd | No |
| **80** | `0.0.0.0` + `[::]` | **host nginx** | **YES — P0** vs `HTTP_PORT=80` |
| **443** | `0.0.0.0` + `[::]` | **host nginx** | **YES — P0** vs `HTTPS_PORT=443` |
| **3000** | `*` | `next-server` | No (PJSR api not published); **do not** publish PJSR api on 3000 |
| **3100** | `0.0.0.0` | docker-proxy | Avoid for PJSR |
| **3101** | `0.0.0.0` | docker-proxy | Avoid |
| **4000** | `*` | MainThread (app) | Avoid |
| **5000** | `127.0.0.1` | docker-proxy | Avoid for loopback proxies |
| **5001** | `0.0.0.0` | `node /var/www/...` | Avoid |
| **5002** | `*` | MainThread | Avoid |
| **5050** | `127.0.0.1` | next-server | Avoid |
| **5432** | `0.0.0.0` + `[::]` | docker-proxy (existing Postgres) | No if PJSR keeps DB internal-only (**do not** publish PJSR Postgres) |
| **5433** | `127.0.0.1` | host postgres | No |
| **6385** | `127.0.0.1` | docker-proxy (Redis-like) | No |
| **8080** | host nginx `server_name 76.13.40.84` → `127.0.0.1:5000` | Occupied IP vhost | Avoid |
| **8081** | host nginx `server_name 76.13.40.84` → `127.0.0.1:5001` | Occupied | Avoid |
| **8082** | host nginx `server_name 76.13.40.84` → `127.0.0.1:3000` | Occupied | Avoid |
| **11433–11435** | `127.0.0.1` | docker-proxy | Avoid |

**ASSUMPTION:** Ports such as **8083+, 8090, 3200** appear free from this `ss` snapshot; re-run `ss -tlnp` immediately before any future publish.

### 3.3 Host Nginx virtual hosts (VERIFIED VPS — do not replace)

| listen | server_name | Upstream (proxy_pass) |
|--------|-------------|------------------------|
| 80/443 | `aviationsminute.com` (+ www) | `127.0.0.1:5000` |
| 80/443 | `aviationsminuteanalysis.com` | `127.0.0.1:5050` |
| 80/443 | `alsadidigital.com` | `localhost:3000` |
| 80/443 | `medai2030.com` | (TLS present) |
| 80/443 | `pulsering.alsadidigital.cloud` / `ring.alsadidigital.cloud` | `127.0.0.1:5001` |
| 8080 | `76.13.40.84` | `127.0.0.1:5000` |
| 8081 | `76.13.40.84` | `127.0.0.1:5001` |
| 8082 | `76.13.40.84` | `127.0.0.1:3000` |

**Integration path later (design only):** add a **new** host Nginx `server { }` (e.g. listen on a free high port for IP testing, or a future hostname on 443) that `proxy_pass`es to PJSR ports bound to **127.0.0.1 only**. Do **not** overwrite existing site files; do **not** run a second public Nginx on 80/443 via Compose.

---

## 4. Docker resources PJSR will create

Compose project name `sjs-prod` prefixes resources (Compose V2/V5 convention).

### 4.1 Containers / services (VERIFIED repo)

| Service key | Expected container name pattern | Image | Host ports | Notes |
|-------------|-------------------------------|-------|------------|-------|
| postgres | `sjs-prod-postgres-1` | `postgres:16-alpine` | none | Named volume for data |
| redis | `sjs-prod-redis-1` | `redis:7.2-alpine` | none | AOF + password |
| minio | `sjs-prod-minio-1` | `pgsty/silo:RELEASE.2026-09-16T00-00-00Z` | none | S3-compatible |
| minio-init | `sjs-prod-minio-init-1` | `pgsty/mc:RELEASE.2026-09-16T00-00-00Z` | none | one-shot; `restart: "no"` |
| api | `sjs-prod-api-1` | `sjs-api:${IMAGE_TAG}` | none | migrate + Nest |
| worker | `sjs-prod-worker-1` | `sjs-worker:${IMAGE_TAG}` | none | BullMQ + OCR |
| frontend | `sjs-prod-frontend-1` | `sjs-frontend:${IMAGE_TAG}` | none | static nginx |
| nginx | `sjs-prod-nginx-1` | `nginx:1.27-alpine` | **80 + 443 by default** | **conflicts on this VPS** |

No `container_name:` overrides in production Compose → names stay project-scoped (**VERIFIED repo**).  
No `external: true` networks or volumes (**VERIFIED repo**) → no attachment to SIDRA/DSM/Daqiqattayaran resources.

### 4.2 Network (VERIFIED repo)

| Compose network key | Full Docker network name (typical) | Driver | Collision with existing? |
|---------------------|--------------------------------------|--------|---------------------------|
| `sjs_internal` | `sjs-prod_sjs_internal` | bridge | **No** — existing: `bridge`, `host`, `none`, `sidra_default`, `digital-social-media_default`, `daqiqattayaran_default`, `postgres_default` (**VERIFIED VPS**) |

### 4.3 Volumes (VERIFIED repo)

| Compose volume key | Full volume name (typical) | Purpose | Collision with existing? |
|--------------------|----------------------------|---------|---------------------------|
| `sjs_prod_pg_data` | `sjs-prod_sjs_prod_pg_data` | PostgreSQL | **No** — existing named volumes include `sidra_*`, `digital-social-media_*`, `daqiqattayaran_mongo_data`, `postgres_postgres_data`, plus anonymous hashes (**VERIFIED VPS**) |
| `sjs_prod_redis_data` | `sjs-prod_sjs_prod_redis_data` | Redis AOF | **No** |
| `sjs_prod_minio_data` | `sjs-prod_sjs_prod_minio_data` | Object bytes | **No** |

### 4.4 Images built/pulled (VERIFIED repo)

| Image tag pattern | Source |
|-------------------|--------|
| `sjs-api:*` | `infra/docker/backend.Dockerfile` |
| `sjs-worker:*` | `infra/docker/worker.Dockerfile` |
| `sjs-frontend:*` | `infra/docker/frontend.Dockerfile` |
| `postgres:16-alpine`, `redis:7.2-alpine`, `nginx:1.27-alpine`, `pgsty/silo:…`, `pgsty/mc:…` | Hub pulls |

**ASSUMPTION:** Image name `sjs-api` etc. will not collide with other projects’ running containers; only disk tag namespace is shared on the host.

### 4.5 Independence check

| Dependency | Uses existing app resource? |
|------------|----------------------------|
| Database | **No** — own Postgres service + volume |
| Redis | **No** — own Redis |
| Object storage | **No** — own MinIO/Silo |
| Docker network | **No** — own `sjs_internal` |
| Qdrant / OpenAI | External SaaS (operator credentials) — not VPS-local SIDRA/DSM |
| Host Nginx sites | **Would conflict only if** Compose binds 80/443 or operators edit existing vhosts in place |

---

## 5. Required environment variables (names only — no secrets)

Source of truth: `infra/docker/.env.production.example` + Compose `environment:` overrides + `backend` `validateEnv` production rules.

### 5.1 Compose / edge

| Variable | Required | Secret? | Consumer | Purpose |
|----------|----------|---------|----------|---------|
| `IMAGE_TAG` | recommended | no | image tags | Immutable tag preferred over `local` |
| `HTTP_PORT` | yes for publish | no | compose nginx | Host port → container 80 (**must not be 80 on this VPS**) |
| `HTTPS_PORT` | yes if TLS edge used | no | compose nginx | Host port → container 443 (**must not be 443 on this VPS**) |
| `TLS_CERTS_HOST_PATH` | yes if HTTPS edge | no path; certs sensitive | nginx mount | Host dir with `fullchain.pem` / `privkey.pem` |
| `CERTBOT_WWW_PATH` | if ACME | no | nginx mount | HTTP-01 webroot |
| `VITE_API_BASE_URL` | **yes** (build) | no | frontend build | Absolute API base baked into SPA |
| `VITE_AI_ADVISOR_EXPERIMENTAL` | optional (default true) | no | frontend build | Advisor “experimental” flag |

### 5.2 Datastores (internal)

| Variable | Required | Secret? | Consumer |
|----------|----------|---------|----------|
| `POSTGRES_USER` | yes | no | postgres + URL build |
| `POSTGRES_PASSWORD` | yes | **yes** | postgres + URL build |
| `POSTGRES_DB` | yes | no | postgres + URL build |
| `REDIS_PASSWORD` | yes | **yes** | redis requirepass + `REDIS_URL` |
| `MINIO_ROOT_USER` | yes | semi | minio admin |
| `MINIO_ROOT_PASSWORD` | yes | **yes** | minio admin |
| `S3_ACCESS_KEY` | yes | **yes** | api/worker least-privilege user |
| `S3_SECRET` | yes | **yes** | api/worker |
| `S3_BUCKET` | yes | no | api/worker / minio-init |

Compose injects `DATABASE_URL`, `REDIS_URL`, `S3_ENDPOINT=http://minio:9000` (**VERIFIED repo**). Entrypoint sets `DIRECT_URL=$DATABASE_URL` if unset.

### 5.3 API / worker application

| Variable | Required in production | Secret? | Notes |
|----------|------------------------|---------|-------|
| `JWT_ACCESS_SECRET` | yes | **yes** | Long random |
| `JWT_ACCESS_EXPIRES_IN` | recommended | no | Example `15m` |
| `CORS_ORIGINS` | yes | no | Exact browser origin(s); **no `*`** |
| `LOG_LEVEL` | recommended | no | e.g. `info` |
| `TRUST_PROXY_HOPS` | set to `1` by Compose | no | Behind one proxy hop |
| `NAFATH_MODE` | forced `inactive` | no | Deferred |
| `PAYMENT_PROVIDER` | forced `deferred` | no | Deferred |
| `PAYMENT_WEBHOOK_SECRET` | placeholder ok while deferred | treat as secret | Unused while deferred |
| `AI_PROVIDER_MODE` | `openai` | no | Mock forbidden in prod |
| `AI_LLM_MODE` | `openai` | no | |
| `AI_EMBEDDING_MODE` | `openai` | no | |
| `AI_VECTOR_STORE_MODE` | `qdrant` | no | |
| `AI_TEXT_EXTRACTOR_MODE` | `pdf` | no | |
| `AI_OCR_MODE` | `local` | no | |
| `AI_OCR_TESSDATA` | recommended | no | e.g. `fast` |
| `AI_ADVISOR_EXPERIMENTAL` | recommended | no | |
| `OPENAI_API_KEY` | yes | **yes** | |
| `OPENAI_CHAT_MODEL` | recommended | no | |
| `OPENAI_EMBEDDING_MODEL` | recommended | no | |
| `AI_QDRANT_URL` | yes | no | Cloud HTTPS URL |
| `AI_QDRANT_API_KEY` | yes | **yes** | |
| `AI_QDRANT_COLLECTION` | recommended | no | e.g. `legal_chunks_v1` |

**Private IP+port test (when a future HTTP profile exists):**  
`VITE_API_BASE_URL` and `CORS_ORIGINS` must match the actual browser origin, e.g. `http://76.13.40.84:<free-port>` and `http://76.13.40.84:<free-port>/api/v1` — **ASSUMPTION** of exact strings; must match the chosen publish scheme.

---

## 6. IP + port private testing (no domain / no HTTPS)

| Requirement | Stock PJSR support? | Detail |
|-------------|---------------------|--------|
| Frontend reachable via `http://76.13.40.84:<port>` | **Blocked by stock edge** | Compose nginx redirects HTTP→HTTPS; needs certs (**VERIFIED repo**) |
| API same origin `/api/` via that port | Same | Routed only through edge HTTPS server block |
| Skip purchasing a domain | Policy OK | Host already fronts IP on 8080–8082 for **other** apps |
| Keep host Nginx sites intact | Required | Do not bind Compose to 80/443 |
| Publish only DB/Redis/MinIO internally | Already true | Keep it that way |

**Recommended future co-tenancy pattern (documentation only — not implemented):**

1. Do **not** start Compose `nginx` on 80/443.  
2. Publish `frontend` and/or a thin HTTP edge on a **free high port** (candidate **8083+**) bound to `127.0.0.1` **or** to `0.0.0.0` only if intentional for private testing.  
3. Optionally add a **new** host Nginx server block (copy-on-write new file under sites-available) listening on that free port with `server_name 76.13.40.84` and `proxy_pass` to PJSR — **without** editing existing vhosts.  
4. Rebuild frontend with `VITE_API_BASE_URL` pointing at that IP:port API prefix; set `CORS_ORIGINS` accordingly.  
5. Provide an HTTP-only nginx config (no `ssl_certificate`, no force-HTTPS) for private testing.

Until those changes exist, **stock production Compose cannot satisfy requirement 10**.

---

## 7. Resource evaluation (VERIFIED VPS + VERIFIED repo)

### 7.1 Host capacity signals

| Metric | Value | Source |
|--------|-------|--------|
| Disk `/` | **42.2% of 95.82 GB** used | Login banner |
| Memory | **~59–61%** used of ~7.8 GB class | Banner + operator brief |
| Swap | **0%** | Banner |
| Load | ~0.15–0.46 | Banner |
| Other apps | SIDRA, Digital Social Media, Daqiqattayaran, MedAI, PulseRing, Aviation sites, host Nginx, etc. | Networks/volumes/nginx inventory |

### 7.2 Compose memory limits (VERIFIED repo)

| Service | `deploy.resources.limits.memory` |
|---------|----------------------------------|
| postgres | 1G |
| redis | 512M |
| minio | 512M |
| api | 1G |
| worker | **2G** |
| frontend | 128M |
| nginx | 128M |
| **Sum of limits** | **≈ 5.25 GiB** |

**Note:** On non-Swarm Compose, `deploy.resources` may be **ignored** unless `mem_limit` is set (**ASSUMPTION** / Compose behavior). Either way, OCR worker + Postgres + API under concurrent load can pressure a host already ~60% full.

**Disk:** Images (Node builds + OCR langdata + Postgres/MinIO growth) are plausible on ~55 GB free, but MinIO document growth and Postgres dumps need an off-box backup plan (not present as automation).

---

## 8. Nginx integration compatibility

| Topic | Finding |
|-------|---------|
| Stock Compose edge | Second Nginx on **80/443** — **incompatible** with host Nginx |
| Host Nginx | Active, Certbot-managed multi-site (**VERIFIED VPS**) |
| Later integration | **Compatible in principle** via a **new** `server` block + `proxy_pass` to PJSR loopback ports — does **not** require replacing existing virtual hosts |
| Stock `server_name _` | Accepts any Host — fine for IP tests once HTTP-only; should be pinned for real domains later |
| CSP `connect-src 'self'` | Requires SPA and API same origin (edge path `/` + `/api/`) — OK if one host port fronts both |

---

## 9. Blockers

| ID | Severity | Blocker | Evidence |
|----|----------|---------|----------|
| X-B1 | **P0** | Default publish **80/443** collides with host Nginx | Compose defaults + `ss` / nginx active |
| X-B2 | **P0** | Stock edge **requires TLS** and redirects HTTP→HTTPS; no domain/certs this phase | `nginx.production.conf` |
| X-B3 | **P0** | Private IP+port testing **not supported** by stock Compose/edge without a new HTTP-only profile | Repo |
| X-B4 | **P1** | **RAM headroom** likely insufficient for full stack + OCR worker alongside existing apps | Banner ~60% used + 5.25 GiB limits |
| X-B5 | **P1** | No VPS deploy/backup automation scripts; backups are manual docs only | Repo |
| X-B6 | **P1** | CI does not deploy to this host; release process is operator-manual | `.github/workflows/ci.yml` |
| X-B7 | **P2** | Example `VITE_API_BASE_URL` / `CORS_ORIGINS` assume a purchased HTTPS hostname | `.env.production.example` |
| X-B8 | **P2** | Worker has no Compose healthcheck | Compose |
| X-B9 | **P2** | No Docker log rotation options in Compose | Compose |

---

## 10. Recommended fixes (for a future change set — **not applied now**)

1. **Co-tenancy Compose profile**  
   - Never bind host 80/443 on this VPS.  
   - Either omit Compose `nginx` and use **host Nginx** as the only edge, or publish Compose edge on a **free high port** (e.g. 8083) with an **HTTP-only** config for private IP testing.

2. **Loopback publishing**  
   - Prefer `127.0.0.1:<port>:<container>` for API/frontend so only host Nginx (or SSH tunnel) exposes them.

3. **New host Nginx site file**  
   - Add `sites-available/pjsr-ip.conf` (name TBD) listening on a free port / future hostname; `proxy_pass` to PJSR; leave Aviation/SIDRA/DSM/PulseRing files untouched.

4. **Env for IP test**  
   - Set `VITE_API_BASE_URL=http://76.13.40.84:<port>/api/v1` and matching `CORS_ORIGINS`; rebuild frontend image.

5. **RAM**  
   - Lower worker/api/postgres limits; reduce OCR/job concurrency; or upgrade VPS RAM before go-live. Confirm free memory with `free -h` at deploy time.

6. **Keep data plane private**  
   - Do not add `ports:` for postgres/redis/minio (current design is correct).

7. **Project isolation**  
   - Keep Compose `name: sjs-prod` and deploy directory e.g. `/opt/pjsr` (operator choice); never `docker system prune` / volume prune on the shared host.

8. **Secrets**  
   - Create `infra/docker/.env.production` on the server only (`chmod 600`); never commit; supply OpenAI + Qdrant Cloud credentials.

---

## 11. What this audit deliberately did not do

- No repository code/config changes (other than adding this audit document).  
- No agent SSH / VPS mutation.  
- No `docker compose up`, build, stop, prune, or network/volume create/delete.  
- No secret values printed.  
- No claim that private IP testing works with the **current** production nginx config.

---

## 12. Summary tables (quick reference)

### Port conflicts (PJSR default vs VPS)

| PJSR default | VPS status | Result |
|--------------|------------|--------|
| Host **80** | host nginx | **CONFLICT** |
| Host **443** | host nginx | **CONFLICT** |
| Internal 3000/5432/6379/9000 | not published by PJSR | **OK** (do not publish) |

### Resources PJSR creates

| Kind | Names |
|------|-------|
| Project | `sjs-prod` |
| Network | `sjs-prod_sjs_internal` |
| Volumes | `sjs-prod_sjs_prod_pg_data`, `…_redis_data`, `…_minio_data` |
| Services | postgres, redis, minio, minio-init, api, worker, frontend, nginx |

### Bottom line

PJSR’s **isolation model is compatible** with a multi-app Hostinger VPS (unique project/network/volumes; DB/Redis/MinIO not public).  
The **default production edge binding and HTTPS-mandatory nginx config are not compatible** with this host or with domain-less IP testing.  
**Do not deploy the stock Compose file onto this VPS until a co-tenancy / HTTP-IP profile is designed and reviewed.**
