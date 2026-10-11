# Smart Legal Advisor — Intelligence Audit

Scope: the conversational "المرشد القانوني الذكي" (Legal Guide) — routes `/guide`,
`/guide/question`, `/guide/summary/:sessionId`, backend `POST /api/v1/ai/guide/start`,
`POST /api/v1/ai/guide/answer`, `GET /api/v1/ai/guide/summary/:sessionId`.
(The document-analysis "المستشار" flow under `/advisor` uses the RAG answer path and
is not the source of the unrelated questions.)

## 1. Current flow (traced)

```
LegalGuideChat (mount)
  └─ useGuideChat.bootstrap → POST /ai/guide/start {}                (new session every mount)
       backend AiGuideService.start → composeReply(isWelcome)
         mock: static welcome · openai: LLM call with "SYSTEM_EVENT: session_start_welcome"
User types question → useGuideChat.sendMessage
  └─ POST /ai/guide/answer {sessionId, answer}
       backend: persist USER msg → load all msgs → stage = resolveGuideStage(userCount)
         userCount 1 → 'QUESTION', ≥2 → 'SUMMARY'                     (fixed by turn count)
       composeReply → llm.complete(free text) / mock: fixed GUIDE_CLARIFY_REPLY_AR
       persist ASSISTANT msg → return {reply, stage}
  └─ stage === 'QUESTION' → LegalGuideChat navigates to /guide/question
ClarifyingQuestion (/guide/question)
  - prompt   = ar.guide.question.prompt  "هل يوجد عقد إيجار موثّق في منصة «إيجار»؟"   (static)
  - options  = documented / notDocumented / noContract / unsure                (static)
  - tip      = Ejar documentation tip                                           (static)
  - progress = currentStep=2, totalSteps=4 → "2 من 4"                           (hardcoded)
  - confirm  → POST /ai/guide/answer with the static option label
       backend userCount=2 → stage 'SUMMARY' unconditionally → session COMPLETED
  └─ navigate /guide/summary/:id
GuidanceSummary → GET /ai/guide/summary/:id
       backend buildGuideSummary: regex /إيجار|مستأجر|مؤجر|rent…/ over all text
         rental → "نزاع إيجاري", "لجان المنازعات الإيجارية", "حتى ٦٠ يوماً", lease docs
         else   → generic "غير محدد" template
```

## 2. Root cause

The unrelated question is not produced by the model — it is **hardcoded UI**, reached
through a **fixed turn-count state machine**:

1. `backend/src/modules/ai/guide/guide-stage.ts` — `resolveGuideStage` returns `QUESTION`
   for the 1st user message and `SUMMARY` for every later one, regardless of content.
   The LLM's reply has no influence on whether a clarification is needed.
2. `frontend/src/features/legal-guide/LegalGuideChat.tsx` — on `stage === 'QUESTION'`
   it navigates away from the chat to `/guide/question`, so the model's actual reply
   (which may have been a relevant question) is effectively replaced.
3. `frontend/src/features/legal-guide/ClarifyingQuestion.tsx` + `ar.guide.question.*` —
   static Ejar/rental question, static options, static tip, hardcoded "2 من 4" progress.
   The user's chosen option label is sent as the "answer" to a question the model never asked.
4. `backend/src/modules/ai/guide/guide-dialogue.ts` — `buildGuideSummary` is a regex
   rental/non-rental template (incl. a "60 days" duration) — not derived from the conversation.

Contributing defects:

- Free-text model output (`llm.complete`) — no structured analysis, no validation of
  whether a clarification is needed, no facts tracking.
- `GUIDE_CLARIFY_REPLY_AR` (mock/deterministic path) is a fixed "عقد أو مستند موثّق" question.
- Mock frontend fixtures (`ar.guide.messages.userSample/aiFollowUp`, `replies.afterUser`,
  `quickReplies` "عقد موثق/غير موثق") are rental-specific.
- On LLM failure the USER message was already persisted, so a retry duplicates it in
  history; the frontend appended a fake AI bubble (`ar.guide.errorReply`).
- An LLM call was spent on the welcome greeting for every session.
- No clarification budget → nothing bounds clarification loops other than the message cap.

What is correct and kept: JWT auth, ownership (`findFirst {id, userId}`, identical 404 for
foreign/missing), rate-limit guard, message cap, session TTL, DTO validation
(`forbidNonWhitelisted`), system/untrusted separation, secret-leak pattern.

## 3. Legal-source grounding (RAG) finding

`AiRetrievalService.retrieve` searches only the **caller's own uploaded documents**
(`filters: { userId, trust: 'TRUSTED' }`). There is no trusted Saudi-law corpus in the
vector store. The guide therefore has **no verified legal sources** for general legal
questions. The correct behaviour is to say so — never to cite article numbers, decrees,
or deadlines from model memory as if verified.

## 4. Planned fix (smallest correct change)

Backend (`modules/ai/guide`):

- Replace the turn-count stage machine with a **validated structured turn** produced by the
  existing `ANSWER_LLM_PROVIDER.generateAnswer` (JSON mode, same OpenAI client, one call per turn):
  domains, understanding, knownFacts, missingFacts, needsClarification,
  clarificationQuestion, suggestedReplies, guidance, nextSteps, suggestedDocuments,
  likelyAuthority, uncertainty, urgent.
- Strict server-side validation; one constrained retry on invalid output (same convention as
  `AiAnswerService`); otherwise `AI_GUIDE_FAILED` — never a fallback question.
- Safety checks: secret-leak pattern (reused), no article/decree-number citations while no
  trusted sources exist; `sourcesAvailable: false` returned explicitly.
- Full bounded context per turn: original question always included, recent turns, previously
  established facts (marked as correctable), clarification count; clarification budget (3) after
  which the model must answer; repeated questions rejected.
- Persist USER + ASSISTANT messages only after a valid turn (no duplicate on retry); store the
  validated analysis in a new nullable `AiGuideMessage.analysis` JSON column.
- Summary built from the latest validated guidance turn (no regex template, no invented duration).
- Static welcome (no LLM call).

Frontend (`features/legal-guide`):

- Stay in the chat for clarifications; show model-provided suggested replies with the existing
  `GuideQuickReplies` chips; free typing always possible.
- Remove the static questionnaire screen; `/guide/question` redirects to `/guide` (no fixed
  "2 من 4" counter — the conversation has no fixed length).
- Validate the API response shape before rendering; retry without duplicating messages;
  no fake AI error bubble; summary reachable via a chip once guidance exists.
- Neutral mock-mode fixtures (dev/test only).

No changes to auth, ownership, rate limits, RAG/citation validation, providers, or worker.
