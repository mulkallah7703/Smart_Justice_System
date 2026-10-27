# Manager handoff — Smart Judicial System (Phase R)

## Current status

```text
READY FOR MANAGER DEMO
```

Not ready for full production cutover while Payment, official Nafath, and live OpenAI credentials remain unresolved.

## Completed modules

| Module | Classification |
|--------|----------------|
| Auth (email/password) | REAL + VERIFIED (staging/dev stack) |
| Users | REAL + VERIFIED |
| Cases / Legal File | REAL + VERIFIED |
| Documents + MinIO | REAL + VERIFIED |
| Lawyers | REAL + VERIFIED |
| Consultations / Booking | REAL + VERIFIED (payment deferred) |
| Advisor pipeline | MOCK + VERIFIED (OpenAI live BLOCKED without keys) |
| OCR (local) | REAL + VERIFIED (policy fail-closed) |
| Embeddings / Qdrant / RAG / LLM | MOCK + VERIFIED locally; live OpenAI BLOCKED |
| Legal Guide | MOCK + VERIFIED (same LLM mode) |
| Alerts | REAL + VERIFIED |
| Kiosk (API) | REAL + VERIFIED |
| Judicial Card + QR | REAL + VERIFIED (not government-signed) |
| Payment | DEFERRED |
| Nafath | PRESENT BUT INACTIVE |

## Demo login

After `npx prisma db seed` (development only):

| Field | Value |
|-------|--------|
| Email | `dev.citizen@localhost.local` |
| Password | `DevCitizen1!` |

Or use **Create Account** (`/register`) then **Login** (`/login`).

Do not reuse these credentials in production.

## Startup instructions

Node **20.19.4** · Prisma **5.22.0**

```text
1. docker compose -f infra/docker/docker-compose.dev.yml up -d
2. cd backend
3. copy .env.example → .env (unique JWT_ACCESS_SECRET; CORS to frontend origin)
4. npx prisma migrate deploy
5. npx prisma generate
6. npx prisma db seed          # optional, demo data
7. npm run build
8. npm run start:prod          # API :3000
9. npm run worker:prod         # separate AI worker process
10. cd ../frontend
11. set VITE_API_BASE_URL=http://localhost:3000/api/v1
12. npm run build && serve dist/   # or npm run dev for local UI
13. GET http://localhost:3000/health
14. GET http://localhost:3000/health/ready
```

Compose binds Postgres/Redis/MinIO/Qdrant to `127.0.0.1` only.

## Manager demo flow (~10 minutes)

1. Splash → Onboarding → **Login** (or Register)
2. Home / profile (`/users/me`)
3. Legal File → cases
4. Documents → list / upload small PDF
5. Advisor → analyze → retrieve → answer (**Mock AI** unless OpenAI keys configured)
6. Legal Guide → start → answer → summary
7. Lawyers → availability → book (**skip Payment**)
8. Alerts → mark read
9. Kiosk → session start → scan (API only; no physical hardware claim)
10. Judicial Card → card + QR (upgrade shows deferred)
11. Logout

## Known limitations

- Payment settlement / card paid upgrade deferred
- Nafath inactive in UI (code retained)
- Live OpenAI not verified without API keys
- Physical kiosk QR/NFC hardware NOT VERIFIED
- Judicial Card QR is application opaque token — not an official government credential
- Readable Arabic TEXT_LAYER / OCR are `TRUSTED` and embedded. Garbled or low-confidence pages stay `REVIEW_REQUIRED`

## Production blockers

| Blocker | Notes |
|---------|--------|
| Official Nafath client + credentials | Required for government identity in production |
| Real payment provider | `PAYMENT_PROVIDER=mock` refused in production |
| Production secrets & private networking | Staging compose is localhost-bound |
| Live OpenAI (if required in prod) | Keys not present in this environment |
| Mock AI modes | Production env validation refuses mock AI adapters |

## Payment status

**Payment intentionally deferred and untouched.**

## Nafath status

```text
PRESENT IN PROJECT
NOT USED BY ACTIVE LOGIN
OFFICIAL INTEGRATION DEFERRED
```

## OpenAI status

```text
LIVE OPENAI VERIFICATION:
BLOCKED — credentials unavailable
```

This demo environment uses Mock AI adapters unless operators configure OpenAI + Qdrant modes explicitly.
