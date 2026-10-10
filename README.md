# Smart Judicial System (PJSR)

Arabic RTL citizen judicial platform.

## Runtime architecture (current)

```text
React/Vite frontend
  → NestJS API (backend/src/main.ts)
       → PostgreSQL · Redis · MinIO · Qdrant
  → BullMQ
  → NestJS AI Worker (backend/src/worker.ts)
```

Python `ai-service` is **not** part of the runtime.

## Quick start (development)

1. Start infra: `docker compose -f infra/docker/docker-compose.dev.yml up -d`
2. Backend: copy `backend/.env.development` → `backend/.env`, then:
   - `cd backend && npm ci && npx prisma migrate deploy && npm run start:dev`
   - `npm run worker:dev` (separate terminal; avoid dual `--watch` on Windows `dist` lock — use `build` + `start:prod` / `worker:prod` if needed)
3. Frontend: set `VITE_API_MODE=real` and `VITE_API_BASE_URL=http://localhost:3000/api/v1` (see `frontend/.env.development`). Production builds **reject** `VITE_API_MODE=mock` and require a real API URL — no silent mock fallback.

Demo citizen (development seed only — `prisma db seed` refuses `NODE_ENV=production`): `dev.citizen@localhost.local` / `DevCitizen1!`

## Production configuration

See `backend/.env.production.example` and `infra/docker/.env.production.example`.

| Concern | Production rule |
|---------|-----------------|
| AI | `AI_PROVIDER_MODE=openai`, OpenAI chat + embeddings, Qdrant, PDF extract, local OCR — **no mock** |
| Nafath | **DEFERRED** — `NAFATH_MODE=inactive` (not required) |
| Payment | **DEFERRED** — `PAYMENT_PROVIDER=deferred` (not required; no fake success) |
| Auth | Email/password + Argon2id + JWT |

Missing `OPENAI_API_KEY` or Qdrant in production **fails fast** (no silent mock fallback).

### Production deploy

Launch runbook (single VPS, Compose, Nginx, Let's Encrypt): `docs/LAUNCH-CHECKLIST.md`.

- Compose: `infra/docker/docker-compose.production.yml`
- Object storage image: `pgsty/silo` (`minio/minio` was removed from Docker Hub)
- Guide: `docs/PRODUCTION-DEPLOYMENT.md`
- HTTPS: `docs/HTTPS.md`
- Backup/restore: `docs/PRODUCTION-BACKUP-RESTORE.md`
- Smoke test: `docs/PRODUCTION-SMOKE-TEST.md`
- Handoff: `docs/MANAGER_HANDOFF.md`

## Docs

- `ARCHITECTURE.md` — system architecture
- `docs/PHASE-S-AUDIT.md` / `docs/PHASE-S-RESULT.md` — production realification
- `docs/PHASE-T-RESULT.md` / `docs/PHASE-T5-RESULT.md` — real AI / live RAG
- `docs/PHASE-U-AUDIT.md` / `docs/PHASE-U-RESULT.md` — production infrastructure
- `docs/LAUNCH-CHECKLIST.md` — tomorrow's production deploy
- `docs/MANAGER_HANDOFF.md` — current handoff
- `docs/PRODUCTION_READINESS_MATRIX.md` — what is real vs deferred

## Health

- `GET /health` — liveness
- `GET /health/ready` — Postgres, Redis, object storage (when configured), Qdrant (when enabled), AI config modes (no secrets)
- `GET /readyz` — readiness alias
