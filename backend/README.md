# Smart Judicial System — Backend

NestJS modular monolith foundation for **المنظومة العدلية الذكية**.

This phase provides a runnable API process, PostgreSQL via Prisma, health/readiness endpoints, local Docker infrastructure, development authentication (mock Nafath → JWT → `/users/me`), citizen Cases read APIs, and secure Documents upload/download (MinIO binaries + PostgreSQL metadata). **Payments, AI, lawyers, and other mock domains are not implemented yet.**

The existing frontend must keep using mock APIs until a later integration phase. Leave `VITE_API_BASE_URL` empty.

---

## Prerequisites

- Node.js 20+
- npm
- Docker Desktop (or Docker Engine + Compose) for local PostgreSQL, Redis, and MinIO

---

## Environments

| Environment | How it is used in this phase |
|-------------|------------------------------|
| **LOCAL** | Docker Compose + `backend/.env` copied from `.env.example`. Default. |
| **DEVELOPMENT** | Same stack as local, shared `NODE_ENV=development`. |
| **STAGING** | Not configured here. Use `prisma migrate deploy` against a staging database when that environment exists. |
| **PRODUCTION** | Not configured here. Do not reuse Compose credentials or `.env.example` values. |

This README does not describe Kubernetes or production deployment.

---

## Installation

From the repository root:

```bash
cd backend
npm install
copy .env.example .env
```

On Unix:

```bash
cp .env.example .env
```

`.env` is gitignored. Never commit secrets.

---

## Environment variables

See `.env.example`. Required to boot:

| Variable | Purpose |
|----------|---------|
| `NODE_ENV` | `development` \| `test` \| `staging` \| `production` |
| `PORT` | HTTP port (default `3000`) |
| `LOG_LEVEL` | `fatal` \| `error` \| `warn` \| `info` \| `debug` \| `trace` |
| `CORS_ORIGINS` | Comma-separated origins. Must not be `*`. Local frontend: `http://localhost:5173` |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_ACCESS_SECRET` | HMAC secret, min 32 characters. Local example only. |
| `JWT_ACCESS_EXPIRES_IN` | Access token lifetime. Default `15m`. |
| `NAFATH_MODE` | Future Nafath provider only (`mock` / `real`). **Not used by Login/Register.** |
| `MOCK_NAFATH_CODE` | **DEVELOPMENT ONLY** for `POST /auth/nafath/verify` (inactive UI). |
| `NAFATH_CLIENT_ID` / `NAFATH_CLIENT_SECRET` / `NAFATH_BASE_URL` | Future real Nafath boundary placeholders. |

Active authentication is **email + password** (`POST /auth/register`, `POST /auth/login`). Seed demo citizen: `dev.citizen@localhost.local` / `DevCitizen1!` (development only).

Optional:

`AUTH_RATE_LIMIT_MAX` (default 10), `AUTH_RATE_LIMIT_WINDOW_SEC` (default 60), `S3_*` (endpoint, access key, secret, bucket, optional region), `DOCUMENT_UPLOAD_RATE_LIMIT_MAX` (default 20), `DOCUMENT_UPLOAD_RATE_LIMIT_WINDOW_SEC` (default 900).

The process **fails fast** if required variables are missing, `DATABASE_URL` is not PostgreSQL, `NODE_ENV=production` with `NAFATH_MODE=mock`, or other refuse-closed production rules (mock payment / mock AI).

### Authentication (development)

```
POST /api/v1/auth/nafath/verify   { nationalId, nafathCode }
GET  /api/v1/users/me             Authorization: Bearer <accessToken>
PATCH /api/v1/users/me            { name?, phone?, email? }
```

Mock Nafath (`NAFATH_MODE=mock`) compares `nafathCode` to `MOCK_NAFATH_CODE`. It is not a government integration. Real mode never silently falls back to mock.

Rate limit: `AUTH_RATE_LIMIT_MAX` attempts per client IP per `AUTH_RATE_LIMIT_WINDOW_SEC`, stored in Redis. Production should keep this (or stricter) and later use a gateway. Refresh tokens, HttpOnly cookies, rotation, and CSRF are **not** implemented.

Access JWT payload is `{ sub, role }` only. No National ID.

### Documents

```
POST /api/v1/documents                 multipart: file + caseId
GET  /api/v1/documents                 optional ?caseId=
GET  /api/v1/documents/:id
GET  /api/v1/documents/:id/download    streams bytes after ownership check
```

All routes require a JWT. `userId` is taken from `request.user.sub` and is rejected if sent in the body.

PostgreSQL stores metadata only. MinIO stores the binary. Object keys are generated server-side as `users/{userId}/cases/{caseId}/documents/{documentId}` and never use the original filename.

Allowed types: PDF, JPEG, PNG (extension + declared MIME + magic bytes). Maximum size: **10 MB**, enforced by Multer and service validation. There is no product requirement for a larger limit.

Upload rate limit: **20 uploads per authenticated user per 900 seconds**, stored in Redis. If Redis is unavailable the guard **fails closed** (`DOCUMENT_RATE_LIMITED` / 429). It does not allow unlimited uploads.

Bucket `S3_BUCKET` (local default `sjs-documents-dev`) is created automatically on startup in `development` and `test` only. Production must provision the bucket and policies explicitly; the app will not create buckets when `NODE_ENV=production`.

The MinIO bucket is private (localhost-bound Compose ports, no public policy). Downloads go through the API after PostgreSQL ownership checks. Signed URLs are not issued.

If MinIO put succeeds and PostgreSQL metadata create fails, the service attempts to delete the orphaned object. If that cleanup fails, it logs `documentId` only. Eventual orphan cleanup is not implemented in this phase.

DELETE is not exposed: the Legal File Documents tab has no delete action.

---

## Docker Compose (local infrastructure)

From the repository root:

```bash
docker compose -f infra/docker/docker-compose.dev.yml up -d
```

Or from `backend/`:

```bash
npm run infra:up
```

| Service | Image | Host bind | Credentials (local only) |
|---------|--------|-----------|--------------------------|
| PostgreSQL 16 | `postgres:16-alpine` | `127.0.0.1:5432` | user `sjs` / password `sjs_dev_only_change_me` / db `sjs_dev` |
| Redis 7.2 | `redis:7.2-alpine` | `127.0.0.1:6379` | none |
| MinIO | pinned RELEASE | `127.0.0.1:9000` (API), `9001` (console) | `sjs_minio_dev` / `sjs_minio_dev_secret_local_only` |

Ports are bound to localhost only. Compose credentials are **development defaults** and must not be reused in production.

Stop:

```bash
npm run infra:down
```

---

## Database migration

Always use Prisma migrations. Do **not** use `prisma db push` as the workflow.

```bash
cd backend
npx prisma generate
npx prisma migrate deploy
```

During schema development:

```bash
npx prisma migrate dev
```

On staging/production (when those databases exist):

```bash
npx prisma migrate deploy
```

Optional synthetic seed (fake IDs only, marked development-only):

```bash
npx prisma db seed
```

---

## Development server

```bash
cd backend
npm run start:dev
```

API listen port: `PORT` (3000 by default).

Future domain routes will live under `/api/v1`. Health endpoints stay unversioned.

---

## AI worker

AI processing runs in its own process. The API only enqueues jobs onto Redis
(BullMQ) and reads their status; it registers no queue processor, so a long OCR
or model call can never block an API request.

```bash
cd backend
npm run worker:dev   # alongside npm run start:dev
```

The worker has no HTTP surface. In production it is built and started
separately (`node dist/worker.js`) and scaled on queue depth.

Only deterministic mock LLM adapters exist for chat generation.
Embeddings may be `mock` (tests/dev) or OpenAI `text-embedding-3-small`
(`AI_EMBEDDING_MODE`). Vector storage may be in-memory `mock` or Qdrant
(`AI_VECTOR_STORE_MODE`). Production refuses mock embedding and mock vector
store. OCR may be `mock` or in-process `local` (tesseract.js).

Document extraction (`AI_TEXT_EXTRACTOR_MODE=pdf`) reads the PDF text layer and
falls back to OCR for pages without usable text. Every page receives an explicit
trust status (`TRUSTED` | `REVIEW_REQUIRED` | `UNUSABLE`). Arabic TEXT_LAYER is
order-unresolved (Option B) and `REVIEW_REQUIRED`. OCR is `REVIEW_REQUIRED` and
is not authoritative legal text.

### Advisor API

`POST /api/v1/ai/advisor/analyze` accepts `{ "documentIds": [...] }`, verifies
that every document belongs to the caller, creates a `DOCUMENT_ANALYSIS` job,
enqueues `{ aiJobId }`, and returns `202` with the job id. Repeating the same
request returns the same job rather than queueing duplicate work, and the
per-user limit is configurable via `AI_ANALYSIS_RATE_LIMIT_MAX` /
`AI_ANALYSIS_RATE_LIMIT_WINDOW_SEC`.

`GET /api/v1/ai/advisor/jobs/:jobId` reports `status`, `progress`, and
`stageIndex`; a job belonging to another citizen is indistinguishable from one
that does not exist.

`POST /api/v1/ai/advisor/retrieve` returns ranked **evidence** (TRUSTED + READY
chunk text from PostgreSQL with provenance). It embeds the query, searches
Qdrant with a server-side `userId` filter, then re-validates ownership, trust,
and soft-delete in PostgreSQL. Empty results are `200` with `results: []`.
No LLM and no legal answer synthesis.

`POST /api/v1/ai/advisor/answer` runs RAG answer generation: retrieve evidence
→ build a delimited legal prompt → LLM (`AI_LLM_MODE=mock|openai`) → validate
JSON + citations against the server evidence map. Zero usable evidence skips
the LLM and returns `insufficientEvidence: true`. Citations are remapped to
PostgreSQL provenance only. Informational — not an official legal opinion.

Document
 ↓
DocumentPage
 ↓
ExtractionTrust (TRUSTED only)
 ↓
DocumentChunk
 ↓
Embedding provider (`mock` or OpenAI `text-embedding-3-small`)
 ↓
Qdrant collection `legal_chunks_v1` (cosine, 1536 dims for OpenAI)
 ↓
Retrieval (`POST /ai/advisor/retrieve`) — evidence only
 ↓
Answer (`POST /ai/advisor/answer`) — validated RAG citations
 ↓
Frontend AI UI (not implemented)

Arabic TEXT_LAYER and OCR remain `REVIEW_REQUIRED` and are **not** chunked,
embedded, retrieved, or used as RAG evidence. Chunk text is never rewritten.
Qdrant is a **derived** index; PostgreSQL remains canonical. The LLM is not an
authority — only validated retrieved evidence may ground answers.

---

## Health endpoints

| Endpoint | Meaning |
|----------|---------|
| `GET /health` | Process is alive |
| `GET /health/ready` | PostgreSQL and Redis respond |

Success shape (frontend can still read `data`):

```json
{
  "data": { "status": "ok" },
  "meta": { "timestamp": "...", "version": "v1" }
}
```

Readiness includes `data.checks.postgres` and `data.checks.redis` (`up` \| `down`). HTTP 503 if a required check fails. MinIO is not a readiness dependency.

---

## Tests

```bash
cd backend
npm test          # unit: env, envelope, ValidationPipe, auth, cases, documents
npm run test:e2e  # health + auth/users/cases/documents/AI; requires Compose + migrated database
npm run typecheck
npm run build
```

---

## Backend foundation architecture

```
Client
  → HTTP
    → Helmet / CORS / ValidationPipe / Exception filter / Envelope interceptor
      → HealthModule
      → AuthModule / UsersModule / CasesModule / DocumentsModule
        → PrismaService → PostgreSQL (document metadata)
        → RedisService → Redis (auth + upload rate limits)
        → ObjectStorage → MinIO (document binaries)
```

Lawyers, payments, alerts, kiosk, and AI modules remain unimplemented placeholders.

---

## Frontend

Do not set `VITE_API_BASE_URL` in this phase. The frontend mock adapters remain the runtime source of UI data.
