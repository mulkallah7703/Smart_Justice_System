# المنظومة العدلية الذكية — Architecture

> Smart Judicial System · Current repository architecture (as implemented) · Arabic RTL

This document describes the **actual running architecture** of the codebase.
It is the source of truth for technical review and manager delivery.

Status legend used below:

| Label | Meaning |
|-------|---------|
| **REAL IMPLEMENTED** | Code exists and is wired into API / worker / frontend |
| **MOCK / DEVELOPMENT** | Adapter or mode for local/tests; refused or incomplete for production |
| **DEFERRED** | Intentionally out of current delivery scope |
| **INACTIVE / PLANNED** | Present in repo or docs as future work; not used by active flows |

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Tech Stack](#2-tech-stack)
3. [Runtime Architecture](#3-runtime-architecture)
4. [Frontend Structure](#4-frontend-structure)
5. [Backend Structure](#5-backend-structure)
6. [AI Architecture (NestJS)](#6-ai-architecture-nestjs)
7. [Authentication](#7-authentication)
8. [Database](#8-database)
9. [Infrastructure](#9-infrastructure)
10. [Security Boundaries](#10-security-boundaries)
11. [API Surface](#11-api-surface)
12. [Deferred and Inactive Items](#12-deferred-and-inactive-items)
13. [Documentation Notes](#13-documentation-notes)

---

## 1. System Overview

**المنظومة العدلية الذكية** is a citizen-facing judicial platform: legal guidance, document-backed AI advice, lawyer directory and booking, alerts, kiosk session APIs, and a smart judicial card — Arabic RTL first.

### Active product domains (REAL IMPLEMENTED)

| Domain | Notes |
|--------|--------|
| Auth (email / password) | Active login and registration |
| Users | Profile (`/users/me`) |
| Cases / Legal File | Citizen-owned cases |
| Documents + MinIO | Upload / list / download |
| Lawyers + availability | Directory and slots |
| Consultations / Booking | Create consultation; payment not completed |
| AI Advisor | Analyze jobs, retrieve, answer + citations |
| Legal Guide | Guided dialogue sessions |
| Alerts | List / mark read |
| Kiosk (API) | Session start / scan / print API |
| Judicial Card | Card + application QR |

### Explicitly not active delivery

| Topic | Status |
|-------|--------|
| Payment gateway | **DEFERRED** — `PAYMENT_PROVIDER=deferred` in production; controlled unavailable (no fake success). **Not required for boot or readiness.** |
| Official Nafath government auth | **DEFERRED / inactive** — `NAFATH_MODE=inactive` in production; email/password is active auth. **Not required for boot or readiness.** |
| Python FastAPI `ai-service` | **UNUSED** — never powered the runtime; Nest owns AI |
| SMS / email / push notifications | **INACTIVE** — TODO stubs under `notifications/`; not registered in `AppModule` |

### Production AI policy (Phase S)

- Production **must** select real OpenAI chat + embeddings + Qdrant + PDF extract + local OCR
- `AI_PROVIDER_MODE=openai` wires the worker GENERATE LLM (no silent mock fallback)
- Missing `OPENAI_API_KEY` or Qdrant URL **fails fast**
- Mock adapters remain for **tests/development only**

### Design principles (as implemented)

- UI talks to Nest HTTP APIs only (never to the database or MinIO directly)
- PostgreSQL is authoritative for ownership and document text used in RAG
- AI heavy work runs in a **separate Nest worker** process (BullMQ), not inside every API request for analysis jobs
- Arabic extraction trust is fail-closed: OCR and Arabic TEXT_LAYER stay `REVIEW_REQUIRED` and do not enter embeddings/RAG

---

## 2. Tech Stack

### Frontend — REAL IMPLEMENTED

| Technology | Role |
|------------|------|
| React + TypeScript | UI |
| Vite | Build / dev server |
| React Router | Client routing + lazy screens |
| Zustand | Auth token persistence |
| Fetch-based `apiRequest` | HTTP client (`frontend/src/shared/api/httpClient.ts`) |

Live vs mock UI data is controlled by **`VITE_API_MODE`** and **`VITE_API_BASE_URL`** in `frontend/src/shared/api/mode.ts`.

- Production builds: real API only; missing URL fails at startup (`assertProductionApiConfig`).
- Development mocks: only when `VITE_API_MODE=mock` is set explicitly.
- Empty URL no longer silently enables mocks in real mode.

### Backend — REAL IMPLEMENTED

| Technology | Role |
|------------|------|
| NestJS | Modular HTTP API + DI |
| TypeScript | Shared language |
| Prisma | ORM + migrations (`backend/prisma/`) |
| BullMQ + Redis | AI job queue |
| Passport JWT | Access-token validation |
| class-validator | DTO validation |
| Argon2 | Password hashing (`password.service.ts`) |
| pdfjs-dist + `@napi-rs/canvas` | PDF text / page render |
| tesseract.js | Local OCR in worker |
| OpenAI SDK | Optional embeddings + chat (**MOCK / DEVELOPMENT** when modes are `mock`) |
| Qdrant client | Optional vector store |

### Data stores — REAL IMPLEMENTED (local compose)

| Technology | Role |
|------------|------|
| PostgreSQL 16 | Source of truth |
| Redis 7.2 | Rate limits + BullMQ |
| MinIO | Private document objects |
| Qdrant | Derived vector index (when `AI_VECTOR_STORE_MODE=qdrant`) |

### Not part of the current runtime AI stack

| Claim (historical / planned) | Current reality |
|------------------------------|-----------------|
| Python 3.12 FastAPI `ai-service` | **Not used**. Nest implements AI |
| LangChain microservice | **Not used** |
| Elasticsearch / TimescaleDB / Kong / Vault as required runtime | **Not** in `docker-compose.dev.yml` |

---

## 3. Runtime Architecture

```text
React (Vite) frontend
        │  HTTPS/HTTP  /api/v1   Bearer JWT (live mode)
        ▼
NestJS API
  backend/src/main.ts
  backend/src/app.module.ts
        │
        ├── PostgreSQL   (Prisma)
        ├── Redis        (rate limits, BullMQ)
        ├── MinIO / S3   (document bytes)
        └── Qdrant       (vectors; optional vs in-process mock store)
                │
                │  BullMQ payload: { "aiJobId": "..." }
                ▼
NestJS AI Worker (separate process)
  backend/src/worker.ts
  backend/src/worker.module.ts
        │
        └── Document analysis pipeline (extract → pages → chunks → embed)
```

- API process: enqueue jobs, sync retrieve/answer/guide, domain CRUD  
- Worker process: **no HTTP controllers**; consumes BullMQ only  

Entry commands (package scripts):

- API: `npm run start:prod` → `node dist/main.js`
- Worker: `npm run worker:prod` → `node dist/worker.js`

---

## 4. Frontend Structure

Root: `frontend/src/`

| Area | Path / role |
|------|-------------|
| Routing | `core/router/AppRouter.tsx`, `RequireAuth.tsx` |
| i18n (Arabic) | `core/i18n/ar.ts` |
| Auth UI | `/login`, `/register` — `features/auth/LoginScreen.tsx`, `RegisterScreen.tsx` |
| Auth API | `features/auth/authApi.ts` — `login` / `register` (active); `verifyNafath` retained but not routed as active login |
| Token store | `features/auth/authStore.ts` (Zustand persist) |
| Feature domains | `features/{alerts,legal-advisor,legal-guide,legal-file,documents,lawyers,booking,payment,judicial-card,kiosk,home,profile}/` |
| Shared HTTP | `shared/api/endpoints.ts`, `httpClient.ts`, `mode.ts` |

Protected application routes require a JWT via `RequireAuth`. Public routes: splash, onboarding, login, register.

Payment screens may exist in the UI for booking flow wiring; **payment gateway delivery is DEFERRED**.

---

## 5. Backend Structure

### 5.1 API root module

`backend/src/app.module.ts` imports (REAL IMPLEMENTED):

- `AuthModule`, `UsersModule`, `CasesModule`, `DocumentsModule`
- `LawyersModule`, `ConsultationsModule`, `PaymentsModule`
- `AlertsModule`, `KioskModule`, `JudicialCardModule`
- `AiAdvisorModule`, `AiGuideModule`
- `HealthModule`, `DatabaseModule`, `RedisModule`, `LoggingModule`

Comment in `AppModule`: AI analysis is enqueued on the API; the **processor lives in the worker**.

### 5.2 Worker root module

`backend/src/worker.module.ts` imports:

- `ConfigModule`, `LoggingModule`, `DatabaseModule`, `AiWorkerModule`

No controllers — no inbound HTTP surface.

### 5.3 Domain modules (controllers under `/api/v1`)

| Module | Controller prefix |
|--------|-------------------|
| Auth | `auth` |
| Users | `users` |
| Cases | `cases` |
| Documents | `documents` |
| Lawyers | `lawyers` |
| Consultations | `consultations` |
| Payments | `payments` (**DEFERRED** product / mock provider) |
| Alerts | `alerts` |
| Kiosk | `kiosk` |
| Judicial Card | `judicial-card` |
| AI Advisor | `ai/advisor` |
| AI Guide | `ai/guide` |

### 5.4 Shared

- `shared/database/prisma.service.ts`
- `shared/cache/redis.service.ts`
- `shared/exceptions/*`, `shared/validation/*`
- Documents storage: `modules/documents/storage/` (MinIO)

### 5.5 Not registered

- `modules/notifications/**` — TODO stubs; not imported by `AppModule`

---

## 6. AI Architecture (NestJS)

AI is entirely inside Nest (`backend/src/modules/ai/**`).  
There is **no** runtime dependency on Python FastAPI, LangChain, or `ai-service/`.

### 6.1 Module map

| Piece | Path |
|-------|------|
| API advisor | `ai-advisor.module.ts`, `ai-advisor.controller.ts`, `ai-advisor.service.ts` |
| Sync retrieval | `ai-retrieval.service.ts` |
| Sync answer + citations | `ai-answer.service.ts`, `prompts/legal-answer.prompt.ts` |
| Legal Guide | `guide/ai-guide.module.ts`, `guide/ai-guide.service.ts`, … |
| Shared AI services | `ai.module.ts` — jobs, pages, chunks, embedding ingest |
| Providers | `providers/ai-providers.module.ts` |
| Queue | `queue/ai-queue.module.ts` |
| Worker processor | `worker/ai-job.processor.ts`, `worker/ai-worker.module.ts` |
| Vector stores | `vector/qdrant-vector.store.ts`, `vector/mock-vector.store.ts` |

### 6.2 Provider selection (env-driven)

Configured in `providers/ai-providers.module.ts` and `config/env.validation.ts`:

| Concern | Modes |
|---------|--------|
| Text extraction | `mock` \| `pdf` (`pdf/pdf-text-extractor.provider.ts`) |
| OCR | `mock` \| `local` (`ocr/local-ocr.provider.ts`, tesseract.js) |
| Embeddings | `mock` \| `openai` |
| Vector store | `mock` \| `qdrant` |
| Answer / guide LLM | `mock` \| `openai` |

Production env validation **refuses** mock AI modes when `NODE_ENV=production`.

### 6.3 Document → answer pipeline (REAL IMPLEMENTED)

```text
Document (MinIO bytes + Postgres metadata)
   ↓
PDF text extraction  (± page render)
   ↓
Local OCR when text layer insufficient
   ↓
Extraction Trust Policy
   ↓
DocumentPage  (Postgres)
   ↓
TRUSTED pages only
   ↓
DocumentChunk  (Postgres)
   ↓
Embeddings  (OpenAI or mock)
   ↓
Qdrant upsert  (or mock vector store)
   ↓
Retrieval  (vector candidates)
   ↓
PostgreSQL authoritative ownership + chunk text
   ↓
LLM Answer
   ↓
Evidence / citations
```

| Step | Implementation |
|------|----------------|
| Trust assignment | `providers/extraction-trust.ts` |
| Persist pages | `document-pages.service.ts` |
| Chunk TRUSTED only | `document-chunks.service.ts`, `chunking/text-chunker.ts` |
| Embed + upsert | `embedding-ingest.service.ts` |
| Async job stages | `worker/ai-job.processor.ts` |
| Retrieve | `ai-retrieval.service.ts` |
| Answer | `ai-answer.service.ts` |

**Trust policy (fail-closed):**

- `TRUSTED` → may enter chunks / embeddings / RAG evidence  
- `REVIEW_REQUIRED` → excluded (includes OCR and Arabic TEXT_LAYER)  
- `UNUSABLE` → excluded  

BullMQ job payload remains minimal:

```json
{ "aiJobId": "..." }
```

Document bytes are **not** placed on the queue; the worker loads objects from MinIO using Postgres metadata.

### 6.4 Legal Guide

Synchronous Nest APIs under `ai/guide`:

- Session + messages in Postgres (`AiGuideSession`, `AiGuideMessage`)
- LLM via `ANSWER_LLM_PROVIDER`
- Implementation: `guide/ai-guide.service.ts`, stage/dialogue helpers, `prompts/legal-guide.prompt.ts`

---

## 7. Authentication

### 7.1 Active flow — REAL IMPLEMENTED

```text
POST /api/v1/auth/register
   → name, email, password (no client role / userId / nationalId)
   → Argon2id passwordHash
   → PostgreSQL User (role = CITIZEN)
   → Judicial card created as needed

POST /api/v1/auth/login
   → email + password
   → verify hash
   → JWT { sub: User.id, role }
   → protected APIs (JwtAuthGuard)
   → ownership via request.user.sub
```

Key files:

- `modules/auth/auth.controller.ts`
- `modules/auth/auth.service.ts`
- `modules/auth/password.service.ts`
- `modules/auth/strategies/jwt.strategy.ts`
- `modules/auth/guards/jwt-auth.guard.ts`
- `modules/auth/guards/auth-rate-limit.guard.ts`

Frontend: `/register`, `/login` only for active auth UX.

### 7.2 Nafath — INACTIVE (retained)

| Fact | Detail |
|------|--------|
| Present | Yes — `MockNafathAdapter`, `RealNafathAdapter`, `POST /auth/nafath/verify` |
| Registered | Yes in `AuthModule` via `NAFATH_ADAPTER` |
| Active UI login | **No** — not linked from `AppRouter` as the current login |
| Official government integration | **DEFERRED / INACTIVE** until real contract + client |

Do not treat Mock Nafath as production identity.

---

## 8. Database

ORM: Prisma — `backend/prisma/schema.prisma` + migrations under `backend/prisma/migrations/`.

Core models (REAL IMPLEMENTED):

- `User` (optional `nationalId`, unique `email`, `passwordHash`)
- `JudicialCard`, `Lawyer`, `LawyerAvailabilitySlot`
- `Case`, `Hearing`, `Deadline`
- `Consultation`, `Payment`, `PaymentWebhookEvent` (payment product **DEFERRED**)
- `Document`, `DocumentPage`, `DocumentChunk`
- `Alert`, `Notification`
- `KioskDevice`, `KioskSession`
- `AiGuideSession`, `AiGuideMessage`
- `AiJob`, `AiJobDocument`
- `AuditLog`

PostgreSQL remains authoritative for user-owned resources and chunk text used after vector search.

---

## 9. Infrastructure

### 9.1 Local development compose — REAL IMPLEMENTED

File: `infra/docker/docker-compose.dev.yml`

| Service | Binding |
|---------|---------|
| PostgreSQL | `127.0.0.1:5432` |
| Redis | `127.0.0.1:6379` |
| MinIO | `127.0.0.1:9000` (console `9001`) |
| Qdrant | `127.0.0.1:6333` |

API, worker, and frontend are typically started via npm (or separate images), not as services inside this compose file.

### 9.2 Production containers (Phase U) — REAL

| Image | Dockerfile | Runtime |
|-------|------------|---------|
| API | `infra/docker/backend.Dockerfile` | `prisma migrate deploy` then `node dist/main.js` |
| Worker | `infra/docker/worker.Dockerfile` | `node dist/worker.js` + baked OCR langdata |
| Frontend | `infra/docker/frontend.Dockerfile` | Nginx serving Vite `dist` (`VITE_API_MODE=real`) |
| Edge | `infra/nginx/nginx.production.conf` | TLS termination; `/` → FE; `/api/` → API |

Compose: `infra/docker/docker-compose.production.yml`  
Qdrant Cloud remains external (not replaced by local Qdrant in production).

### 9.3 Legacy / inactive stubs

- `infra/docker/ai-service.Dockerfile` — **deprecated** (build fails intentionally); Python AI removed
- K8s/Helm stubs under `infra/k8s` / `infra/helm` — not the current delivery path

### 9.4 Process topology (delivery)

```text
Internet → Nginx (HTTPS)
            → Frontend (static)
            → NestJS API → PostgreSQL · Redis · MinIO
                         → BullMQ → NestJS AI Worker → OpenAI · Qdrant Cloud
```

---

## 10. Security Boundaries

| Boundary | Behavior |
|----------|----------|
| Identity | JWT `sub` = application User id |
| Ownership | Queries scoped to JWT subject; foreign resources follow safe not-found conventions |
| Passwords | Argon2id; never returned in API payloads |
| Documents | Private object storage; download requires ownership |
| AI trust | Only TRUSTED text → chunks → embeddings → RAG evidence |
| Queue | Minimal `{ aiJobId }`; no JWT / document bytes / nationalId in payload |
| Qdrant | Ranking aid; Postgres authorizes and supplies text |
| CORS | Explicit origins; `*` rejected |
| Production config | Mock Nafath / mock payment / mock AI modes refused when `NODE_ENV=production` |

---

## 11. API Surface

Global prefix: `/api/v1` (health endpoints excluded).

Representative routes (REAL IMPLEMENTED):

| Area | Examples |
|------|----------|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/nafath/verify` (inactive UI) |
| Users | `GET /users/me` |
| Cases / Documents | CRUD-style list/detail/upload/download |
| Lawyers / Booking | list, detail, availability, `POST /consultations` |
| Payments | endpoints exist; **gateway DEFERRED** |
| Alerts / Kiosk / Card | list/read, session/scan/print, card/qr |
| Advisor | `POST /ai/advisor/analyze`, `retrieve`, `answer`, `GET .../jobs/:id` |
| Guide | `POST /ai/guide/start`, `answer`, summary |
| Health | `GET /health`, `GET /health/ready` (Postgres + Redis on ready) |

---

## 12. Deferred and Inactive Items

### Payment — DEFERRED

- Payment **gateway integration is not part of the current active delivery**
- Do not describe Payment as completed
- Nest `PaymentsModule` / mock provider may exist for scaffolding; product settlement remains deferred
- Judicial Card paid upgrade remains unavailable while payment is deferred

### Nafath — INACTIVE

- Code and configuration boundary retained for a future official client
- Active authentication is **email + password** only

### Python `ai-service/` — INACTIVE / unused scaffold

- Historical scaffold only; **not** part of the runtime
- AI is Nest API + Nest worker + providers under `backend/src/modules/ai/**`
- Do not claim FastAPI or LangChain powers the current AI system

### Other INACTIVE stubs

- `notifications` Nest TODOs (not in `AppModule`)
- Physical kiosk hardware (API only in this repo)

---

## 13. Documentation Notes

- Prefer this file and `docs/MANAGER_HANDOFF.md` / `docs/PRODUCTION_DELIVERY.md` for delivery status
- Older sections that described a Python FastAPI microservice as the live AI tier are **obsolete** and have been replaced by Section 6 above
- Environment variables for AI modes, JWT, S3, Redis, Qdrant, and Nafath modes are documented in `backend/.env.example` and validated in `backend/src/config/env.validation.ts`

---

*Last aligned to the repository implementation: NestJS modular monolith + separate AI worker, React/Vite frontend, compose infra (PostgreSQL / Redis / MinIO / Qdrant), email/password auth, deferred payment, inactive Nafath UI.*
