# Phase U — Production Infrastructure Audit

**Date:** 2026-09-12  
**Scope:** Discover existing deployability before changing packaging/ops.  
**Deferred (unchanged):** Nafath · Payment  

---

## Verdict (pre-implementation)

Application-level production fail-closed config (Phase S/T/T.5) is largely in place.  
**Packaging / edge / CI were not production-ready** at audit time.

| Area | Status at audit |
|------|-----------------|
| Nest API + Worker code | PRODUCTION-capable |
| Real OpenAI / Qdrant Cloud | VERIFIED (T.5) |
| API Dockerfile | STUB |
| Frontend Dockerfile | STUB |
| Worker Dockerfile | REAL (untracked) |
| compose.production | MISSING |
| Nginx / HTTPS | MISSING |
| Root CI | MISSING (stubs under `infra/.github/`) |
| Graceful shutdown | Hooks only |

---

## Classification legend

- **PRODUCTION** — required at runtime in `NODE_ENV=production`
- **DEVELOPMENT** — local/dev only
- **TEST** — Jest/Vitest only
- **DOCUMENTATION** — docs/comments
- **DEFERRED** — Nafath / Payment (must not block production)

---

## Inventory

### Docker / Compose

| Path | Class | Finding |
|------|-------|---------|
| `infra/docker/backend.Dockerfile` | STUB → to fix | `# TODO` only |
| `infra/docker/frontend.Dockerfile` | STUB → to fix | `# TODO` only |
| `infra/docker/ai-service.Dockerfile` | DOCUMENTATION/legacy | Python AI removed; stub only |
| `infra/docker/worker.Dockerfile` | PRODUCTION | Real multi-stage Nest worker + tessdata |
| `infra/docker/docker-compose.dev.yml` | DEVELOPMENT | postgres, redis, minio, qdrant on `127.0.0.1` |

### Frontend

| Item | Class | Finding |
|------|-------|---------|
| `npm run build` | PRODUCTION | `tsc` + `vite build` |
| `npm run dev` | DEVELOPMENT | Vite HMR — forbidden in prod |
| `VITE_API_MODE=mock` | DEVELOPMENT/TEST | Rejected when `import.meta.env.PROD` |
| `assertProductionApiConfig` | PRODUCTION | Requires `VITE_API_BASE_URL` |

### Backend runtime

| Item | Class | Finding |
|------|-------|---------|
| `node dist/main.js` | PRODUCTION | API |
| `node dist/worker.js` | PRODUCTION | AI worker |
| Mock AI/Nafath/Payment providers | DEVELOPMENT/TEST | Refused in production by `env.validation.ts` |
| `InactiveNafathAdapter` | DEFERRED | Prod default |
| `DeferredPaymentProvider` | DEFERRED | Prod default |
| `GET /health` | PRODUCTION | Liveness |
| `GET /health/ready` | PRODUCTION | Readiness (PG, Redis, S3, Qdrant, AI config) |
| `/readyz` on API | MISSING | Qdrant uses `/readyz` internally |

### Search terms (summary)

| Term | Typical class |
|------|----------------|
| `mock` / `Mock*` | DEVELOPMENT/TEST (+ deferred inactive paths) |
| `fake` / `dummy` / `stub` | TEST / DOCUMENTATION / leftover TODO stubs |
| `localhost` / `127.0.0.1` | DEVELOPMENT compose binds; TEST fixtures; docs |
| `forceExit` | TEST/DOCUMENTATION (live Jest only) |
| `watch` | DEVELOPMENT Nest/Vite |
| `TODO` / `placeholder` | DOCUMENTATION / incomplete infra stubs |

### CI/CD

| Path | Class | Finding |
|------|-------|---------|
| `infra/.github/workflows/*.yml` | STUB | Not discovered by GitHub Actions |
| Root `.github/workflows` | MISSING | Must be created at repo root |

### Secrets / env

| Item | Finding |
|------|---------|
| `.gitignore` `.env.*` | Blocks `.env.production.example` unless excepted |
| Production must set | DATABASE, REDIS, S3, QDRANT, OPENAI, JWT, CORS |
| Never in frontend | OpenAI / Qdrant / DB / Redis / MinIO secrets |

---

## Gaps to close in Phase U

1. Real API + frontend Dockerfiles; harden worker image (non-root).  
2. `docker-compose.production.yml` (no public DB/Redis/MinIO; Qdrant Cloud external).  
3. Nginx reverse proxy + HTTPS documentation (no fake certs).  
4. Explicit SIGTERM/SIGINT shutdown for API + worker.  
5. Root CI workflow (no live secrets).  
6. Tracked `*.env.*.example` templates.  
7. Backup/restore + deployment + smoke docs.  
8. Optional `/readyz` alias for readiness.  

**Nafath = DEFERRED — NOT REQUIRED**  
**Payment = DEFERRED — NOT REQUIRED**
