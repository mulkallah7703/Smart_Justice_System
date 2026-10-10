# Phase T.5 — Full Real AI/RAG Verification Result

**Date:** 2026-09-12  
**Scope:** Complete real AI pipeline (OpenAI + Qdrant Cloud + Nest AI Worker).  
**Out of scope (unchanged):** Nafath = DEFERRED · Payment = DEFERRED

---

## Status summary

| Item | Status |
|------|--------|
| OpenAI Live | **VERIFIED** |
| Qdrant Live | **VERIFIED** |
| AI Worker | **VERIFIED** |
| Full RAG | **VERIFIED** |
| Citation Validation | **VERIFIED** |
| No mock fallback (fail-closed) | **VERIFIED** (provider binding + invalid OpenAI / unreachable Qdrant) |
| Nafath | **DEFERRED — NOT MODIFIED** |
| Payment | **DEFERRED — NOT MODIFIED** |

---

## 1. Original skipped suite / 6 skipped tests

When `npm run test:live` ran **without** live enable flags, Jest reported:

- **1 skipped suite**
- **6 skipped tests**
- **2 passed** (always-on gate tests)

### Breakdown

| Suite / tests | Count | Why skipped |
|---------------|------:|-------------|
| `LIVE INTEGRATION TESTS` (`test/live/live-integration.spec.ts`) | **1 suite · 3 tests** | Requires `RUN_LIVE_INTEGRATION_TESTS=1` **and** dedicated `LIVE_*` credentials (`LIVE_DATABASE_URL`, `LIVE_REDIS_URL`, `LIVE_S3_*`, `LIVE_QDRANT_URL`, `LIVE_OPENAI_API_KEY`). This is a **thin smoke** suite (credential presence + Qdrant `/readyz` + tiny embedding) — **not** full RAG. |
| `LIVE OpenAI` (`openai.live.spec.ts`) | **2 tests** | Requires `RUN_LIVE_AI_TESTS=true` + `OPENAI_API_KEY` / `LIVE_OPENAI_API_KEY`. |
| `LIVE Qdrant` (`qdrant.live.spec.ts`) | **1 test** | Requires `RUN_LIVE_QDRANT_TESTS=true` + Qdrant URL. |
| Gate tests in OpenAI + Qdrant files | **2 passed** | Always run; assert skip gating only. |

### Were they safely enabled?

| Suite | Safely enabled? | Notes |
|-------|-----------------|-------|
| OpenAI live | **Yes** | Loads `backend/.env` via dotenv; `RUN_LIVE_AI_TESTS=true` → chat + embedding PASS. |
| Qdrant live | **Yes** | Same dotenv; creates payload indexes before filtered search (Cloud requirement). |
| `live-integration.spec.ts` | **Intentionally left gated** | Not the full pipeline. Still needs a separate `LIVE_*` env block; Full RAG uses normal app env vars instead. |
| Full RAG | **Added + enabled** | `test/live/rag-pipeline.live.spec.ts` with `RUN_LIVE_RAG_TESTS=true`. |

**Final live run (with RAG + OpenAI + Qdrant flags):** 3 passed suites, 10 passed tests; **1 suite / 3 tests still skipped** = thin `live-integration` only (expected).

**Do not treat the thin `LIVE INTEGRATION TESTS` suite as Full RAG verification.**

---

## 2. Full RAG live suite

**File:** `backend/test/live/rag-pipeline.live.spec.ts`  
**Gate:** `RUN_LIVE_RAG_TESTS=true` + OpenAI key + Qdrant URL  

Forces real modes for the Jest process (overrides `.env.test` mocks):

- `AI_PROVIDER_MODE=openai`
- `AI_LLM_MODE=openai`
- `AI_EMBEDDING_MODE=openai`
- `AI_VECTOR_STORE_MODE=qdrant`
- `AI_TEXT_EXTRACTOR_MODE=pdf`
- `AI_OCR_MODE=local`
- Unique `AI_QUEUE_PREFIX` so only the in-process Nest worker consumes jobs

### Pipeline exercised (no mocks)

Test user (email/password register+login) → upload English text-layer PDF → MinIO → Postgres `Document` → `AiJob` → BullMQ → **Nest AI Worker** → PDF extract → trust (`TRUSTED`) → chunk → **real OpenAI embedding** → **real Qdrant upsert** → **real Qdrant retrieve** → **real OpenAI chat** → citation validation → final answer.

### Result (this run)

```
PASS test/live/rag-pipeline.live.spec.ts
  √ binds real OpenAI + Qdrant + PDF providers (no mocks)
  √ runs upload → worker → embed → retrieve → cited OpenAI answer
  √ fails closed for invalid OpenAI credentials (no mock fallback)
  √ fails closed for unreachable Qdrant (no mock fallback)
```

Job `resultJson` asserted: `mock: false`, `llmProvider: 'openai'`, `extractorEngine: 'pdfjs-text-layer-v1'`, `chunksEmbedded >= 1`, vectors present in Qdrant Cloud collection `legal_chunks_v1`.

---

## 3. AI Worker

| Check | Result |
|-------|--------|
| API process has no `AiJobProcessor` | Pass |
| Worker Nest context has `AiJobProcessor` | Pass |
| Job reaches `DONE` via worker (not API) | Pass |
| Worker LLM / embedding / vector providers | `openai` / `openai` / `qdrant` |

---

## 4. Qdrant

| Check | Result |
|-------|--------|
| Points stored for test `documentId` / `userId` | Pass |
| Filtered retrieve returns that document | Pass |

### Fix applied for Qdrant Cloud

Cloud requires payload indexes for filtered search. `QdrantVectorStore.ensureCollection` now creates:

- `userId` (keyword)
- `trust` (keyword)
- `embeddingModel` (keyword)
- `pipelineVersion` (**integer** — matches numeric payload)

Without this, upsert succeeded but retrieve/answer failed with `AI_VECTOR_STORE_ERROR`.

---

## 5. OpenAI

| Check | Result |
|-------|--------|
| Worker stage uses real chat completion | Pass (`llmProvider: openai`, non-mock model) |
| Embedding ingest uses real embeddings | Pass (`text-embedding-3-small`, chunks `READY`) |
| Answer path uses real `generateAnswer` | Pass (non-mock `model` in response) |

---

## 6. Citations

Final answer:

- `insufficientEvidence: false`
- Claims include citations whose `documentId` / `pageNumber` / `chunkId` match the uploaded test document and Postgres chunks
- Answer content references the lease rent fact from the evidence (no fabricated doc ids)

---

## 7. Failure handling

| Check | Result |
|-------|--------|
| Invalid OpenAI key rejects; worker stays bound to `openai` (no mock switch) | Pass |
| Unreachable Qdrant rejects; worker stays bound to `qdrant` | Pass |
| Production config still refuses mock AI modes | Unchanged (Phase S) |

---

## 8. How to re-run

```powershell
cd backend
$env:RUN_LIVE_RAG_TESTS="true"
# Optional provider smokes:
$env:RUN_LIVE_AI_TESTS="true"
$env:RUN_LIVE_QDRANT_TESTS="true"
npm run test:live -- --forceExit
```

Requires real values in `backend/.env` (never commit secrets):

- `OPENAI_API_KEY`, `OPENAI_CHAT_MODEL`, `OPENAI_EMBEDDING_MODEL`
- `AI_QDRANT_URL`, `AI_QDRANT_API_KEY`
- Local Postgres / Redis / MinIO (`DATABASE_URL`, `REDIS_URL`, `S3_*`)
- OCR tessdata under `.ocr-data` for `AI_OCR_MODE=local`

---

## 9. Files touched (T.5)

- `backend/test/live/rag-pipeline.live.spec.ts` — **new** full RAG live suite
- `backend/test/live/openai.live.spec.ts` — load `.env` via dotenv
- `backend/test/live/qdrant.live.spec.ts` — load `.env`; create payload indexes before filtered search
- `backend/test/live/live-integration.spec.ts` — clarified as thin smoke, not Full RAG
- `backend/test/jest-live.json` — timeout 180s
- `backend/src/modules/ai/vector/qdrant-vector.store.ts` — payload indexes for Cloud filtered search
- `docs/PHASE-T5-RESULT.md` — this file

**Nafath / Payment:** not modified.
