# PHASE X.1 — Hostinger Co-Tenancy Deployment Profile

**Date:** 2026-11-02  
**Depends on:** `docs/PHASE-X-DEPLOYMENT-COMPATIBILITY-AUDIT.md`  
**Scope:** Repository-only preparation. No VPS connection, no container start, no host Nginx edits.

---

## 1. Purpose

Deploy PJSR on the shared Hostinger VPS (`76.13.40.84`) **without**:

- Binding host **80** / **443**
- Competing with the existing host Nginx
- Touching SIDRA / Digital Social Media / Daqiqattayaran networks or volumes
- Requiring a purchased domain or TLS for private testing

Standard production Compose (`docker-compose.production.yml`, project `sjs-prod`) is **unchanged**.

---

## 2. What was added

| File | Role |
|------|------|
| `infra/docker/docker-compose.hostinger.yml` | Isolated Compose project `pjsr` |
| `infra/nginx/nginx.hostinger-private.conf` | HTTP-only private edge (same-origin `/` + `/api/` + WS upgrade) |
| `infra/docker/.env.hostinger.example` | Placeholder secrets / tunnel CORS + Vite URL |
| `docs/PHASE-X1-HOSTINGER-DEPLOYMENT.md` | This document |
| `docs/HOSTINGER-BACKUP-RESTORE.md` | Backup/restore for `pjsr` only (Phase X.3) |
| `docs/PHASE-X3-HOSTINGER-READINESS-FIXES.md` | X.2 finding resolutions |

---

## 3. Architecture (private tunnel test)

```
Laptop browser
  → http://localhost:8083
  → SSH tunnel (-L 8083:127.0.0.1:8083)
  → VPS 127.0.0.1:8083
  → Compose service "edge" (nginx, HTTP only)
       → frontend:80   (SPA)
       → api:3000      (/api/, /health*)
  api / worker → postgres, redis, minio on network pjsr_internal
  worker → OpenAI + Qdrant Cloud (external)
```

The browser never uses Docker DNS names (`api`, `frontend`). It only sees `localhost:8083` (tunneled). The edge proxies `/api/` to the API container, preserving same-origin CSP (`connect-src 'self'`).

---

## 4. Port and resource allocation

### 4.1 Ports

| Host binding | Service | Public? | Notes |
|--------------|---------|---------|-------|
| `127.0.0.1:8083` → edge:80 | Private HTTP edge | **No** (loopback only) | Free vs Phase X inventory (8080–8082 taken) |
| *(none)* | postgres :5432 | No | `expose` only |
| *(none)* | redis :6379 | No | `expose` only |
| *(none)* | minio :9000/:9001 | No | `expose` only |
| *(none)* | api :3000 | No | `expose` only |
| *(none)* | frontend :80 | No | `expose` only |
| **Not used** | 80 / 443 | — | Must remain host Nginx |

### 4.2 Docker resources (project `pjsr`)

| Kind | Name |
|------|------|
| Project | `pjsr` |
| Network | `pjsr_internal` (explicit `name:`) |
| Volumes | `pjsr_pg_data`, `pjsr_redis_data`, `pjsr_minio_data` |
| Images | `pjsr-api:*`, `pjsr-worker:*`, `pjsr-frontend:*` |
| Containers (typical) | `pjsr-postgres-1`, `pjsr-redis-1`, `pjsr-minio-1`, `pjsr-minio-init-1`, `pjsr-api-1`, `pjsr-worker-1`, `pjsr-frontend-1`, `pjsr-edge-1` |

No `external:` references to other projects’ networks or volumes.

### 4.3 Memory / CPU (conservative co-tenancy)

Host signal from Phase X: ~7.8 GiB RAM, ~3 GiB free while other apps run.

| Service | `mem_limit` | `cpus` | Rationale |
|---------|-------------|--------|-----------|
| postgres | 512m | 0.50 | Below standard prod 1G |
| redis | 256m | 0.25 | Also `--maxmemory 192mb` + `noeviction` (BullMQ-safe) |
| minio | 256m | 0.25 | Object I/O, not RAM-heavy |
| api | 512m | 0.75 | Nest + Prisma |
| worker | 768m | 1.00 | OCR needs headroom; **not** the old 2G prod cap |
| frontend | 64m | 0.10 | Static nginx |
| edge | 64m | 0.10 | Private reverse proxy |
| **Sum of limits** | **≈ 2.43 GiB** | — | Leaves ~0.5 GiB+ free for host OS + spikes if ~3 GiB was free |

**Tradeoffs**

- Worker defaults to `AI_WORKER_CONCURRENCY=1` / `AI_OCR_CONCURRENCY=1`; heavy OCR may still OOM under 768 MiB — do not raise `mem_limit` without measured evidence (see Phase X.3 staged plan).
- Redis `noeviction` means queue pressure fails writes instead of silently dropping BullMQ keys — preferred for job integrity.
- Limits are hard caps (`mem_limit`), not soft reservations.

Logging: `json-file` with `max-size` / `max-file` on api, worker, frontend, edge.

---

## 5. Environment (secrets stay off Git)

```bash
cp infra/docker/.env.hostinger.example infra/docker/.env.hostinger
chmod 600 infra/docker/.env.hostinger
# Fill CHANGE_ME and empty AI keys. Never commit .env.hostinger.
```

Tunnel-oriented defaults in the example:

| Variable | Example purpose |
|----------|-----------------|
| `VITE_API_BASE_URL` | `http://localhost:8083/api/v1` (baked at **image build**) |
| `CORS_ORIGINS` | `http://localhost:8083` |
| Datastore / JWT / MinIO / OpenAI / Qdrant | Same production rules; real providers only |

Compose injects internal `DATABASE_URL`, `REDIS_URL`, `S3_ENDPOINT`. API entrypoint still runs `prisma migrate deploy` (no seed).

---

## 6. Private access (SSH tunnel)

On your laptop (after the stack is running on the VPS — **not** done in this phase):

```bash
ssh -L 8083:127.0.0.1:8083 root@76.13.40.84
```

Then open: **http://localhost:8083**

Health: **http://localhost:8083/health**

Do **not** publish `0.0.0.0:8083`. Loopback + tunnel keeps the temporary HTTP endpoint off the public internet.

---

## 7. Operator bring-up commands (for later — not executed now)

From the repo root **on the VPS**:

```bash
# Validate only
docker compose -p pjsr -f infra/docker/docker-compose.hostinger.yml \
  --env-file infra/docker/.env.hostinger config >/dev/null

# Build and start (when authorized)
docker compose -p pjsr -f infra/docker/docker-compose.hostinger.yml \
  --env-file infra/docker/.env.hostinger up -d --build

# Status / logs (PJSR only)
docker compose -p pjsr -f infra/docker/docker-compose.hostinger.yml \
  --env-file infra/docker/.env.hostinger ps
```

Stopping PJSR does **not** stop SIDRA/DSM/etc.:

```bash
docker compose -p pjsr -f infra/docker/docker-compose.hostinger.yml \
  --env-file infra/docker/.env.hostinger stop
```

Never run global `docker system prune` / volume prune on this host.

---

## 8. Future domain + host Nginx (documentation only)

When a domain is purchased:

1. Keep Compose publishing **only** `127.0.0.1:8083` (or switch edge to TLS later inside Compose — optional).
2. Add a **new** file under host Nginx `sites-available/` (do not edit Aviation/SIDRA/DSM vhosts).
3. Example shape (illustrative — **not** installed now):

```nginx
server {
    listen 443 ssl http2;
    server_name app.example.com;
    # ssl_certificate ... managed by Certbot

    location / {
        proxy_pass http://127.0.0.1:8083;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 12m;
    }
}
```

4. Rebuild the frontend image with `VITE_API_BASE_URL=https://app.example.com/api/v1` and set `CORS_ORIGINS=https://app.example.com`.
5. Enable the site and obtain certificates with Certbot **without** removing existing certificates.

---

## 9. Static validation (this phase)

| Check | Result |
|-------|--------|
| Standard `docker-compose.production.yml` unmodified | Pass (not edited) |
| Hostinger Compose `name: pjsr` | Pass |
| Explicit volume/network names `pjsr_*` | Pass |
| No host bind of 80/443 | Pass |
| Only publish `127.0.0.1:8083` | Pass |
| Postgres/Redis/MinIO not published | Pass |
| Private edge HTTP-only (no cert mount required) | Pass |
| API migrate entrypoint reused | Pass |
| Worker healthcheck + depends_on api healthy | Pass |
| Real AI modes in env example | Pass |
| `docker compose … config` (local dry parse) | **Pass** (`config_exit=0`); only publish is `127.0.0.1:8083`; project `pjsr`; volumes `pjsr_*`; no host 80/443 |

---

## 10. WebSocket (private edge)

Live alerts use path `/api/v1/alerts/ws` on the API HTTP server (`AlertsGateway`, `ws` `noServer` + `upgrade`).

Private Nginx (`nginx.hostinger-private.conf`) sets:

- `map $http_upgrade $connection_upgrade` (`upgrade` / `close`)
- On `/api/`: `proxy_set_header Upgrade` + `Connection $connection_upgrade`

Normal REST keeps working when `Upgrade` is empty (`Connection: close`). WebSocket is **not** published on host 80/443 — only via `127.0.0.1:8083` + SSH tunnel. Host Nginx is unchanged.

Details: `docs/PHASE-X3-HOSTINGER-READINESS-FIXES.md`.

---

## 11. Backup and restore (Hostinger)

Use **`docs/HOSTINGER-BACKUP-RESTORE.md`** only (`-p pjsr`, volumes `pjsr_*`).  
Do not run `sjs-prod` / `docker-compose.production.yml` backup commands on this VPS.

---

## 12. Worker OCR / memory (768 MiB kept)

| Control | Hostinger default |
|---------|-------------------|
| `mem_limit` (worker) | **768m** (unchanged — not raised) |
| `AI_WORKER_CONCURRENCY` | `1` |
| `AI_OCR_CONCURRENCY` | `1` |

Staged OCR validation plan and OOM conditions: `docs/PHASE-X3-HOSTINGER-READINESS-FIXES.md`.

---

## 13. Redis / BullMQ monitoring

Keep `--maxmemory-policy noeviction` and `maxmemory 192mb`.  
Warning **≥ 150 MB**, critical **≥ 180 MB** `used_memory`. Commands and backpressure recovery: `docs/PHASE-X3-HOSTINGER-READINESS-FIXES.md`.

---

## 14. Remaining blockers (before any VPS deploy)

1. **Operator must create** `infra/docker/.env.hostinger` with real secrets (OpenAI, Qdrant, passwords, JWT) on the server only.  
2. **Authorize** build/start on the VPS (this phase did not deploy).  
3. **Re-verify** `8083` is still free (`ss -tlnp`) at deploy time.  
4. **RAM:** if free memory drops below ~2.5 GiB, delay start or reduce worker concurrency/jobs.  
5. **Frontend rebuild** required whenever `VITE_API_BASE_URL` changes (tunnel vs future domain).  
6. Domain/TLS for public launch still **out of scope** until a hostname exists.  
7. Run Stage A–C OCR validation after first bring-up (see Phase X.3) before trusting heavy scanned PDFs.

---

## 15. Safety confirmation

| Constraint | Status |
|------------|--------|
| Existing production Compose preserved | Yes |
| No VPS SSH / Docker up from this phase | Yes |
| No host Nginx modification | Yes |
| No public temporary HTTP | Yes (`127.0.0.1` only) |
| No reuse of other apps’ volumes/networks | Yes |
| No production mocks | Yes |
