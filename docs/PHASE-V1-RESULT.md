# PHASE V.1 — SECURITY RISK CLOSURE RESULT

**Date:** 2026-09-16  
**Parent:** Phase V (`PHASE-V-RESULT.md`, `PHASE-V-SECURITY-AUDIT.md`)  
**Deferred integrations:** Nafath · Payment (unchanged)

------------------------------------------
STATUS
------------------------------------------

**PHASE V.1 COMPLETE WITH OPERATIONAL RISKS**

Technically actionable remaining risks from Phase V were closed or explicitly decided.
Host TLS / production smoke remain operational (require a real production host).

------------------------------------------
RISKS ADDRESSED
------------------------------------------

### 1. JWT in localStorage (V5)

**Decision: DEFERRED — do not migrate to HttpOnly cookies in V.1**

Audit finding:

- Login returns JSON `{ accessToken }`; frontend persists via Zustand → `localStorage` (`auth`).
- API uses `Authorization: Bearer` only (`ExtractJwt.fromAuthHeaderAsBearerToken()`).
- No `Set-Cookie`, cookie-parser, CSRF middleware, or server logout today.
- CORS already has `credentials: true`, but the SPA does not send `credentials: 'include'`.
- Dev is cross-origin (Vite ↔ API); prod nginx is same-origin — favorable later, insufficient alone.

Why migration now is unsafe:

- Introducing cookies without CSRF + server logout would create a worse CSRF surface.
- Half-migrating (cookies + still-readable localStorage JWT) does not remove XSS token theft.
- Would rewrite the verified Bearer auth contract across API, SPA, and e2e.

Mitigations retained: short JWT TTL (15m), Helmet, Nginx CSP / Permissions-Policy, rate limits.

Test: `backend/test/security/jwt-transport.unit.spec.ts`

### 2. Residual LLM narrative / prompt injection (V6)

**Strengthened (structural), residual narrative risk remains**

Changes:

- Explicit **INSTRUCTION HIERARCHY** in answer + guide system prompts.
- Application-policy framing before evidence; evidence wrapped in `<<<UNTRUSTED_DOCUMENT_DATA>>>` delimiters.
- Citation rules stated as non-waivable by document text.
- Defense-in-depth: `answerAppearsToLeakSecrets()` rejects model JSON that dumps env/keys/JWT-like tokens (citation validator unchanged).

Does **not** claim 100% narrative control of LLMs.

Tests: `backend/test/security/prompt-injection.unit.spec.ts` (+ existing answer/citation suites); live RAG still PASS.

### 3. Registration email 409 enumeration (V4)

**Fixed**

- Duplicate email no longer returns `409 AUTH_EMAIL_ALREADY_EXISTS`.
- Public register returns the same **201** success shape; no second account is created.
- Timing aligned with `verifyDummy`; audit action `AUTH_REGISTER_DUPLICATE_SUPPRESSED`.
- Frontend still navigates to login after register; legacy error string softened.

Tests: `auth-password.unit.spec.ts`, `auth-password.e2e-spec.ts`

### 4. Transitive dependency advisories (V13)

| Package | Action | Result |
|---------|--------|--------|
| `tar` (via canvas / node-pre-gyp) | npm `overrides` → `7.5.22` | Critical advisory cleared; app does not extract user TAR archives |
| `bullmq` | `5.34.0` → `5.58.9` | Pulls `uuid@11.1.1` (moderate uuid advisory closed) |
| `react-router-dom` | → `6.30.6` | Closes GHSA for 6.30.2–6.30.5 open-redirect XSS |
| `react-router` remaining moderate (needs ≥7.18) | **Not upgraded** | Major SPA router rewrite; no SSR; navigations are app-controlled constants |
| `pdfjs-dist@3` JS-exec advisory | **Not upgraded** | Fix is major `pdfjs-dist@5`; OCR/PDF path risk accepted pending dedicated upgrade project |

### 5. Phase U host TLS / smoke

**Operational — not solved by code**

Still require a real production host:

- TLS certificate issuance/renewal
- HTTPS end-to-end verification
- Production smoke against the live edge

Nginx configs already include HTTPS redirect / HSTS when certificates are mounted. No fabricated host verification in this phase.

------------------------------------------
RISKS REMAINING
------------------------------------------

- JWT remains in `localStorage` until a coordinated HttpOnly cookie + CSRF + logout project
- Residual LLM narrative steering (citations/secrets gated)
- `react-router` advisories that require major 7.18+ (SPA reachability limited)
- `pdfjs-dist@3` malicious-PDF JS advisory (major upgrade deferred)
- Production host TLS + smoke (operational)
- Prior accepted items unchanged: readiness topology (V11), download streaming (V10 partial), password policy length-only (V12)

------------------------------------------
TEST RESULTS
------------------------------------------

| Suite | Result |
|-------|--------|
| Backend Unit | **417 PASS** (≥414) |
| Security Unit | **18 PASS** (≥15) |
| Backend E2E | **178 PASS** |
| Frontend Tests | **164 PASS** |
| Frontend Build | **PASS** |
| Live OpenAI | **PASS** |
| Live Qdrant | **PASS** |
| Full RAG | **PASS** |
| Docker `sjs-api:phase-v1` | **PASS** |
| Docker `sjs-worker:phase-v1` | **PASS** |
| Docker `sjs-frontend:phase-v1` | **PASS** |

------------------------------------------
DEFERRED
------------------------------------------

Nafath: DEFERRED  
Payment: DEFERRED  
HttpOnly cookie auth + CSRF: DEFERRED (designed, not implemented)  
Production host TLS smoke: OPERATIONAL PENDING  

------------------------------------------
PHASE V.1 STATUS
------------------------------------------

**PHASE V.1 COMPLETE WITH OPERATIONAL RISKS**
