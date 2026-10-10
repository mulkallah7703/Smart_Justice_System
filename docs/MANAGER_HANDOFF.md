# Manager handoff — Smart Judicial System

**Date:** 2026-10-10  
**Launch target:** 11 October 2026, single Linux VPS  
**Runbook:** `docs/LAUNCH-CHECKLIST.md`

```text
APPLICATION CODE: ready to deploy once the owner supplies the host, DNS, TLS, OpenAI key, and Qdrant Cloud.
NOT a claim that a public URL is already live.
```

Nafath and Payment stay **deferred**. They are not launch blockers. The UI does not offer a fake Nafath login or a fake successful payment.

## What is real

| Module | Classification |
|--------|----------------|
| Auth (email/password) | REAL. Argon2id + JWT (15 minutes). |
| Users / profile | REAL |
| Cases | REAL, including create. Owner-only reads (IDOR checked). |
| Documents | REAL. PDF, JPEG, PNG. 10 MB. Signature check. Stored in S3-compatible object storage. |
| Lawyers + booking | REAL. After booking, the screen says payment is not available. |
| Alerts | REAL. Home does not invent a deadline. |
| Judicial card + QR | REAL application token. Not a government credential. Paid upgrade is marked coming later. |
| Advisor, embeddings, RAG, legal guide | REAL OpenAI + Qdrant code path. **Live calls were not re-run here** (no API key). Production refuses mock mode. |
| OCR | REAL local Tesseract in the worker image. Untrusted text stays `REVIEW_REQUIRED`. |
| Kiosk API | REAL. No physical device. |
| Payment | DEFERRED. Provider `deferred` never returns success. |
| Nafath | DEFERRED. `NAFATH_MODE=inactive`. Not shown on login. |

## Demo login (development only)

`npx prisma db seed` creates:

| Field | Value |
|-------|--------|
| Email | `dev.citizen@localhost.local` |
| Password | `DevCitizen1!` |

The seed **exits with an error** when `NODE_ENV` is `production`, `staging`, or unset. Do not run it on the VPS. Production users register through the site.

## How to start a local real-mode check

```text
1. docker compose -f infra/docker/docker-compose.dev.yml up -d
2. cd backend && cp .env.example .env
3. npx prisma migrate deploy && npx prisma generate
4. NODE_ENV=development npx prisma db seed     # local demo data only
5. npm run build && npm run start:prod          # API :3000
6. npm run worker:prod                          # separate terminal
7. cd ../frontend
8. VITE_API_MODE=real VITE_API_BASE_URL=http://localhost:3000/api/v1 npm run dev
```

Dev Compose binds Postgres, Redis, Silo (S3), and Qdrant to `127.0.0.1` only. AI in that `.env.example` is mock. Production Compose is not.

## Citizen path to show

1. Splash → onboarding → register → login
2. Home (your name and card, no sample case)
3. Legal file → add a case → upload a document on the case
4. Advisor or legal guide (mock only if `AI_*_MODE=mock`; production uses OpenAI)
5. Lawyers → book → confirmation that payment is not charged
6. Alerts, judicial card, logout

## Known limits to say out loud

- Payment and paid card upgrades are not live
- Nafath is not live
- The judicial card QR is not an official government ID
- Kiosk hardware was not tested
- Scanned Arabic documents are not treated as trusted text
- The session token is stored in browser `localStorage` (short TTL, not an HttpOnly cookie)
- `minio/minio` cannot be pulled anymore; Compose uses `pgsty/silo`

## Owner actions before the public URL

| Action | Why |
|--------|-----|
| VPS, DNS, Let's Encrypt | No public host was provisioned in this work |
| `OPENAI_API_KEY` | Production will not boot, and will not answer, without it |
| Qdrant Cloud URL + API key | Same. Vectors are not stored in Postgres |
| Off-site Postgres and object-storage backups | Documented, not automated |
| Do not seed demo credentials | Known password must not exist in production |

SMTP is not used. There is no outbound mail to configure.
