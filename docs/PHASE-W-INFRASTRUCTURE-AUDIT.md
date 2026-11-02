# PHASE W — Infrastructure Audit

**Date:** 2026-11-02  
**Scope:** Repository + Hostinger VPS readiness for PJSR (Smart Judicial System)  
**Target host (operator):** Ubuntu 24.04.3 LTS at `76.13.40.84` (Hostinger)  
**Deferred:** Nafath (`inactive`) · Payment (`deferred`)  
**Audit mode:** Repository inspection complete. Real VPS was **not** fully inventoried from this agent (SSH key auth unavailable; password session exists in the operator terminal only). Banner metadata from that session is recorded under §7 as **unverified inventory hints**, not VERIFIED facts.

**Phase W Stage 1 status:** AUDIT COMPLETE — no production host mutations performed.

---

## 1. Current architecture (as implemented)

```
Internet
  → Nginx edge (TLS :443, ACME :80)     [infra/nginx/nginx.production.conf]
       → Frontend static (nginx:80)     [infra/docker/frontend.Dockerfile]
       → Nest API (:3000)               [infra/docker/backend.Dockerfile]
            → PostgreSQL 16 (internal)
            → Redis 7.2 + AUTH + AOF (internal)
            → MinIO/Silo S3 (internal)
            → BullMQ → Nest AI Worker   [infra/docker/worker.Dockerfile]
                         → OpenAI (external)
                         → Qdrant Cloud (external)
```

Compose project name: `sjs-prod` (`infra/docker/docker-compose.production.yml`).  
Local Qdrant is **dev-only** (`docker-compose.dev.yml`). Production vectors stay on **Qdrant Cloud**.

Alternate free-tier path (Vercel + Render + Neon + Upstash + R2) is documented in `docs/PRODUCTION-DEPLOYMENT.md` / `docs/LAUNCH-CHECKLIST.md`. **Phase W target is the single-VPS Compose path**, not that free-tier path.

---

## 2. Infrastructure inventory (repository)

| Asset | Path / identity | Role | Notes |
|-------|-----------------|------|-------|
| Prod Compose | `infra/docker/docker-compose.production.yml` | Full stack | Named volumes; internal network; only nginx publishes 80/443 |
| Dev Compose | `infra/docker/docker-compose.dev.yml` | Local deps | Binds Postgres/Redis/MinIO/Qdrant to `127.0.0.1` |
| API image | `infra/docker/backend.Dockerfile` | Nest API | Multi-stage; non-root `sjs`; `prisma migrate deploy` then `node dist/main.js` |
| Worker image | `infra/docker/worker.Dockerfile` | BullMQ worker | Multi-stage; OCR tessdata baked; non-root; no HTTP |
| Frontend image | `infra/docker/frontend.Dockerfile` | SPA | Build-time `VITE_*`; rejects empty API URL / non-`real` mode |
| Edge Nginx | `infra/nginx/nginx.production.conf` | TLS + routing | HSTS, CSP, body 12m; `/api/` → API; SPA `/` |
| SPA Nginx | `infra/nginx/frontend-static.conf` | Static + SPA fallback | Inside frontend container |
| Prod env example | `infra/docker/.env.production.example` | Secrets template | Gitignored real file via `.env.*` |
| Backend env | `backend/.env.example`, `.env.production.example` | App vars | Validation in `env.validation.ts` refuses prod mocks |
| Frontend env | `frontend/.env.example`, `.env.production.example` | Build vars | Production assert for real API |
| API entrypoint | `backend/scripts/docker-api-entrypoint.sh` | Migrate + start | Sets `DIRECT_URL` from `DATABASE_URL` if unset; **no seed** |
| Health | `/health`, `/health/ready`, `/readyz` | Liveness / readiness | Readiness checks Postgres, Redis, object storage, Qdrant, AI config |
| CI | `.github/workflows/ci.yml` | Unit + build + docker build | E2E opt-in; no live AI secrets |
| Backup docs | `docs/PRODUCTION-BACKUP-RESTORE.md` | Manual operator steps | Explicitly **not** automated |
| Deploy docs | `docs/PRODUCTION-DEPLOYMENT.md`, `LAUNCH-CHECKLIST.md`, `HTTPS.md` | Runbooks | Domain placeholders; TLS ops pending |
| Deprecated | `infra/docker/ai-service.Dockerfile` | Intentional fail | Python AI removed |

**Secrets hygiene (repo):** `.gitignore` covers `.env` / `.env.*` with example exceptions. Compose does not bake secrets into images; runtime `env_file` + compose `environment` injection. **Do not** put real keys in reports or git.

---

## 3. What is already strong

| Area | Evidence |
|------|----------|
| Topology isolation | Postgres/Redis/MinIO only `expose` (no host publish) in prod Compose |
| Restart / health | `restart: unless-stopped`; healthchecks on postgres, redis, minio, api; `depends_on` with `service_healthy` / `service_completed_successfully` |
| Migration safety | Entrypoint uses `prisma migrate deploy` only; seed refused outside dev/test |
| Prod mock refusal | `validateEnv` rejects Nafath/Payment/AI mock modes when `NODE_ENV=production` |
| Non-root API/worker | UID/GID 1001 `sjs` |
| Frontend build gates | Requires `VITE_API_MODE=real` + non-empty `VITE_API_BASE_URL` |
| TLS config skeleton | TLSv1.2/1.3, HSTS, CSP, ACME webroot location |
| Memory limits | Compose `deploy.resources.limits` on core services |
| Security phases | Phase V / V.1 audits and regressions documented |
| CI docker build | Compose `config` + three image builds on PR/push |

---

## 4. Identified risks

Severity: **P0** blocks safe go-live · **P1** high operational/security risk · **P2** hardening / maintainability · **P3** nice-to-have.

### P0 — Blockers for “production ready” on this VPS

| ID | Risk | Evidence | Recommended remediation |
|----|------|----------|-------------------------|
| W-P0-1 | **No verified TLS on real domain** | Nginx expects `fullchain.pem` / `privkey.pem`; `server_name _`; docs use `app.example.com`. Certificate not installed/verified from this audit. | Confirm DNS A/AAAA → `76.13.40.84`; issue Let's Encrypt cert; set real `server_name`; verify HTTPS + redirect (`docs/HTTPS.md`). |
| W-P0-2 | **No verified production smoke on live host** | Phase U/V.1 explicitly left host TLS + smoke as OPERATIONAL PENDING. | After stack + TLS: run `docs/PRODUCTION-SMOKE-TEST.md` against the real URL. |
| W-P0-3 | **Automated backups not implemented** | `PRODUCTION-BACKUP-RESTORE.md`: “manual / operator-driven”; LAUNCH-CHECKLIST lists off-site automation as outstanding. | Add cron scripts + encrypted off-VPS copy + restore drill in isolation (Phase W Stages 5+). |
| W-P0-4 | **VPS co-tenancy / port conflict unknown** | Agent cannot list containers without key-based SSH. Local Windows already showed port **3000** fights with other Node apps; VPS may host other sites. | Operator: inventory `docker ps`, `ss -tlnp`, nginx sites, existing `/opt/*` **before** bind 80/443. Use isolated Compose project `sjs-prod` and `/opt/pjsr` (or similar). Never global prune. |

### P1 — Must fix before trusting production traffic

| ID | Risk | Evidence | Recommended remediation |
|----|------|----------|-------------------------|
| W-P1-1 | **Worker has no Compose healthcheck** | `worker` service: no `healthcheck`; only `depends_on` api healthy. | Add process-level health (e.g. Redis/BullMQ ping script or side-channel file) or document external monitoring of queue depth / `AiJob` states. |
| W-P1-2 | **No Docker log rotation** | Compose lacks `logging: { driver: json-file, options: max-size/max-file }`. | Add log options on all services to prevent disk fill (judicial logs can grow). |
| W-P1-3 | **Nginx `server_name _`** | Accepts any Host. | Pin to production hostname(s) only. |
| W-P1-4 | **First-boot TLS chicken-and-egg** | HTTPS server block always enabled; missing certs → nginx fail. Docs mention bootstrap HTTP-only path but no committed bootstrap conf. | Add documented bootstrap HTTP-only nginx snippet or certbot standalone flow before enabling 443. |
| W-P1-5 | **Cert renewal not automated in-repo** | HTTPS.md is manual certbot + copy into `./certs`. | Install host cron/`certbot renew` hook that refreshes mounts and reloads nginx. |
| W-P1-6 | **JWT in `localStorage`** | Phase V.1 accepted risk (Bearer + XSS surface). | Keep mitigations (short TTL, CSP, Helmet); plan HttpOnly+CSRF as separate project — do not half-migrate. |
| W-P1-7 | **Redis memory policy unspecified** | Prod redis: AOF + password only; no `maxmemory` / `maxmemory-policy`. | Set explicit policy suitable for BullMQ (avoid `allkeys-lru` wiping jobs without understanding); size limit to VPS RAM. |
| W-P1-8 | **Migration on every API start** | Entrypoint always `migrate deploy`. Safe for **single** API replica; unsafe if multiple API containers race. | Keep single API replica **or** move migrate to a one-shot job before scaling. |
| W-P1-9 | **MinIO init uses `\|\| true`** | Policy/user create failures can be swallowed. | Fail closed on critical init errors; verify bucket + app user on deploy. |
| W-P1-10 | **Host hardening not verified** | Banner: password SSH works; 85 pending updates; memory ~61%; no UFW/fail2ban confirmation from agent. | Key-based SSH (verify before disabling passwords); UFW 22/80/443; fail2ban; unattended-upgrades; dedicated deploy user. |

### P2 — Should address for maintainable production ops

| ID | Risk | Evidence | Recommended remediation |
|----|------|----------|-------------------------|
| W-P2-1 | **Missing Phase W operator scripts** | Brief asks for `deploy-production.sh`, backup/verify/restore, smoke scripts; repo has docs + `docker-api-entrypoint.sh` / `render-start.sh` only. | Add scripts under `scripts/` or `infra/scripts/` following existing conventions. |
| W-P2-2 | **CI gaps for release gate** | Unit + docker build; security suite not a separate required job; E2E opt-in; no deploy job; no image registry push. | Add security job; optional tagged release workflow that pushes immutable tags (not only `latest`). |
| W-P2-3 | **No rollback runbook artifact with image digests** | Deploy docs mention previous images conceptually; no deployment record format. | Add `docs/PRODUCTION-ROLLBACK.md` + release record template (SHA, tags, migration id). |
| W-P2-4 | **Frontend container runs nginx as root** | Official `nginx:alpine` default. | Acceptable for many deployments; optional non-root nginx hardening later. |
| W-P2-5 | **Dual deployment narratives** | Compose VPS vs Vercel/Render free tier in same docs. | Keep both, but Phase W runbook must make **VPS Compose** the authoritative production path for Hostinger. |
| W-P2-6 | **`DIRECT_URL` footgun** | Required by Prisma schema; entrypoint copies `DATABASE_URL`. Local `.env` previously had invalid placeholder and blocked boot. | Document clearly in env matrix; validate format at startup (already partially done). |
| W-P2-7 | **OpenAI readiness is config-only** | `/health/ready` checks AI **config**, not a live OpenAI call (good for secrets); outages show up in jobs, not readiness. | Monitor failed `AiJob` / provider errors separately. |
| W-P2-8 | **Resource fit on VPS unknown** | Docs recommend ≥4 vCPU / 8 GB / 40 GB. Host banner: ~96 GB disk, memory 61% **with unknown other workloads**. | Confirm vCPU/RAM free headroom after inventory; tune worker concurrency / OCR. |
| W-P2-9 | **CSP `connect-src 'self'`** | Correct for same-origin nginx edge; breaks if frontend ever calls absolute cross-origin API. | Keep same-origin; ensure `VITE_API_BASE_URL` is same host `/api/v1` or update CSP deliberately. |
| W-P2-10 | **Deprecated `ai-service.Dockerfile` still in tree** | Architecture marks intentional fail. | Leave or remove in cleanup to avoid operator confusion. |

### P3 — Lower priority

| ID | Risk | Remediation |
|----|------|-------------|
| W-P3-1 | No centralized metrics (Prometheus/Grafana) | Optional later; start with health + disk + docker logs |
| W-P3-2 | No WebSocket proxy tuning beyond defaults | Confirm alerts WS path under `/api/` works through nginx (timeouts 120s already) |
| W-P3-3 | Compose `deploy.resources` ignored by non-Swarm Compose | Document that limits may need `mem_limit` for pure Compose v2 on single node |

---

## 5. Environment / configuration consistency notes

| Topic | Finding |
|-------|---------|
| Compose overrides | `DATABASE_URL` / `REDIS_URL` / `S3_ENDPOINT` constructed in Compose — good; avoids wrong hostnames inside containers |
| `env_file` | `.env.production` supplies JWT, CORS, OpenAI, Qdrant, etc. |
| Nafath / Payment | Forced inactive/deferred in Dockerfile ENV + Compose |
| CORS | Must be exact HTTPS origin (no `*`) — example still `https://app.example.com` |
| Frontend bake | Changing `VITE_API_BASE_URL` requires **rebuild** of frontend image |
| Object storage image | `pgsty/silo` + `pgsty/mc` (MinIO Hub removal) — documented and used |

---

## 6. Database & data-plane notes

| Topic | Finding |
|-------|---------|
| Migrate command | `prisma migrate deploy` only in API entrypoint |
| Seed | Not in entrypoint; seed script refuses non-dev/test |
| Volumes | `sjs_prod_pg_data`, `sjs_prod_redis_data`, `sjs_prod_minio_data` — persist across recreate **if volumes not pruned** |
| Qdrant | Derived; rebuildable from DB chunks + embeddings |
| Redis | Queue durability via AOF; **not** system of record for legal content |
| Cascade / ownership | Existing Prisma schema + Phase V ownership controls — do not weaken |

Local lesson (2026-10): missing `CRIMINAL` enum migration caused case-create 500 until `migrate deploy` — reinforces controlled migrate-on-deploy and pre-deploy migrate status checks.

---

## 7. Hostinger VPS — items requiring real access

**Agent SSH (BatchMode / key):** `Permission denied (publickey,password)` — no remote inventory from this session.

**Operator terminal banner (hints only — re-verify on host):**

| Signal | Value |
|--------|-------|
| OS | Ubuntu 24.04.3 LTS (kernel 6.8.0-147-generic) |
| Public IPv4 | `76.13.40.84` |
| IPv6 | Present on eth0 |
| Disk `/` | ~42% of ~96 GB |
| Memory | ~61% used (other workloads possible) |
| Swap | 0% |
| Updates | ~85 packages pending; ESM Apps note |
| Auth | Password login currently works for `root` |

**Required operator commands (read-only first):**

```bash
# On VPS — inventory only (no prune / no delete)
uname -a
free -h; df -h; nproc
docker version; docker compose version
docker ps -a
docker volume ls
docker network ls
ss -tlnp
ufw status verbose || true
ls -la /opt /etc/nginx/sites-enabled 2>/dev/null
systemctl is-active nginx docker fail2ban 2>/dev/null
```

**Do not** run `docker system prune`, volume prune, or stop unrelated containers until PJSR ownership of ports 80/443 is confirmed.

---

## 8. Acceptance criteria baseline (Stage 1)

| ID | Criterion | Status after audit |
|----|-----------|--------------------|
| A | Repository production configuration | **PARTIALLY VERIFIED** (Compose/Dockerfiles/env examples present; gaps in scripts/automation) |
| B | Docker production builds | **PARTIALLY VERIFIED** (CI builds; not re-run in this Stage 1 session) |
| C | Production environment validation | **NOT VERIFIED** (no live `.env.production` review — secrets stay off git) |
| D | Database migration safety | **PARTIALLY VERIFIED** (entrypoint + docs correct; host migrate not run) |
| E | Persistent storage | **PARTIALLY VERIFIED** (volumes defined; host survival not tested) |
| F–H | API/worker/network startup | **NOT VERIFIED** on VPS |
| I | Nginx routing | **PARTIALLY VERIFIED** (config reviewed; not live) |
| J | Host firewall | **NOT VERIFIED** |
| K | TLS certificate | **NOT VERIFIED** / **BLOCKED** until domain + cert |
| L–M | Automated backups + restore drill | **NOT VERIFIED** (docs only) |
| N | Monitoring/logging | **PARTIALLY VERIFIED** (app health exists; host log rotation / alerts missing) |
| O | Deployment automation | **PARTIALLY VERIFIED** (CI build only; no CD) |
| P | Rollback procedure | **NOT VERIFIED** (no dedicated rollback doc/scripts yet) |
| Q | Real production smoke | **NOT VERIFIED** |
| R | Live AI/RAG on prod host | **NOT VERIFIED** |
| S | Security review (Phase W) | **PARTIALLY VERIFIED** (inherits Phase V/V.1; host review pending) |
| T | Resource capacity | **NOT VERIFIED** |

---

## 9. Recommended Stage 2+ order (no execution in this document)

1. **Operator VPS inventory** (read-only) + decide port ownership for 80/443.  
2. **Repo hardening:** Compose log rotation, worker health/monitoring, nginx `server_name`, Redis memory policy, bootstrap TLS path, env matrix doc.  
3. **Scripts:** deploy / backup / verify / restore / smoke with safe defaults.  
4. **Local verification:** `docker compose … build`, migrate dry-run against disposable DB, unit/security/frontend regression.  
5. **VPS deploy (authorized):** `/opt/pjsr`, `.env.production` chmod 600, bring-up, migrate observable, health.  
6. **DNS + Certbot + HTTPS verify.**  
7. **Backup cron + isolated restore drill.**  
8. **Production smoke + RAG smoke with test accounts.**  
9. **Final PHASE-W-RESULT.md with one verdict.**

---

## 10. Stage 1 conclusion

The repository already contains a **credible single-VPS Docker Compose production architecture** aligned with the existing Nest API + worker + MinIO + external Qdrant/OpenAI design. It is **not** production-complete: TLS, host hardening, automated backups, restore drills, CD/rollback tooling, and live smoke remain open.

**No infrastructure was modified on the VPS during this audit.**  
**Next:** Stage 2 — production environment standardization and Compose/script remediation per the P0/P1 table above, after operator confirms VPS inventory and domain hostname.
