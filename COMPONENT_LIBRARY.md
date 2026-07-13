# المنظومة العدلية الذكية — Component Library

> Complete React + TypeScript component reference.  
> Every component maps 1-to-1 to the actual UI design.  
> RTL · IBM Plex Sans Arabic · Material Symbols Rounded

---

## Table of Contents

1. [Primitives](#1-primitives)
   - Button · Input · Icon · Avatar · Divider
2. [Feedback](#2-feedback)
   - Badge · StatusBadge · AlertBanner · Toast · SkeletonLoader
3. [Navigation](#3-navigation)
   - BottomNav · Header · TabBar · FilterPills · BackButton
4. [Cards](#4-cards)
   - Card · FeatureCard · AICard · CaseCard · LawyerCard · AlertCard
5. [Overlays](#5-overlays)
   - Modal · BottomSheet · Backdrop · Tooltip
6. [Forms](#6-forms)
   - SearchInput · OTPInput · DatePicker · TimeSlotPicker · MethodSelector
7. [Data Display](#7-data-display)
   - StatsRow · ProgressBar · StrengthMeter · StepIndicator · CountdownTimer
8. [AI Components](#8-ai-components)
   - ChatBubble · TypingIndicator · ClarifyingQuestion · GuidanceSummary
9. [Judicial Card](#9-judicial-card)
   - JudicialCard · CardQR · TierBadge · TierCompare
10. [Document Components](#10-document-components)
    - FileUploadZone · FileRow · AnalyzingLoader · ReportSection
11. [Lawyers](#11-lawyers)
    - LawyerCard · RatingStars · AvailabilitySlot · ConsultationTypePicker
12. [Screen Shells](#12-screen-shells)
    - ScreenShell · ScrollContent · SectionHeader · EmptyState

---

## 1. Primitives

### Button

```tsx
// src/shared/components/Button.tsx

type ButtonVariant = 'primary' | 'secondary' | 'gold' | 'ghost' | 'ai' | 'danger';
type ButtonSize    = 'sm' | 'md' | 'lg' | 'xl';

interface ButtonProps {
  variant?:   ButtonVariant;   // default: 'primary'
  size?:      ButtonSize;      // default: 'lg'
  label:      string;
  icon?:      string;          // Material Symbol name
  iconSide?:  'right' | 'left'; // default: 'right' (RTL = visually left)
  loading?:   boolean;
  disabled?:  boolean;
  fullWidth?: boolean;         // default: true
  onClick?:   () => void;
}
```

**Variants & CSS**

```css
/* primary */
.btn-primary {
  background: #0E5A4A;
  color: #FFFFFF;
  box-shadow: 0 2px 8px rgba(14,90,74,.18);
}

/* secondary */
.btn-secondary {
  background: #F6F8F6;
  color: #0E5A4A;
  border: 1.5px solid #ECEFEC;
}

/* gold */
.btn-gold {
  background: linear-gradient(135deg, #C7A24B 0%, #E8C97A 50%, #C7A24B 100%);
  color: #FFFFFF;
  box-shadow: 0 4px 20px rgba(199,162,75,.25);
}

/* ghost */
.btn-ghost {
  background: transparent;
  color: #0E5A4A;
  border: none;
}

/* ai */
.btn-ai {
  background: #2F6FB0;
  color: #FFFFFF;
  animation: aiGlow 2s ease-in-out infinite;
}

/* danger */
.btn-danger {
  background: #FBE7E5;
  color: #C8372E;
  border: 1px solid rgba(200,55,46,.2);
}

/* sizes */
.btn-sm { padding: 8px 16px;  font-size: 13px; border-radius: 8px;  }
.btn-md { padding: 12px 20px; font-size: 15px; border-radius: 10px; }
.btn-lg { padding: 14px 24px; font-size: 16px; border-radius: 12px; }
.btn-xl { padding: 18px 32px; font-size: 17px; border-radius: 14px; }

/* states */
.btn:active   { opacity: 0.85; transform: scale(0.98); }
.btn:disabled { opacity: 0.4;  cursor: not-allowed;    }
```

**Usage**

```tsx
<Button label="ابدأ المحادثة" variant="ai" icon="robot_2" />
<Button label="احجز استشارة"  variant="primary" />
<Button label="ترقية البطاقة" variant="gold" icon="workspace_premium" />
<Button label="تحميل الملف"   variant="secondary" icon="download" size="md" />
<Button label="إلغاء"          variant="danger" fullWidth={false} size="sm" />
```

---

### Input

```tsx
// src/shared/components/Input.tsx

interface InputProps {
  label?:       string;
  placeholder?: string;
  value:        string;
  onChange:     (v: string) => void;
  type?:        'text' | 'tel' | 'number' | 'password';
  icon?:        string;          // Material Symbol — appears on right (RTL start)
  error?:       string;
  hint?:        string;
  disabled?:    boolean;
  maxLength?:   number;
}
```

```css
.input-base {
  background: #FFFFFF;
  border: 1.5px solid #ECEFEC;
  border-radius: 12px;
  padding: 14px 16px;
  font-size: 15px;
  color: #19211E;
  font-family: 'IBM Plex Sans Arabic', sans-serif;
  text-align: right;
  direction: rtl;
  width: 100%;
  transition: border-color 200ms ease-out, box-shadow 200ms ease-out;
}
.input-base:focus {
  border-color: #0E5A4A;
  box-shadow: 0 0 0 3px rgba(14,90,74,.10);
  outline: none;
}
.input-error  { border-color: #C8372E; box-shadow: 0 0 0 3px rgba(200,55,46,.10); }
.input-label  { font-size: 14px; font-weight: 500; color: #19211E; margin-bottom: 8px; }
.input-hint   { font-size: 12px; color: #6B746F; margin-top: 6px; }
.input-error-msg { font-size: 12px; color: #C8372E; margin-top: 6px; }
```

---

### Icon

```tsx
// src/shared/components/Icon.tsx

interface IconProps {
  name:     string;        // Material Symbol name
  size?:    16 | 20 | 24 | 28 | 32 | 40 | 48;   // default: 24
  color?:   string;        // default: 'currentColor'
  filled?:  boolean;       // default: false
  mirror?:  boolean;       // RTL mirror — default: false
  className?: string;
}
```

```css
.icon-base {
  font-family: 'Material Symbols Rounded';
  font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24;
  font-style: normal;
  line-height: 1;
  user-select: none;
}
.icon-filled {
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
.icon-mirror { transform: scaleX(-1); }
```

---

### Avatar

```tsx
interface AvatarProps {
  src?:    string;         // image URL
  name:    string;         // used for initials fallback
  size?:   32 | 40 | 48 | 56 | 64 | 80;   // default: 48
  shape?:  'circle' | 'rounded';            // default: 'rounded' (border-radius: 15px)
  badge?:  'online' | 'verified';
}
```

```css
.avatar-base {
  object-fit: cover;
  flex-shrink: 0;
  background: #E6F0EE;
  color: #0E5A4A;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
.avatar-circle  { border-radius: 50%; }
.avatar-rounded { border-radius: 15px; }

/* Verified badge */
.avatar-badge {
  position: absolute;
  bottom: -2px;
  left: -2px;       /* RTL end */
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #1B873F;
  border: 2px solid #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

---

### Divider

```tsx
interface DividerProps {
  label?: string;          // optional centered label (e.g. "أو")
  color?: string;
}
```

```css
.divider { height: 1px; background: #ECEFEC; width: 100%; }
.divider-labeled {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #6B746F;
  font-size: 13px;
}
.divider-labeled::before,
.divider-labeled::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #ECEFEC;
}
```

---

## 2. Feedback

### Badge

```tsx
// src/shared/components/Badge.tsx

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'gold';

interface BadgeProps {
  label:     string;
  variant:   BadgeVariant;
  dot?:      boolean;      // show colored dot before label
  icon?:     string;       // Material Symbol
  size?:     'sm' | 'md'; // default: 'sm'
}
```

```css
.badge-base {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: 50px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}
.badge-success { background: #E7F2EB; color: #1B873F; }
.badge-warning { background: #FBF0DC; color: #D98A0B; }
.badge-danger  { background: #FBE7E5; color: #C8372E; }
.badge-info    { background: #E9F0F8; color: #2F6FB0; }
.badge-neutral { background: #F6F8F6; color: #6B746F; }
.badge-gold    {
  background: linear-gradient(135deg, #C7A24B, #E8C97A);
  color: #FFFFFF;
}
```

---

### StatusBadge

Semantic alias over Badge — maps `CaseStatus` and `ConsultationStatus` to badge variants.

```tsx
type CaseStatus         = 'PENDING' | 'ACTIVE' | 'CLOSED' | 'APPEALING';
type ConsultationStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

interface StatusBadgeProps {
  status: CaseStatus | ConsultationStatus;
}

const STATUS_MAP = {
  ACTIVE:    { label: 'منظورة',   variant: 'success' },
  PENDING:   { label: 'بانتظار',  variant: 'warning' },
  CLOSED:    { label: 'مغلقة',    variant: 'neutral' },
  APPEALING: { label: 'استئناف',  variant: 'info'    },
  CONFIRMED: { label: 'مؤكدة',   variant: 'success' },
  COMPLETED: { label: 'منتهية',  variant: 'neutral' },
  CANCELLED: { label: 'ملغاة',   variant: 'danger'  },
};
```

---

### AlertBanner

```tsx
type BannerVariant = 'success' | 'warning' | 'danger' | 'info';

interface AlertBannerProps {
  variant:    BannerVariant;
  title:      string;
  body?:      string;
  icon?:      string;
  onDismiss?: () => void;
  action?:    { label: string; onClick: () => void; };
}
```

```css
.banner-base {
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  font-size: 14px;
  line-height: 1.5;
}
.banner-success { background: #E7F2EB; color: #1B873F; border: 1px solid rgba(27,135,63,.2); }
.banner-warning { background: #FBF0DC; color: #D98A0B; border: 1px solid rgba(217,138,11,.2); }
.banner-danger  { background: #FBE7E5; color: #C8372E; border: 1px solid rgba(200,55,46,.2); }
.banner-info    { background: #E9F0F8; color: #2F6FB0; border: 1px solid rgba(47,111,176,.2); }
```

---

### Toast

```tsx
type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  message:  string;
  variant:  ToastVariant;
  duration?: number;        // ms, default: 3000
}

// Usage via hook
const { toast } = useToast();
toast({ message: 'تم حجز الاستشارة بنجاح', variant: 'success' });
```

```css
.toast {
  position: fixed;
  bottom: 88px;            /* above bottom nav */
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 20px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  box-shadow: 0 8px 24px rgba(0,0,0,.12);
  animation: toastIn 300ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
  z-index: 1000;
}
@keyframes toastIn {
  from { opacity: 0; transform: translateX(-50%) translateY(12px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}
```

---

### SkeletonLoader

```tsx
interface SkeletonProps {
  variant: 'text' | 'title' | 'avatar' | 'card' | 'button' | 'custom';
  width?:  string;
  height?: string;
  rows?:   number;    // for 'text' variant — number of lines
}
```

```css
.skeleton {
  background: linear-gradient(
    90deg,
    #ECEFEC 0%, #F6F8F6 50%, #ECEFEC 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: 8px;
}

/* Presets */
.skeleton-title    { height: 20px; width: 60%; border-radius: 6px; }
.skeleton-text     { height: 14px; width: 100%; border-radius: 4px; }
.skeleton-text-sm  { height: 14px; width: 75%; border-radius: 4px; }
.skeleton-avatar   { width: 48px; height: 48px; border-radius: 50%; flex-shrink: 0; }
.skeleton-card     { height: 120px; border-radius: 16px; }
.skeleton-button   { height: 50px; border-radius: 12px; }
```

**Skeleton Card (composed)**

```tsx
const LawyerCardSkeleton = () => (
  <div className="card-base" style={{ display: 'flex', gap: 14 }}>
    <Skeleton variant="avatar" />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Skeleton variant="title" />
      <Skeleton variant="text" />
      <Skeleton variant="text-sm" />
    </div>
  </div>
);
```

---

## 3. Navigation

### BottomNav

```tsx
// src/shared/components/BottomNav.tsx

interface NavTab {
  id:    string;
  label: string;
  icon:  string;   // Material Symbol name
  path:  string;
}

const TABS: NavTab[] = [
  { id: 'home',          label: 'الرئيسية', icon: 'home',          path: '/'          },
  { id: 'legal-file',    label: 'ملفي',     icon: 'folder_shared', path: '/legal-file' },
  { id: 'legal-guide',   label: 'المرشد',   icon: 'robot_2',       path: '/guide'      },
  { id: 'lawyers',       label: 'المحامون', icon: 'badge',         path: '/lawyers'    },
  { id: 'alerts',        label: 'الإشعارات',icon: 'notifications', path: '/alerts'     },
];
```

```css
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 72px;
  background: #FFFFFF;
  border-top: 1px solid #ECEFEC;
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  box-shadow: 0 -4px 16px rgba(14,90,74,.06);
  z-index: 100;
}
.nav-tab         { display: flex; flex-direction: column; align-items: center;
                   gap: 3px; flex: 1; padding: 8px 0; color: #9AA39E;
                   transition: color 200ms ease-out; cursor: pointer; }
.nav-tab.active  { color: #0E5A4A; }
.nav-icon.active { font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
.nav-label       { font-size: 11px; font-weight: 500; }

/* Unread badge on alerts tab */
.nav-badge {
  position: absolute;
  top: 4px;
  left: 50%;
  transform: translateX(-50%) translateX(10px);
  background: #C8372E;
  color: #FFFFFF;
  border-radius: 50%;
  min-width: 16px;
  height: 16px;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #FFFFFF;
}
```

---

### Header

```tsx
// src/shared/components/Header.tsx

interface HeaderProps {
  title:        string;
  showBack?:    boolean;                          // default: true
  onBack?:      () => void;                       // default: router.back()
  rightAction?: { icon: string; onClick: () => void; label: string; };
  leftAction?:  { icon: string; onClick: () => void; label: string; };
  transparent?: boolean;
  dark?:        boolean;
}
```

```css
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  min-height: 56px;
}
.header-title   { font-size: 18px; font-weight: 600; color: #19211E; }
.header-dark .header-title { color: #EAF0ED; }
.header-transparent { background: transparent; position: absolute; top: 0; left: 0; right: 0; z-index: 10; }

/* Icon button wrapper (44×44 touch target) */
.header-icon-btn {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  cursor: pointer;
  transition: background 150ms ease-out;
}
.header-icon-btn:active { background: rgba(14,90,74,.08); }
```

---

### TabBar

```tsx
// src/shared/components/TabBar.tsx

interface TabBarProps {
  tabs:     { id: string; label: string; }[];
  active:   string;
  onChange: (id: string) => void;
  variant?: 'pill' | 'underline';   // default: 'pill'
}
```

```css
/* pill variant */
.tab-bar-pill {
  display: flex;
  background: #ECEFEC;
  border-radius: 12px;
  padding: 4px;
  gap: 2px;
}
.tab-pill-item {
  flex: 1;
  padding: 10px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  text-align: center;
  transition: all 200ms ease-out;
  color: #6B746F;
}
.tab-pill-item.active {
  background: #FFFFFF;
  color: #0E5A4A;
  box-shadow: 0 1px 4px rgba(14,90,74,.1);
}

/* underline variant */
.tab-bar-underline { display: flex; border-bottom: 1px solid #ECEFEC; }
.tab-underline-item {
  flex: 1;
  padding: 12px;
  font-size: 14px;
  font-weight: 500;
  text-align: center;
  color: #6B746F;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: all 200ms ease-out;
}
.tab-underline-item.active { color: #0E5A4A; border-bottom-color: #0E5A4A; }
```

---

### FilterPills

```tsx
interface FilterPillsProps {
  options:   { id: string; label: string; count?: number; }[];
  selected:  string | string[];
  multi?:    boolean;                  // allow multiple selected
  onChange:  (selected: string | string[]) => void;
  scrollable?: boolean;                // horizontal scroll
}
```

```css
.filter-pills-wrap {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
  padding-bottom: 2px;
}
.filter-pill {
  padding: 8px 16px;
  border-radius: 50px;
  font-size: 13px;
  font-weight: 500;
  border: 1.5px solid #ECEFEC;
  background: #FFFFFF;
  color: #6B746F;
  white-space: nowrap;
  cursor: pointer;
  transition: all 200ms ease-out;
  flex-shrink: 0;
}
.filter-pill.active {
  background: #0E5A4A;
  color: #FFFFFF;
  border-color: #0E5A4A;
}
.filter-pill-count {
  background: rgba(255,255,255,.25);
  border-radius: 50px;
  padding: 1px 6px;
  font-size: 11px;
  margin-right: 4px;      /* RTL: visually left of label */
}
```

---

### BackButton

```tsx
interface BackButtonProps {
  onBack?:  () => void;
  dark?:    boolean;       // for dark screens
  label?:   string;        // optional text label
}
```

```css
.back-btn {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  cursor: pointer;
  color: #19211E;
  transition: background 150ms ease-out;
}
.back-btn:active { background: rgba(14,90,74,.08); }
.back-btn.dark   { color: #EAF0ED; }
.back-btn .icon  { transform: scaleX(-1); }   /* RTL mirror */
```

---

## 4. Cards

### Card

```tsx
// src/shared/components/Card.tsx

interface CardProps {
  children:   React.ReactNode;
  variant?:   'default' | 'feature' | 'ai' | 'urgent' | 'gold';
  padding?:   number;           // default: 20
  onClick?:   () => void;
  className?: string;
}
```

```css
.card-default {
  background: #FFFFFF;
  border: 1px solid #ECEFEC;
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(14,90,74,.08);
}
.card-feature {
  background: #FFFFFF;
  border: 1px solid #ECEFEC;
  border-radius: 20px;
  box-shadow: 0 4px 16px rgba(14,90,74,.10);
}
.card-ai {
  background: linear-gradient(135deg, #EBF2FA 0%, #F5F8FC 100%);
  border: 1px solid rgba(47,111,176,.15);
  border-radius: 20px;
}
.card-urgent {
  background: #FFFFFF;
  border: 1px solid rgba(200,55,46,.2);
  border-right: 3px solid #C8372E;  /* accent — RTL right */
  border-radius: 16px;
  box-shadow: 0 4px 16px rgba(200,55,46,.08);
}
.card-gold {
  background: linear-gradient(135deg, #1a3a2e 0%, #0e2a20 100%);
  border: 1px solid rgba(199,162,75,.3);
  border-radius: 24px;
  box-shadow: 0 8px 32px rgba(0,0,0,.3), 0 0 0 1px rgba(199,162,75,.2);
}
```

---

### FeatureCard

Home screen 2×2 grid. Each card represents a main service.

```tsx
interface FeatureCardProps {
  title:       string;
  description: string;
  icon:        string;       // Material Symbol
  iconBg:      string;       // background color
  iconColor:   string;
  badge?:      string;       // e.g. 'جديد', 'AI'
  onClick:     () => void;
}
```

```css
.feature-card {
  background: #FFFFFF;
  border: 1px solid #ECEFEC;
  border-radius: 20px;
  padding: 20px;
  cursor: pointer;
  transition: transform 200ms ease-out, box-shadow 200ms ease-out;
}
.feature-card:active {
  transform: scale(0.97);
  box-shadow: 0 2px 8px rgba(14,90,74,.08);
}
.feature-icon-wrap {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
}
```

**Four home cards:**

| Title | Icon | iconBg | iconColor |
|-------|------|--------|-----------|
| المرشد الذكي | `robot_2` | `#E9F0F8` | `#2F6FB0` |
| المستشار القانوني | `psychology` | `#EBF5EE` | `#0E5A4A` |
| ابحث عن محامٍ | `badge` | `#FBF4E6` | `#C7A24B` |
| قضاياي | `gavel` | `#F6F8F6` | `#6B746F` |

---

### AICard

Used on the AI Guide and Advisor screens to highlight an AI-driven insight.

```tsx
interface AICardProps {
  title:    string;
  body:     string;
  icon?:    string;       // default: 'auto_awesome'
  glowing?: boolean;      // enables aiGlow animation on border
}
```

```css
.ai-card {
  background: linear-gradient(135deg, #EBF2FA, #F5F8FC);
  border: 1px solid rgba(47,111,176,.2);
  border-radius: 16px;
  padding: 18px;
}
.ai-card.glowing {
  animation: aiGlow 2s ease-in-out infinite;
}
.ai-card-icon {
  width: 40px;
  height: 40px;
  background: rgba(47,111,176,.12);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #2F6FB0;
}
```

---

### CaseCard

```tsx
interface CaseCardProps {
  caseNumber:   string;
  type:         string;           // 'تجاري' | 'عقاري' | 'عمالي' | 'شخصي'
  authority:    string;
  status:       CaseStatus;
  nextDeadline?: { label: string; dueAt: Date; urgent: boolean; };
  onClick:      () => void;
}
```

```css
.case-card {
  background: #FFFFFF;
  border: 1px solid #ECEFEC;
  border-radius: 14px;
  padding: 16px;
  cursor: pointer;
  transition: box-shadow 200ms ease-out;
}
.case-card:active { box-shadow: 0 4px 16px rgba(14,90,74,.10); }

.case-number { font-size: 13px; color: #6B746F; font-weight: 400; }
.case-type   { font-size: 15px; font-weight: 600; color: #19211E; }
.case-auth   { font-size: 13px; color: #6B746F; }

/* Deadline row */
.case-deadline {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #ECEFEC;
  font-size: 13px;
}
.case-deadline.urgent { color: #C8372E; }
.case-deadline.warning { color: #D98A0B; }
```

---

### LawyerCard

```tsx
interface LawyerCardProps {
  id:             string;
  name:           string;
  avatarUrl?:     string;
  specialties:    string[];
  city:           string;
  rating:         number;
  reviewCount:    number;
  experienceYrs:  number;
  priceFrom:      number;           // SAR
  isAvailable:    boolean;
  discountPct?:   number;           // from judicial card tier
  isVerified?:    boolean;
  onClick:        () => void;
}
```

```css
.lawyer-card {
  background: #FFFFFF;
  border: 1px solid #ECEFEC;
  border-radius: 16px;
  padding: 16px;
  display: flex;
  gap: 14px;
  align-items: flex-start;
  cursor: pointer;
  transition: box-shadow 200ms ease-out;
}
.lawyer-name       { font-size: 16px; font-weight: 600; color: #19211E; }
.lawyer-specialty  { font-size: 13px; color: #6B746F; }
.lawyer-price-row  { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.price-original    { text-decoration: line-through; color: #9AA39E; font-size: 13px; }
.price-discounted  { color: #1B873F; font-weight: 700; font-size: 16px; }
.price-unit        { color: #6B746F; font-size: 12px; }
.available-dot     { width: 8px; height: 8px; border-radius: 50%; background: #1B873F; }
```

---

### AlertCard

```tsx
type AlertSeverity = 'URGENT' | 'WARNING' | 'INFO';

interface AlertCardProps {
  id:          string;
  severity:    AlertSeverity;
  type:        'DEADLINE' | 'MISSING_DOC' | 'LAW_UPDATE' | 'HEARING_REMINDER';
  titleAr:     string;
  bodyAr:      string;
  triggeredAt: Date;
  isRead:      boolean;
  timeLeft?:   string;          // e.g. '47:52:10' for countdown
  onRead:      (id: string) => void;
  onDismiss?:  (id: string) => void;
}
```

```css
.alert-card {
  background: #FFFFFF;
  border-radius: 16px;
  padding: 16px;
  cursor: pointer;
  transition: opacity 200ms ease-out;
}
/* Severity left accent bar (RTL: right side) */
.alert-card-urgent  { border: 1px solid rgba(200,55,46,.2); border-right: 3px solid #C8372E; box-shadow: 0 4px 16px rgba(200,55,46,.08); }
.alert-card-warning { border: 1px solid rgba(217,138,11,.2); border-right: 3px solid #D98A0B; }
.alert-card-info    { border: 1px solid rgba(47,111,176,.2);  border-right: 3px solid #2F6FB0; }

.alert-card.unread::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #C8372E;
  position: absolute;
  top: 16px;
  left: 16px;    /* RTL: top-left = top-end */
}

/* Countdown display */
.alert-countdown {
  font-size: 22px;
  font-weight: 300;
  color: #C8372E;
  letter-spacing: 2px;
  font-variant-numeric: tabular-nums;
}
```

---

## 5. Overlays

### Modal

```tsx
interface ModalProps {
  isOpen:     boolean;
  onClose:    () => void;
  title?:     string;
  children:   React.ReactNode;
  size?:      'sm' | 'md' | 'lg';    // default: 'md'
  closable?:  boolean;               // default: true
}
```

```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(14,26,22,.5);
  backdrop-filter: blur(4px);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.modal-box {
  background: #FFFFFF;
  border-radius: 24px;
  padding: 24px;
  width: 100%;
  max-width: 480px;
  animation: scaleIn 300ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
  box-shadow: 0 24px 48px rgba(0,0,0,.2);
}
@keyframes scaleIn {
  from { opacity: 0; transform: scale(.94); }
  to   { opacity: 1; transform: scale(1); }
}
```

---

### BottomSheet

```tsx
interface BottomSheetProps {
  isOpen:    boolean;
  onClose:   () => void;
  title?:    string;
  children:  React.ReactNode;
  snapPoints?: number[];     // heights in px — default: [400]
}
```

```css
.sheet-wrap {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}
.sheet-box {
  background: #FFFFFF;
  border-radius: 24px 24px 0 0;
  padding: 0 20px calc(env(safe-area-inset-bottom, 0px) + 24px);
  box-shadow: 0 -8px 32px rgba(14,90,74,.12);
  animation: slideUpSheet 350ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
@keyframes slideUpSheet {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
.sheet-handle {
  width: 40px;
  height: 4px;
  background: #ECEFEC;
  border-radius: 2px;
  margin: 12px auto 20px;
}
```

---

### Backdrop

```tsx
interface BackdropProps {
  visible:   boolean;
  onClick?:  () => void;
  blur?:     boolean;     // default: true
}
```

```css
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(14,26,22,.5);
  z-index: 200;
  transition: opacity 250ms ease-out;
}
.backdrop.blur { backdrop-filter: blur(4px); }
.backdrop.hidden { opacity: 0; pointer-events: none; }
```

---

### Tooltip

```tsx
interface TooltipProps {
  content:   string;
  children:  React.ReactNode;
  position?: 'top' | 'bottom' | 'right' | 'left';
}
```

```css
.tooltip {
  position: absolute;
  background: #19211E;
  color: #FFFFFF;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 8px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 150ms ease-out;
  z-index: 500;
}
.tooltip-trigger:hover .tooltip { opacity: 1; }
```

---

## 6. Forms

### SearchInput

```tsx
interface SearchInputProps {
  value:       string;
  onChange:    (v: string) => void;
  placeholder?: string;
  onClear?:    () => void;
  loading?:    boolean;
  autoFocus?:  boolean;
}
```

```css
.search-input-wrap {
  position: relative;
}
.search-input {
  background: #F6F8F6;
  border: 1.5px solid #ECEFEC;
  border-radius: 20px;
  padding: 12px 44px 12px 40px;   /* right = icon, left = clear */
  font-size: 15px;
  color: #19211E;
  width: 100%;
  transition: border-color 200ms ease-out;
}
.search-input:focus { border-color: #0E5A4A; }
.search-icon { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); color: #6B746F; }
.search-clear { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #6B746F; }
```

---

### OTPInput

Used on the Nafath verification screen (screen 03).

```tsx
interface OTPInputProps {
  length:    number;         // default: 6
  value:     string;
  onChange:  (v: string) => void;
  onComplete?: (v: string) => void;
  error?:    boolean;
}
```

```css
.otp-wrap {
  display: flex;
  gap: 10px;
  justify-content: center;
  direction: ltr;            /* OTP digits always LTR */
}
.otp-cell {
  width: 48px;
  height: 56px;
  border: 2px solid #ECEFEC;
  border-radius: 12px;
  font-size: 22px;
  font-weight: 600;
  text-align: center;
  color: #19211E;
  background: #FFFFFF;
  transition: border-color 200ms ease-out;
}
.otp-cell:focus  { border-color: #0E5A4A; box-shadow: 0 0 0 3px rgba(14,90,74,.10); outline: none; }
.otp-cell.filled { border-color: #0E5A4A; }
.otp-cell.error  { border-color: #C8372E; }
```

---

### DatePicker

Calendar sheet for booking consultations (screen 16).

```tsx
interface DatePickerProps {
  value:     Date | null;
  onChange:  (d: Date) => void;
  minDate?:  Date;
  maxDate?:  Date;
  calendar?: 'hijri' | 'gregorian';   // from user settings
  disabledDates?: Date[];
}
```

```css
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}
.calendar-day {
  aspect-ratio: 1;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  cursor: pointer;
  transition: all 200ms ease-out;
}
.calendar-day:hover    { background: #E6F0EE; }
.calendar-day.selected { background: #0E5A4A; color: #FFFFFF; font-weight: 600; }
.calendar-day.today    { border: 1.5px solid #0E5A4A; color: #0E5A4A; }
.calendar-day.disabled { opacity: 0.35; cursor: not-allowed; pointer-events: none; }
.calendar-day-label    { font-size: 12px; color: #6B746F; text-align: center; padding-bottom: 8px; }
```

---

### TimeSlotPicker

```tsx
interface TimeSlot {
  time:      string;     // '09:00'
  available: boolean;
}
interface TimeSlotPickerProps {
  slots:    TimeSlot[];
  selected: string | null;
  onChange: (time: string) => void;
}
```

```css
.slot-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.time-slot {
  padding: 12px 8px;
  border: 1.5px solid #ECEFEC;
  border-radius: 10px;
  text-align: center;
  font-size: 14px;
  cursor: pointer;
  transition: all 200ms ease-out;
}
.time-slot.selected   { background: #0E5A4A; color: #FFFFFF; border-color: #0E5A4A; }
.time-slot.unavailable { background: #F6F8F6; color: #9AA39E; cursor: not-allowed; text-decoration: line-through; }
```

---

### MethodSelector

Payment method picker (screen 17).

```tsx
type PaymentMethod = 'APPLE_PAY' | 'MADA' | 'VISA';

interface MethodSelectorProps {
  selected:  PaymentMethod;
  onChange:  (m: PaymentMethod) => void;
}

const METHODS = [
  { id: 'APPLE_PAY', label: 'Apple Pay', icon: 'apple'  },
  { id: 'MADA',      label: 'مدى',       icon: 'credit_card' },
  { id: 'VISA',      label: 'Visa',      icon: 'credit_card' },
];
```

```css
.method-option {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  border: 1.5px solid #ECEFEC;
  border-radius: 14px;
  cursor: pointer;
  transition: all 200ms ease-out;
  margin-bottom: 10px;
}
.method-option.selected {
  border-color: #0E5A4A;
  background: #E6F0EE;
}
.method-radio {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid #ECEFEC;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.method-radio.selected {
  border-color: #0E5A4A;
  background: #0E5A4A;
}
.method-radio.selected::after {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #FFFFFF;
}
```

---

## 7. Data Display

### StatsRow

```tsx
interface Stat {
  label: string;
  value: string | number;
  icon?: string;
  color?: string;
}
interface StatsRowProps {
  stats: Stat[];     // 2–4 stats
}
```

```css
.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 12px;
}
.stat-item {
  background: #F6F8F6;
  border-radius: 12px;
  padding: 14px 12px;
  text-align: center;
}
.stat-value { font-size: 22px; font-weight: 700; color: #19211E; }
.stat-label { font-size: 12px; color: #6B746F; margin-top: 4px; }
```

---

### ProgressBar

```tsx
interface ProgressBarProps {
  value:    number;          // 0–100
  max?:     number;          // default: 100
  label?:   string;
  color?:   string;          // default: primary
  height?:  number;          // default: 6
  animated?: boolean;        // default: true
}
```

```css
.progress-track {
  height: 6px;
  background: #ECEFEC;
  border-radius: 3px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #0E5A4A, #1a7a62);
  border-radius: 3px;
  transition: width 600ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

---

### StrengthMeter

AI Advisor case strength display (screen 12). SVG arc with animated fill.

```tsx
interface StrengthMeterProps {
  score:    number;    // 0–100
  size?:    number;    // default: 160px
}

// Color by score:
// 75–100 → success (#1B873F) · label: 'قوية'
// 45–74  → warning (#D98A0B) · label: 'متوسطة'
// 0–44   → danger  (#C8372E) · label: 'ضعيفة'
```

```css
.strength-svg { transform: rotate(-90deg); }
.strength-track { stroke: #ECEFEC; stroke-width: 10; fill: none; }
.strength-fill  {
  stroke-width: 10;
  stroke-linecap: round;
  fill: none;
  transition: stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1);
}
.strength-label {
  font-size: 32px;
  font-weight: 700;
  fill: #19211E;
}
.strength-sublabel {
  font-size: 14px;
  fill: #6B746F;
}
```

---

### StepIndicator

Multi-step flows: Booking (3 steps), Guide (4 steps), Payment.

```tsx
interface StepIndicatorProps {
  total:   number;
  current: number;       // 1-based
  labels?: string[];
}
```

```css
.step-dots { display: flex; gap: 6px; align-items: center; justify-content: center; }
.step-dot {
  height: 8px;
  border-radius: 4px;
  background: #ECEFEC;
  transition: all 250ms ease-out;
  width: 8px;
}
.step-dot.active    { background: #0E5A4A; width: 24px; }
.step-dot.completed { background: #1B873F; }
```

---

### CountdownTimer

Urgent alert countdown — live updating.

```tsx
interface CountdownTimerProps {
  targetDate:  Date;
  onExpire?:   () => void;
  showRing?:   boolean;     // animated ring pulse
  size?:       'sm' | 'md' | 'lg';
}
```

```css
.countdown-wrap  { position: relative; display: inline-flex; align-items: center; justify-content: center; }
.countdown-ring  {
  position: absolute;
  inset: -8px;
  border-radius: 50%;
  border: 2px solid rgba(200,55,46,.3);
  animation: ringPulse 1.5s ease-out infinite;
}
.countdown-time  { font-size: 28px; font-weight: 300; color: #C8372E; letter-spacing: 2px; font-variant-numeric: tabular-nums; }
```

---

## 8. AI Components

### ChatBubble

```tsx
type BubbleRole = 'ai' | 'user';

interface ChatBubbleProps {
  role:       BubbleRole;
  text:       string;
  timestamp?: Date;
  isStreaming?: boolean;     // show cursor at end while streaming
}
```

```css
.bubble-wrap  { display: flex; margin-bottom: 12px; }
.bubble-wrap.ai   { justify-content: flex-end;   /* RTL: AI on right */ }
.bubble-wrap.user { justify-content: flex-start;  /* RTL: user on left */ }

.bubble-ai {
  background: #FFFFFF;
  border: 1px solid #ECEFEC;
  border-radius: 4px 20px 20px 20px;
  padding: 14px 16px;
  max-width: 85%;
  font-size: 15px;
  line-height: 1.6;
  color: #19211E;
  box-shadow: 0 2px 8px rgba(14,90,74,.06);
}
.bubble-user {
  background: #0E5A4A;
  color: #FFFFFF;
  border-radius: 20px 4px 20px 20px;
  padding: 14px 16px;
  max-width: 80%;
  font-size: 15px;
  line-height: 1.6;
}
.bubble-time {
  font-size: 11px;
  color: #9AA39E;
  margin-top: 4px;
  text-align: end;
}

/* Streaming cursor */
.streaming-cursor {
  display: inline-block;
  width: 2px;
  height: 16px;
  background: #0E5A4A;
  margin-right: 2px;
  animation: blink 1s step-end infinite;
  vertical-align: middle;
}
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
```

---

### TypingIndicator

```tsx
// No props — shows when AI is composing
const TypingIndicator = () => (
  <div className="bubble-wrap ai">
    <div className="bubble-ai typing-bubble">
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="typing-dot" />
    </div>
  </div>
);
```

```css
.typing-bubble { padding: 14px 18px; display: flex; gap: 5px; align-items: center; }
.typing-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #6B746F;
  animation: typingBounce 1.2s ease-in-out infinite;
}
.typing-dot:nth-child(2) { animation-delay: .2s; }
.typing-dot:nth-child(3) { animation-delay: .4s; }
@keyframes typingBounce {
  0%, 60%, 100% { transform: translateY(0); }
  30%            { transform: translateY(-6px); }
}
```

---

### ClarifyingQuestion

Guide screen (screen 08) — single or multiple choice question.

```tsx
interface Option {
  id:    string;
  label: string;
  icon?: string;
}
interface ClarifyingQuestionProps {
  question:  string;
  options:   Option[];
  multi?:    boolean;        // default: false
  selected:  string[];
  onChange:  (ids: string[]) => void;
  onConfirm: () => void;
}
```

```css
.question-text { font-size: 17px; font-weight: 600; color: #19211E; line-height: 1.5; margin-bottom: 20px; }
.option-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  border: 1.5px solid #ECEFEC;
  border-radius: 14px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: all 200ms ease-out;
}
.option-item.selected {
  border-color: #0E5A4A;
  background: #E6F0EE;
}
.option-check {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid #ECEFEC;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 200ms ease-out;
}
.option-check.selected { background: #0E5A4A; border-color: #0E5A4A; color: #FFFFFF; }
```

---

### GuidanceSummary

Guide result screen (screen 09).

```tsx
interface Step { number: number; label: string; }
interface GuidanceSummaryProps {
  caseType:      string;
  authority:     string;
  durationDays:  number;
  requiredDocs:  string[];
  steps:         Step[];
  onBookLawyer?: () => void;
}
```

```css
.summary-section {
  background: #FFFFFF;
  border: 1px solid #ECEFEC;
  border-radius: 16px;
  padding: 18px;
  margin-bottom: 12px;
}
.summary-section-title {
  font-size: 13px;
  font-weight: 600;
  color: #6B746F;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
}
.step-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 10px;
}
.step-number {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #E6F0EE;
  color: #0E5A4A;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
```

---

## 9. Judicial Card

### JudicialCard

Full card visual — used on screens 18 and 20.

```tsx
type CardTier = 'NORMAL' | 'SILVER' | 'GOLD';

interface JudicialCardProps {
  cardNumber:  string;       // 'JC-1446-0827'
  holderName:  string;
  nationalId:  string;
  tier:        CardTier;
  validUntil:  Date;
  discountPct: number;       // 0 | 25 | 40
  flipped?:    boolean;      // show back side
  onFlip?:     () => void;
}
```

```css
.judicial-card-wrap {
  perspective: 1000px;
  width: 100%;
  aspect-ratio: 1.586;
}
.judicial-card-inner {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 600ms cubic-bezier(0.4, 0, 0.2, 1);
}
.judicial-card-inner.flipped { transform: rotateY(180deg); }

.judicial-card-face,
.judicial-card-back {
  position: absolute;
  inset: 0;
  border-radius: 24px;
  backface-visibility: hidden;
  overflow: hidden;
  padding: 24px;
  background: linear-gradient(135deg, #1a3a2e 0%, #0e2a20 50%, #0a1e17 100%);
  box-shadow: 0 8px 32px rgba(0,0,0,.4), 0 0 0 1px rgba(199,162,75,.2);
}
.judicial-card-back { transform: rotateY(180deg); }

/* Gold accent line */
.card-line {
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(199,162,75,.6), transparent);
  margin: 16px 0;
}
/* Card number */
.card-number-text {
  font-size: 18px;
  font-weight: 300;
  color: rgba(255,255,255,.85);
  letter-spacing: 4px;
  direction: ltr;
  text-align: left;
}
/* Tier badge on card */
.card-tier-badge {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: #C7A24B;
}
```

---

### TierBadge

Standalone tier indicator.

```tsx
interface TierBadgeProps {
  tier: CardTier;
  size?: 'sm' | 'md' | 'lg';
}

const TIER_CONFIG = {
  NORMAL: { label: 'عادية',  discount: '0%',   bg: 'rgba(107,116,111,.15)', color: '#6B746F'  },
  SILVER: { label: 'فضية',   discount: '25%',  bg: 'linear-gradient(135deg, #C0C0C0, #E8E8E8)', color: '#4A4A4A' },
  GOLD:   { label: 'ذهبية',  discount: '40%',  bg: 'linear-gradient(135deg, #C7A24B, #E8C97A)', color: '#FFFFFF' },
};
```

---

### TierCompare

Upgrade screen (screen 20) — 3-column comparison table.

```tsx
interface TierCompareProps {
  currentTier:   CardTier;
  onUpgrade:     (tier: 'SILVER' | 'GOLD') => void;
}
```

```css
.tier-compare-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 24px;
}
.tier-col {
  border: 1.5px solid #ECEFEC;
  border-radius: 16px;
  padding: 16px 12px;
  text-align: center;
}
.tier-col.current   { border-color: #0E5A4A; background: #E6F0EE; }
.tier-col.gold-col  { border-color: #C7A24B; background: #FBF4E6; }
.tier-discount      { font-size: 28px; font-weight: 700; }
.tier-discount.gold { color: #C7A24B; }
.tier-discount.silver { color: #6B746F; }
```

---

## 10. Document Components

### FileUploadZone

AI Advisor upload (screen 10).

```tsx
interface FileUploadZoneProps {
  onFiles:    (files: File[]) => void;
  accept?:    string[];      // default: ['application/pdf', 'image/*']
  maxSizeMB?: number;        // default: 10
  maxFiles?:  number;        // default: 5
  uploading?: boolean;
}
```

```css
.upload-zone {
  border: 2px dashed #ECEFEC;
  border-radius: 20px;
  padding: 40px 24px;
  text-align: center;
  cursor: pointer;
  transition: all 200ms ease-out;
  background: #FAFBFA;
}
.upload-zone:hover,
.upload-zone.drag-over {
  border-color: #0E5A4A;
  background: #E6F0EE;
}
.upload-icon   { font-size: 48px; color: #ECEFEC; margin-bottom: 16px; }
.upload-title  { font-size: 16px; font-weight: 600; color: #19211E; }
.upload-hint   { font-size: 13px; color: #6B746F; margin-top: 6px; }
.upload-types  { font-size: 12px; color: #9AA39E; margin-top: 12px; }
```

---

### FileRow

Single uploaded file row with progress.

```tsx
interface FileRowProps {
  name:       string;
  sizeMB:     number;
  progress:   number;        // 0–100
  status:     'uploading' | 'done' | 'error';
  onRemove?:  () => void;
}
```

```css
.file-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px;
  background: #FFFFFF;
  border: 1px solid #ECEFEC;
  border-radius: 12px;
  margin-bottom: 8px;
}
.file-icon-wrap {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: #E9F0F8;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #2F6FB0;
  flex-shrink: 0;
}
.file-name  { font-size: 14px; font-weight: 500; color: #19211E; }
.file-size  { font-size: 12px; color: #6B746F; }
.file-progress { height: 3px; background: #ECEFEC; border-radius: 2px; margin-top: 6px; }
.file-progress-fill { height: 100%; background: #0E5A4A; border-radius: 2px; transition: width 300ms ease-out; }
```

---

### AnalyzingLoader

Full dark screen while AI analyzes (screen 11).

```tsx
interface AnalyzingLoaderProps {
  progress:  number;      // 0–100
  stage:     string;      // e.g. 'استخراج النص...'
  docCount:  number;
}
```

```css
.analyzing-screen {
  position: fixed;
  inset: 0;
  background: #0E1A16;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 32px;
  padding: 40px;
}
.analyzing-orb {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: radial-gradient(circle at center, rgba(47,111,176,.4), rgba(47,111,176,.05));
  display: flex;
  align-items: center;
  justify-content: center;
  animation: aiGlow 2s ease-in-out infinite;
}
.analyzing-orb-inner {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1a3a5a, #2F6FB0);
  border: 2px solid rgba(47,111,176,.4);
}
.analyzing-ring {
  position: absolute;
  inset: -12px;
  border-radius: 50%;
  border: 1px solid rgba(47,111,176,.3);
  animation: ringPulse 1.5s ease-out infinite;
}
.analyzing-title { font-size: 18px; font-weight: 600; color: #EAF0ED; }
.analyzing-stage { font-size: 14px; color: #93A39C; }
.analyzing-progress { width: 100%; max-width: 280px; }
.analyzing-bar { height: 3px; background: rgba(255,255,255,.1); border-radius: 2px; overflow: hidden; }
.analyzing-fill { height: 100%; background: linear-gradient(90deg, #2F6FB0, #5B9BD5); transition: width 400ms ease-out; }
```

---

### ReportSection

Collapsible section in the AI Advisory Report (screen 13).

```tsx
interface ReportSectionProps {
  title:      string;
  icon:       string;
  children:   React.ReactNode;
  severity?:  'neutral' | 'warning' | 'danger' | 'success';
  defaultOpen?: boolean;
}
```

```css
.report-section { border: 1px solid #ECEFEC; border-radius: 14px; overflow: hidden; margin-bottom: 12px; }
.report-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  cursor: pointer;
  background: #FFFFFF;
  transition: background 150ms ease-out;
}
.report-section-header:active { background: #F6F8F6; }
.report-section-body { padding: 0 16px 16px; font-size: 14px; line-height: 1.7; color: #19211E; }
.report-section-toggle { transition: transform 250ms ease-out; }
.report-section.open .report-section-toggle { transform: rotate(180deg); }
```

---

## 11. Lawyers

### RatingStars

```tsx
interface RatingStarsProps {
  rating:      number;      // e.g. 4.8
  count?:      number;      // review count
  size?:       'sm' | 'md'; // default: 'sm'
  showNumber?: boolean;     // show numeric value
}
```

```css
.stars-wrap  { display: flex; align-items: center; gap: 4px; }
.star-icon   { color: #C7A24B; }
.star-count  { font-size: 12px; color: #6B746F; }
.star-value  { font-size: 14px; font-weight: 600; color: #19211E; }
```

---

### AvailabilitySlot

```tsx
interface AvailabilitySlotProps {
  date:       Date;
  times:      string[];
  selected?:  string;
  onSelect:   (time: string) => void;
}
```

---

### ConsultationTypePicker

Booking step 1 (screen 16) — 4-card type selector.

```tsx
type ConsultationType = 'INSTANT' | 'WRITTEN' | 'IN_PERSON' | 'REPRESENTATION';

const TYPE_CONFIG = {
  INSTANT:        { label: 'فوري',     icon: 'call',        desc: 'مكالمة مباشرة الآن' },
  WRITTEN:        { label: 'مكتوب',    icon: 'chat',        desc: 'رد خلال 24 ساعة' },
  IN_PERSON:      { label: 'حضوري',    icon: 'person',      desc: 'لقاء في مكتب المحامي' },
  REPRESENTATION: { label: 'توكيل',    icon: 'gavel',       desc: 'تمثيل قانوني كامل' },
};
```

```css
.consult-type-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.consult-type-card {
  border: 1.5px solid #ECEFEC;
  border-radius: 16px;
  padding: 18px 14px;
  text-align: center;
  cursor: pointer;
  transition: all 200ms ease-out;
}
.consult-type-card.selected { border-color: #0E5A4A; background: #E6F0EE; }
.consult-type-icon {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: #F6F8F6;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12px;
}
.consult-type-card.selected .consult-type-icon { background: rgba(14,90,74,.12); color: #0E5A4A; }
```

---

## 12. Screen Shells

### ScreenShell

Wraps every screen — handles background, bottom nav clearance, safe areas.

```tsx
interface ScreenShellProps {
  children:  React.ReactNode;
  dark?:     boolean;         // dark background (screens 11, 23-24)
  noNav?:    boolean;         // hide bottom nav (splash, onboarding, kiosk)
  noPadding?: boolean;        // full-bleed content
}
```

```css
.screen-shell {
  min-height: 100dvh;
  background: #F6F8F6;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
  direction: rtl;
}
.screen-shell.dark { background: #0E1A16; }

/* Content area */
.screen-content {
  flex: 1;
  padding: 0 20px 88px;   /* 88px = 72 nav + 16 safe */
  overflow-y: auto;
}
.screen-content.no-padding { padding: 0; }
```

---

### ScrollContent

```tsx
interface ScrollContentProps {
  children:       React.ReactNode;
  paddingBottom?: number;    // default: 88
  gap?:           number;    // gap between direct children
}
```

---

### SectionHeader

```tsx
interface SectionHeaderProps {
  title:      string;
  action?:    { label: string; onClick: () => void; };
  subtitle?:  string;
}
```

```css
.section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.section-title  { font-size: 17px; font-weight: 600; color: #19211E; }
.section-action { font-size: 14px; font-weight: 500; color: #0E5A4A; cursor: pointer; }
.section-sub    { font-size: 13px; color: #6B746F; margin-top: 2px; }
```

---

### EmptyState

```tsx
interface EmptyStateProps {
  icon:      string;       // Material Symbol
  title:     string;
  body?:     string;
  action?:   { label: string; onClick: () => void; variant?: ButtonVariant; };
}
```

```css
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 48px 32px;
  gap: 16px;
}
.empty-icon  { font-size: 52px; color: #ECEFEC; }
.empty-title { font-size: 18px; font-weight: 600; color: #19211E; }
.empty-body  { font-size: 14px; color: #6B746F; line-height: 1.6; max-width: 280px; }
```

**Common empty states:**

| Screen | Icon | Title |
|--------|------|-------|
| Cases (no cases) | `gavel` | لا توجد قضايا حالياً |
| Alerts (all read) | `notifications_off` | لا توجد إشعارات جديدة |
| Lawyers (no results) | `search_off` | لا توجد نتائج للبحث |
| Documents (empty) | `folder_open` | لم تُرفع أي وثائق |
| Appointments (none) | `event_busy` | لا توجد مواعيد قادمة |

---

*المنظومة العدلية الذكية · Component Library · v1.0*