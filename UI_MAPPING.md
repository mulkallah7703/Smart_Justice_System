# المنظومة العدلية الذكية — UI Mapping

> Screen-by-screen breakdown of all 24 UI screens.  
> Maps each screen to: route · feature file · components · API calls · store state · animations.

---

## Table of Contents

1. [Screen Index](#screen-index)
2. [Screen 01 — Splash](#screen-01--splash)
3. [Screen 02 — Onboarding](#screen-02--onboarding)
4. [Screen 03 — Nafath Verification](#screen-03--nafath-verification)
5. [Screen 04 — File Created Success](#screen-04--file-created-success)
6. [Screen 05 — Home Dashboard](#screen-05--home-dashboard)
7. [Screen 06 — Alerts Center](#screen-06--alerts-center)
8. [Screen 07 — AI Legal Guide (Chat)](#screen-07--ai-legal-guide-chat)
9. [Screen 08 — Clarifying Question](#screen-08--clarifying-question)
10. [Screen 09 — Guidance Summary](#screen-09--guidance-summary)
11. [Screen 10 — Document Upload](#screen-10--document-upload)
12. [Screen 11 — Analyzing Loader](#screen-11--analyzing-loader)
13. [Screen 12 — Initial Opinion](#screen-12--initial-opinion)
14. [Screen 13 — Advisory Report](#screen-13--advisory-report)
15. [Screen 14 — Lawyers List](#screen-14--lawyers-list)
16. [Screen 15 — Lawyer Profile](#screen-15--lawyer-profile)
17. [Screen 16 — Consultation Booking](#screen-16--consultation-booking)
18. [Screen 17 — Payment](#screen-17--payment)
19. [Screen 18 — Judicial Card](#screen-18--judicial-card)
20. [Screen 19 — Legal File](#screen-19--legal-file)
21. [Screen 20 — Card Tier Upgrade](#screen-20--card-tier-upgrade)
22. [Screen 21 — Kiosk](#screen-21--kiosk)
23. [Screen 22 — Profile & Settings](#screen-22--profile--settings)
24. [Screen 23 — Dark Mode Home](#screen-23--dark-mode-home)
25. [Screen 24 — Dark Mode AI Guide](#screen-24--dark-mode-ai-guide)
26. [Navigation Flow](#navigation-flow)
27. [State Ownership Map](#state-ownership-map)
28. [API Call Map](#api-call-map)

---

## Screen Index

| # | Screen Name | Route | Feature Folder | Primary Color |
|---|-------------|-------|----------------|---------------|
| 01 | Splash | `/splash` | `auth/` | Primary green |
| 02 | Onboarding | `/onboarding` | `auth/` | White + brand |
| 03 | Nafath Verification | `/auth/verify` | `auth/` | Primary green |
| 04 | File Created Success | `/auth/success` | `auth/` | Primary green |
| 05 | Home Dashboard | `/` | `home/` | White + green |
| 06 | Alerts Center | `/alerts` | `alerts/` | Mixed severity |
| 07 | AI Legal Guide Chat | `/guide` | `legal-guide/` | Blue (AI) |
| 08 | Clarifying Question | `/guide/question` | `legal-guide/` | Blue (AI) |
| 09 | Guidance Summary | `/guide/summary` | `legal-guide/` | Green |
| 10 | Document Upload | `/advisor` | `legal-advisor/` | White |
| 11 | Analyzing Loader | `/advisor/analyzing` | `legal-advisor/` | Dark (#0E1A16) |
| 12 | Initial Opinion | `/advisor/opinion` | `legal-advisor/` | White |
| 13 | Advisory Report | `/advisor/report/:jobId` | `legal-advisor/` | White |
| 14 | Lawyers List | `/lawyers` | `lawyers/` | White |
| 15 | Lawyer Profile | `/lawyers/:id` | `lawyers/` | White + gold |
| 16 | Consultation Booking | `/lawyers/:id/book` | `booking/` | White |
| 17 | Payment | `/payment/:consultationId` | `payment/` | White |
| 18 | Judicial Card | `/card` | `judicial-card/` | Dark green |
| 19 | Legal File | `/legal-file` | `legal-file/` | White |
| 20 | Card Tier Upgrade | `/card/upgrade` | `judicial-card/` | Gold |
| 21 | Kiosk | `/kiosk` | `kiosk/` | Dark (#0E1A16) |
| 22 | Profile & Settings | `/profile` | `profile/` | White |
| 23 | Dark Mode Home | `/` (dark) | `home/` | Dark (#0E1A16) |
| 24 | Dark Mode AI Guide | `/guide` (dark) | `legal-guide/` | Dark (#0E1A16) |

---

## Screen 01 — Splash

**Visual:** Full-screen green background, centered logo, animated ring pulse, tagline.

| Property | Value |
|----------|-------|
| Route | `/splash` |
| File | `src/features/auth/SplashScreen.tsx` |
| Redirects to | `/onboarding` after 2.5s (or `/` if token valid) |
| Background | `#0E5A4A` (primary) |
| Animation | `ringPulse` on logo ring, `fadeInUp` on tagline |

**Elements:**
```
┌─────────────────────────────┐
│                              │
│      ◉  [ring pulse]         │
│    [Logo SVG]                │
│                              │
│    المنظومة العدلية الذكية   │  fadeInUp 600ms delay 400ms
│    بوابتك للعدالة الذكية     │  fadeInUp 600ms delay 600ms
│                              │
│    ════════════════          │  progress bar, fills in 2s
│                              │
└─────────────────────────────┘
```

**Logic:**
```typescript
// SplashScreen.tsx
useEffect(() => {
  const hasToken = authStore.getState().accessToken;
  const timer = setTimeout(() => {
    navigate(hasToken ? '/' : '/onboarding', { replace: true });
  }, 2500);
  return () => clearTimeout(timer);
}, []);
```

**Components used:** `ScreenShell (noNav, dark)`, `Icon`, custom SVG logo

---

## Screen 02 — Onboarding

**Visual:** 4 service highlight cards with icons, tagline, CTA button.

| Property | Value |
|----------|-------|
| Route | `/onboarding` |
| File | `src/features/auth/OnboardingScreen.tsx` |
| Redirects to | `/auth/verify` on CTA tap |
| Background | `#FFFFFF` |

**Elements:**
```
┌─────────────────────────────┐
│  [Skip]              [Logo]  │
│                              │
│  اكتشف منظومة                │
│  العدالة الذكية              │
│                              │
│  ┌──────────┐ ┌──────────┐  │
│  │ 🤖 المرشد│ │⚖️ المستشار│  │
│  │ الذكي   │ │القانوني  │  │  Feature cards × 4
│  └──────────┘ └──────────┘  │
│  ┌──────────┐ ┌──────────┐  │
│  │👨‍💼 محامون│ │📁 ملفاتك │  │
│  └──────────┘ └──────────┘  │
│                              │
│  [ ابدأ الآن ←           ]  │  Button primary
└─────────────────────────────┘
```

**Service Cards (4):**

| Icon | Title | Description |
|------|-------|-------------|
| `robot_2` blue | المرشد الذكي | استشارة قانونية فورية |
| `psychology` green | المستشار القانوني | تحليل وثائقك القانونية |
| `badge` gold | ابحث عن محامٍ | تواصل مع محامين معتمدين |
| `folder_shared` neutral | ملفاتك القانونية | جميع قضاياك في مكان واحد |

**Components used:** `ScreenShell (noNav)`, `FeatureCard`, `Button (xl, primary)`

---

## Screen 03 — Nafath Verification

**Visual:** Phone number input → Nafath OTP flow → loading state.

| Property | Value |
|----------|-------|
| Route | `/auth/verify` |
| File | `src/features/auth/NafathVerification.tsx` |
| API | `POST /auth/nafath/verify` |
| Store | `authStore` — setUser, setTokens |
| Redirects to | `/auth/success` on success |

**Elements:**
```
┌─────────────────────────────┐
│  ←  [Back]                  │
│                              │
│  [🔐 Icon]                  │
│  تحقق من هويتك               │
│  سيتم إرسال رمز عبر نفاذ     │
│                              │
│  رقم الجوال                  │
│  ┌────────────────────────┐  │
│  │ 🇸🇦 +966  05X XXX XXXX │  │  Input with country flag
│  └────────────────────────┘  │
│                              │
│  [ التحقق عبر نفاذ ← ]      │  Button primary
│                              │
│  ─────── أو ──────           │
│  ادخل برقم الهوية الوطنية    │  Ghost link
└─────────────────────────────┘
```

**OTP Step (shown after phone submit):**
```
┌─────────────────────────────┐
│  أدخل رمز نفاذ              │
│  تم إرسال رمز إلى تطبيق نفاذ │
│                              │
│  [ 0 ] [ 0 ] [ 0 ] [ 0 ] [ 0 ] [ 0 ]  │  OTPInput (LTR)
│                              │
│  لم تستلم الرمز؟ أعد الإرسال  │  resend in 60s countdown
│                              │
│  [ تحقق ← ]                  │
└─────────────────────────────┘
```

**Error states:**
- Invalid OTP → red border on cells + "رمز غير صحيح" below
- Network error → `AlertBanner (danger)`
- Expired OTP → "انتهت صلاحية الرمز، أعد المحاولة" + resend button

**Components used:** `Header (noBack)`, `Input`, `OTPInput`, `Button`, `AlertBanner`, `ScreenShell (noNav)`

---

## Screen 04 — File Created Success

**Visual:** Green success illustration, confirmation text, judicial card preview, CTA.

| Property | Value |
|----------|-------|
| Route | `/auth/success` |
| File | `src/features/auth/FileCreatedSuccess.tsx` |
| API | Called by: `POST /judicial-card` (auto-issued) |
| Redirects to | `/` on CTA tap |

**Elements:**
```
┌─────────────────────────────┐
│                              │
│   ✅  [success animation]   │
│                              │
│   تم إنشاء ملفك القانوني    │
│   بنجاح!                    │
│                              │
│   ┌────────────────────────┐ │
│   │ البطاقة القضائية        │ │
│   │ JC-1446-XXXX  عادية    │ │  JudicialCard (mini preview)
│   │ [holder name]          │ │
│   └────────────────────────┘ │
│                              │
│   [ الذهاب للرئيسية ← ]    │  Button primary
└─────────────────────────────┘
```

**Animation sequence:**
1. 0ms — screen fades in
2. 200ms — success icon `scaleIn` with spring easing
3. 500ms — text `fadeInUp`
4. 800ms — card preview slides up
5. 1100ms — button appears

**Components used:** `ScreenShell (noNav)`, `JudicialCard (preview)`, `Button`, `TierBadge`

---

## Screen 05 — Home Dashboard

**Visual:** Greeting header, judicial card widget, 4 service cards, active cases list.

| Property | Value |
|----------|-------|
| Route | `/` |
| File | `src/features/home/HomeScreen.tsx` |
| API | `GET /users/me` · `GET /judicial-card` · `GET /cases?status=ACTIVE&limit=3` · `GET /alerts?read=false&limit=1` |
| Store | `authStore.user` · `alertsStore.unreadCount` |

**Elements:**
```
┌─────────────────────────────┐
│  مرحباً، [name] 👋   [🔔 3]  │  Header with alert badge
│                              │
│  ┌────────────────────────┐  │
│  │ البطاقة القضائية        │  │
│  │ JC-1446-0827  ذهبية   │  │  JudicialCardPreview
│  │ خصم ٤٠٪ على الاستشارات │  │
│  └────────────────────────┘  │
│                              │
│  الخدمات القانونية            │  SectionHeader
│  ┌──────────┐ ┌──────────┐  │
│  │🤖 المرشد │ │⚖️ المستشار│  │  ServicesGrid (2×2)
│  └──────────┘ └──────────┘  │
│  ┌──────────┐ ┌──────────┐  │
│  │👨‍💼 محامون│ │ ⚡ عاجل  │  │  Last card = urgent alert
│  └──────────┘ └──────────┘  │
│                              │
│  قضاياي النشطة              │  SectionHeader + "عرض الكل"
│  ┌────────────────────────┐  │
│  │ قضية تجارية  منظورة ●  │  │  CaseCard × 3
│  └────────────────────────┘  │
│                              │
│  [═══ BottomNav ════════]    │
└─────────────────────────────┘
```

**Data loading strategy:**
```typescript
// useHomeData.ts — parallel fetch
const { data } = useQueries({
  queries: [
    { queryKey: ['user'],    queryFn: () => api.get('/users/me')             },
    { queryKey: ['card'],    queryFn: () => api.get('/judicial-card')        },
    { queryKey: ['cases'],   queryFn: () => api.get('/cases?status=ACTIVE&limit=3') },
    { queryKey: ['alerts'],  queryFn: () => api.get('/alerts?read=false&limit=1')   },
  ]
});
```

**Cache TTL:** user 5min · card 10min · cases 2min · alerts 30s

**Components used:** `ScreenShell`, `BottomNav`, `JudicialCardPreview`, `ServicesGrid`, `FeatureCard`, `CaseCard`, `SectionHeader`, `StatusBadge`, `Badge (unread count)`

---

## Screen 06 — Alerts Center

**Visual:** Severity filter pills, alert cards with countdown, urgent ring animation.

| Property | Value |
|----------|-------|
| Route | `/alerts` |
| File | `src/features/alerts/AlertsCenter.tsx` |
| API | `GET /alerts` · `PATCH /alerts/:id/read` |
| WebSocket | `WS /alerts` — real-time push |
| Store | `alertsStore` — alerts[], unreadCount |

**Elements:**
```
┌─────────────────────────────┐
│  ←  الإشعارات         [⚙]  │
│                              │
│  [الكل ▪] [عاجل] [مهل] [أنظمة]  │  FilterPills
│                              │
│  ┌────────────────────────┐  │
│  │ ⚡ عاجل                │  │  AlertCard (danger)
│  │ موعد الاستئناف ينتهي قريباً│ │
│  │ ◉ ٤٧:٥٢:١٠  [ring]   │  │  CountdownTimer
│  └────────────────────────┘  │
│                              │
│  ┌────────────────────────┐  │
│  │ ⚠ مهلة                 │  │  AlertCard (warning)
│  │ وثيقة مطلوبة خلال ٧ أيام│ │
│  └────────────────────────┘  │
│                              │
│  ┌────────────────────────┐  │
│  │ ℹ تحديث نظام           │  │  AlertCard (info)
│  │ تعديل جديد في اللائحة   │  │
│  └────────────────────────┘  │
│                              │
│  [═══ BottomNav ════════]    │
└─────────────────────────────┘
```

**Filter options:**
| ID | Label | Filters by |
|----|-------|-----------|
| `all` | الكل | — |
| `urgent` | عاجل | `severity=URGENT` |
| `warning` | مهل | `severity=WARNING` |
| `info` | أنظمة | `type=LAW_UPDATE` |

**WebSocket handling:**
```typescript
// useAlerts.ts
useEffect(() => {
  const socket = io('/alerts', { auth: { token } });
  socket.on('alert:new', (alert: Alert) => {
    queryClient.setQueryData(['alerts'], (old) => [alert, ...old]);
    alertsStore.setState(s => ({ unreadCount: s.unreadCount + 1 }));
  });
  return () => socket.disconnect();
}, [token]);
```

**Components used:** `ScreenShell`, `BottomNav`, `Header`, `FilterPills`, `AlertCard`, `CountdownTimer`, `Badge`

---

## Screen 07 — AI Legal Guide Chat

**Visual:** Full chat interface, AI logo header, initial welcome message, user input bar.

| Property | Value |
|----------|-------|
| Route | `/guide` |
| File | `src/features/legal-guide/LegalGuideChat.tsx` |
| API | `POST /ai/guide/start` |
| State | Local session: `{ sessionId, messages[], stage }` |

**Elements:**
```
┌─────────────────────────────┐
│  ←  [🤖 AI Logo]  المرشد   │  Header with AI icon
│      مدعوم بالذكاء الاصطناعي│  Subtitle
│                              │
│  ┌────────────────────────┐  │
│  │ مرحباً! أنا المرشد     │  │  ChatBubble (AI)
│  │ القانوني الذكي. كيف   │  │
│  │ يمكنني مساعدتك؟       │  │
│  └────────────────────────┘  │
│                              │
│  أو اختر من الأمثلة:         │
│  ┌──────────────────────┐   │
│  │ 💬 عقد إيجار تجاري  │   │  QuickReply chips × 4
│  └──────────────────────┘   │
│  ┌──────────────────────┐   │
│  │ 💬 قضية عمالية       │   │
│  └──────────────────────┘   │
│                              │
│  ─────────────────────────── │
│  ┌──────────────────────┐[→]│  Input + Send button
│  │ اكتب رسالتك...       │   │
│  └──────────────────────┘   │
└─────────────────────────────┘
```

**Quick reply chips (4):**
- عقد إيجار تجاري
- فصل تعسفي من العمل
- نزاع تجاري مع شريك
- حضانة أطفال

**Send button behavior:**
- Idle: `send` icon, primary green
- Loading: `TypingIndicator` appears in chat, button disabled
- Error: `Toast (danger)` — "حدث خطأ، حاول مرة أخرى"

**Components used:** `ScreenShell`, `Header`, `ChatBubble`, `TypingIndicator`, `Input`, `Button (ai, icon-only send)`, `AICard`

---

## Screen 08 — Clarifying Question

**Visual:** Progress bar, AI question, option cards, confirm button.

| Property | Value |
|----------|-------|
| Route | `/guide/question` (within guide flow) |
| File | `src/features/legal-guide/ClarifyingQuestion.tsx` |
| API | `POST /ai/guide/answer` |
| State | Extends guide session: adds `answers[]` |

**Elements:**
```
┌─────────────────────────────┐
│  ←  المرشد الذكي            │
│  ████████░░░░  ٢ من ٤       │  StepIndicator + GuideProgress
│                              │
│  ما نوع العقد الذي تواجه     │
│  مشكلة معه؟                  │  Question text
│                              │
│  ┌────────────────────────┐  │
│  │ ○  عقد إيجار سكني     │  │  ClarifyingQuestion option
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ ◉  عقد إيجار تجاري    │  │  Selected option
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ ○  عقد خدمات           │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ ○  عقد توريد           │  │
│  └────────────────────────┘  │
│                              │
│  [ التالي ← ]                │  Button primary (disabled until selection)
└─────────────────────────────┘
```

**Question flow state machine:**
```typescript
type GuideStage = 'CHAT' | 'QUESTION' | 'SUMMARY';

// sessionId persists across all question steps
// Each answer posted to /ai/guide/answer → returns { nextQuestion? | summary? }
```

**Components used:** `Header (back)`, `GuideProgress`, `StepIndicator`, `ClarifyingQuestion`, `Button (primary, disabled)`

---

## Screen 09 — Guidance Summary

**Visual:** Result summary with case type, authority, steps, required docs, lawyer CTA.

| Property | Value |
|----------|-------|
| Route | `/guide/summary/:sessionId` |
| File | `src/features/legal-guide/GuidanceSummary.tsx` |
| API | `GET /ai/guide/summary/:sessionId` |

**Elements:**
```
┌─────────────────────────────┐
│  ←  ملخص التوجيه           │
│                              │
│  ┌─ نتيجة التحليل ──────┐   │
│  │ نزاع إيجار تجاري      │   │  AICard (summary header)
│  │ الجهة: المحكمة التجارية │  │
│  │ المدة التقديرية: ٦ أشهر│  │
│  └──────────────────────┘   │
│                              │
│  ┌─ الخطوات المطلوبة ────┐  │  ReportSection (steps)
│  │ ١. إشعار المستأجر     │  │
│  │ ٢. رفع الدعوى         │  │
│  │ ٣. جلسة التحقيق       │  │
│  └──────────────────────┘   │
│                              │
│  ┌─ الوثائق المطلوبة ────┐  │  ReportSection (docs)
│  │ □ عقد الإيجار         │  │
│  │ □ إشعار الإخلاء       │  │
│  └──────────────────────┘   │
│                              │
│  [ احجز محامياً متخصصاً ← ] │  Button primary
│  [ بدء تحليل وثائقي    ]   │  Button secondary
└─────────────────────────────┘
```

**Components used:** `ScreenShell`, `Header`, `AICard`, `GuidanceSummary`, `ReportSection`, `Button`

---

## Screen 10 — Document Upload

**Visual:** Drag-drop zone, supported formats, file list with progress.

| Property | Value |
|----------|-------|
| Route | `/advisor` |
| File | `src/features/legal-advisor/DocumentUpload.tsx` |
| API | `POST /documents/upload` (multipart) |
| Redirects to | `/advisor/analyzing` after upload |

**Elements:**
```
┌─────────────────────────────┐
│  ←  المستشار القانوني       │
│                              │
│  ┌──────────────────────┐   │
│  │                       │   │
│  │    ☁ ارفع وثائقك      │   │  FileUploadZone
│  │  PDF · صورة · Word   │   │
│  │  الحد الأقصى: ١٠ ميجا │   │
│  │  [ اختر ملف ]         │   │
│  └──────────────────────┘   │
│                              │
│  الملفات المرفوعة (٢)        │  Section label
│  ┌────────────────────────┐  │
│  │ 📄 عقد_الإيجار.pdf   ✓│  │  FileRow (done)
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ 🖼 صورة_الإشعار.jpg  ↑│  │  FileRow (uploading 67%)
│  │ ████████████░░░░░░░    │  │
│  └────────────────────────┘  │
│                              │
│  [ تحليل الوثائق ← ]         │  Button (disabled until ≥1 done)
└─────────────────────────────┘
```

**Upload flow:**
```typescript
// 1. User selects file(s)
// 2. Each file uploads immediately via POST /documents/upload
// 3. FileRow shows individual progress (Axios onUploadProgress)
// 4. documentIds[] collected as uploads complete
// 5. CTA enabled when ≥1 document fully uploaded
// 6. On CTA: POST /ai/advisor/analyze → { jobId } → navigate to /advisor/analyzing
```

**Components used:** `ScreenShell`, `Header`, `FileUploadZone`, `FileRow`, `Button`

---

## Screen 11 — Analyzing Loader

**Visual:** Full dark screen, animated AI orb, progress bar, rotating stage labels.

| Property | Value |
|----------|-------|
| Route | `/advisor/analyzing` |
| File | `src/features/legal-advisor/AnalyzingLoader.tsx` |
| API | `GET /ai/advisor/report/:jobId` (polling every 2s) |
| Redirects to | `/advisor/opinion` when `status === 'DONE'` |
| Background | `#0E1A16` (dark) |

**Elements:**
```
┌─────────────────────────────┐
│  [Dark background]           │
│                              │
│       ◎◉◎  [aiGlow]        │  AnalyzingLoader orb
│       [ringPulse ×2]        │
│                              │
│   جاري تحليل وثائقك...      │
│   استخراج البنود القانونية   │  Rotating stage label
│                              │
│   ████████████░░░░░░  ٦٧٪  │  ProgressBar
│                              │
│   ٢ وثيقة · ٣٢ بنداً        │  Stats
│                              │
└─────────────────────────────┘
```

**Stage labels (cycle while processing):**
1. جاري قراءة الوثائق...
2. استخراج البنود القانونية...
3. مطابقة مع قواعد البيانات...
4. تقييم قوة الموقف...
5. إعداد التقرير القانوني...

**Polling logic:**
```typescript
// useDocumentAnalysis.ts
useEffect(() => {
  const interval = setInterval(async () => {
    const { status, progress } = await api.get(`/ai/advisor/report/${jobId}`);
    setProgress(progress);
    if (status === 'DONE')    { clearInterval(interval); navigate(`/advisor/opinion`); }
    if (status === 'FAILED')  { clearInterval(interval); navigate('/advisor', { state: { error: true } }); }
  }, 2000);
  return () => clearInterval(interval);
}, [jobId]);
```

**Components used:** `ScreenShell (dark, noNav)`, `AnalyzingLoader`, `ProgressBar`

---

## Screen 12 — Initial Opinion

**Visual:** Strength meter arc, key findings cards, severity breakdown.

| Property | Value |
|----------|-------|
| Route | `/advisor/opinion` |
| File | `src/features/legal-advisor/InitialOpinion.tsx` |
| Data | Cached from polling result |
| Redirects to | `/advisor/report/:jobId` on "عرض التقرير الكامل" |

**Elements:**
```
┌─────────────────────────────┐
│  ←  التقييم الأولي          │
│                              │
│     ┌────────────────┐      │
│     │  [SVG Arc 78%] │      │  StrengthMeter (success green)
│     │      ٧٨٪       │      │
│     │   موقفك قوي    │      │
│     └────────────────┘      │
│                              │
│  النتائج الرئيسية            │
│  ┌────────────────────────┐  │
│  │ ✅ بنود واضحة ومحددة  │  │  Finding card (success)
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ ⚠ غياب فترة الإشعار   │  │  Finding card (warning)
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ ❌ بند جزائي مخالف    │  │  Finding card (danger)
│  └────────────────────────┘  │
│                              │
│  [ عرض التقرير الكامل ← ]   │  Button primary
└─────────────────────────────┘
```

**Strength score → display:**
| Score | Color | Label |
|-------|-------|-------|
| 75–100 | `#1B873F` | موقفك قوي |
| 45–74 | `#D98A0B` | موقف متوسط |
| 0–44 | `#C8372E` | موقف ضعيف |

**Components used:** `ScreenShell`, `Header`, `StrengthMeter`, `AICard`, `AlertBanner`, `Button`

---

## Screen 13 — Advisory Report

**Visual:** Full legal report — scrollable sections, each collapsible.

| Property | Value |
|----------|-------|
| Route | `/advisor/report/:jobId` |
| File | `src/features/legal-advisor/AdvisoryReport.tsx` |
| API | `GET /ai/advisor/report/:jobId` (final data) |

**Report Sections (in order):**

```
┌─────────────────────────────┐
│  ←  التقرير القانوني  [↓PDF]│
│                              │
│  ┌─ ملخص تنفيذي ▼ ────────┐ │  ReportSection (open)
│  │ نزاع عقد إيجار تجاري   │ │
│  │ الجهة: المحكمة التجارية  │ │
│  └──────────────────────┘  │
│                              │
│  ┌─ تحليل البنود ▶ ───────┐  │  ReportSection (collapsed)
│  └──────────────────────┘  │
│                              │
│  ┌─ المخاطر القانونية ▼ ──┐  │  ReportSection (open)
│  │ ⚠ بند جزائي مخالف     │  │
│  └──────────────────────┘  │
│                              │
│  ┌─ التوصيات ▼ ────────── ┐ │
│  │ ١. تقديم إشعار رسمي   │ │
│  │ ٢. رفع دعوى استرداد  │ │
│  └──────────────────────┘  │
│                              │
│  [ احجز محامياً متخصصاً ← ] │
└─────────────────────────────┘
```

**Report sections:**
1. ملخص تنفيذي (Executive Summary)
2. تحليل البنود (Clause Analysis)
3. المخاطر القانونية (Legal Risks)
4. المراجع النظامية (Legal References)
5. التوصيات (Recommendations)

**PDF export:** calls `GET /ai/advisor/report/:jobId?format=pdf` → presigned URL → `window.open()`

**Components used:** `ScreenShell`, `Header`, `ReportSection`, `Button`, `Badge`, `StrengthMeter (mini)`

---

## Screen 14 — Lawyers List

**Visual:** Search bar, filter pills (specialty), lawyer cards with rating and price.

| Property | Value |
|----------|-------|
| Route | `/lawyers` |
| File | `src/features/lawyers/LawyersList.tsx` |
| API | `GET /lawyers?specialty=&city=&available=&page=&limit=20` |
| Pagination | Infinite scroll |

**Elements:**
```
┌─────────────────────────────┐
│  ←  المحامون المعتمدون      │
│                              │
│  ┌──────────────────────[🔍]│  SearchInput
│  │ ابحث عن محامٍ...         │
│  └──────────────────────────┘
│                              │
│  [الكل▪] [عقاري] [تجاري] [عمالي] [شخصي]  │  FilterPills
│                              │
│  ٢٤ محامٍ متاح              │  Results count
│                              │
│  ┌────────────────────────┐  │
│  │ [Avatar]  أحمد الغامدي │  │  LawyerCard
│  │ محامٍ عقاري · الرياض  │  │
│  │ ⭐ ٤.٨ (١٢٣ تقييم)   │  │
│  │ من ٣٠٠ ر.س/ساعة       │  │
│  │ [خصم ٢٥٪] [متاح ✓]    │  │
│  └────────────────────────┘  │
│  ... (infinite scroll)       │
│                              │
│  [═══ BottomNav ════════]    │
└─────────────────────────────┘
```

**Specialty filters:**
| ID | Label |
|----|-------|
| `all` | الكل |
| `RENTAL` | عقاري |
| `COMMERCIAL` | تجاري |
| `LABOR` | عمالي |
| `PERSONAL` | شخصي |

**Search:** debounced 400ms → triggers `GET /lawyers?q=...`

**Infinite scroll:**
```typescript
// useLawyers.ts — TanStack Query infinite
const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: ['lawyers', filters],
  queryFn: ({ pageParam = 1 }) => api.get('/lawyers', { params: { ...filters, page: pageParam } }),
  getNextPageParam: (last) => last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
});
```

**Components used:** `ScreenShell`, `BottomNav`, `Header`, `SearchInput`, `FilterPills`, `LawyerCard`, `RatingStars`, `Badge (discount)`, `SkeletonLoader`

---

## Screen 15 — Lawyer Profile

**Visual:** Avatar + stats hero, specialty tags, experience timeline, discount badge, book CTA.

| Property | Value |
|----------|-------|
| Route | `/lawyers/:id` |
| File | `src/features/lawyers/LawyerProfile.tsx` |
| API | `GET /lawyers/:id` · `GET /lawyers/:id/availability?date=today` |

**Elements:**
```
┌─────────────────────────────┐
│  ←                          │
│                              │
│  [Large Avatar]             │
│  أحمد الغامدي               │
│  محامٍ عقاري وتجاري         │
│  ⭐ ٤.٨  (١٢٣ تقييم)       │
│  ● متاح الآن                │
│                              │
│  ─────────────────────────  │
│  [عقاري] [تجاري] [إيجار]   │  Specialty tags
│                              │
│  ١٢ سنة خبرة  |  ٤٥٠ قضية │  StatsRow
│                              │
│  ┌─ خصم البطاقة الذهبية ──┐  │  Discount card
│  │ السعر الأصلي: ٥٠٠ ر.س  │  │
│  │ سعرك: ٣٠٠ ر.س (خصم٤٠%)│  │
│  └──────────────────────┘   │
│                              │
│  نبذة عن المحامي            │
│  [Bio text ...]              │
│                              │
│  [ احجز استشارة ← ]         │  Button primary (sticky)
└─────────────────────────────┘
```

**Components used:** `ScreenShell`, `Header`, `Avatar (lg)`, `RatingStars`, `Badge`, `StatsRow`, `Card (discount)`, `Button (sticky footer)`

---

## Screen 16 — Consultation Booking

**Visual:** 3-step flow — type → date/time → summary.

| Property | Value |
|----------|-------|
| Route | `/lawyers/:id/book` |
| File | `src/features/booking/ConsultationType.tsx` (step 1) |
| Files | + `DateTimePicker.tsx` (step 2) · `BookingSummary.tsx` (step 3) |
| API | `GET /lawyers/:id/availability?date=` · `POST /consultations/book` |
| Redirects to | `/payment/:consultationId` on confirm |

**Step 1 — Type:**
```
┌─────────────────────────────┐
│  ←  نوع الاستشارة    ١/٣   │
│                              │
│  ┌──────────┐ ┌──────────┐  │
│  │📞 فوري  │ │✉️ مكتوب  │  │  ConsultationTypePicker
│  │مكالمة الآن│ │رد ٢٤ ساعة│ │
│  └──────────┘ └──────────┘  │
│  ┌──────────┐ ┌──────────┐  │
│  │👤 حضوري │ │⚖️ توكيل │  │
│  │في مكتبه │ │تمثيل كامل│ │
│  └──────────┘ └──────────┘  │
│                              │
│  [التالي ← ]                 │
└─────────────────────────────┘
```

**Step 2 — Date & Time:**
```
┌─────────────────────────────┐
│  ←  الموعد             ٢/٣  │
│                              │
│  < يوليو ٢٠٢٦ >            │  DatePicker calendar header
│  ن  ث  ث  ر  خ  ج  س       │  Day labels
│  ┌──┬──┬──┬──┬──┬──┬──┐   │
│  │  │  │ ١│ ٢│ ٣│ ٤│ ٥│  │
│  │ ٦│ ٧│ ٨│ ٩│١٠│  │  │  │
│  └──┴──┴──┴──┴──┴──┴──┘   │
│                              │
│  المواعيد المتاحة            │
│  [٩:٠٠] [١٠:٠٠] [١٤:٠٠]  │  TimeSlotPicker
│  [١٥:٠٠] [--] [--]         │  (grayed = unavailable)
│                              │
│  [ التالي ← ]                │
└─────────────────────────────┘
```

**Step 3 — Summary:**
```
┌─────────────────────────────┐
│  ←  ملخص الحجز         ٣/٣  │
│  ┌────────────────────────┐  │
│  │ المحامي: أحمد الغامدي  │  │  BookingSummary card
│  │ النوع: استشارة فورية   │  │
│  │ التاريخ: ١٠ يوليو      │  │
│  │ الوقت: ٩:٠٠ صباحاً    │  │
│  │ المدة: ٢٠ دقيقة        │  │
│  │ ──────────────────────  │  │
│  │ السعر: ٣٠٠ ر.س (خصم٤٠%)│ │
│  └────────────────────────┘  │
│                              │
│  [ تأكيد وإتمام الدفع ← ]   │
└─────────────────────────────┘
```

**Components used:** `ScreenShell`, `Header`, `StepIndicator`, `ConsultationTypePicker`, `DatePicker`, `TimeSlotPicker`, `BookingSummary`, `Button`

---

## Screen 17 — Payment

**Visual:** Amount summary, payment method selector, pay CTA, success state.

| Property | Value |
|----------|-------|
| Route | `/payment/:consultationId` |
| File | `src/features/payment/PaymentScreen.tsx` |
| API | `POST /payments/initiate` · `GET /payments/:id` (poll) |
| Redirects to | Home or booking confirmation on success |

**Elements:**
```
┌─────────────────────────────┐
│  ←  إتمام الدفع             │
│                              │
│  ┌─ ملخص الدفع ───────────┐  │  PaymentSummary card
│  │ استشارة فورية           │  │
│  │ أحمد الغامدي           │  │
│  │ ──────────────────────  │  │
│  │ السعر الأصلي   ٥٠٠ ر.س │  │  Struck-through
│  │ خصم البطاقة   -٢٠٠ر.س │  │  Green discount
│  │ ──────────────────────  │  │
│  │ الإجمالي       ٣٠٠ ر.س │  │  Bold total
│  └──────────────────────┘   │
│                              │
│  طريقة الدفع                │
│  ┌────────────────────────┐  │
│  │ ◉  Apple Pay           │  │  MethodSelector
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ ○  مدى                 │  │
│  └────────────────────────┘  │
│                              │
│  [ ادفع ٣٠٠ ر.س ← ]         │  Button (gold — payment action)
│                              │
│  🔒 مدفوعاتك محمية بالكامل  │  Trust text
└─────────────────────────────┘
```

**Success state (replaces screen):**
```
┌─────────────────────────────┐
│  [✅ large success icon]    │
│  تم الدفع بنجاح!            │
│  تم حجز استشارتك            │
│  [ عرض تفاصيل الحجز ]       │
│  [ العودة للرئيسية ]         │
└─────────────────────────────┘
```

**Components used:** `ScreenShell`, `Header`, `PaymentSummary`, `MethodSelector`, `Button (gold)`, `Toast`

---

## Screen 18 — Judicial Card

**Visual:** Animated 3D-flip card, QR button, tier info, actions.

| Property | Value |
|----------|-------|
| Route | `/card` |
| File | `src/features/judicial-card/JudicialCardScreen.tsx` |
| API | `GET /judicial-card` · `GET /judicial-card/qr` |

**Elements:**
```
┌─────────────────────────────┐
│  ←  البطاقة القضائية        │
│                              │
│  ┌────────────────────────┐  │
│  │  [3D Flip Card]         │  │  JudicialCard (flippable)
│  │  [Front: card number]   │  │
│  │  Tap to flip for QR →  │  │
│  └────────────────────────┘  │
│                              │
│  البطاقة الذهبية ⭐          │  TierBadge
│  خصم ٤٠٪ على جميع الخدمات  │
│                              │
│  ┌─ مزايا بطاقتك ─────────┐  │
│  │ ✓ خصم ٤٠٪ استشارات    │  │  Card perks list
│  │ ✓ أولوية في الحجوزات   │  │
│  │ ✓ تقارير مجانية        │  │
│  └──────────────────────┘   │
│                              │
│  [ عرض رمز QR ]              │  Button secondary
│  [ ترقية البطاقة ]           │  Button gold (if not GOLD)
└─────────────────────────────┘
```

**Card flip:** tap card → `rotateY(180deg)` → shows QR code on back

**Components used:** `ScreenShell`, `Header`, `JudicialCard (flippable)`, `CardQR`, `TierBadge`, `Button`

---

## Screen 19 — Legal File

**Visual:** 4-tab interface — Cases, Appointments, Documents, Notifications.

| Property | Value |
|----------|-------|
| Route | `/legal-file` |
| File | `src/features/legal-file/LegalFileScreen.tsx` |
| API | Tab-dependent (see below) |

**Tab → API → File mapping:**

| Tab | Label | API | File |
|-----|-------|-----|------|
| `cases` | القضايا | `GET /cases` | `CasesTab.tsx` |
| `appointments` | المواعيد | `GET /cases?type=hearing` | `AppointmentsTab.tsx` |
| `documents` | الوثائق | `GET /documents` | `DocumentsTab.tsx` |
| `notifications` | الإشعارات | `GET /alerts?all=true` | `NotificationsTab.tsx` |

**Elements:**
```
┌─────────────────────────────┐
│  ←  ملفي القانوني           │
│                              │
│  [القضايا][المواعيد][الوثائق][الإشعارات]  │  TabBar (pill)
│                              │
│  — Cases Tab —               │
│  ┌────────────────────────┐  │
│  │ قضية تجارية  منظورة   │  │  CaseCard
│  │ المحكمة التجارية       │  │
│  │ أ.جلسة: ١٥ يوليو ⚠    │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ نزاع عمالي  مغلقة     │  │  CaseCard
│  └────────────────────────┘  │
│                              │
│  [═══ BottomNav ════════]    │
└─────────────────────────────┘
```

**Components used:** `ScreenShell`, `BottomNav`, `Header`, `TabBar`, `CaseCard`, `FileRow`, `AlertCard`, `EmptyState`

---

## Screen 20 — Card Tier Upgrade

**Visual:** 3-column tier comparison, upgrade CTA per tier.

| Property | Value |
|----------|-------|
| Route | `/card/upgrade` |
| File | `src/features/judicial-card/CardTierUpgrade.tsx` |
| API | `POST /judicial-card/upgrade` |

**Elements:**
```
┌─────────────────────────────┐
│  ←  ترقية البطاقة           │
│                              │
│  ┌──────┐ ┌──────┐ ┌──────┐ │
│  │عادية │ │فضية  │ │ذهبية│ │  TierCompare grid
│  │ ٠٪   │ │ ٢٥٪  │ │ ٤٠٪ │ │
│  │──────│ │──────│ │──────│ │
│  │  ✓   │ │  ✓   │ │  ✓  │ │  Feature rows
│  │  ✗   │ │  ✓   │ │  ✓  │ │
│  │  ✗   │ │  ✗   │ │  ✓  │ │
│  │حالية │ │٩٩ر.س│ │١٩٩ر.س│ │
│  └──────┘ └──────┘ └──────┘ │
│                              │
│  [ الترقية للفضية ← ]        │  Button secondary
│  [ الترقية للذهبية ← ]       │  Button gold
└─────────────────────────────┘
```

**Tier feature matrix:**
| Feature | عادية | فضية | ذهبية |
|---------|-------|------|-------|
| خصم الاستشارات | ٠٪ | ٢٥٪ | ٤٠٪ |
| تقارير قانونية | — | ✓ | ✓ |
| أولوية الحجز | — | — | ✓ |
| محامٍ مخصص | — | — | ✓ |

**Components used:** `ScreenShell`, `Header`, `TierCompare`, `TierBadge`, `Button`

---

## Screen 21 — Kiosk

**Visual:** Full-screen dark kiosk layout — QR scanner, card reader, quick services.

| Property | Value |
|----------|-------|
| Route | `/kiosk` |
| File | `src/features/kiosk/KioskScreen.tsx` |
| API | `POST /kiosk/session/start` · `POST /kiosk/scan` · `POST /kiosk/print` |
| Background | `#0E1A16` (dark) |
| Layout | Fixed 760×520px canvas (non-scrollable) |

**Elements:**
```
┌────────────────────────────────────────┐
│  [Logo]   محطة الخدمة الذاتية   [Clock]│
│────────────────────────────────────────│
│                                         │
│  ┌──────────────────────────────────┐  │
│  │                                   │  │
│  │     [QR Scanner Frame]           │  │  KioskQRScanner
│  │     ┌──────────────┐             │  │
│  │     │  [Camera]    │             │  │
│  │     └──────────────┘             │  │
│  │     امسح رمز QR من تطبيقك        │  │
│  │                                   │  │
│  │  ─── أو ضع بطاقتك هنا ───        │  │  KioskCardReader
│  │     [NFC Icon / tap area]        │  │
│  └──────────────────────────────────┘  │
│                                         │
│  الخدمات السريعة:                       │
│  [استدعاء] [طباعة وثيقة] [رفع ملف]     │  KioskQuickServices
│                                         │
└────────────────────────────────────────┘
```

**Quick services:**
| Button | Icon | Action |
|--------|------|--------|
| استدعاء | `support_agent` | Calls court clerk |
| طباعة وثيقة | `print` | `POST /kiosk/print` |
| رفع ملف | `upload_file` | Opens file picker |

**Components used:** `ScreenShell (dark, noNav)`, `KioskQRScanner`, `KioskCardReader`, `KioskQuickServices`, `Button (ghost, dark)`

---

## Screen 22 — Profile & Settings

**Visual:** User info, settings groups (language, accessibility, security, notifications).

| Property | Value |
|----------|-------|
| Route | `/profile` |
| File | `src/features/profile/ProfileScreen.tsx` |
| API | `GET /users/me` · `PATCH /users/me` |
| Store | `settingsStore` (language, calendar, fontSize, dark) |

**Elements:**
```
┌─────────────────────────────┐
│  ←  الملف الشخصي            │
│                              │
│  [Avatar]  [name]           │
│  [nationalId masked]         │
│  [ تعديل الملف ]             │  Ghost button
│                              │
│  ─ اللغة والتقويم ─          │  SectionHeader
│  العربية / الهجري / ١٢٣     │  LanguageSettings row
│                              │
│  ─ إمكانية الوصول ─          │
│  حجم الخط  [─●────]          │  Slider
│  الوضع المظلم  [●]           │  Toggle
│  تباين عالٍ   [ ]            │  Toggle
│                              │
│  ─ الأمان ─                  │
│  بصمة الإصبع  [●]            │  Toggle
│  رمز PIN      [ تغيير ]      │
│                              │
│  ─ الإشعارات ─               │
│  تنبيهات المواعيد  [●]        │
│  تحديثات الأنظمة   [ ]       │
│                              │
│  [ تسجيل الخروج ]            │  Button danger (ghost)
│                              │
│  [═══ BottomNav ════════]    │
└─────────────────────────────┘
```

**Settings persistence:**
```typescript
// settingsStore.ts (Zustand with persist middleware)
const useSettingsStore = create(persist({
  language:   'ar',          // 'ar' | 'en'
  calendar:   'hijri',       // 'hijri' | 'gregorian'
  numerals:   'arabic',      // 'arabic' | 'western'
  fontSize:   'md',          // 'sm' | 'md' | 'lg'
  darkMode:   false,
  biometric:  true,
  alertsEnabled: true,
}, { name: 'settings' }));
```

**Components used:** `ScreenShell`, `BottomNav`, `Header`, `Avatar`, `TabBar`, `LanguageSettings`, `AccessibilitySettings`, `SecuritySettings`, `NotificationSettings`, `Button (danger, ghost)`

---

## Screen 23 — Dark Mode Home

**Identical to Screen 05** but with dark theme applied.

| Property | Value |
|----------|-------|
| Route | `/` |
| File | `src/features/home/HomeScreen.tsx` (same file) |
| Trigger | `settingsStore.darkMode === true` |

**Dark overrides applied:**
- `<html class="dark">` added
- All `--bg` → `#0E1A16`
- All `--surface` → `#16241F`
- All `--border` → `rgba(255,255,255,0.07)`
- All `--text` → `#EAF0ED`
- Bottom nav background → `#16241F`

No component changes — pure CSS variable swap.

---

## Screen 24 — Dark Mode AI Guide

**Identical to Screen 07** but with dark theme applied.

| Property | Value |
|----------|-------|
| Route | `/guide` |
| File | `src/features/legal-guide/LegalGuideChat.tsx` (same file) |
| Trigger | `settingsStore.darkMode === true` |

**Additional dark-specific:** AI bubble background `#16241F`, user bubble unchanged (`#0E5A4A`).

---

## Navigation Flow

```
/splash (2.5s)
    ├── [has token] ──────────────────────────→ /
    └── [no token] ──→ /onboarding ──→ /auth/verify ──→ /auth/success ──→ /

/ (Home)
    ├── Alert badge tap ───────────────────────→ /alerts
    ├── المرشد card ───────────────────────────→ /guide
    ├── المستشار card ─────────────────────────→ /advisor
    ├── محامون card ───────────────────────────→ /lawyers
    ├── قضاياي card ───────────────────────────→ /legal-file
    └── Card widget tap ───────────────────────→ /card

/guide
    └── [question step] → /guide/question ──────→ /guide/summary/:id
        └── [book lawyer CTA] ─────────────────→ /lawyers

/advisor
    └── [analyze] → /advisor/analyzing
        └── [done] → /advisor/opinion
            └── [full report] → /advisor/report/:jobId

/lawyers
    └── /:id (profile)
        └── /book
            └── /payment/:consultationId ───────→ / (on success)

/card
    └── /upgrade

/legal-file (tabbed, no sub-routes)

/profile (tabbed, no sub-routes)

/kiosk (standalone, no nav)
```

---

## State Ownership Map

| Data | Owner | Store / Hook | TTL |
|------|-------|-------------|-----|
| Auth tokens | `authStore` (Zustand + persist) | `useAuth` | Session |
| Current user | TanStack Query `['user']` | `useProfile` | 5 min |
| Dark mode | `settingsStore` (persist) | `useDarkMode` | Persistent |
| Language/calendar | `settingsStore` (persist) | — | Persistent |
| Alerts list | TanStack Query `['alerts']` + WS push | `useAlerts` | 30s |
| Unread count | `alertsStore` (Zustand) | — | Live (WS) |
| Cases list | TanStack Query `['cases']` | `useLegalFile` | 2 min |
| Lawyers list | TanStack Query infinite `['lawyers']` | `useLawyers` | 5 min |
| Judicial card | TanStack Query `['judicial-card']` | `useJudicialCard` | 10 min |
| Guide session | Local component state | `useGuideChat` | Per session |
| Analysis jobId | Local component state | `useDocumentAnalysis` | Per session |
| Booking steps | Local component state | `useBooking` | Per flow |

---

## API Call Map

| Screen | Method | Endpoint | Trigger |
|--------|--------|----------|---------|
| 03 | POST | `/auth/nafath/verify` | OTP submit |
| 03 | POST | `/auth/refresh` | Token expiry |
| 05 | GET | `/users/me` | Mount |
| 05 | GET | `/judicial-card` | Mount |
| 05 | GET | `/cases?status=ACTIVE&limit=3` | Mount |
| 05 | GET | `/alerts?read=false&limit=1` | Mount |
| 06 | GET | `/alerts` | Mount + WS |
| 06 | PATCH | `/alerts/:id/read` | Tap alert |
| 07 | POST | `/ai/guide/start` | First message |
| 08 | POST | `/ai/guide/answer` | Answer submit |
| 09 | GET | `/ai/guide/summary/:id` | Mount |
| 10 | POST | `/documents/upload` | File select |
| 11 | POST | `/ai/advisor/analyze` | Upload complete |
| 11 | GET | `/ai/advisor/report/:jobId` | Poll every 2s |
| 13 | GET | `/ai/advisor/report/:jobId` | Mount |
| 14 | GET | `/lawyers` | Mount + filter change |
| 15 | GET | `/lawyers/:id` | Mount |
| 15 | GET | `/lawyers/:id/availability?date=` | Date select |
| 16 | POST | `/consultations/book` | Step 3 confirm |
| 17 | POST | `/payments/initiate` | Pay CTA |
| 17 | GET | `/payments/:id` | Poll after initiate |
| 18 | GET | `/judicial-card` | Mount |
| 18 | GET | `/judicial-card/qr` | QR button tap |
| 19 | GET | `/cases` | Tab: cases |
| 19 | GET | `/documents` | Tab: documents |
| 19 | GET | `/alerts?all=true` | Tab: notifications |
| 20 | POST | `/judicial-card/upgrade` | Upgrade CTA |
| 21 | POST | `/kiosk/session/start` | Mount |
| 21 | POST | `/kiosk/scan` | QR/card scan |
| 22 | GET | `/users/me` | Mount |
| 22 | PATCH | `/users/me` | Settings save |

---

*المنظومة العدلية الذكية · UI Mapping · v1.0*