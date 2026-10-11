# Judicial File — "إضافة قضية أو متابعة جديدة" Action Fix

## Root cause

The dashed card is `AddCaseCard` (`frontend/src/features/legal-file/AddCaseCard.tsx`), a native
`<button type="button">` whose only behaviour is `onClick={onClick}`.

Click path before the fix:

1. `LegalFileScreen` renders `<CasesTab cases={cases} isLoading={isLoading} />` — **no `onAddCase` prop**.
2. `CasesTab` declared `onAddCase?: () => void` (optional) and rendered `<AddCaseCard onClick={onAddCase} />`.
3. `AddCaseCard` declared `onClick?: () => void` (optional), so `onClick` was `undefined`.

The button received clicks normally but had no handler, so nothing happened. Both props being optional
let the missing wiring compile silently.

Ruled out (verified in the live app and in CSS): `disabled`, `pointer-events: none`, overlays / `z-index`
(`document.elementFromPoint` at the card hits the button), nested interactive elements, invalid routes,
runtime errors.

## Intended workflow discovered

There is **no case-creation or case-linking workflow** anywhere in the product:

- Backend `CasesController` (`/api/v1/cases`) is read-only: `GET /cases` and `GET /cases/:id`, JWT-guarded,
  scoped to `user.sub`. No `POST`/`PATCH`.
- In application code, `Case` rows are created only by `prisma/seed.ts` and by tests. `Case.caseNumber` is a
  globally unique official case number.
- No frontend route, page, dialog or form exists for adding or linking a case (`AppRouter.tsx` has only
  `/legal-file` and `/legal-file/:caseId`).
- The empty-state copy says cases appear "عند ربطها بملفك العدلي" (when linked to your judicial file), i.e. an
  official linkage — which depends on the deferred Nafath / government integrations.

This is therefore **Case C (missing product capability)**. Decision taken with the product owner: keep the
design and, on click, show an honest inline notice that linking cases is not yet available. No navigation to
an unrelated screen, no fake record, no new backend endpoint.

## Exact behaviour after the fix

- Clicking (mouse/touch) or activating with the keyboard (Enter/Space — native `<button>`) shows the
  existing `AlertBanner` (`variant="info"`, `role="status"`, announced to screen readers) directly under the
  card:
  > ربط القضايا بملفك العدلي غير متاح حالياً وسيُتاح لاحقاً. ستظهر قضاياك هنا عند ربطها بملفك العدلي.
- The URL stays `/legal-file`; no API call is made; repeated clicks show a single notice.
- The notice resets when the user leaves the Cases tab.
- Case cards, the empty state, the card's dashed style, colours, spacing, RTL layout, and the global
  `:focus-visible` outline are unchanged.
- `/legal-file` remains behind `RequireAuth`; case data still comes only from the authenticated,
  server-scoped `GET /cases`.

## Files changed

| File | Change |
| --- | --- |
| `frontend/src/features/legal-file/CasesTab.tsx` | Owns the action: `useState` + `AlertBanner`; removed unused optional `onAddCase` prop |
| `frontend/src/features/legal-file/AddCaseCard.tsx` | `onClick` is now **required**, so an unwired card can no longer compile |
| `frontend/src/core/i18n/ar.ts` | Added `legalFile.addCaseUnavailable` |
| `frontend/src/features/legal-file/LegalFileScreen.spec.ts` | New regression tests (6) |

No backend code, API, schema, styles or routes changed.

## Tests added (`LegalFileScreen.spec.ts`, real API mode, `fetch` stubbed at the network boundary)

1. Empty state and the add action render when `GET /cases` returns no cases.
2. Clicking the action shows the notice (not silent) and stays on `/legal-file`.
3. Three clicks → exactly one notice, exactly one request (`GET /cases`), no write request, no case appears.
4. Keyboard/a11y: native enabled `<button type="button">`, not `tabindex=-1`, no nested interactive
   elements, receives focus.
5. Existing behaviour: own cases render, the add action stays, clicking a case navigates to
   `/legal-file/:caseId`; the request carries the bearer token and no client-supplied `userId`.
6. Without a token, `/legal-file` redirects to `/login`, the action is not rendered, and no request is made.

## Verification results (this run)

| Check | Result |
| --- | --- |
| Frontend unit tests (`npx vitest run`) | **192 / 192 PASS** (32 files; 186 before + 6 new) |
| Legal-file tests | 19 / 19 PASS |
| Frontend build (`tsc --noEmit && vite build`) | **PASS** |
| Backend unit / security / e2e | Not rerun — no backend code changed |

Live check against the running local stack (Vite dev server + API, real auth, fresh QA account
`qa.emptyfile.1011@localhost.local` with no cases):

- `/legal-file` showed "لا قضايا في ملفك" and the dashed card (`border: dashed`, `pointer-events: auto`,
  not disabled, top element at the card is the button).
- A real mouse click displayed the notice; the URL stayed `/legal-file`.
- Switching tabs and returning reset the notice.
- The button accepts focus. The browser tool's synthetic Enter key did not activate **any** native button
  (it also failed on the existing, working tab buttons), so keyboard activation is covered by the native
  `<button>` semantics and the unit test rather than by the live tool.
- An unauthenticated page load of `/legal-file` redirected to `/login`.

## Missing capability / remaining limitation

- **Linking or adding cases to the judicial file does not exist.** Implementing it needs a product
  decision: either official linkage (Nafath / Najiz — currently deferred), or a user-managed tracking record,
  which would need a new authenticated `POST` endpoint, server-side ownership, validation, and UI that clearly
  labels it as self-tracked, not court-registered. When that exists, replace the notice in `CasesTab` with
  navigation to the new workflow.
- The QA account created for the live check remains in the local development database only.
