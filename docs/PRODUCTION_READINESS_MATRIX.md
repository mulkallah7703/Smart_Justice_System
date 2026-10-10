# Production readiness matrix (Phase R)

Inspected against the live repository on 2026-08-30. Classification uses:

`REAL + VERIFIED` · `REAL + NOT VERIFIED` · `MOCK + VERIFIED` · `BLOCKED` · `DEFERRED`

| Component | Status | Notes |
|-----------|--------|-------|
| Auth (email/password) | REAL + VERIFIED | Register/login/JWT/`/users/me` live OK |
| Auth (Nafath) | PRESENT / INACTIVE | Code retained; not used by UI |
| Users | REAL + VERIFIED | |
| Cases | REAL + VERIFIED | IDOR covered in e2e |
| Documents + MinIO | REAL + VERIFIED | Private MinIO; ownership checks |
| Lawyers | REAL + VERIFIED | Availability OK |
| Consultations | REAL + VERIFIED | Payment deferred |
| Advisor | MOCK + VERIFIED | Live OpenAI BLOCKED (no keys) |
| OCR | REAL + VERIFIED | Local; REVIEW_REQUIRED fail-closed |
| Embeddings | MOCK + VERIFIED | No OpenAI key in env |
| Qdrant | REAL + NOT VERIFIED (live AI path) | Infra healthy; AI modes mock |
| RAG / LLM Answer | MOCK + VERIFIED | |
| Legal Guide | MOCK + VERIFIED | Live start OK |
| Alerts | REAL + VERIFIED | |
| Kiosk API | REAL + VERIFIED | Hardware NOT VERIFIED |
| Judicial Card + QR | REAL + VERIFIED | Not government-signed |
| Payment | DEFERRED | Untouched |
| OpenAI live | BLOCKED | Credentials unavailable |

## Health

- `GET /health` → ok
- `GET /health/ready` → postgres + redis up (not OpenAI)

## Production refuse-closed (unchanged)

- `NAFATH_MODE=mock` refused when `NODE_ENV=production`
- Mock payment / mock AI modes refused in production
- CORS `*` rejected

## Runtime verified this phase

- Node 20.19.4 · Prisma 5.22.0 · 11 migrations up to date
- Docker: Postgres, Redis, MinIO, Qdrant healthy on `127.0.0.1`
- API + Worker start independently
- Worker queue payload remains `{ aiJobId }`
