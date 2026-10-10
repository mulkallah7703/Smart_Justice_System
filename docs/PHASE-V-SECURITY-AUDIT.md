# Phase V — Security Audit

**Date:** 2026-09-16  
**Project:** PJSR (Saudi legal/judicial platform)  
**Method:** Code/configuration review only — no invented findings.  
**Deferred:** Nafath · Payment (unchanged)

---

## Attack surface

| Surface | Exposure |
|---------|----------|
| Public HTTPS (Nginx) | Frontend static, `/api/*`, `/health`, `/health/ready`, `/readyz` |
| NestJS API | Auth, users, cases, documents, AI advisor/guide, consultations, alerts, payments (deferred), kiosk |
| Nest AI Worker | No public HTTP; Redis/BullMQ consumer |
| Postgres / Redis / MinIO | Internal Docker network in production compose |
| Qdrant Cloud / OpenAI | Outbound from API/worker only |

---

## Existing security controls (verified)

| Control | Status |
|---------|--------|
| Argon2id password hashing | Present |
| JWT Bearer verify via Passport (`ignoreExpiration: false`) | Present |
| JWT `sub` reloaded from DB (role from DB) | Present |
| Global `ValidationPipe` whitelist + forbidNonWhitelisted | Present |
| Resource ownership via JWT `user.sub` (documents, cases, AI jobs, guide, alerts, consultations) | Present |
| RAG: server-side `userId` filter + Postgres re-auth | Present |
| Answer prompt: instruction/data separation + citation validation | Present |
| Upload: magic bytes, size 10MB, sanitized filename, UUID storage keys | Present |
| MinIO: no public signed URLs; downloads via authenticated API | Present |
| CORS allowlist; `*` rejected in production config | Present |
| Helmet on Nest API | Present |
| Pino redact for common secrets | Present (incomplete — see findings) |
| Auth / AI / upload rate limits (Redis) | Present (auth IP trust issue — see findings) |
| Production env refuses mock AI / mock Nafath / mock payment | Present |
| Docker images: no baked OpenAI/JWT/DB secrets | Present |
| SSRF: no user-controlled outbound URL fetch found | N/A (surface absent) |

---

## Findings

### V1 — HIGH — Auth rate-limit bypass via client `X-Forwarded-For`

| Field | Detail |
|-------|--------|
| Component | `AuthRateLimitGuard` |
| Issue | Rate-limit key uses first hop of `X-Forwarded-For` without trusting only a configured proxy. Clients can rotate the header. |
| Exploit | Unlimited `/auth/login` / `/auth/register` attempts by changing `X-Forwarded-For` each request. |
| Fix | Prefer socket/`request.ip` with Nest `trust proxy` only when behind Nginx; ignore untrusted `X-Forwarded-For`. |
| Test | Unit/e2e: spoofed XFF must not create a new bucket when proxy trust is off. |
| Status | **FIXED** — `request.ip` only + `TRUST_PROXY_HOPS` / Express trust proxy |

### V2 — HIGH — MinIO root credentials used by API/worker

| Field | Detail |
|-------|--------|
| Component | `docker-compose.production.yml` |
| Issue | `S3_ACCESS_KEY`/`S3_SECRET` mapped from `MINIO_ROOT_*`. Compromised API env = full MinIO admin. |
| Exploit | Steal env → create public policies, delete all objects, access all tenants’ files. |
| Fix | Dedicated least-privilege MinIO access key for app; root only for `minio-init`. Document rotation. |
| Test | Compose/env example uses distinct app credentials; docs updated. |
| Status | **FIXED** — `minio-init` creates bucket-scoped app user; root not used by API/worker |

### V3 — MEDIUM — Login timing oracle

| Field | Detail |
|-------|--------|
| Component | `AuthService.login` |
| Issue | Missing user returns before `argon2.verify`. |
| Exploit | Timing distinguishes registered emails. |
| Fix | Always verify against a dummy Argon2id hash when user/hash missing. |
| Test | Unit: missing user still calls verify path (dummy). |
| Status | **FIXED** — `PasswordService.verifyDummy()` |

### V4 — MEDIUM — Register email enumeration

| Field | Detail |
|-------|--------|
| Component | `AUTH_EMAIL_ALREADY_EXISTS` |
| Issue | Distinct 409 reveals registered emails. |
| Exploit | Account probing. |
| Fix | Prefer generic conflict / email-out-of-band notice; keep rate limits. (Product tradeoff — document if partial.) |
| Test | Optional: response shape does not include “exists” wording for attackers. |
| Status | **FIXED (Phase V.1)** — duplicate register returns same 201 success shape; no `AUTH_EMAIL_ALREADY_EXISTS` on public register; timing aligned via `verifyDummy` |

### V5 — MEDIUM — JWT in `localStorage` + no CSP

| Field | Detail |
|-------|--------|
| Component | Frontend `authStore` + Nginx |
| Issue | XSS can steal access token; edge Nginx lacks CSP. |
| Exploit | Injected script exfiltrates Bearer token (15m TTL). |
| Fix | Add conservative CSP on edge; document cookie migration as future work (no rewrite). |
| Test | Nginx config contains CSP header. |
| Status | **DEFERRED (Phase V.1)** — HttpOnly cookie migration unsafe without CSRF/logout redesign; Bearer + CSP retained; see PHASE-V1-RESULT |

### V6 — MEDIUM — Residual LLM prompt injection

| Field | Detail |
|-------|--------|
| Component | Answer + Guide |
| Issue | Architectural separation exists; LLM may still obey malicious document text for narrative. Citations gated on answer path. |
| Exploit | Malicious PDF steers wording; should not leak secrets or forge evidence IDs. |
| Fix | Keep hierarchy; regression tests for injection strings (existing + extend). |
| Test | Security suite: injection document does not leak env/keys; citations remain valid. |
| Status | **STRENGTHENED (Phase V.1)** — explicit instruction hierarchy, untrusted delimiters, secret-leak answer gate; residual narrative risk remains for LLM wording |

### V7 — LOW — Argon2 parameters not pinned

| Field | Detail |
|-------|--------|
| Component | `PasswordService` |
| Fix | Explicit memory/time/parallelism/hashLength. |
| Status | **FIXED** — explicit Argon2id memory/time/parallelism/hashLength |

### V8 — LOW — JWT algorithm not explicit

| Field | Detail |
|-------|--------|
| Component | `JwtModule` / `JwtStrategy` |
| Fix | `algorithms: ['HS256']` on verify/sign. |
| Status | **FIXED** |

### V9 — LOW — Log redaction gaps

| Field | Detail |
|-------|--------|
| Component | `logging.module.ts` |
| Issue | Missing `passwordHash`, `AI_QDRANT_API_KEY`, `REDIS_URL`, etc. |
| Status | **FIXED** |

### V10 — LOW — Download unbounded rate / full buffer

| Field | Detail |
|-------|--------|
| Component | Document download |
| Fix | Align nginx body limit; optional download rate limit; streaming is larger change — document. |
| Status | **PARTIAL** (nginx `client_max_body_size 12m`; streaming deferred) |

### V11 — LOW — Unauthenticated readiness topology leak

| Field | Detail |
|-------|--------|
| Component | `/health/ready`, `/readyz` |
| Status | **ACCEPTED** for orchestrators; document risk |

### V12 — INFO — Password policy length-only; no refresh tokens

| Field | Detail |
|-------|--------|
| Status | Documented remaining risk |

### V13 — INFO — Dependency advisories

| Field | Detail |
|-------|--------|
| Backend | `tar` overridden to `7.5.22` (closes critical install-time advisory); `bullmq` → `5.58.9` (uuid ≥11.1.1). `pdfjs-dist@3` JS-exec advisory remains (major upgrade deferred). |
| Frontend | `react-router-dom` → `6.30.6` (closes 6.30.2–6.30.5 open-redirect XSS). Remaining moderate advisories require `react-router@≥7.18` major — deferred; SPA has no SSR; navigations are app-controlled. |
| Status | **PARTIALLY FIXED (Phase V.1)** — see PHASE-V1-RESULT |

---

## Implementation notes (Phase V)

| Area | Change |
|------|--------|
| Auth rate limit | `AuthRateLimitGuard` keys on `request.ip`; `TRUST_PROXY_HOPS` (default 1) |
| Password | Pinned Argon2id; `verifyDummy` on login miss |
| JWT | Explicit `HS256` algorithms on sign + verify |
| Logging | Expanded Pino redact paths |
| Nginx | CSP, Permissions-Policy, `client_max_body_size 12m` |
| MinIO prod | App key ≠ root; bucket policy via `minio-init` |
| Security tests | `backend/test/security/*` (auth, upload, RAG filter, prompt architecture) |

---

## Non-findings (explicit)

- No CRITICAL broken authentication or IDOR on reviewed resource APIs.
- No `jwt.decode` used for auth decisions in production code.
- No mass-assignment of `role`/`isAdmin` on register.
- No user-controlled MinIO `storageKey` or Qdrant collection/filter injection.
- No SSRF via user-controlled URLs.
- No `dangerouslySetInnerHTML` in frontend app source.
- No secrets baked into production Dockerfiles.

**Nafath = DEFERRED — NOT REQUIRED**  
**Payment = DEFERRED — NOT REQUIRED**
