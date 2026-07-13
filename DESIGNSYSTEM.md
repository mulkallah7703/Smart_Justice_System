# المنظومة العدلية الذكية — Design System

> Single source of truth for all visual and interaction decisions.  
> Arabic RTL · IBM Plex Sans Arabic · Material Symbols Rounded

---

## Table of Contents

1. [Foundations](#1-foundations)
   - 1.1 Color Palette
   - 1.2 Typography
   - 1.3 Spacing Scale
   - 1.4 Border Radius
   - 1.5 Shadows & Elevation
   - 1.6 Animations & Keyframes
2. [Iconography](#2-iconography)
3. [Components](#3-components)
   - 3.1 Buttons
   - 3.2 Inputs
   - 3.3 Cards
   - 3.4 Badges & Tags
   - 3.5 Bottom Navigation
   - 3.6 Modals & Sheets
   - 3.7 Alerts & Banners
   - 3.8 Skeleton Loaders
   - 3.9 Progress Indicators
   - 3.10 Judicial Card
   - 3.11 Lawyer Card
   - 3.12 Chat Bubbles
4. [Patterns](#4-patterns)
   - 4.1 Screen Layout
   - 4.2 Header Variants
   - 4.3 Tab Bar
   - 4.4 Filter Pills
   - 4.5 List Rows
   - 4.6 Empty States
5. [Dark Mode](#5-dark-mode)
6. [RTL Rules](#6-rtl-rules)
7. [Motion Principles](#7-motion-principles)
8. [Accessibility](#8-accessibility)
9. [Design Tokens (Code)](#9-design-tokens-code)

---

## 1. Foundations

### 1.1 Color Palette

#### Brand Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `primary` | `#0E5A4A` | Primary actions, links, active states, brand identity |
| `primary-light` | `#E6F0EE` | Primary button hover background, focus rings |
| `gold` | `#C7A24B` | Judicial Card, Gold tier, premium actions |
| `gold-light` | `#FBF4E6` | Gold backgrounds, card tier highlights |
| `blue` | `#2F6FB0` | AI features, AI Guide, AI Advisor, info states |
| `blue-light` | `#E9F0F8` | AI feature backgrounds, info banners |

#### Neutral Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `background` | `#F6F8F6` | App background — every screen |
| `surface` | `#FFFFFF` | Cards, modals, sheets, list rows |
| `border` | `#ECEFEC` | All dividers, card borders, input borders |
| `text` | `#19211E` | Primary text — headings and body |
| `text-muted` | `#6B746F` | Secondary text, labels, placeholders |
| `text-disabled` | `#9AA39E` | Disabled inputs, inactive tabs |

#### Semantic Colors

| Token | Hex | Light BG | Usage |
|-------|-----|----------|-------|
| `success` | `#1B873F` | `#E7F2EB` | Completed cases, paid status, valid card |
| `warning` | `#D98A0B` | `#FBF0DC` | Upcoming deadlines (< 7 days), pending payment |
| `danger` | `#C8372E` | `#FBE7E5` | Urgent alerts (< 48h), errors, missing docs |
| `info` | `#2F6FB0` | `#E9F0F8` | Law updates, informational alerts |

#### Dark Mode Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `dark-bg` | `#0E1A16` | Dark app background |
| `dark-surface` | `#16241F` | Dark cards, dark modals |
| `dark-border` | `rgba(255,255,255,0.07)` | Dark dividers and card borders |
| `dark-text` | `#EAF0ED` | Dark primary text |
| `dark-muted` | `#93A39C` | Dark secondary text |

---

### 1.2 Typography

**Font:** IBM Plex Sans Arabic (Google Fonts CDN)  
**Icons:** Material Symbols Rounded (Google Fonts CDN)

```
https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap
https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,300,0,0
```

#### Type Scale

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| `display` | 28px | 700 | 1.3 | Screen titles, splash headline |
| `h1` | 24px | 700 | 1.3 | Section headings |
| `h2` | 22px | 600 | 1.35 | Card titles, modal headings |
| `h3` | 18px | 600 | 1.4 | Sub-section headings |
| `body-lg` | 16px | 400 | 1.6 | Body text, descriptions |
| `body` | 15px | 400 | 1.6 | Default body, list items |
| `body-sm` | 14px | 400 | 1.5 | Secondary labels, form hints |
| `caption` | 12px | 400 | 1.4 | Timestamps, metadata |
| `micro` | 11px | 500 | 1.3 | Badges, tags, pill labels |

#### Weight Usage

| Weight | Value | When |
|--------|-------|------|
| Light | 300 | Large decorative numbers (card number, countdown) |
| Regular | 400 | Body, labels, secondary text |
| Medium | 500 | Button text, tab labels, badge text |
| SemiBold | 600 | Card titles, section headers, names |
| Bold | 700 | Screen titles, display headings, prices |

---

### 1.3 Spacing Scale

> Base unit: **4px**. All spacing is a multiple of 4.

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4px | Icon padding, tight gaps |
| `space-2` | 8px | Between icon and label |
| `space-3` | 12px | Tag internal padding, small gaps |
| `space-4` | 16px | Standard padding, list row gaps |
| `space-5` | 20px | Card internal padding |
| `space-6` | 24px | Section gaps |
| `space-8` | 32px | Large section gaps, illustration spacing |
| `space-10` | 40px | Screen top padding |
| `space-12` | 48px | Bottom nav height, modal sheet handles |
| `space-16` | 64px | Hero section padding |

#### Screen Layout Constants

| Constant | Value |
|----------|-------|
| Screen horizontal padding | 20px |
| Bottom navigation height | 72px |
| Safe area bottom offset | 16px (or env safe-area-inset-bottom) |
| Card gap | 12px |
| Section gap | 24px |

---

### 1.4 Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radius-sm` | 8px | Small tags, small buttons |
| `radius-md` | 12px | Buttons, inputs, small cards |
| `radius-lg` | 16px | Standard cards, modals |
| `radius-xl` | 20px | Feature cards, notification sheets |
| `radius-2xl` | 24px | Bottom sheets, large modals |
| `radius-pill` | 50px | Filter pills, status badges |
| `radius-full` | 9999px | Circular avatars, round icon buttons |
| `radius-phone` | 44px | Outer phone/device frame |
| `radius-card` | 24px | Judicial card, special screens |

---

### 1.5 Shadows & Elevation

| Level | CSS Value | Usage |
|-------|-----------|-------|
| `shadow-xs` | `0 1px 3px rgba(14,90,74,.06)` | Subtle card lift |
| `shadow-sm` | `0 2px 8px rgba(14,90,74,.08)` | Default cards |
| `shadow-md` | `0 4px 16px rgba(14,90,74,.10)` | Elevated cards, dropdowns |
| `shadow-lg` | `0 8px 32px rgba(14,90,74,.12)` | Modals, sheets |
| `shadow-gold` | `0 4px 20px rgba(199,162,75,.25)` | Judicial Card, gold elements |
| `shadow-blue` | `0 0 22px 1px rgba(47,111,176,.28)` | AI glow effect (animated) |
| `shadow-danger` | `0 4px 16px rgba(200,55,46,.15)` | Urgent alert cards |

---

### 1.6 Animations & Keyframes

```css
/* AI glow pulse — AI buttons and features */
@keyframes aiGlow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(47, 111, 176, 0); }
  50%       { box-shadow: 0 0 22px 1px rgba(47, 111, 176, .28); }
}

/* Spinner — loading states */
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Shimmer — skeleton loaders */
@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Ring pulse — alert countdown ring */
@keyframes ringPulse {
  0%   { transform: scale(.85); opacity: .55; }
  100% { transform: scale(1.25); opacity: 0; }
}

/* Fade in up — screen entry */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Scale in — modal/sheet entry */
@keyframes scaleIn {
  from { opacity: 0; transform: scale(.96); }
  to   { opacity: 1; transform: scale(1); }
}
```

#### Timing Reference

| Use Case | Duration | Easing |
|----------|---------|--------|
| Micro (badge, toggle) | 150ms | ease-out |
| Element (button press) | 200ms | ease-out |
| Component (card, dropdown) | 250ms | ease-in-out |
| Screen transition | 300ms | cubic-bezier(0.4, 0, 0.2, 1) |
| Modal/sheet entry | 350ms | cubic-bezier(0.34, 1.56, 0.64, 1) |
| AI glow | 2000ms | ease-in-out · infinite |
| Ring pulse | 1500ms | ease-out · infinite |

---

## 2. Iconography

**Library:** Material Symbols Rounded  
**Default settings:** `opsz=24 · wght=300 · FILL=0 · GRAD=0`

```html
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,300,0,0" rel="stylesheet">

<span class="material-symbols-rounded">home</span>
```

#### Icon Size Scale

| Size | Usage |
|------|-------|
| 16px | Inline text icons, micro tags |
| 20px | Button icons, list row icons |
| 24px | Default — navigation, standard actions |
| 28px | Feature icons in cards |
| 32px | Section header icons |
| 40px | Large feature icons, empty state icons |
| 48px | Hero icons, splash screen |

#### Core Icon Set

| Feature | Icon Name |
|---------|-----------|
| Home | `home` |
| Cases | `gavel` |
| Alerts | `notifications` |
| Profile | `person` |
| AI Guide | `robot_2` |
| AI Advisor | `psychology` |
| Lawyer | `badge` |
| Document | `description` |
| Upload | `upload_file` |
| Camera/QR | `qr_code_scanner` |
| Judicial Card | `credit_card` |
| Calendar | `calendar_month` |
| Clock / Deadline | `schedule` |
| Search | `search` |
| Filter | `tune` |
| Phone | `call` |
| Star / Rating | `star` |
| Chevron Right | `chevron_right` |
| Back | `arrow_back` *(mirrored in RTL)* |
| Close | `close` |
| Check | `check_circle` |
| Warning | `warning` |
| Error | `error` |
| Info | `info` |
| Settings | `settings` |
| Logout | `logout` |
| Dark Mode | `dark_mode` |
| Print | `print` |
| Download | `download` |
| Share | `share` |
| Lock | `lock` |
| Fingerprint | `fingerprint` |
| Payment | `payments` |
| Apple Pay | `apple` *(custom SVG)* |
| Saudi Flag | Custom SVG asset |

#### Icon Filled State

Filled icons (`FILL=1`) used for **active/selected states** only:

```css
/* Active nav icon */
.material-symbols-rounded.filled {
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
```

---

## 3. Components

### 3.1 Buttons

#### Variants

**Primary** — main action per screen
```css
background: #0E5A4A;
color: #FFFFFF;
border-radius: 12px;
padding: 14px 24px;
font-size: 16px;
font-weight: 600;
width: 100%;                 /* full-width on mobile by default */
box-shadow: 0 2px 8px rgba(14,90,74,.18);
transition: opacity 200ms ease-out;

:active { opacity: 0.85; transform: scale(0.98); }
:disabled { opacity: 0.4; cursor: not-allowed; }
```

**Secondary** — alternative actions
```css
background: #F6F8F6;
color: #0E5A4A;
border: 1.5px solid #ECEFEC;
border-radius: 12px;
padding: 13px 24px;
font-size: 16px;
font-weight: 600;
```

**Gold** — upgrade / judicial card actions
```css
background: linear-gradient(135deg, #C7A24B 0%, #E8C97A 50%, #C7A24B 100%);
color: #FFFFFF;
border-radius: 12px;
padding: 14px 24px;
font-size: 16px;
font-weight: 600;
box-shadow: 0 4px 20px rgba(199,162,75,.25);
```

**Ghost** — low-emphasis actions
```css
background: transparent;
color: #0E5A4A;
border: none;
padding: 10px 16px;
font-size: 15px;
font-weight: 500;
```

**AI Blue** — AI-feature actions
```css
background: #2F6FB0;
color: #FFFFFF;
border-radius: 12px;
padding: 14px 24px;
animation: aiGlow 2s ease-in-out infinite;
```

**Danger** — destructive actions
```css
background: #FBE7E5;
color: #C8372E;
border: 1px solid rgba(200,55,46,.2);
border-radius: 12px;
padding: 13px 24px;
```

#### Button Sizes

| Size | Padding | Font | Radius | Use |
|------|---------|------|--------|-----|
| `sm` | 8px 16px | 13px | 8px | Inline actions, tags |
| `md` | 12px 20px | 15px | 10px | Secondary actions |
| `lg` | 14px 24px | 16px | 12px | **Default** — primary CTAs |
| `xl` | 18px 32px | 17px | 14px | Hero CTAs (splash, onboarding) |

---

### 3.2 Inputs

```css
/* Base input */
background: #FFFFFF;
border: 1.5px solid #ECEFEC;
border-radius: 12px;
padding: 14px 16px;
font-size: 15px;
color: #19211E;
font-family: 'IBM Plex Sans Arabic', sans-serif;
text-align: right;           /* RTL */
direction: rtl;
width: 100%;
transition: border-color 200ms ease-out;

/* Focus */
:focus {
  border-color: #0E5A4A;
  outline: none;
  box-shadow: 0 0 0 3px rgba(14,90,74,.10);
}

/* Error */
.input-error {
  border-color: #C8372E;
  box-shadow: 0 0 0 3px rgba(200,55,46,.10);
}

/* With icon (leading in RTL = right side) */
.input-with-icon {
  padding-right: 44px;
}
.input-icon {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: #6B746F;
  font-size: 20px;
}
```

**Search Input** — used in lawyers and documents

```css
background: #F6F8F6;
border: 1.5px solid #ECEFEC;
border-radius: 20px;          /* pill shape */
padding: 12px 16px 12px 44px; /* space for search icon on left (RTL end) */
```

---

### 3.3 Cards

**Standard Card**
```css
background: #FFFFFF;
border: 1px solid #ECEFEC;
border-radius: 16px;
padding: 20px;
box-shadow: 0 2px 8px rgba(14,90,74,.08);
```

**Feature Card** — home dashboard services
```css
background: #FFFFFF;
border: 1px solid #ECEFEC;
border-radius: 20px;
padding: 20px;
box-shadow: 0 4px 16px rgba(14,90,74,.10);
```

**AI Feature Card** — blue tinted
```css
background: linear-gradient(135deg, #EBF2FA 0%, #F5F8FC 100%);
border: 1px solid rgba(47,111,176,.15);
border-radius: 20px;
padding: 20px;
```

**Urgent Alert Card**
```css
background: #FFFFFF;
border: 1px solid rgba(200,55,46,.2);
border-right: 3px solid #C8372E;  /* accent border on RTL-right */
border-radius: 16px;
box-shadow: 0 4px 16px rgba(200,55,46,.08);
```

**Gold Card** — judicial card screen
```css
background: linear-gradient(135deg, #1a3a2e 0%, #0e2a20 100%);
border: 1px solid rgba(199,162,75,.3);
border-radius: 24px;
padding: 24px;
box-shadow: 0 8px 32px rgba(0,0,0,.3), 0 0 0 1px rgba(199,162,75,.2);
```

---

### 3.4 Badges & Tags

**Status Badge**

```css
/* Base */
border-radius: 50px;
padding: 4px 10px;
font-size: 12px;
font-weight: 500;
display: inline-flex;
align-items: center;
gap: 4px;

/* منظورة (Active) */
background: #E7F2EB; color: #1B873F;

/* بانتظار (Pending) */
background: #FBF0DC; color: #D98A0B;

/* مغلقة (Closed) */
background: #F6F8F6; color: #6B746F;

/* استئناف (Appeal) */
background: #E9F0F8; color: #2F6FB0;
```

**Alert Severity Badge**
```css
/* عاجل (Urgent) */
background: #FBE7E5; color: #C8372E; border: 1px solid rgba(200,55,46,.2);

/* مهلة (Warning) */
background: #FBF0DC; color: #D98A0B; border: 1px solid rgba(217,138,11,.2);

/* تحديث (Info) */
background: #E9F0F8; color: #2F6FB0; border: 1px solid rgba(47,111,176,.2);
```

**Tier Badge** — Judicial Card
```css
/* عادية */
background: rgba(107,116,111,.15); color: #6B746F;

/* فضية */
background: linear-gradient(135deg, #C0C0C0, #E8E8E8); color: #4A4A4A;

/* ذهبية */
background: linear-gradient(135deg, #C7A24B, #E8C97A); color: #FFFFFF;
```

**Discount Tag**
```css
background: rgba(199,162,75,.15);
color: #C7A24B;
border: 1px solid rgba(199,162,75,.3);
border-radius: 8px;
padding: 4px 8px;
font-size: 12px;
font-weight: 600;
```

---

### 3.5 Bottom Navigation

```css
/* Container */
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

/* Tab Item */
.nav-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  flex: 1;
  padding: 8px 0;
  cursor: pointer;
  transition: color 200ms ease-out;
}

/* Default state */
.nav-tab { color: #9AA39E; }

/* Active state */
.nav-tab.active {
  color: #0E5A4A;
}
.nav-tab.active .icon {
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

/* Label */
.nav-label {
  font-size: 11px;
  font-weight: 500;
  font-family: 'IBM Plex Sans Arabic', sans-serif;
}
```

**Tabs (in order, RTL = right to left):**
الرئيسية · ملفي · المرشد · المحامون · الإشعارات

---

### 3.6 Modals & Bottom Sheets

**Bottom Sheet** — used for confirmations, filters
```css
position: fixed;
bottom: 0;
left: 0;
right: 0;
background: #FFFFFF;
border-radius: 24px 24px 0 0;
padding: 0 20px 40px;
box-shadow: 0 -8px 32px rgba(14,90,74,.12);

/* Handle */
.sheet-handle {
  width: 40px;
  height: 4px;
  background: #ECEFEC;
  border-radius: 2px;
  margin: 12px auto 20px;
}
```

**Overlay / Backdrop**
```css
position: fixed;
inset: 0;
background: rgba(14, 26, 22, 0.5);
backdrop-filter: blur(4px);
z-index: 200;
```

---

### 3.7 Alerts & Banners

**Inline Banner**
```css
border-radius: 12px;
padding: 14px 16px;
display: flex;
align-items: flex-start;
gap: 12px;
font-size: 14px;

.banner-success  { background: #E7F2EB; color: #1B873F; border: 1px solid rgba(27,135,63,.2); }
.banner-warning  { background: #FBF0DC; color: #D98A0B; border: 1px solid rgba(217,138,11,.2); }
.banner-danger   { background: #FBE7E5; color: #C8372E; border: 1px solid rgba(200,55,46,.2); }
.banner-info     { background: #E9F0F8; color: #2F6FB0; border: 1px solid rgba(47,111,176,.2); }
```

**Alert Countdown** — urgent deadline timer
```css
/* Outer ring (animated) */
.ring-pulse-outer {
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  border: 2px solid rgba(200,55,46,.4);
  animation: ringPulse 1.5s ease-out infinite;
}

/* Time display */
font-size: 28px;
font-weight: 300;       /* Light — dramatic effect */
color: #C8372E;
letter-spacing: 2px;
font-variant-numeric: tabular-nums;
```

---

### 3.8 Skeleton Loaders

```css
.skeleton {
  background: linear-gradient(
    90deg,
    #ECEFEC 0%,
    #F6F8F6 50%,
    #ECEFEC 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: 8px;
}

/* Common skeleton sizes */
.skeleton-title    { height: 20px; width: 60%; }
.skeleton-body     { height: 14px; width: 100%; }
.skeleton-body-sm  { height: 14px; width: 80%; }
.skeleton-avatar   { width: 48px; height: 48px; border-radius: 50%; }
.skeleton-card     { height: 120px; border-radius: 16px; }
.skeleton-button   { height: 48px; border-radius: 12px; }
```

---

### 3.9 Progress Indicators

**Guide Progress Bar** — AI Legal Guide
```css
.progress-bar {
  height: 6px;
  background: #ECEFEC;
  border-radius: 3px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #0E5A4A, #1a7a62);
  border-radius: 3px;
  transition: width 400ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

**Case Strength Meter** — AI Advisor result
```css
/* The strength meter arc is an SVG circle with stroke-dashoffset animation */
.strength-track {
  stroke: #ECEFEC;
  stroke-width: 8;
  fill: none;
}
.strength-fill {
  stroke: #0E5A4A;    /* or #D98A0B for medium, #C8372E for weak */
  stroke-width: 8;
  stroke-linecap: round;
  fill: none;
  transition: stroke-dashoffset 800ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

**Step Indicator** — Booking flow
```css
.step-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ECEFEC;
  transition: all 200ms ease-out;
}
.step-dot.active {
  background: #0E5A4A;
  width: 24px;          /* elongated pill when active */
  border-radius: 4px;
}
.step-dot.completed {
  background: #1B873F;
}
```

---

### 3.10 Judicial Card

The Judicial Card uses a dark green gradient and gold accents to convey authority.

```css
.judicial-card {
  background: linear-gradient(135deg, #1a3a2e 0%, #0e2a20 50%, #0a1e17 100%);
  border-radius: 24px;
  padding: 24px;
  aspect-ratio: 1.586;    /* Standard card ratio */
  position: relative;
  overflow: hidden;
  box-shadow:
    0 8px 32px rgba(0,0,0,.4),
    0 0 0 1px rgba(199,162,75,.2),
    inset 0 1px 0 rgba(199,162,75,.1);
}

/* Decorative corner pattern */
.card-pattern {
  position: absolute;
  top: -20px;
  left: -20px;         /* left in LTR = end in RTL card */
  width: 120px;
  height: 120px;
  background: radial-gradient(circle, rgba(199,162,75,.15) 0%, transparent 70%);
}

/* Card number */
.card-number {
  font-size: 22px;
  font-weight: 300;    /* Light for elegance */
  color: rgba(255,255,255,.9);
  letter-spacing: 3px;
}

/* Gold accent line */
.card-accent {
  height: 2px;
  background: linear-gradient(90deg, transparent, #C7A24B, transparent);
  margin: 16px 0;
}

/* Tier label */
.card-tier {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: #C7A24B;
}
```

---

### 3.11 Lawyer Card

```css
.lawyer-card {
  background: #FFFFFF;
  border: 1px solid #ECEFEC;
  border-radius: 16px;
  padding: 16px;
  display: flex;
  gap: 14px;
  align-items: flex-start;
}

.lawyer-avatar {
  width: 56px;
  height: 56px;
  border-radius: 15px;
  object-fit: cover;
  flex-shrink: 0;
}

/* Star rating */
.star-rating {
  color: #C7A24B;
  font-size: 14px;
}
.star-rating .count {
  color: #6B746F;
  font-size: 12px;
  margin-right: 4px;   /* RTL: appears to the left of stars */
}

/* Discount badge — shown when user has judicial card */
.discount-badge {
  background: rgba(14,90,74,.08);
  color: #0E5A4A;
  border-radius: 8px;
  padding: 3px 8px;
  font-size: 12px;
  font-weight: 600;
}

/* Crossed-out original price */
.price-original {
  text-decoration: line-through;
  color: #9AA39E;
  font-size: 13px;
}
.price-discounted {
  color: #1B873F;
  font-weight: 700;
  font-size: 16px;
}
```

---

### 3.12 Chat Bubbles

**AI Message Bubble**
```css
.bubble-ai {
  background: #FFFFFF;
  border: 1px solid #ECEFEC;
  border-radius: 4px 20px 20px 20px;  /* RTL: flat corner on right */
  padding: 14px 16px;
  max-width: 85%;
  align-self: flex-end;                /* RTL: AI on right */
  box-shadow: 0 2px 8px rgba(14,90,74,.06);
}
```

**User Message Bubble**
```css
.bubble-user {
  background: #0E5A4A;
  color: #FFFFFF;
  border-radius: 20px 4px 20px 20px;  /* RTL: flat corner on left */
  padding: 14px 16px;
  max-width: 80%;
  align-self: flex-start;              /* RTL: user on left */
}
```

**Typing Indicator**
```css
.typing-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #6B746F;
  animation: typingBounce 1.2s ease-in-out infinite;
}
.typing-dot:nth-child(2) { animation-delay: 0.2s; }
.typing-dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes typingBounce {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-6px); }
}
```

---

## 4. Patterns

### 4.1 Screen Layout

Every screen follows this structure:

```
┌──────────────────────────────────┐
│  Status Bar (system)              │
├──────────────────────────────────┤
│  Header (48–64px)                 │
│  [Back] · Title · [Action]        │
├──────────────────────────────────┤
│                                   │
│  Scroll Content                   │
│  padding: 20px horizontal         │
│  padding-bottom: 88px             │
│  (clears bottom nav)              │
│                                   │
└──────────────────────────────────┘
│  Bottom Navigation (72px)         │
└──────────────────────────────────┘
```

---

### 4.2 Header Variants

**Standard Header** (most screens)
```css
.screen-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: #F6F8F6;   /* matches background — no card bg */
}
/* Title centered or right-aligned for RTL */
.header-title { font-size: 18px; font-weight: 600; color: #19211E; }
```

**Transparent Hero Header** — splash, onboarding
```css
background: transparent;
position: absolute;
top: 0;
left: 0;
right: 0;
```

**Dark Header** — AI Analyzer screen (screen 11)
```css
background: #0E1A16;
border-bottom: 1px solid rgba(255,255,255,.07);
```

---

### 4.3 Tab Bar (in-screen)

```css
.tab-bar {
  display: flex;
  background: #ECEFEC;
  border-radius: 12px;
  padding: 4px;
  gap: 2px;
}
.tab-item {
  flex: 1;
  padding: 10px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  text-align: center;
  transition: all 200ms ease-out;
  color: #6B746F;
}
.tab-item.active {
  background: #FFFFFF;
  color: #0E5A4A;
  box-shadow: 0 1px 4px rgba(14,90,74,.1);
}
```

---

### 4.4 Filter Pills

```css
.filter-pill {
  padding: 8px 16px;
  border-radius: 50px;
  font-size: 13px;
  font-weight: 500;
  border: 1.5px solid #ECEFEC;
  background: #FFFFFF;
  color: #6B746F;
  cursor: pointer;
  white-space: nowrap;
  transition: all 200ms ease-out;
}
.filter-pill.active {
  background: #0E5A4A;
  color: #FFFFFF;
  border-color: #0E5A4A;
}
```

---

### 4.5 List Rows

**Standard List Row**
```css
.list-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
  border-bottom: 1px solid #ECEFEC;
}
.list-row:last-child { border-bottom: none; }

/* Icon on right (RTL start), chevron on left (RTL end) */
.row-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: #F6F8F6;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
```

**Case List Row** — with status badge
```css
.case-row {
  padding: 16px;
  background: #FFFFFF;
  border-radius: 12px;
  border: 1px solid #ECEFEC;
  margin-bottom: 8px;
}
```

---

### 4.6 Empty States

```css
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 48px 32px;
  gap: 16px;
}
.empty-icon {
  font-size: 48px;
  color: #ECEFEC;
}
.empty-title {
  font-size: 18px;
  font-weight: 600;
  color: #19211E;
}
.empty-body {
  font-size: 14px;
  color: #6B746F;
  line-height: 1.6;
}
```

---

## 5. Dark Mode

Dark mode is applied by adding `class="dark"` to the root `<html>` element.

```css
/* All dark overrides via CSS custom properties */
:root {
  --bg: #F6F8F6;
  --surface: #FFFFFF;
  --border: #ECEFEC;
  --text: #19211E;
  --text-muted: #6B746F;
}

.dark {
  --bg: #0E1A16;
  --surface: #16241F;
  --border: rgba(255, 255, 255, 0.07);
  --text: #EAF0ED;
  --text-muted: #93A39C;
}
```

#### Dark Mode Component Overrides

| Component | Light | Dark |
|-----------|-------|------|
| Screen background | `#F6F8F6` | `#0E1A16` |
| Cards | `#FFFFFF` | `#16241F` |
| Borders | `#ECEFEC` | `rgba(255,255,255,0.07)` |
| Input background | `#FFFFFF` | `#16241F` |
| Bottom nav | `#FFFFFF` | `#16241F` |
| Skeleton gradient | `#ECEFEC → #F6F8F6` | `#16241F → #0E1A16` |
| Primary button | Unchanged | Unchanged |
| Status badges | Unchanged | Reduced opacity by 10% |

---

## 6. RTL Rules

### Core Rules

```css
/* Applied to root always — never toggle per-component */
html {
  direction: rtl;
  lang: ar;
}
```

### What Changes in RTL

| Property | LTR Value | RTL Equivalent |
|----------|-----------|----------------|
| `text-align` | `left` | `right` |
| `padding-left` | — | `padding-right` |
| `margin-left: auto` | push right | `margin-right: auto` (push left visually) |
| `border-left` | accent border | `border-right` |
| `float: left` | — | `float: right` |
| Flex row order | natural | natural (RTL reverses visually) |

### Icons That Need Mirroring

```css
/* Mirror directional icons for RTL */
.icon-rtl-mirror {
  transform: scaleX(-1);
}
```

Apply to: `arrow_back`, `arrow_forward`, `send`, `chevron_right`, `chevron_left`, `trending_up`, `undo`, `redo`, `shortcut`

**Do NOT mirror:** `search`, `star`, `close`, `check`, `home`, `person`, `notifications`, `settings`, `lock`, `fingerprint`, `call`, `camera`

### Arabic Number Display

```typescript
// Display numbers in Arabic numerals (user preference)
const toArabicNumerals = (n: number | string): string =>
  String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[+d]);

// Examples:
// 47:52:10  →  ٤٧:٥٢:١٠
// 4,200 ر.س →  ٤٬٢٠٠ ر.س
// 85%       →  ٨٥٪
```

---

## 7. Motion Principles

### Principles

1. **Purposeful** — animation communicates state change, not decoration
2. **Snappy** — most transitions under 250ms; never feel laggy
3. **Consistent** — same transition for same action type across all screens
4. **Reduced motion respected** — `@media (prefers-reduced-motion: reduce)` removes all animations

### Screen Transitions

```css
/* Screen enters (new page push) */
.screen-enter {
  animation: fadeInUp 300ms cubic-bezier(0.4, 0, 0.2, 1) both;
}

/* Sheet/modal enters */
.sheet-enter {
  animation: slideUpSheet 350ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
@keyframes slideUpSheet {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 8. Accessibility

### Contrast Ratios

| Foreground | Background | Ratio | WCAG |
|------------|------------|-------|------|
| `#19211E` on `#F6F8F6` | Body text | 14.8:1 | AAA |
| `#0E5A4A` on `#FFFFFF` | Primary actions | 7.2:1 | AAA |
| `#FFFFFF` on `#0E5A4A` | Primary button text | 7.2:1 | AAA |
| `#6B746F` on `#FFFFFF` | Muted text | 4.6:1 | AA |
| `#C8372E` on `#FBE7E5` | Danger on light | 4.8:1 | AA |
| `#EAF0ED` on `#0E1A16` | Dark mode text | 13.1:1 | AAA |

### Focus Styles

```css
/* Visible focus for keyboard users */
:focus-visible {
  outline: 2px solid #0E5A4A;
  outline-offset: 2px;
  border-radius: 4px;
}
```

### Touch Targets

- Minimum tap target: **44×44px** (iOS HIG / WCAG 2.5.5)
- Bottom nav tabs: 72px height ÷ 5 tabs = adequate width
- Icon-only buttons: must have `aria-label` in Arabic

### ARIA Labels

```tsx
// Example: icon-only back button
<button aria-label="العودة للخلف">
  <span className="material-symbols-rounded icon-rtl-mirror">arrow_back</span>
</button>

// Live region for real-time alert count
<span aria-live="polite" aria-atomic="true">
  {unreadCount} تنبيه غير مقروء
</span>
```

---

## 9. Design Tokens (Code)

```typescript
// src/core/theme/tokens.ts

export const colors = {
  // Brand
  primary:        '#0E5A4A',
  primaryLight:   '#E6F0EE',
  gold:           '#C7A24B',
  goldLight:      '#FBF4E6',
  blue:           '#2F6FB0',
  blueLight:      '#E9F0F8',

  // Neutral
  background:     '#F6F8F6',
  surface:        '#FFFFFF',
  border:         '#ECEFEC',
  text:           '#19211E',
  textMuted:      '#6B746F',
  textDisabled:   '#9AA39E',

  // Semantic
  success:        '#1B873F',
  successBg:      '#E7F2EB',
  warning:        '#D98A0B',
  warningBg:      '#FBF0DC',
  danger:         '#C8372E',
  dangerBg:       '#FBE7E5',
  info:           '#2F6FB0',
  infoBg:         '#E9F0F8',

  // Dark mode
  darkBg:         '#0E1A16',
  darkSurface:    '#16241F',
  darkBorder:     'rgba(255,255,255,0.07)',
  darkText:       '#EAF0ED',
  darkMuted:      '#93A39C',
} as const;

export const fontSize = {
  display: '28px',
  h1: '24px',
  h2: '22px',
  h3: '18px',
  bodyLg: '16px',
  body: '15px',
  bodySm: '14px',
  caption: '12px',
  micro: '11px',
} as const;

export const fontWeight = {
  light:    300,
  regular:  400,
  medium:   500,
  semiBold: 600,
  bold:     700,
} as const;

export const radius = {
  sm:   '8px',
  md:   '12px',
  lg:   '16px',
  xl:   '20px',
  '2xl': '24px',
  pill: '50px',
  full: '9999px',
  phone: '44px',
  card: '24px',
} as const;

export const spacing = {
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
} as const;

export const shadow = {
  xs:     '0 1px 3px rgba(14,90,74,.06)',
  sm:     '0 2px 8px rgba(14,90,74,.08)',
  md:     '0 4px 16px rgba(14,90,74,.10)',
  lg:     '0 8px 32px rgba(14,90,74,.12)',
  gold:   '0 4px 20px rgba(199,162,75,.25)',
  blue:   '0 0 22px 1px rgba(47,111,176,.28)',
  danger: '0 4px 16px rgba(200,55,46,.15)',
} as const;

export const transition = {
  micro:     '150ms ease-out',
  element:   '200ms ease-out',
  component: '250ms ease-in-out',
  screen:    '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  spring:    '350ms cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

export const layout = {
  screenPaddingH:   '20px',
  bottomNavHeight:  '72px',
  cardGap:          '12px',
  sectionGap:       '24px',
  contentPaddingBottom: '88px',  // clears bottom nav
} as const;

// Font stacks
export const fonts = {
  arabic: "'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, sans-serif",
  icons:  "'Material Symbols Rounded'",
  mono:   "'Fira Code', 'Courier New', monospace",
} as const;
```

---

*المنظومة العدلية الذكية · Design System · v1.0*