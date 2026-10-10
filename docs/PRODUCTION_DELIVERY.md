# Production delivery notes (Phase R)

Honest status for manager delivery. Payment gateway is **deferred**. Nafath is **inactive** in the UI.

## Verdict

| Claim | Status |
|-------|--------|
| READY FOR MANAGER DEMO | **YES** — email/password auth + domains against Nest + Postgres |
| READY FOR PRODUCTION DEPLOYMENT | **NO** — Payment, official Nafath, production secrets/network, live OpenAI if required |

## Active authentication

```text
Email + Password → JWT → existing APIs
```

Demo seed: `dev.citizen@localhost.local` / `DevCitizen1!` (development only). See [`MANAGER_HANDOFF.md`](./MANAGER_HANDOFF.md).

## Required services

| Service | Role | Compose |
|---------|------|---------|
| PostgreSQL | Source of truth | `infra/docker/docker-compose.dev.yml` |
| Redis | Rate limits + BullMQ | same |
| MinIO | Private document objects | same |
| Qdrant | Vectors when `AI_VECTOR_STORE_MODE=qdrant` | same |
| Nest API | `npm run start:prod` | — |
| Nest worker | `npm run worker:prod` (separate process) | — |
| Frontend | Vite build / static host | — |

Ports bound to `127.0.0.1` in compose.

## Shortest deploy sequence (staging / demo host)

1. `docker compose -f infra/docker/docker-compose.dev.yml up -d`
2. Configure `backend/.env` from `.env.example`
3. Optional real AI: OpenAI keys + non-mock `AI_*` modes + OCR langdata
4. `cd backend` → `npx prisma migrate deploy` → `npx prisma generate` → optional seed
5. `npm run build` → `npm run start:prod` and `npm run worker:prod`
6. Frontend: `VITE_API_BASE_URL=https://<api>/api/v1` → `npm run build` → serve `dist/`
7. Check `/health` and `/health/ready`

## Production refuse-closed rules

- `NAFATH_MODE=mock` cannot run under `NODE_ENV=production`
- Mock payment provider cannot run under `NODE_ENV=production`
- Mock embedding / vector / LLM / OCR / text-extractor modes cannot run under `NODE_ENV=production`
- `CORS_ORIGINS` must not include `*`

## Manager demo flow (~10 minutes)

1. Register or login (seed credentials above)
2. Home → Legal File → documents
3. Advisor (Mock AI unless OpenAI configured) → Guide
4. Lawyers → availability → book (**skip payment**)
5. Alerts → Kiosk API → Judicial Card + QR
6. Logout

## Phase R verification snapshot (2026-08-30)

| Item | Result |
|------|--------|
| Backend unit | **387** passed |
| Backend e2e | **177** passed |
| Backend `tsc` + `nest build` | pass |
| Prisma | 11 migrations, up to date; generate OK |
| Frontend unit | **163** passed |
| Frontend typecheck + build | pass |
| Lint | No lint script configured |
| Infra (PG/Redis/MinIO/Qdrant) | healthy |
| API + Worker | started |
| Live manager smoke (auth→domains) | pass |
| Live OpenAI | BLOCKED — credentials unavailable |
| Payment | DEFERRED — untouched |
| Nafath UI | INACTIVE |

## Related

- [`MANAGER_HANDOFF.md`](./MANAGER_HANDOFF.md)
- [`PRODUCTION_READINESS_MATRIX.md`](./PRODUCTION_READINESS_MATRIX.md)
- [`OPERATIONS_BACKUP_RESTORE.md`](./OPERATIONS_BACKUP_RESTORE.md)
- [`../infra/README.md`](../infra/README.md)
