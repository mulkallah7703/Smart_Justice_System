# Production-like smoke test

No mock success. Use a real deployment (or production compose with real OpenAI + Qdrant Cloud credentials).

**Nafath / Payment:** not part of this smoke test.

---

## Preconditions

- [ ] `docker compose ... up -d` healthy  
- [ ] `GET /health` → 200  
- [ ] `GET /health/ready` → 200 with postgres/redis/objectStorage/qdrant/aiConfig up  
- [ ] Frontend served over HTTPS with `VITE_API_MODE=real`  
- [ ] `OPENAI_API_KEY` and `AI_QDRANT_*` set on **api** and **worker** only  

---

## Flow

| # | Step | Pass criteria |
|---|------|----------------|
| 1 | Open production frontend | App loads; no mock banner; no localhost API calls in network tab |
| 2 | Register test account | `POST /api/v1/auth/register` → 201 |
| 3 | Login | `POST /api/v1/auth/login` → JWT |
| 4 | Verify JWT | Token has `sub`, `role`; no nationalId in payload |
| 5 | `GET /api/v1/users/me` | 200; profile matches |
| 6 | Create/use case | Case row in Postgres |
| 7 | Upload legal PDF (English text-layer for TRUSTED RAG) | 201; object in MinIO |
| 8 | Verify MinIO | Object exists at document `storageKey` |
| 9 | Verify Postgres | `Document` row; later pages/chunks |
| 10 | `POST /api/v1/ai/advisor/analyze` | 202; `AiJob` created |
| 11 | BullMQ | Job moves PENDING → PROCESSING → DONE |
| 12 | AI Worker | Worker logs process job; API has **no** processor |
| 13 | Extract | TRUSTED page text in Postgres |
| 14 | OpenAI embedding | Chunks `embeddingStatus=READY`; model `text-embedding-3-small` |
| 15 | Qdrant upsert | Points in `legal_chunks_v1` for `documentId` |
| 16 | Retrieve | `POST /api/v1/ai/advisor/retrieve` returns evidence |
| 17 | Answer | Real OpenAI model; `insufficientEvidence=false` when evidence exists |
| 18 | Citations | `documentId` / `chunkId` / `pageNumber` match Postgres |
| 19 | Ownership | Second user → insufficient / empty retrieve |
| 20 | Provider failure | Invalid OpenAI key or Qdrant → clear error; **no** mock answer |

Optional automated mirror:  
`RUN_LIVE_RAG_TESTS=true npm run test:live` (backend) against reachable infra + credentials.

---

## Record results

Date: ________  
Environment URL: ________  
Operator: ________  

| Step | Result (PASS/FAIL) | Notes |
|------|--------------------|-------|
| 1–20 | | |

**Smoke test status for Phase U in CI/agent environment:** run on the owner’s production host; mark **NOT VERIFIED** until executed there with real DNS/TLS.
