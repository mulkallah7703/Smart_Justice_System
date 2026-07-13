# المنظومة العدلية الذكية — Architecture

> Smart Judicial System · Full-Stack · Production-Grade · Arabic RTL

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture Layers](#3-architecture-layers)
4. [Frontend Structure](#4-frontend-structure)
5. [Backend Structure](#5-backend-structure)
6. [AI Service](#6-ai-service)
7. [Database Schema](#7-database-schema)
8. [Infrastructure & DevOps](#8-infrastructure--devops)
9. [Scalability Strategy](#9-scalability-strategy)
10. [Security](#10-security)
11. [API Contracts](#11-api-contracts)
12. [Design Tokens](#12-design-tokens)
13. [Coding Conventions](#13-coding-conventions)

---

## 1. System Overview

**المنظومة العدلية الذكية** is a citizen-facing judicial platform that connects users to legal guidance, AI-powered document analysis, certified lawyers, and their own digital judicial file — all in Arabic RTL.

### Core Features (24 Screens)

| # | Feature | Screen(s) |
|---|---------|-----------|
| 01 | Splash & Onboarding | 01–02 |
| 02 | Nafath Authentication | 03–04 |
| 03 | Home Dashboard | 05 |
| 04 | Proactive Alerts Center | 06 |
| 05 | AI Legal Guide (Chat) | 07–09 |
| 06 | AI Legal Advisor (Document Analysis) | 10–13 |
| 07 | Certified Lawyers Directory | 14–15 |
| 08 | Consultation Booking | 16 |
| 09 | Secure Payment | 17 |
| 10 | Smart Judicial Card | 18, 20 |
| 11 | Digital Legal File | 19 |
| 12 | Self-Service Kiosk | 21 |
| 13 | Profile & Settings | 22 |
| 14 | Dark Mode | 23–24 |

### Design Principles

- **One feature = one file** — no file contains logic for more than one feature
- **One layer = one responsibility** — UI never talks directly to the database
- **Horizontal scaling by default** — every service is stateless and auto-scalable
- **Arabic-first** — RTL, Hijri calendar, Arabic numerals, IBM Plex Sans Arabic

---

## 2. Tech Stack

### Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 18.3 | UI framework — Concurrent Mode + Suspense |
| TypeScript | 5.4 | Type safety across the entire codebase |
| Vite | 5.2 | Build tool — HMR, code splitting, PWA |
| TanStack Query | v5 | Server state — smart cache, optimistic updates |
| Zustand | 4.5 | Client state — lightweight, no boilerplate |
| React Router | v6 | Client-side routing with lazy loading |
| Axios | 1.7 | HTTP client with interceptor chain |

### Backend

| Technology | Version | Purpose |
|-----------|---------|---------|
| NestJS | 10 | Modular framework — DI, decorators, microservices |
| TypeScript | 5.4 | Type safety |
| Prisma | 5.14 | Type-safe ORM + migrations |
| BullMQ | 5 | Job queues — AI tasks, alerts, notifications |
| Socket.io | 4 | WebSocket gateway for real-time alerts |
| Passport JWT | — | Authentication strategy |
| class-validator | — | DTO validation |

### AI Service

| Technology | Version | Purpose |
|-----------|---------|---------|
| Python | 3.12 | Runtime |
| FastAPI | 0.111 | Async API framework |
| LangChain | 0.2 | LLM orchestration + RAG pipelines |
| OpenAI GPT-4o | — | Legal reasoning + report generation |
| Qdrant | 1.9 | Vector DB for semantic law search |
| Tesseract OCR | — | Arabic document text extraction |

### Data Layer

| Technology | Purpose |
|-----------|---------|
| PostgreSQL 16 | Primary database — ACID, JSON, full-text |
| Redis 7.2 | Cache + sessions + pub/sub |
| Elasticsearch 8.13 | Search — lawyers, cases, documents |
| Qdrant 1.9 | Vector embeddings for AI RAG |
| MinIO / S3 | Document file storage |
| TimescaleDB | Audit logs — time-series partitioning |

### Infrastructure

| Technology | Purpose |
|-----------|---------|
| Docker | Container packaging |
| Kubernetes (K8s) | Orchestration + auto-scaling (HPA) |
| Helm | K8s package management |
| Nginx | Load balancer + static file serving |
| Kong | API gateway — rate limiting, auth, analytics |
| GitHub Actions | CI/CD pipelines |
| Prometheus + Grafana | Metrics + dashboards |
| ELK Stack | Centralized logging |
| HashiCorp Vault | Secrets management |

---

## 3. Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                   CLIENT LAYER                           │
│         React 18 + TypeScript + Vite + PWA              │
│     TanStack Query · Zustand · React Router v6           │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTPS / WSS
┌───────────────────────▼─────────────────────────────────┐
│                  GATEWAY LAYER                           │
│      Nginx (Load Balancer) → Kong (API Gateway)         │
│   Rate Limiting · SSL Termination · JWT Verify · CORS    │
└───────────────────────┬─────────────────────────────────┘
                        │ Internal HTTP / gRPC
┌───────────────────────▼─────────────────────────────────┐
│                  SERVICES LAYER                          │
│              NestJS — 11 Independent Modules             │
│  auth · users · cases · documents · lawyers              │
│  consultations · payments · alerts · notifications       │
│  judicial-card · kiosk                                   │
└───────────────────────┬─────────────────────────────────┘
                        │ BullMQ Message Queue
┌───────────────────────▼─────────────────────────────────┐
│                   AI LAYER                               │
│              Python FastAPI Microservice                 │
│   LangChain · GPT-4o · RAG · OCR · Proactive Alerts     │
└───────────────────────┬─────────────────────────────────┘
                        │ Connection Pool
┌───────────────────────▼─────────────────────────────────┐
│                  DATA LAYER                              │
│  PostgreSQL · Redis · Elasticsearch · Qdrant · MinIO     │
└───────────────────────┬─────────────────────────────────┘
                        │ Observability
┌───────────────────────▼─────────────────────────────────┐
│               INFRASTRUCTURE LAYER                       │
│    Docker · Kubernetes · Helm · GitHub Actions           │
│    Prometheus · Grafana · ELK · Vault                    │
└─────────────────────────────────────────────────────────┘
```

### Request Lifecycle

```
1. Client (TanStack Query)
      │
2. Nginx → Kong Gateway
   ├── Rate limit check
   ├── JWT verification
   └── Route to service
      │
3. NestJS Controller
   ├── @UseGuards(JwtAuthGuard)
   ├── @Roles() check
   └── DTO validation (class-validator)
      │
4. NestJS Service (business logic)
      │
5. Redis Cache check
   ├── HIT  → return cached response
   └── MISS → continue
      │
6. Repository → Prisma → PostgreSQL
      │
7. Cache result in Redis (TTL per endpoint)
      │
8. Transform response → { data, meta }
      │
9. Return to client
```

---

## 4. Frontend Structure

> **Rule: one feature = one folder. One concern = one file.**

```
frontend/
├── src/
│   │
│   ├── features/                         # Every screen lives here
│   │   │
│   │   ├── auth/                         # Screens 01–04
│   │   │   ├── SplashScreen.tsx          # Animated splash (screen 01)
│   │   │   ├── OnboardingScreen.tsx      # 4-service intro (screen 02)
│   │   │   ├── NafathVerification.tsx    # Nafath OTP flow (screen 03)
│   │   │   ├── FileCreatedSuccess.tsx    # Judicial file created (screen 04)
│   │   │   ├── useAuth.ts                # login · logout · refresh · persist
│   │   │   ├── authStore.ts              # Zustand: user, token, isAuthenticated
│   │   │   ├── authApi.ts                # POST /auth/nafath · /auth/refresh
│   │   │   └── auth.types.ts             # User · AuthState · NafathPayload
│   │   │
│   │   ├── home/                         # Screen 05
│   │   │   ├── HomeScreen.tsx            # Main dashboard layout
│   │   │   ├── JudicialCardPreview.tsx   # Card widget in dashboard
│   │   │   ├── ServicesGrid.tsx          # 2×2 grid of 4 services
│   │   │   ├── ActiveCasesList.tsx       # Cases with status badges
│   │   │   └── useHomeData.ts            # Parallel fetch: card + cases + alerts
│   │   │
│   │   ├── alerts/                       # Screen 06
│   │   │   ├── AlertsCenter.tsx          # Full alerts screen
│   │   │   ├── AlertCard.tsx             # Single alert (urgent/warning/info)
│   │   │   ├── AlertCountdown.tsx        # Live countdown timer (47:52:10)
│   │   │   ├── AlertsFilter.tsx          # Pill filters: الكل · عاجل · مهل · أنظمة
│   │   │   ├── useAlerts.ts              # WebSocket + fallback polling
│   │   │   └── alertsStore.ts            # Zustand: alerts[], unreadCount
│   │   │
│   │   ├── legal-guide/                  # Screens 07–09
│   │   │   ├── LegalGuideChat.tsx        # Chat interface (screen 07)
│   │   │   ├── ChatBubble.tsx            # AI bubble · User bubble · Typing indicator
│   │   │   ├── ClarifyingQuestion.tsx    # Single/multi choice question (screen 08)
│   │   │   ├── GuideProgress.tsx         # Progress bar "٢ من ٤"
│   │   │   ├── GuidanceSummary.tsx       # Results: type · authority · steps (screen 09)
│   │   │   ├── useGuideChat.ts           # Session state machine + SSE streaming
│   │   │   └── guideApi.ts               # POST /ai/guide/start · /answer
│   │   │
│   │   ├── legal-advisor/                # Screens 10–13
│   │   │   ├── DocumentUpload.tsx        # Drag-drop upload zone (screen 10)
│   │   │   ├── AnalyzingLoader.tsx       # Dark analysis screen (screen 11)
│   │   │   ├── InitialOpinion.tsx        # Strength meter + findings (screen 12)
│   │   │   ├── AdvisoryReport.tsx        # Full PDF-style report (screen 13)
│   │   │   ├── FileUploadProgress.tsx    # Per-file progress bar
│   │   │   ├── useDocumentAnalysis.ts    # Upload → poll jobId → display result
│   │   │   └── advisorApi.ts             # POST /ai/analyze · GET /ai/report/:jobId
│   │   │
│   │   ├── lawyers/                      # Screens 14–15
│   │   │   ├── LawyersList.tsx           # Searchable list with filters (screen 14)
│   │   │   ├── LawyerCard.tsx            # Card: name · rating · specialty · price
│   │   │   ├── LawyerProfile.tsx         # Full profile + stats + discount (screen 15)
│   │   │   ├── LawyersSearch.tsx         # Debounced search input
│   │   │   ├── LawyersFilter.tsx         # Specialty pills: عقاري · تجاري · عمالي
│   │   │   ├── useLawyers.ts             # Infinite scroll + search + filter state
│   │   │   └── lawyersApi.ts             # GET /lawyers · GET /lawyers/:id
│   │   │
│   │   ├── booking/                      # Screen 16
│   │   │   ├── ConsultationType.tsx      # 4 types: فوري · مكتوب · حضوري · توكيل
│   │   │   ├── DateTimePicker.tsx        # Calendar + time slots
│   │   │   ├── BookingSummary.tsx        # Summary before payment
│   │   │   ├── BookingConfirmation.tsx   # Post-payment confirmation
│   │   │   ├── useBooking.ts             # Multi-step state: type → date → confirm
│   │   │   └── bookingApi.ts             # POST /consultations/book
│   │   │
│   │   ├── payment/                      # Screen 17
│   │   │   ├── PaymentScreen.tsx         # Full payment page
│   │   │   ├── PaymentSummary.tsx        # Amount · discount · total
│   │   │   ├── PaymentMethod.tsx         # Apple Pay · مدى selector
│   │   │   ├── PaymentSuccess.tsx        # Success confirmation screen
│   │   │   ├── usePayment.ts             # Initiate → poll status → confirm
│   │   │   └── paymentApi.ts             # POST /payments/initiate · /confirm
│   │   │
│   │   ├── judicial-card/                # Screens 18, 20
│   │   │   ├── JudicialCardScreen.tsx    # Card + actions (screen 18)
│   │   │   ├── CardVisual.tsx            # 3D flip card animation
│   │   │   ├── CardQRCode.tsx            # QR display for identity verification
│   │   │   ├── CardTierUpgrade.tsx       # Tier comparison + upgrade (screen 20)
│   │   │   ├── useJudicialCard.ts        # Card data + tier + discount
│   │   │   └── cardApi.ts                # GET /judicial-card · POST /upgrade
│   │   │
│   │   ├── legal-file/                   # Screen 19
│   │   │   ├── LegalFileScreen.tsx       # Tabbed file screen
│   │   │   ├── CasesTab.tsx              # Cases list with deadlines
│   │   │   ├── AppointmentsTab.tsx       # Upcoming hearings
│   │   │   ├── DocumentsTab.tsx          # Uploaded documents grid
│   │   │   ├── NotificationsTab.tsx      # All notifications history
│   │   │   └── useLegalFile.ts           # Active tab state + per-tab data fetch
│   │   │
│   │   ├── kiosk/                        # Screen 21
│   │   │   ├── KioskScreen.tsx           # Full kiosk layout (760×520)
│   │   │   ├── KioskQRScanner.tsx        # Camera QR scan component
│   │   │   ├── KioskCardReader.tsx       # NFC/contactless card reader
│   │   │   ├── KioskQuickServices.tsx    # استدعاء · طباعة · رفع
│   │   │   └── useKiosk.ts               # Device session + file retrieval
│   │   │
│   │   └── profile/                      # Screens 22–24
│   │       ├── ProfileScreen.tsx         # Profile + all settings (screen 22)
│   │       ├── LanguageSettings.tsx      # عربي/EN · هجري/ميلادي · ٠١٢/012
│   │       ├── AccessibilitySettings.tsx # Font size · contrast · dark mode
│   │       ├── SecuritySettings.tsx      # Fingerprint · PIN · biometric
│   │       ├── NotificationSettings.tsx  # Toggle proactive alerts
│   │       └── useProfile.ts             # Fetch + mutate profile settings
│   │
│   ├── shared/                           # Shared across features — no feature logic here
│   │   ├── components/
│   │   │   ├── BottomNav.tsx             # 5-tab navigation bar
│   │   │   ├── PhoneFrame.tsx            # Device frame wrapper (Storybook/dev)
│   │   │   ├── AlertBanner.tsx           # Inline banner (error · warning · info)
│   │   │   ├── StatusBadge.tsx           # Case status pill (منظورة · بانتظار · عاجل)
│   │   │   ├── SkeletonLoader.tsx        # Shimmer placeholder animation
│   │   │   ├── Button.tsx                # primary · secondary · ghost · gold · disabled
│   │   │   ├── Input.tsx                 # With focus · error · icon states
│   │   │   └── Modal.tsx                 # Bottom sheet on mobile · centered on web
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts           # Managed WS connection with auto-reconnect
│   │   │   ├── useInfiniteScroll.ts      # IntersectionObserver-based pagination
│   │   │   ├── useDarkMode.ts            # Toggle + persist to settingsStore
│   │   │   └── useRTL.ts                 # RTL utility helpers
│   │   ├── api/
│   │   │   ├── httpClient.ts             # Axios instance — baseURL · timeout · headers
│   │   │   ├── interceptors.ts           # Inject Bearer · 401 refresh · error normalize
│   │   │   └── endpoints.ts              # All API URL constants (single source of truth)
│   │   ├── store/
│   │   │   ├── themeStore.ts             # dark/light mode + color scheme
│   │   │   └── settingsStore.ts          # language · calendar · fontSize · numerals
│   │   └── utils/
│   │       ├── dateFormatter.ts          # toHijri() · toGregorian() · formatRelative()
│   │       ├── arabicNumerals.ts         # toArabic(123) → '١٢٣' · toWestern('١٢٣') → 123
│   │       └── validators.ts             # nationalId · phone · fileSize · fileType
│   │
│   └── core/
│       ├── router/
│       │   ├── AppRouter.tsx             # All route definitions — lazy loaded per feature
│       │   └── ProtectedRoute.tsx        # Redirect to /auth if not authenticated
│       ├── theme/
│       │   ├── colors.ts                 # Design tokens (see §12)
│       │   ├── typography.ts             # Font scale — 28 · 22 · 18 · 16 · 14 · 12
│       │   └── animations.ts             # aiGlow · shimmer · ringPulse · spin keyframes
│       └── i18n/
│           ├── ar.ts                     # All Arabic strings (primary language)
│           └── en.ts                     # English strings
```

---

## 5. Backend Structure

> **Rule: one NestJS module = one domain. Repository pattern enforced — services never import Prisma directly.**

```
backend/
├── src/
│   ├── modules/
│   │   │
│   │   ├── auth/
│   │   │   ├── auth.module.ts              # Imports: JwtModule, UsersModule
│   │   │   ├── auth.controller.ts          # POST /auth/nafath/verify · /refresh · /logout
│   │   │   ├── auth.service.ts             # verify() · issueTokens() · revokeRefresh()
│   │   │   ├── nafath.service.ts           # Calls Nafath OAuth API · validates code
│   │   │   ├── jwt.strategy.ts             # Passport strategy · validates JWT · returns user
│   │   │   ├── refresh-token.service.ts    # Store in Redis · rotate on use · revoke on logout
│   │   │   └── auth.dto.ts                 # NafathVerifyDto · RefreshDto
│   │   │
│   │   ├── users/
│   │   │   ├── users.module.ts
│   │   │   ├── users.controller.ts         # GET /users/me · PATCH /users/me
│   │   │   ├── users.service.ts            # getById() · updateProfile() · getStats()
│   │   │   ├── users.repository.ts         # findById() · update() — all Prisma calls here
│   │   │   └── users.dto.ts                # UpdateProfileDto
│   │   │
│   │   ├── cases/
│   │   │   ├── cases.module.ts
│   │   │   ├── cases.controller.ts         # GET /cases · POST /cases · GET /cases/:id
│   │   │   ├── cases.service.ts            # createCase() · updateStatus() · getWithDetails()
│   │   │   ├── cases.repository.ts         # Prisma: Case + Hearing + Deadline relations
│   │   │   ├── cases-search.service.ts     # Elasticsearch: index on create · search by keyword
│   │   │   └── cases.dto.ts                # CreateCaseDto · UpdateCaseStatusDto
│   │   │
│   │   ├── documents/
│   │   │   ├── documents.module.ts
│   │   │   ├── documents.controller.ts     # POST /documents/upload · GET /documents/:id/download
│   │   │   ├── documents.service.ts        # processUpload() · getPresignedUrl() · delete()
│   │   │   ├── storage.service.ts          # MinIO/S3: put · getSignedUrl · remove
│   │   │   ├── documents.repository.ts     # Prisma: Document CRUD
│   │   │   └── documents.dto.ts            # UploadDocumentDto
│   │   │
│   │   ├── lawyers/
│   │   │   ├── lawyers.module.ts
│   │   │   ├── lawyers.controller.ts       # GET /lawyers · GET /lawyers/:id · GET /lawyers/:id/availability
│   │   │   ├── lawyers.service.ts          # list() · getProfile() · getAvailability()
│   │   │   ├── lawyers.repository.ts       # Prisma: Lawyer + ratings
│   │   │   ├── lawyers-search.service.ts   # Elasticsearch: name · specialty · city · rating
│   │   │   └── lawyers.dto.ts              # LawyerFilterDto
│   │   │
│   │   ├── consultations/
│   │   │   ├── consultations.module.ts
│   │   │   ├── consultations.controller.ts # POST /consultations/book · GET /consultations/:id
│   │   │   ├── consultations.service.ts    # book() · confirm() · cancel() · reschedule()
│   │   │   ├── availability.service.ts     # Lawyer calendar · slot generation · conflict check
│   │   │   ├── consultations.repository.ts # Prisma: Consultation + relations
│   │   │   └── consultations.dto.ts        # BookConsultationDto
│   │   │
│   │   ├── payments/
│   │   │   ├── payments.module.ts
│   │   │   ├── payments.controller.ts      # POST /payments/initiate · /payments/webhook
│   │   │   ├── payments.service.ts         # initiate() · applyDiscount() · handleWebhook()
│   │   │   ├── apple-pay.service.ts        # Merchant session · payment token validation
│   │   │   ├── mada.service.ts             # Mada/Visa payment gateway integration
│   │   │   ├── payments.repository.ts      # Prisma: Payment CRUD
│   │   │   └── payments.dto.ts             # InitiatePaymentDto · WebhookDto
│   │   │
│   │   ├── alerts/
│   │   │   ├── alerts.module.ts
│   │   │   ├── alerts.controller.ts        # GET /alerts · PATCH /alerts/:id/read
│   │   │   ├── alerts.service.ts           # create() · classify() · prioritize() · markRead()
│   │   │   ├── deadline-watcher.service.ts # BullMQ job · runs every 5min · scans all deadlines
│   │   │   ├── alerts.gateway.ts           # @WebSocketGateway · pushes to connected clients
│   │   │   └── alerts.repository.ts        # Prisma: Alert CRUD + unread count
│   │   │
│   │   ├── notifications/
│   │   │   ├── notifications.module.ts
│   │   │   ├── notifications.service.ts    # dispatch() · chooses channel by user preference
│   │   │   ├── push.service.ts             # Firebase FCM (Android) + APNs (iOS)
│   │   │   ├── sms.service.ts              # SMS via Saudi telecom gateway (Unifonic/Taqnyat)
│   │   │   └── email.service.ts            # Email via SendGrid or AWS SES
│   │   │
│   │   ├── judicial-card/
│   │   │   ├── judicial-card.module.ts
│   │   │   ├── judicial-card.controller.ts # GET /judicial-card · POST /judicial-card/upgrade · GET /qr
│   │   │   ├── judicial-card.service.ts    # createOnRegistration() · upgrade() · validateQR()
│   │   │   ├── qr-generator.service.ts     # Signs JWT payload → generates QR image
│   │   │   ├── card-tier.service.ts        # NORMAL(0%) · SILVER(25%) · GOLD(40%) logic
│   │   │   └── judicial-card.repository.ts # Prisma: JudicialCard CRUD
│   │   │
│   │   └── kiosk/
│   │       ├── kiosk.module.ts
│   │       ├── kiosk.controller.ts         # POST /kiosk/session/start · /kiosk/scan
│   │       ├── kiosk.service.ts            # authenticateDevice() · retrieveFile() · sync()
│   │       └── kiosk-session.service.ts    # Short-lived session tokens for kiosk devices
│   │
│   ├── shared/
│   │   ├── database/
│   │   │   ├── database.module.ts          # Global PrismaModule (isGlobal: true)
│   │   │   └── prisma.service.ts           # PrismaClient singleton + onModuleInit hook
│   │   ├── cache/
│   │   │   └── redis.service.ts            # get · set · del · ttl · pub · sub wrappers
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts           # @UseGuards(JwtAuthGuard) on all protected routes
│   │   │   └── roles.guard.ts              # @Roles('citizen','lawyer','admin') enforcement
│   │   ├── interceptors/
│   │   │   ├── logging.interceptor.ts      # Logs request + response to ELK (structured JSON)
│   │   │   ├── cache.interceptor.ts        # Auto-cache GET responses in Redis by URL
│   │   │   └── transform.interceptor.ts    # Wraps all responses: { data, meta, timestamp }
│   │   └── decorators/
│   │       ├── current-user.decorator.ts   # @CurrentUser() → extracts User from JWT
│   │       └── roles.decorator.ts          # @Roles() metadata setter
│   │
│   └── app.module.ts                       # Root — imports all feature modules
│
├── prisma/
│   ├── schema.prisma                       # Full schema (see §7)
│   └── migrations/                         # Auto-generated SQL migration files
│
└── test/
    ├── auth.e2e-spec.ts
    ├── cases.e2e-spec.ts
    └── payments.e2e-spec.ts
```

---

## 6. AI Service

> **Stack: Python 3.12 · FastAPI · LangChain · GPT-4o · Qdrant · Tesseract**

```
ai-service/
├── routers/
│   ├── guide_router.py        # POST /guide/start · /guide/answer · /guide/summary
│   ├── advisor_router.py      # POST /advisor/analyze · GET /advisor/report/{job_id}
│   ├── alerts_router.py       # POST /alerts/scan (called internally by deadline-watcher)
│   └── ocr_router.py          # POST /ocr/extract — Arabic document text extraction
│
├── services/
│   ├── legal_guide_service.py     # Manages chat session · collects answers · builds summary
│   ├── document_analyzer.py       # Parses PDF/image · extracts contract clauses · flags risks
│   ├── report_generator.py        # Structures advisory report from analysis results
│   ├── proactive_alerts.py        # Detects risks in case data · returns classified alerts
│   └── ocr_service.py             # Preprocesses image → Tesseract → clean Arabic text
│
├── chains/
│   ├── guide_chain.py         # LangChain: classify issue → ask Qs → generate guidance
│   ├── analysis_chain.py      # LangChain: clause extraction → law matching → risk scoring
│   └── rag_chain.py           # Embed query → Qdrant similarity search → augment prompt
│
├── models/
│   ├── guide_models.py        # Pydantic: GuideStartRequest · GuideAnswerRequest · GuideSummary
│   ├── advisor_models.py      # Pydantic: AnalyzeRequest · OpinionResponse · ReportResponse
│   └── alert_models.py        # Pydantic: AlertScanRequest · AlertResult
│
├── main.py                    # FastAPI app + router registration + CORS config
├── vector_store.py            # Qdrant client: upsert_laws() · search_similar()
├── llm_client.py              # OpenAI GPT-4o client singleton (Ollama fallback for dev)
├── config.py                  # Pydantic Settings — reads from environment variables
└── requirements.txt
```

### AI Flows

**Legal Guide (المرشد)**
```
User message
    → classify_issue() [GPT-4o] → issue type
    → generate_clarifying_questions() → 2–4 questions
    → collect_answers() [stateful session in Redis]
    → build_guidance_summary() [GPT-4o + RAG]
    → return: { caseType, authority, durationDays, requiredDocs, steps[] }
```

**Legal Advisor (المستشار)**
```
Document upload (PDF/image)
    → OCR if image → extract_text()
    → parse_contract_clauses() [GPT-4o]
    → rag_chain.search_relevant_laws() [Qdrant]
    → analyze_risks() [GPT-4o]
    → score_position_strength() [0–100]
    → generate_advisory_report() [GPT-4o]
    → store result → return jobId (async polling)
```

**Proactive Alerts Engine**
```
BullMQ job (every 5 min)
    → scan all deadlines due within 7 days
    → classify each: URGENT (<48h) · WARNING (<7d) · INFO
    → call ai-service /alerts/scan for law-change detection
    → create Alert records in PostgreSQL
    → push via WebSocket to online users
    → send Push/SMS to offline users
```

---

## 7. Database Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── USERS ───────────────────────────────────────────────

model User {
  id            String         @id @default(cuid())
  nationalId    String         @unique
  name          String
  phone         String         @unique
  email         String?
  role          Role           @default(CITIZEN)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  judicialCard  JudicialCard?
  cases         Case[]
  consultations Consultation[]
  documents     Document[]
  alerts        Alert[]

  @@index([nationalId])
  @@index([phone])
}

model JudicialCard {
  id          String     @id @default(cuid())
  cardNumber  String     @unique              // JC-1446-0827
  tier        CardTier   @default(NORMAL)
  qrPayload   String                          // Signed JWT payload for kiosk/QR scan
  discountPct Int        @default(0)          // 0 | 25 | 40
  validUntil  DateTime
  issuedAt    DateTime   @default(now())

  userId      String     @unique
  user        User       @relation(fields: [userId], references: [id])
}

// ─── CASES ───────────────────────────────────────────────

model Case {
  id          String      @id @default(cuid())
  caseNumber  String      @unique
  type        CaseType
  status      CaseStatus  @default(PENDING)
  authority   String                          // الجهة المختصة
  notes       String?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  userId      String
  lawyerId    String?
  user        User        @relation(fields: [userId], references: [id])

  hearings    Hearing[]
  documents   Document[]
  deadlines   Deadline[]
  alerts      Alert[]

  @@index([userId, status])
  @@index([caseNumber])
}

model Hearing {
  id          String   @id @default(cuid())
  scheduledAt DateTime
  location    String?
  notes       String?
  caseId      String
  case        Case     @relation(fields: [caseId], references: [id])
}

model Deadline {
  id        String       @id @default(cuid())
  type      DeadlineType
  dueAt     DateTime
  label     String                            // Human-readable label in Arabic
  caseId    String
  case      Case         @relation(fields: [caseId], references: [id])
  alerts    Alert[]

  @@index([dueAt])
}

// ─── LAWYERS ─────────────────────────────────────────────

model Lawyer {
  id            String         @id @default(cuid())
  licenseNumber String         @unique
  name          String
  specialties   String[]
  city          String
  bio           String?
  rating        Float          @default(0)
  reviewCount   Int            @default(0)
  experienceYrs Int
  priceFrom     Int                           // SAR
  isAvailable   Boolean        @default(true)
  isVerified    Boolean        @default(false)

  consultations Consultation[]

  @@index([specialties])
  @@index([rating])
  @@index([isAvailable])
}

// ─── CONSULTATIONS ───────────────────────────────────────

model Consultation {
  id          String             @id @default(cuid())
  type        ConsultationType
  scheduledAt DateTime
  status      ConsultationStatus @default(PENDING)
  durationMin Int                @default(20)
  notes       String?
  createdAt   DateTime           @default(now())

  userId      String
  lawyerId    String
  user        User               @relation(fields: [userId], references: [id])
  lawyer      Lawyer             @relation(fields: [lawyerId], references: [id])

  payment     Payment?

  @@index([userId, status])
  @@index([lawyerId, scheduledAt])
}

// ─── PAYMENTS ────────────────────────────────────────────

model Payment {
  id             String        @id @default(cuid())
  amount         Float                         // Final amount after discount
  originalAmount Float
  discountPct    Int           @default(0)
  method         PaymentMethod
  status         PaymentStatus @default(PENDING)
  transactionId  String?
  gatewayRef     String?
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  consultationId String        @unique
  consultation   Consultation  @relation(fields: [consultationId], references: [id])

  @@index([status])
}

// ─── DOCUMENTS ───────────────────────────────────────────

model Document {
  id          String   @id @default(cuid())
  name        String
  mimeType    String
  sizeBytes   Int
  storageKey  String                           // MinIO/S3 object key
  isAnalyzed  Boolean  @default(false)
  uploadedAt  DateTime @default(now())

  userId      String
  caseId      String?
  user        User     @relation(fields: [userId], references: [id])
  case        Case?    @relation(fields: [caseId], references: [id])

  @@index([userId])
  @@index([caseId])
}

// ─── ALERTS ──────────────────────────────────────────────

model Alert {
  id          String        @id @default(cuid())
  type        AlertType
  severity    AlertSeverity
  titleAr     String
  bodyAr      String
  isRead      Boolean       @default(false)
  triggeredAt DateTime      @default(now())

  userId      String
  caseId      String?
  deadlineId  String?

  user        User          @relation(fields: [userId], references: [id])
  case        Case?         @relation(fields: [caseId], references: [id])
  deadline    Deadline?     @relation(fields: [deadlineId], references: [id])

  @@index([userId, isRead])
  @@index([triggeredAt])
}

// ─── ENUMS ───────────────────────────────────────────────

enum Role               { CITIZEN LAWYER COURT_STAFF ADMIN }
enum CardTier           { NORMAL SILVER GOLD }
enum CaseType           { RENTAL COMMERCIAL PERSONAL LABOR }
enum CaseStatus         { PENDING ACTIVE CLOSED APPEALING }
enum ConsultationType   { INSTANT WRITTEN IN_PERSON REPRESENTATION }
enum ConsultationStatus { PENDING CONFIRMED COMPLETED CANCELLED }
enum PaymentMethod      { APPLE_PAY MADA VISA }
enum PaymentStatus      { PENDING COMPLETED FAILED REFUNDED }
enum AlertType          { DEADLINE MISSING_DOC LAW_UPDATE HEARING_REMINDER }
enum AlertSeverity      { URGENT WARNING INFO }
enum DeadlineType       { APPEAL DOCUMENT_SUBMIT HEARING PAYMENT }
```

---

## 8. Infrastructure & DevOps

```
infra/
├── k8s/
│   ├── namespaces/
│   │   ├── production.yaml
│   │   └── staging.yaml
│   │
│   ├── deployments/                          # One file per service
│   │   ├── frontend-deployment.yaml          # replicas: 3 (min) · 20 (max)
│   │   ├── auth-service-deployment.yaml      # replicas: 3 (min) · 15 (max)
│   │   ├── cases-service-deployment.yaml
│   │   ├── lawyers-service-deployment.yaml
│   │   ├── alerts-service-deployment.yaml
│   │   ├── payments-service-deployment.yaml
│   │   ├── ai-service-deployment.yaml        # replicas: 2 (min) · 10 (max)
│   │   └── notifications-service-deployment.yaml
│   │
│   ├── services/                             # ClusterIP / LoadBalancer
│   │   ├── frontend-service.yaml
│   │   └── backend-services.yaml
│   │
│   ├── hpa/                                  # HorizontalPodAutoscaler
│   │   ├── frontend-hpa.yaml                 # scale on CPU >70%
│   │   ├── auth-hpa.yaml                     # scale on CPU >60%
│   │   ├── alerts-hpa.yaml                   # scale on WS connection count
│   │   └── ai-service-hpa.yaml               # scale on BullMQ queue depth
│   │
│   └── configmaps/
│       └── app-config.yaml
│
├── docker/
│   ├── frontend.Dockerfile                   # nginx:alpine + Vite build
│   ├── backend.Dockerfile                    # node:20-alpine + NestJS
│   ├── ai-service.Dockerfile                 # python:3.12-slim + FastAPI
│   └── docker-compose.dev.yml                # Full local dev stack
│
├── helm/
│   ├── Chart.yaml
│   ├── values.yaml                           # Base values
│   ├── values.production.yaml                # Production overrides
│   └── values.staging.yaml                   # Staging overrides
│
├── monitoring/
│   ├── prometheus-config.yaml
│   ├── grafana-dashboard.json                # Pre-built dashboard
│   └── alert-rules.yaml                      # Alerting rules (PagerDuty)
│
└── .github/workflows/
    ├── ci.yml                                # Lint + typecheck + tests on PR
    ├── deploy-staging.yml                    # Auto-deploy on push to main
    └── deploy-production.yml                 # Deploy on release tag (requires approval)
```

### CI/CD Pipeline

```
PR opened
    → lint (ESLint + Prettier)
    → typecheck (tsc --noEmit)
    → unit tests (Jest)
    → e2e tests (Playwright)
    → build Docker images
    → push to registry
    → deploy to staging
    → smoke tests on staging
    → [manual approval]
    → deploy to production (rolling update, zero downtime)
```

---

## 9. Scalability Strategy

### Caching (3 Levels)

| Level | Technology | TTL | What |
|-------|-----------|-----|------|
| L1 | TanStack Query (browser) | 5 min stale | API responses per query key |
| L2 | Redis | 5 min lists · 1hr profiles | All GET endpoints |
| L3 | PostgreSQL | — | Source of truth |

### Database

```
- PgBouncer connection pooling (max 1000 connections across all services)
- Read replicas for: cases list · lawyers search · alerts · documents
- Table partitioning: Alert partitioned by month · AuditLog by month
- Indexes: every foreign key · every filter field · every sort field
```

### Queue Strategy (BullMQ)

| Queue | Priority | Workers | What |
|-------|---------|---------|------|
| alerts-urgent | CRITICAL | 5 | Deadline alerts <48h |
| ai-analysis | HIGH | 3 | Document analysis jobs |
| notifications | NORMAL | 10 | Push / SMS / Email dispatch |
| report-gen | LOW | 2 | PDF report generation |
| deadline-scan | SCHEDULED | 1 | Runs every 5 minutes |

### Auto-Scaling Targets

| Service | Min | Max | Trigger |
|---------|-----|-----|---------|
| Frontend | 2 | 20 | CPU >70% |
| Auth service | 3 | 15 | CPU >60% |
| Cases service | 2 | 12 | CPU >70% |
| Alerts service | 2 | 10 | WS connections |
| AI service | 2 | 10 | Queue depth >50 |

### Performance Targets

| Metric | Target |
|--------|--------|
| API P95 latency | < 100ms |
| API P99 latency | < 300ms |
| AI analysis latency | < 30s |
| WebSocket alert delivery | < 500ms |
| Uptime SLA | 99.9% |
| Deploy downtime | 0s (rolling) |

---

## 10. Security

### Authentication

```
Access Token:   JWT · 15 min expiry · RS256 signed
Refresh Token:  Opaque token · 30 days · stored in HttpOnly cookie
Rotation:       New refresh token issued on every use
Revocation:     Redis blacklist — invalidated on logout or suspicious activity
Nafath:         Government identity verification (Saudi Nafath OAuth)
```

### Authorization (RBAC)

| Role | Permissions |
|------|------------|
| `CITIZEN` | Own data only — cases, docs, card, consultations |
| `LAWYER` | Own profile + assigned consultations + case files shared with them |
| `COURT_STAFF` | Read cases in their assigned jurisdiction |
| `ADMIN` | Full read/write + audit logs + user management |

### Rate Limits (Kong)

| Endpoint Group | Limit |
|---------------|-------|
| General API | 100 req/min per user |
| Auth endpoints | 10 req/min per IP |
| AI endpoints | 10 req/min per user |
| File upload | 20 uploads/hour per user |
| Kiosk session | 5 req/min per device |

### Data Protection

```
Encryption in transit:  TLS 1.3 enforced, no TLS 1.1/1.2
Encryption at rest:     AES-256 for National ID + sensitive fields
Document storage:       Per-user encryption keys in HashiCorp Vault
Presigned URLs:         15-minute expiry for document downloads
PII handling:           National ID stored encrypted, never logged
Audit trail:            Every data access logged in TimescaleDB
```

---

## 11. API Contracts

### Auth
```
POST   /auth/nafath/verify          { nationalId, nafathCode }
POST   /auth/refresh                Cookie: refreshToken
POST   /auth/logout
```

### Users
```
GET    /users/me
PATCH  /users/me                    { name?, phone?, email? }
```

### Cases
```
GET    /cases                       ?status=ACTIVE&page=1&limit=20
POST   /cases                       { type, authority, notes? }
GET    /cases/:id
PATCH  /cases/:id/status            { status }
```

### Lawyers
```
GET    /lawyers                     ?specialty=عقاري&city=الرياض&available=true&page=1
GET    /lawyers/:id
GET    /lawyers/:id/availability    ?date=2026-07-10
```

### Consultations
```
POST   /consultations/book          { lawyerId, type, scheduledAt }
GET    /consultations/:id
PATCH  /consultations/:id/cancel
```

### Payments
```
POST   /payments/initiate           { consultationId, method: 'APPLE_PAY'|'MADA'|'VISA' }
POST   /payments/webhook            (gateway callback — verified by signature)
GET    /payments/:id
```

### Alerts
```
GET    /alerts                      ?severity=URGENT&read=false&page=1
PATCH  /alerts/:id/read
DELETE /alerts/:id
WS     /alerts                      Real-time push (Socket.io)
```

### Judicial Card
```
GET    /judicial-card
GET    /judicial-card/qr            Returns signed QR payload
POST   /judicial-card/upgrade       { tier: 'SILVER'|'GOLD' }
```

### Documents
```
POST   /documents/upload            multipart/form-data { file, caseId? }
GET    /documents/:id/download      Returns { presignedUrl, expiresAt }
DELETE /documents/:id
```

### AI Guide
```
POST   /ai/guide/start              { initialMessage: string }
POST   /ai/guide/answer             { sessionId, answer: string }
GET    /ai/guide/summary/:sessionId
```

### AI Advisor
```
POST   /ai/advisor/analyze          { documentIds: string[] }
GET    /ai/advisor/report/:jobId    Polling — status: PENDING|PROCESSING|DONE|FAILED
```

### Kiosk
```
POST   /kiosk/session/start         { deviceId }
POST   /kiosk/scan                  { qrPayload? } | { cardNumber? }
POST   /kiosk/print                 { documentId }
```

---

## 12. Design Tokens

```typescript
// core/theme/colors.ts

export const colors = {
  // Brand
  primary:      '#0E5A4A',   // Deep green — trust & authority
  gold:         '#C7A24B',   // Gold — actions & judicial card
  blue:         '#2F6FB0',   // Blue — AI features

  // Light mode
  background:   '#F6F8F6',
  surface:      '#FFFFFF',
  border:       '#ECEFEC',
  text:         '#19211E',
  textMuted:    '#6B746F',
  textDisabled: '#9aa39e',

  // Semantic
  success:      '#1B873F',
  successBg:    '#E7F2EB',
  warning:      '#D98A0B',
  warningBg:    '#FBF0DC',
  danger:       '#C8372E',
  dangerBg:     '#FBE7E5',
  info:         '#2F6FB0',
  infoBg:       '#E9F0F8',

  // Dark mode
  darkBg:       '#0E1A16',
  darkCard:     '#16241F',
  darkBorder:   'rgba(255,255,255,0.07)',
  darkText:     '#EAF0ED',
  darkMuted:    '#93A39C',
  darkSurface:  '#0c1813',
} as const;

// core/theme/animations.ts
export const keyframes = `
  @keyframes aiGlow {
    0%, 100% { box-shadow: 0 0 0 0 rgba(47,111,176,0); }
    50% { box-shadow: 0 0 22px 1px rgba(47,111,176,.28); }
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  @keyframes ringPulse {
    0% { transform: scale(.85); opacity: .55; }
    100% { transform: scale(1.25); opacity: 0; }
  }
`;

// core/theme/typography.ts
export const fontSize = {
  h1: '28px', h2: '22px', h3: '18px',
  body: '16px', secondary: '14px', caption: '12px',
} as const;

// core/theme/radius.ts
export const radius = {
  card: '16px', button: '12px', pill: '20px',
  phone: '44px', avatar: '15px', icon: '12px', tag: '9px',
} as const;
```

---

## 13. Coding Conventions

### File Naming

```
PascalCase   → React components:  HomeScreen.tsx · AlertCard.tsx
camelCase    → Hooks:             useAlerts.ts · useAuth.ts
camelCase    → API files:         alertsApi.ts · authApi.ts
camelCase    → Stores:            alertsStore.ts · authStore.ts
camelCase    → Utils:             dateFormatter.ts · arabicNumerals.ts
PascalCase   → Types:             Alert · User · JudicialCard
```

### Component Pattern

```typescript
// Every component follows this structure:

// 1. Imports (external → internal → types)
import { useState } from 'react';
import { AlertCard } from './AlertCard';
import type { Alert } from './alerts.types';

// 2. Interface (never inline)
interface AlertsCenterProps {
  initialFilter?: AlertSeverity;
}

// 3. Component (explicit return type)
const AlertsCenter = ({ initialFilter = 'ALL' }: AlertsCenterProps): JSX.Element => {
  // 4. Hooks first
  const { alerts, isLoading } = useAlerts();

  // 5. Derived state
  const urgentCount = alerts.filter(a => a.severity === 'URGENT').length;

  // 6. Handlers
  const handleDismiss = (id: string) => { /* ... */ };

  // 7. Render
  return ( /* JSX */ );
};

export default AlertsCenter;
```

### NestJS Pattern

```typescript
// Services never import PrismaService directly — always via repository
// ❌ Wrong:
@Injectable()
class CasesService {
  constructor(private prisma: PrismaService) {}
  async findAll() { return this.prisma.case.findMany(); }
}

// ✅ Correct:
@Injectable()
class CasesService {
  constructor(private casesRepository: CasesRepository) {}
  async findAll(userId: string) { return this.casesRepository.findByUser(userId); }
}
```

### Arabic / RTL Rules

```
- All Arabic strings in i18n/ar.ts — no hardcoded Arabic in components
- Root element: dir="rtl" lang="ar" — never toggle per-component
- RTL-mirrored icons: use transform: scaleX(-1) on arrow-back, send, etc.
- Numbers: store as integers in DB, display via arabicNumerals.ts
- Dates: store as ISO 8601 UTC, display via dateFormatter.ts (Hijri default)
- Font: IBM Plex Sans Arabic only — no fallback to system Arabic fonts
```

### API Response Format

```typescript
// All responses wrapped by transform.interceptor.ts:
{
  "data": { ... },          // actual payload
  "meta": {
    "timestamp": "2026-07-09T...",
    "version": "1.0"
  }
}

// Paginated responses:
{
  "data": [ ... ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 143,
    "totalPages": 8
  }
}

// Errors (standardized):
{
  "error": {
    "code": "DEADLINE_PASSED",
    "messageAr": "انتهت مهلة الاعتراض",
    "messageEn": "Appeal deadline has passed",
    "statusCode": 422
  }
}
```

---

*المنظومة العدلية الذكية · Full-Stack Architecture · v1.0*