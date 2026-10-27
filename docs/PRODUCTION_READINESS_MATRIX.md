# Production readiness matrix

Inspected against the repository on **2026-10-10** (launch branch). This replaces the Phase R matrix, which still described AI as mock.

Classification:

`REAL + VERIFIED` · `REAL + NOT VERIFIED` · `MOCK + VERIFIED` · `BLOCKED` · `DEFERRED`

| Component | Status | Notes |
|-----------|--------|-------|
| Auth (email/password) | REAL + VERIFIED | Register/login/JWT/`/users/me`. Duplicate registration does not reveal whether the email exists. |
| Auth (Nafath) | DEFERRED | `NAFATH_MODE=inactive` in production. The login UI does not offer Nafath. The endpoint remains for a future official client and is not a launch path. |
| Users | REAL + VERIFIED | |
| Cases | REAL + VERIFIED | List/detail IDOR covered. Citizens can create their own case (`POST /cases`); the client cannot set `userId`. |
| Documents + object storage | REAL + VERIFIED | Private bucket, ownership checks, 10 MB, PDF/JPEG/PNG signature checks. Image is Silo (`pgsty/silo`) because `minio/minio` was removed from Docker Hub. |
| Lawyers | REAL + VERIFIED | Availability OK |
| Consultations | REAL + VERIFIED | Booking is real. The UI then says payment is coming later and does not charge. |
| Advisor | REAL + NOT VERIFIED (live) | Production code path is OpenAI + Qdrant + PDF extract + local OCR. Marked experimental (`AI_ADVISOR_EXPERIMENTAL=true`). Mock adapters exist for dev/CI only and are refused when `NODE_ENV=production`. This environment has no OpenAI key, so live answers were not re-run. |
| OCR | REAL + VERIFIED (unit, when tessdata present) | Local OCR, default tessdata `fast` (`best` selectable). Readable pages are `TRUSTED`; low-confidence pages stay `REVIEW_REQUIRED`. Missing language data fails closed. |
| Embeddings | REAL + NOT VERIFIED (live) | `text-embedding-3-small` when `AI_EMBEDDING_MODE=openai`. Mock only in development/tests. |
| Qdrant | REAL + NOT VERIFIED (Cloud) | Production requires `AI_QDRANT_URL`. Local Qdrant in dev compose is healthy. Cloud credentials were not available here. |
| RAG / LLM answer | REAL + NOT VERIFIED (live) | `gpt-4o-mini`. Production refuses mock. |
| Legal Guide | REAL + NOT VERIFIED (live) | Same LLM mode as the advisor. |
| Alerts | REAL + VERIFIED | Home shows a real unread alert, or nothing. The legal-file notifications tab lists the same alerts. |
| Kiosk API | REAL + VERIFIED | Hardware NOT VERIFIED. Not linked from the main citizen navigation. |
| Judicial Card + QR | REAL + VERIFIED | Not government-signed. Paid upgrade and wallet are marked coming later. |
| Payment | DEFERRED | `PAYMENT_PROVIDER=deferred` throws instead of inventing success. UI does not show a checkout. |
| Demo seed | REAL + VERIFIED | Refuses `NODE_ENV` other than `development` or `test`. Production entrypoint does not call it. |
| OpenAI live | BLOCKED | No API key in this environment. Required on the VPS before public AI answers work. |

## Health

- `GET /health` — liveness
- `GET /health/ready` and `GET /readyz` — Postgres, Redis, object storage when configured, Qdrant when enabled, AI config modes (no secrets)

## Production refuse-closed

- `NAFATH_MODE=mock` refused when `NODE_ENV=production`
- `PAYMENT_PROVIDER=mock` refused when `NODE_ENV=production`
- Mock AI modes refused when `NODE_ENV=production`
- Missing `OPENAI_API_KEY` or Qdrant URL fails boot
- CORS `*` rejected
- API listens on `0.0.0.0` and sends a Helmet content-security-policy (`default-src 'none'` for the JSON API). The browser CSP is on Nginx.

## What is not production-ready

- Public HTTPS on a real hostname (operator)
- Live OpenAI + Qdrant Cloud smoke (operator keys)
- Off-site backups (documented, not automated)
- HttpOnly cookie sessions (JWT remains in `localStorage`)
- Nafath, payments, wallet, paid card tiers
