# Phase T — Real AI + Production API Mode Audit

## Goals

1. Eliminate frontend production mock API fallback
2. Harden/verify OpenAI + Qdrant (live tests opt-in)
3. Safe Arabic RAG improvements without weakening trust
4. Configurable chunk overlap
5. Citation / injection / isolation tests

## Frontend mock inventory (pre-change)

| Location | Behavior | Target classification |
|----------|----------|----------------------|
| `shared/api/mode.ts` | Empty `VITE_API_BASE_URL` → mock | Fix: mock only if `VITE_API_MODE=mock` and not production |
| `*Api.ts` domains | `!isDomainLive` → in-browser mock data | Fix: `isMockApiMode()` only |
| `authApi.ts` | Dummy `dev-token-*` when not live | Fix: mock mode only; else real API / fail |
| Vitest specs | Empty URL = mock | Update: set `VITE_API_MODE=mock` |

## Trust policy (unchanged)

Arabic TEXT_LAYER + OCR remain `REVIEW_REQUIRED` (`extraction-trust.ts`). No automatic TRUSTED promotion.

## Deferred

- Nafath — DEFERRED — NOT REQUIRED
- Payment — DEFERRED — NOT REQUIRED
- Hybrid BM25 retrieval — deferred to later phase
