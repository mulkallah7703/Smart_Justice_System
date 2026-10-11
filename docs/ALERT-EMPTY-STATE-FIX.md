# Alert Empty-State Fix — Predictive Alert Banner

## Problem

The dashboard (`HomeScreen`) always rendered the red proactive banner
"تنبيه استباقي • مهلة اعتراض — تبقى يومان – صحح الآن قبل الفوات", even for
users with zero alert records. The header bell also showed an unread dot.

## Root cause (frontend only)

Traced database → API → client → store → UI:

| Layer | Finding |
| --- | --- |
| DB / `AlertsService.list` | Filters by JWT `userId`, returns `[]` + pagination when the user has no alerts. Never creates default alerts. **Correct.** |
| `GET /api/v1/alerts` | Returns `{ data: [], meta: { pagination: { total: 0 } } }`. **Correct.** |
| `alertsApi.fetchAlerts` / `mapAlert` | Unwraps envelope, maps items. **Correct.** |
| `useHomeData` | Returned a hardcoded `staticData.alert` built from `ar.home.alert` i18n strings. The banner was never connected to alert data. **Bug.** |
| `HomeScreen` | Rendered `ProactiveAlertBanner` unconditionally from that static object. **Bug.** |
| `alertsStore` | Initial `unreadCount: 1` (dot shown before/without data) and never reset on logout/account switch, so a count could carry over to another account. **Bug.** |

## Fix

- `frontend/src/features/home/selectHomeAlert.ts` (new): pure selector that picks
  the banner alert from real alerts — unread, URGENT before WARNING, API order
  (newest first) on ties; returns `null` when none qualify. INFO alerts are not
  promoted to the danger-styled banner.
- `frontend/src/features/home/useHomeData.ts`: removed the static alert; fetches
  `/alerts` (only when the alerts domain is live and a token exists, or in mock
  mode), sets the banner from `selectHomeAlert` and the unread count from the
  real list. Loading and failures leave the alert `null` (failure is not treated
  as "empty", it simply shows nothing fabricated). Unmount-guarded.
- `frontend/src/features/home/HomeScreen.tsx`: banner rendered only when
  `alert` is non-null; it shows the alert's own title/body.
- `frontend/src/features/home/home.types.ts`: `HomeAlert` gains `id`;
  `HomeData.alert` is `HomeAlert | null`.
- `frontend/src/core/i18n/ar.ts`: removed the hardcoded `home.alert` copy.
- `frontend/src/features/alerts/alertsStore.ts`: initial `unreadCount` is `0`;
  reset to `0` whenever the access token changes (logout / account switch).

Design (component, CSS, layout) unchanged — `ProactiveAlertBanner` and its CSS
were not modified. No CSS hiding or text-based suppression.

**Backend changed:** No source changes. One e2e test added.
No API, schema, or migration changes.

## Before / after

| Scenario | Before | After |
| --- | --- | --- |
| User with 0 alerts | Red banner with fake deadline text + bell dot | No banner, no dot |
| User with real alert(s) | Same fake text regardless of data | Banner shows the most severe unread alert's real title/body; click → `/alerts` |
| Loading | Fake banner | No banner |
| API error | Fake banner | No banner |
| Account switch A → B | Unread count could persist | Count reset; B sees only B's data |

## Tests

Frontend (`frontend/src/features/home/`):

- `selectHomeAlert.spec.ts` — 6 tests: empty → null; real title/body; URGENT beats
  newer WARNING; tie keeps API order; WARNING when no URGENT; read/INFO ignored.
- `HomeScreen.alerts.spec.ts` — 6 tests rendering the real `HomeScreen` in real
  API mode with a stubbed `fetch`:
  1. Zero alerts → no banner, none of the fabricated strings, unread 0, no dot.
  2. One alert → real text shown, unread 1, click navigates to `/alerts`.
  3. Multiple alerts → single banner showing the URGENT alert, unread 3.
  4. Loading (pending request) → no banner, page still renders.
  5. API failure (502) → no banner.
  6. Account isolation A → B → count reset, no A alert for B, request carries B's token.
  8. Urgent alert stays visible → covered by tests 2 and 3.

Backend (`backend/test/alerts.e2e-spec.ts`):

  7. New user with no alert records → `200`, `data: []`, `total: 0`, and the DB
     alert count for that user remains `0` (nothing created).

## Results (executed)

| Command | Result |
| --- | --- |
| `frontend: npx vitest run` | 30 files, **176 / 176 passed** (baseline 164 + 12 new) |
| `frontend: npm run build` (`tsc --noEmit && vite build`) | **Passed** |
| `backend: jest --config ./test/jest-e2e.json --runInBand test/alerts.e2e-spec.ts` | **7 / 7 passed** (incl. new empty-list test) |

The full backend unit/security/e2e suites were not re-run: no backend source
changed, only one test was added to the alerts e2e spec.

## Limitations

- Other Home placeholders (sample case card, default user name, card number) are
  still static while loading / when those domains are not live — out of scope.
- INFO-severity alerts appear in the Alerts Center but intentionally not in the
  red banner.
- Mock API mode (`VITE_API_MODE=mock`, dev/test only) still serves mock alerts
  from `alertsApi.ts`; production uses real mode.
- The Home banner fetches `/alerts` independently of the Alerts Center (no shared
  cache), which is what guarantees no cross-account carry-over.
