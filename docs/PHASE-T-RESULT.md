# Phase T — Result

## Status summary

| Item | Status |
|------|--------|
| Frontend production mock fallback | **REMOVED** — mock only with explicit `VITE_API_MODE=mock` (dev/test); production builds reject mock and require `VITE_API_BASE_URL` |
| Authentication dummy token | **DEV/TEST ONLY** via explicit mock mode; real mode uses Nest JWT |
| OpenAI live | **NOT VERIFIED** — credentials unavailable (`OPENAI_API_KEY` missing) |
| Qdrant live | **NOT VERIFIED** for upsert/search suite flag; local `/readyz` reachable but `RUN_LIVE_QDRANT_TESTS` not run with credentials |
| AI Worker real providers | **IMPLEMENTED** (Phase S); production config requires openai+qdrant — live end-to-end not verified here |
| Arabic trust policy | **UNCHANGED** — Arabic/OCR remain `REVIEW_REQUIRED` |
| Nafath | **DEFERRED — NOT REQUIRED** |
| Payment | **DEFERRED — NOT REQUIRED** |

**Do not claim full “Production Ready” for live AI** without running `npm run test:live` with real keys.

In-scope code readiness after Phase T: **~88%** (frontend mock gate closed; live AI still unverified).

---

## 1. Files changed (highlights)

### Frontend
- `src/shared/api/mode.ts` — `VITE_API_MODE`, `isMockApiMode`, production assert
- `src/main.tsx` — `assertProductionApiConfig()`
- All `*Api.ts` — mock paths gated by `isMockApiMode()` only
- `src/test/setup.ts`, `vite.config.ts`, `mode.spec.ts`, API specs
- `.env.example`, `.env.development`, `.env.production.example`

### Backend
- `chunking/text-chunker.ts` — configurable overlap
- `chunking/text-normalize.ts` — NFC/whitespace for embedding inputs
- `document-chunks.service.ts`, `embedding-ingest.service.ts`, `ai-retrieval.service.ts`
- `config/env.validation.ts` — `chunkOverlap` / `AI_CHUNK_OVERLAP`
- Live tests: `test/live/openai.live.spec.ts`, `qdrant.live.spec.ts`, `jest-live.json`
- Unit: prompt-injection, normalize, chunk overlap, retrieval normalize expectation

### Docs
- `docs/PHASE-T-AUDIT.md`, `docs/PHASE-T-RESULT.md`
- README / ARCHITECTURE touch-ups as needed

## 2. Frontend mock behavior removed

| Before | After |
|--------|--------|
| Empty `VITE_API_BASE_URL` → silent mock APIs | Empty URL + real mode → `API_UNAVAILABLE` / no domain live |
| Production could ship without API URL | Production build runtime requires URL; `VITE_API_MODE=mock` throws |

## 3. Authentication verification

- Real path: register → login → JWT → `/users/me` via Nest
- Dummy `dev-token-*` only when `VITE_API_MODE=mock`
- No automatic demo login

## 4. OpenAI status

- Code: REAL IMPLEMENTED (`OpenAiLlmProvider`, embeddings)
- Models: `gpt-4o-mini`, `text-embedding-3-small`, 1536 dims
- Live smoke: **NOT VERIFIED** (no API key in environment)
- Suite: `npm run test:live` with `RUN_LIVE_AI_TESTS=true`

## 5. Qdrant status

- Code: REAL IMPLEMENTED + `ensureCollection` on init
- Live suite present; **NOT VERIFIED** under `RUN_LIVE_QDRANT_TESTS=true` in this run
- Local compose Qdrant `/readyz` returned 200 (infra up only)

## 6. AI Worker status

- Phase S wiring: worker `LLM_PROVIDER` → OpenAI when configured
- Full pipeline live E2E with paid OpenAI: **NOT VERIFIED** here

## 7. Arabic RAG changes

- Trust policy preserved (no auto-TRUSTED for Arabic/OCR)
- Embedding-time NFC + whitespace normalize (query + chunk embed inputs)
- Stored page text unchanged
- Hybrid BM25: **deferred**

## 8. Retrieval changes

- Query embedding uses `normalizeForEmbedding`
- Ownership filters + Postgres reauthorization unchanged
- Chunk overlap configurable (`AI_CHUNK_OVERLAP`, default **0**)

## 9. Citation validation

- Existing answer pipeline + e2e isolation retained
- New unit: prompt injection framing (`ai-prompt-injection.unit.spec.ts`)

## 10. Security tests

- Prompt-injection evidence framing
- Cross-user isolation covered by existing answer e2e
- Production mock API rejection (frontend mode)

## 11. Test counts

| Suite | Result |
|-------|--------|
| Backend unit | **398+ passed** (live dir excluded from unit; new normalize/injection/overlap tests) |
| Backend e2e | **177 passed** |
| Frontend | **164 passed** |
| Live | Gate suites skip without flags/keys — **not reported as pass** |

## 12. Build results

- Backend `typecheck` + `build`: pass
- Frontend `build`: pass

## 13. Live test results

| Provider | Result |
|----------|--------|
| LIVE OPENAI | **NOT VERIFIED** |
| LIVE QDRANT | **NOT VERIFIED** (full suite) |

## 14. Remaining blockers

1. Supply `OPENAI_API_KEY` and run `RUN_LIVE_AI_TESTS=true npm run test:live`
2. Run `RUN_LIVE_QDRANT_TESTS=true` against staging Qdrant
3. Optional: set `AI_CHUNK_OVERLAP=200` in staging after measuring recall
4. API/FE Docker images still stub
5. Nafath / Payment remain deferred

## 15. Production readiness percentage

**~88%** for in-scope functionality (frontend mock gate + code paths).  
**Live AI verification: incomplete.**

### Mock classification (remaining)

| Occurrence | Class |
|------------|-------|
| Frontend `VITE_API_MODE=mock` paths | DEVELOPMENT / TEST |
| Backend mock AI providers | TEST / DEVELOPMENT |
| Payment deferred / Nafath inactive | DEFERRED |
| Docs mentioning mock | DOCUMENTATION |

---

## Commands for operators

```bash
# Frontend production build must set:
# VITE_API_MODE=real
# VITE_API_BASE_URL=https://<api>/api/v1

# Live AI (optional):
cd backend
set RUN_LIVE_AI_TESTS=true
set OPENAI_API_KEY=...
set RUN_LIVE_QDRANT_TESTS=true
set AI_QDRANT_URL=http://127.0.0.1:6333
npm run test:live
```
