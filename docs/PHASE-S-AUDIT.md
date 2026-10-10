# Phase S — Production Realification Audit

> Discovery-only inventory (Step 0). Classifications reflect repository state **before** Phase S code changes unless noted.

## Classification legend

| Label | Meaning |
|-------|---------|
| **REAL** | Production-capable implementation wired and selectable |
| **TEST-ONLY MOCK** | Mock adapter for tests/dev; must not be selected in production |
| **PRODUCTION MOCK** | Mock reachable or forced on a production path (blocker) |
| **DEFERRED** | Intentionally out of current product scope |
| **BROKEN** | Logic prevents correct production use |
| **UNKNOWN** | Insufficient evidence |

## Critical boot blockers (pre–Phase S)

| # | Issue | Classification |
|---|--------|----------------|
| 1 | `AI_PROVIDER_MODE` typed as `'mock'` only; mock forbidden in prod **and** any other value rejected | **BROKEN** |
| 2 | `PAYMENT_PROVIDER` same double-bind | **BROKEN** (also **DEFERRED** product) |
| 3 | `NAFATH_MODE=mock` refused in prod; `real` boots but fails closed without official client; **blocks** prod if default mock | **BROKEN** gate / **DEFERRED** product |
| 4 | Worker `LLM_PROVIDER` always mock via `selectMockLlm` | **PRODUCTION MOCK** |
| 5 | Readiness checks only Postgres + Redis (no MinIO/Qdrant/AI config) | Gap (**UNKNOWN** severity) |

## Inventory

| Area | Path | Classification | Notes |
|------|------|----------------|-------|
| Env validation | `backend/src/config/env.validation.ts` | BROKEN (prod AI/pay/nafath) | See blockers |
| Worker LLM wiring | `ai-providers.module.ts` `LLM_PROVIDER` | PRODUCTION MOCK | Never selects OpenAI |
| Answer LLM | `ANSWER_LLM_PROVIDER` + `openai-llm.provider.ts` | REAL | When `AI_LLM_MODE=openai` |
| Embeddings OpenAI | `openai-embedding.provider.ts` | REAL | Needs key |
| Embeddings mock | `mock-embedding.provider.ts` | TEST-ONLY MOCK | |
| Qdrant | `qdrant-vector.store.ts` | REAL | Needs URL |
| Vector mock | `mock-vector.store.ts` | TEST-ONLY MOCK | |
| PDF extract | `pdf-text-extractor.provider.ts` | REAL | |
| Local OCR | `local-ocr.provider.ts` | REAL | tessdata required |
| Mock LLM/OCR/text | `providers/mock/*` | TEST-ONLY MOCK | |
| Worker processor | `ai-job.processor.ts` | PRODUCTION MOCK | Result `mock: true`; uses `LLM_PROVIDER` |
| Answer/retrieve/guide | `ai-answer` / `ai-retrieval` / `guide/*` | MIXED → REAL when modes set | |
| Health ready | `health.service.ts` | REAL partial | PG+Redis only |
| Auth email/password | `auth.service.ts` | REAL | Active path |
| Nafath mock | `mock-nafath.adapter.ts` | TEST-ONLY MOCK | |
| Nafath real | `real-nafath.adapter.ts` | DEFERRED | Fail-closed |
| Payment mock | `mock-payment.provider.ts` | TEST-ONLY MOCK | Only adapter |
| Payment module | `payments.module.ts` | BROKEN for prod boot | |
| Judicial upgrade | `card-tier.service.ts` | DEFERRED | Controlled unavailable |
| Compose infra | `docker-compose.dev.yml` | REAL (dev) | PG Redis MinIO Qdrant |
| Worker Dockerfile | `worker.Dockerfile` | BROKEN vs validateEnv | `NODE_ENV=production` without real AI/pay/nafath modes |
| API/FE Docker | `backend/frontend.Dockerfile` | DEFERRED | `# TODO` |
| Python ai-service | historical | DEFERRED / UNUSED | Not runtime |
| Frontend mocks | `frontend/**/*Api.ts` when no base URL | TEST-ONLY MOCK | |
| Notifications stubs | `modules/notifications/*` | DEFERRED | Not in AppModule |

## Defaults when env omitted (pre–Phase S)

All AI modes → `mock`; `PAYMENT_PROVIDER` → `mock`; `NAFATH_MODE` → `mock`.

## Phase S intent (targets)

| Concern | Target |
|---------|--------|
| AI production | OpenAI chat + embeddings + Qdrant + PDF + local OCR; **no** mock selection |
| Payment | **DEFERRED** — does not block boot; controlled unavailable |
| Nafath | **DEFERRED / inactive** — does not block boot; not required for READY |
| Worker GENERATE | Real OpenAI when production-configured |
| Health | PG, Redis, MinIO, Qdrant, AI config (no secrets) |

## Nafath = DEFERRED

Not required for current production operation. Active auth is email/password.

## Payment = DEFERRED

Not required for current production operation. Judicial card paid upgrade remains unavailable without a real gateway.
