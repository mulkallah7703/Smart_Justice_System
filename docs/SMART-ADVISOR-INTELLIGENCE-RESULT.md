# Smart Legal Advisor — Intelligence Upgrade Result

**Status: SMART ADVISOR IMPROVED WITH REMAINING RISKS**

The unrelated fixed questions are gone (verified by unit, render, e2e, and live tests).
Remaining risks concern legal-source grounding, not the conversation flow (see §11).

See `docs/SMART-ADVISOR-INTELLIGENCE-AUDIT.md` for the full trace.

## 1. Root cause

The Ejar question never came from the model. It was hardcoded UI reached through a
turn-count state machine:

- `guide-stage.ts` → first user message = `QUESTION`, every later one = `SUMMARY`,
  regardless of content.
- `LegalGuideChat` navigated to `/guide/question` on `QUESTION`, hiding the model reply.
- `ClarifyingQuestion.tsx` + `ar.guide.question.*` → static "هل يوجد عقد إيجار موثّق في
  منصة «إيجار»؟", static options, static tip, hardcoded "2 من 4". The selected option label
  was posted as the answer to a question the model never asked.
- `guide-dialogue.ts` → summary was a regex rental/non-rental template with a fixed "60 days".

## 2. Files changed

Backend

| File | Change |
| --- | --- |
| `prisma/schema.prisma`, `prisma/migrations/20261011120000_ai_guide_message_analysis/` | nullable `AiGuideMessage.analysis JSONB` (validated turn per assistant message) |
| `src/modules/ai/guide/guide-turn.ts` (new) | turn contract, domains, strict validator, citation/secret guards, clarification budget, repeat guard |
| `src/modules/ai/guide/prompts/legal-guide.prompt.ts` | new system prompt + fenced per-turn user prompt; static welcome; retry suffix; removed fixed clarify/summary replies |
| `src/modules/ai/guide/ai-guide.service.ts` | structured turn via existing `ANSWER_LLM_PROVIDER.generateAnswer`; bounded context; persist after success; summary from latest guidance |
| `src/modules/ai/guide/guide-stage.ts` | `CHAT \| QUESTION \| ANSWER` (no count-based machine) |
| `src/modules/ai/guide/mappers/guide.mapper.ts`, `dto/guide-response.dto.ts` | `turn` DTO, summary mapping |
| `src/modules/ai/guide/errors/guide.errors.ts` | `AI_GUIDE_SUMMARY_NOT_READY` (409) |
| `src/modules/ai/guide/guide-dialogue.ts` | **deleted** (regex template) |
| `src/modules/ai/providers/mock/mock-llm.provider.ts` | topic-neutral guide fixture (dev/test only; production refuses mock) |

Frontend

| File | Change |
| --- | --- |
| `features/legal-guide/useGuideChat.ts` | fresh session per inquiry; model suggested replies; retry without duplicates; no fake AI error bubble |
| `features/legal-guide/LegalGuideChat.tsx` | clarifications stay in chat; chips = model replies / retry / view summary; no auto-navigation |
| `features/legal-guide/GuideQuickReplies.tsx` | `onSelect` receives the option (id + label) |
| `features/legal-guide/mapGuide.ts`, `guide.types.ts`, `guideApi.ts` | validated answer mapping; new stage set; neutral mock mode |
| `features/legal-guide/ClarifyingQuestion.tsx/.css`, `GuideProgress.tsx/.css` | **deleted** (static questionnaire, fixed 2/4 progress) |
| `core/router/AppRouter.tsx` | `/guide/question` → `<Navigate to="/guide" replace />` |
| `core/i18n/ar.ts` | removed Ejar question/options/tip and rental mock fixtures; added actions, neutral mock text, `summaryNotReady` |
| `shared/api/errors.ts` | maps `AI_GUIDE_SUMMARY_NOT_READY`, `AI_GUIDE_INVALID_RESPONSE`, `AI_LLM_TIMEOUT`, `AI_LLM_RATE_LIMITED` |

No visual component was redesigned. Chat bubbles, composer, header, chips, colors, and RTL
are unchanged; only the static questionnaire screen (whose content *was* the bug) was removed.

## 3. Previous vs new behavior

| | Before | After |
| --- | --- | --- |
| Clarification | Always exactly one, always the Ejar question | 0..3, chosen by the model for this user's facts; one at a time |
| Direct question | Forced through question screen → summary | Answered immediately (`stage: ANSWER`) |
| Progress | Hardcoded "2 من 4" | No fake total; the conversation is not fixed-length |
| Summary | Regex rental template, "60 days" | Built from the validated guidance turn; duration "غير محددة", no invented deadlines |
| Model output | Free text, unvalidated | JSON contract, server-validated, one constrained retry, else error |
| AI failure | User message persisted; fake AI "error" bubble | Nothing persisted; error banner + retry chip; no duplicate |
| Welcome | One LLM call per session | Static greeting, no call |

## 4. Prompt changes

`LEGAL_GUIDE_SYSTEM_PROMPT` keeps the immutable hierarchy, secrecy, and jailbreak rules, and
adds: understand the issue/domains/goal first; preserve all aspects of multi-issue cases;
never assume unstated facts or documents; ask only when a missing fact materially changes the
answer, one question, never repeated, never unrelated; answer directly otherwise; honour
`MUST_ANSWER_NOW`; later user statements correct earlier facts; Saudi orientation without
importing other jurisdictions; **no article/decree/resolution numbers, statutory text,
deadlines, or verification claims while no trusted sources are listed**; urgent flag for
criminal/safety/deadline matters; JSON-only schema.

## 5. Conversation context

Each turn sends (fenced as untrusted data): the session's original question, the last 12
turns (assistant turns labelled clarification/guidance; welcome excluded), facts established
by the previous validated turn (marked correctable), clarifications used / max (3), and
`MUST_ANSWER_NOW`. History is loaded only for the owned session (`findFirst {id, userId}`).
A new inquiry is a new session. Messages are persisted only after a valid turn.

## 6. API contract changes

- `POST /ai/guide/answer` → `{ sessionId, reply, stage: 'QUESTION' | 'ANSWER', turn }`;
  `turn` = domains, understanding, knownFacts, missingFacts, needsClarification,
  clarificationQuestion, suggestedReplies, guidance, nextSteps, uncertainty, urgent,
  clarificationCount, `sourcesAvailable: false`, `sources: []`. Stage `SUMMARY` no longer exists.
- `POST /ai/guide/start` with `initialMessage` also returns `stage` + `turn`.
- `GET /ai/guide/summary/:id` → same shape as before; `409 AI_GUIDE_SUMMARY_NOT_READY`
  until guidance exists.
- Request DTOs unchanged. All callers, types, and tests updated together.

## 7. Security

Unchanged: JWT guard, per-user rate limit, ownership (identical 404 for foreign/missing),
TTL, message cap, `forbidNonWhitelisted` DTOs, RAG retrieval/citation validation
(`AiAnswerService` untouched). Added: model output validated before display/storage; secret-leak
pattern reused; unverified citation patterns rejected; conversation content fenced as data;
no fallback content on failure; mock LLM still refused in production by env validation.

## 8. Tests added / updated

Backend unit — `test/ai-guide.unit.spec.ts` (26) and `test/ai-guide.service.unit.spec.ts` (18),
replacing 9 tests that asserted the old count-based stages and rental template:

| Scenario | Coverage |
| --- | --- |
| A employment | question passed verbatim; reply = model's contextual question; no Ejar/rental text |
| B rental deposit | rental domain; deposit question; no employment text |
| C debt | debt domain; no rental/employment question |
| D definition | `ANSWER` with zero clarifications, one model call; summary from guidance |
| E ambiguous | asks for context, `GENERAL` domain |
| F complex | employment + injury + entitlement domains and facts preserved |
| G follow-up | original question, asked question, answer, and established facts in next prompt |
| H correction | correction reaches the model after the earlier fact; facts updated |
| I new inquiry | new session prompt contains no previous facts/questions |
| J isolation | foreign session → 404 for answer and summary, no model call, nothing stored |
| K failures | timeout, provider error, malformed ×2 → error, nothing persisted, retry not duplicated |
| L citations | unverified "المادة 77" output rejected and retried; `sourcesAvailable: false` |
| M Arabic | Arabic stored and returned verbatim |
| extra | clarification cap (3) → `MUST_ANSWER_NOW`; repeat-question guard; validator edge cases; mock fixture neutral |

Backend e2e — `test/ai-guide.e2e-spec.ts` (7): new contract, summary 409 before guidance,
stored roles/analysis, start with initial question, malformed output → 502 with nothing persisted.

Frontend — `LegalGuideChat.spec.ts` (8, renders the real screen in real-API mode):
question shown in chat with model replies and no static questionnaire; direct answer + summary
chip; chosen reply sent to the same session in order; failure → banner + retry without
duplicate; malformed response → error, no fallback; new inquiry → new session, no old
messages; `/guide/question` lands in chat; document stays `lang="ar" dir="rtl"`.
`guideApi.spec.ts` updated (6): contract mapping, malformed/inconsistent rejection.

Live (opt-in) — `test/live/guide.live.spec.ts` (7), real OpenAI, contract-level assertions.

## 9. Exact results (all executed)

| Suite | Result |
| --- | --- |
| Backend unit (`jest-unit.json`) | **452 / 452** (39 suites) |
| — security subset (`test/security`) | **18 / 18** |
| Backend e2e (`jest-e2e.json --runInBand`, mock AI) | **181 / 181** (17 suites) |
| Frontend (`vitest run`) | **186 / 186** (31 files) |
| Frontend build (`tsc --noEmit && vite build`) | **PASS** |
| Backend build (`nest build`) | **PASS** |
| Live guide (OpenAI, `RUN_LIVE_GUIDE_TESTS=true`) | **7 / 7** |
| Live RAG pipeline (OpenAI + local Qdrant, `RUN_LIVE_RAG_TESTS=true`) | **5 / 5** |
| Docker images (`backend`, `worker`, `frontend` Dockerfiles) | **all built (exit 0)** |

Note: an earlier e2e run in a shell that still carried live `AI_*` overrides showed 11
failures (real providers instead of mocks). With a clean environment the full suite passes;
the numbers above are from the clean run.

## 10. Live verification (real model, gpt-4o-mini, temperature 0)

| Input | Stage | Domains | Reply (model) |
| --- | --- | --- | --- |
| تم فصلي من العمل بدون سبب. | QUESTION | EMPLOYMENT | هل لديك عقد عمل مكتوب، وما هي مدة خدمتك في الشركة؟ |
| المؤجر يرفض إعادة مبلغ التأمين. | ANSWER | RENTAL_REAL_ESTATE | guidance on amicable request, complaint, lawyer; notes unknown contract terms |
| شخص استدان مني مبلغًا ويرفض السداد. | ANSWER | DEBT_FINANCIAL | amicable reminder, then claim before the competent court |
| ما المقصود بالشرط الجزائي في العقود؟ | ANSWER | CONTRACTS | direct definition |
| أريد أرفع قضية. | QUESTION | GENERAL | ما هو نوع القضية التي ترغب في رفعها؟ |
| شركتي فصلتني بعد إصابة أثناء العمل ولم تصرف مستحقاتي. | QUESTION | EMPLOYMENT, WORKPLACE_INJURY | asks about a formal complaint / injury evidence |
| follow-up: عقدي غير محدد المدة ووصلتني رسالة واتساب فقط | ANSWER | EMPLOYMENT | guidance staying on the dismissal |

No article numbers appeared; no turn needed the validation retry in this run.

## 11. Remaining limitations / risks

- **No trusted Saudi-law corpus.** RAG retrieval only covers the user's own uploaded documents,
  so guide answers are general model knowledge, explicitly marked unverified
  (`sourcesAvailable: false`, summary note). Body names (e.g. a ministry or court) are not
  source-verified. Proper grounding needs a curated legal-source collection — out of scope.
- Citation guard is pattern-based: it blocks article/decree/resolution numbers, which may also
  reject a legitimate reference to a contract clause numbered as "المادة"; the turn is retried
  once, then fails safely.
- Answer depth depends on the configured model (`gpt-4o-mini`); guidance is concise.
- Leaving the chat (e.g. to the summary) and returning starts a new inquiry; the previous
  session remains readable via its summary URL only.
- Clarification budget is fixed at 3 per inquiry (code constant).
- Mock mode (dev/test only) uses neutral placeholder text.
- The migration must be applied (`prisma migrate deploy`) before deploying the new API.
