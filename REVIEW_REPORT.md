# Jaz Workout App — UI/UX & Code Review Report

**Date:** 2026-07-10  
**Scope:** Full codebase analysis of `jas_project/src/`

---

## Table of Contents

1. [CSS Duplication Audit](#1-css-duplication-audit)
2. [Code Issues & Bugs](#2-code-issues--bugs)
3. [CSS Architecture Recommendations](#3-css-architecture-recommendations)
4. [Animation & UX Improvements](#4-animation--ux-improvements)
5. [Accessibility Issues](#5-accessibility-issues)

---

## 1. CSS Duplication Audit

### 1.1 Calendar.css — Entire File Duplicated (CRITICAL)

**File:** `src/components/Pages/Calendar/Calendar.css`

The file contains the **complete content twice**. The second copy begins at approximately **line 530** with the comment `/* CALENDAR.CSS Part 1A — Foundation */` and repeats everything from the `:root` block through all animations.

**Duplicated blocks (appear at both ~lines 1–529 and ~lines 530–end):**

| Block | First occurrence | Second occurrence |
|-------|-----------------|-------------------|
| `:root` variables (full set) | Lines 1–33 | ~Lines 530–562 |
| `*` box-sizing reset | Lines 35–37 | ~Lines 564–566 |
| `.calendar` base styles | Lines 39–42 | ~Lines 568–571 |
| `.calendar.page` | Lines 44–48 | ~Lines 573–577 |
| `.calendar__header` | Lines 54–56 | — |
| `.page__eyebrow` | Lines 58–65 | — |
| `.page__title` | Lines 67–75 | — |
| `.calendar__nav` and children | Lines 81–140 | — |
| `.calendar__view-toggle` and children | Lines 142–180 | — |
| `.calendar__week` grid and all children | Lines 182–290 | — |
| `.calendar__summary` / `.calendar__stat` | Lines 296–320 | — |
| `.glass-card__value` / `.glass-card__label` | Lines 322–338 | — |
| `.calendar__error` | Lines 342–352 | — |
| `.calendar__toolbar` / `.calendar__add-btn` | Lines 356–390 | — |
| `.calendar__day` / timeline / grid | Lines 396–470 | — |
| `.calendar__event` and all children | Lines 478–550 | — |
| `.calendar__event-actions` | Lines 556–600 | — |
| `.calendar__empty` / `.calendar__loading` | Lines 606–640 | — |
| `.calendar__reminder` list and children | Lines 648–710 | — |
| `.calendar__fab-stack` and children | Lines 716–760 | ~Lines 770–810 |
| `.calendar__overlay` | — | ~Lines 812–830 |
| `.calendar__modal` | — | ~Lines 832–870 |
| `.calendar__form` / fields | — | ~Lines 872–920 |
| `.calendar__btn` variants | — | ~Lines 922–950 |
| `@keyframes calendarSpin` | Line 770 | ~Line 960 |
| `@keyframes fadeInUp` | Line 776 | — |
| `.animate-in` | Line 786 | — |
| `@keyframes shiftsSheetIn` | Line 792 | ~Line 1010 |
| `@keyframes shiftsSheetOut` | Line 802 | ~Line 1020 |
| `@keyframes calendarOverlayIn/Out` | — | ~Lines 968–978 |
| `@keyframes calendarModalSlideUp` | — | ~Lines 980–986 AND ~Lines 1030–1036 |
| `@keyframes calendarModalIn/Out` | — | ~Lines 988–1000 |
| `@keyframes calendarFabIn` | — | ~Lines 1002–1008 |
| `@media (prefers-reduced-motion)` | Line 764 | ~Lines 1040–1046 |

**Impact:** The browser parses and applies the second set of rules, overriding the first. Some animations (like `calendarModalSlideUp`) are defined **three times** total. The `@keyframes shiftsSheetIn`/`shiftsSheetOut` are defined in Calendar.css but never used by Calendar components — they belong to Shifts.

### 1.2 Shared Classes Redefined Across Multiple Files

#### `.glass-card__value` — Defined in 4 files

| File | Line(s) | Properties |
|------|---------|------------|
| `styles/pages.css` | 42–45 | `font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em` |
| `Shifts/Shifts.css` | ~175–179 | `font-size: 1.4rem; font-weight: 800; color: #fff; margin-bottom: 0.2rem` |
| `Calendar/Calendar.css` | ~322–328 (1st copy) | `display: block; margin-bottom: 0.35rem; font-size: 2.2rem; font-weight: 800; line-height: 1; color: var(--primary)` |
| `Calendar/Calendar.css` | ~600+ (2nd copy) | Same as above (duplicated) |
| `profile/Profile.css` | ~480 | `display: inline-block; animation: statFadeUp 0.4s ease-out backwards` |

**Conflict:** Each file overrides the previous. Final computed styles depend on CSS import order in `App.jsx` → component imports. Calendar's `font-size: 2.2rem` with `color: var(--primary)` (indigo) will bleed into Shifts and Profile cards because there's no scoping.

#### `.glass-card__label` — Defined in 4 files

| File | Line(s) | Properties |
|------|---------|------------|
| `styles/pages.css` | 47–49 | `font-size: 0.75rem; color: rgba(255,255,255,0.55)` |
| `Shifts/Shifts.css` | ~182–185 | `font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: rgba(255,255,255,0.4)` |
| `Calendar/Calendar.css` | ~330–338 (1st copy) | `font-size: 0.82rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted)` |
| `profile/Profile.css` | — | Not explicitly redefined, inherits from pages.css or Calendar |

#### `.page__eyebrow` — Defined in 3 files

| File | Line(s) | Properties |
|------|---------|------------|
| `styles/pages.css` | 9–15 | `font-size: 0.8rem; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: rgba(255,255,255,0.45)` |
| `Calendar/Calendar.css` | ~58–65 | `display: inline-block; margin-bottom: 0.55rem; color: var(--primary); font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em` |
| `profile/Profile.css` | ~494–499 | `letter-spacing: 0.08em; text-transform: uppercase; font-size: 11px; font-weight: 600; opacity: 0.55` |

**Conflict:** Calendar changes the color to `var(--primary)` (indigo) and uses `font-weight: 700`. Profile uses `opacity: 0.55` instead of a color value. These bleed across pages.

#### `.page__title` — Defined in 3 files

| File | Line(s) | Properties |
|------|---------|------------|
| `styles/pages.css` | 17–21 | `font-size: 2rem; font-weight: 700; letter-spacing: -0.03em; margin-bottom: 0.5rem` |
| `Calendar/Calendar.css` | ~67–75 | `font-size: clamp(2rem,5vw,3rem); font-weight: 800; letter-spacing: -0.04em; background: linear-gradient(135deg,#fff,rgba(255,255,255,0.72)); -webkit-background-clip: text; -webkit-text-fill-color: transparent` |
| `profile/Profile.css` | ~501–505 | `font-size: 28px; font-weight: 700; background: linear-gradient(135deg,#fff,#c7c9ff); -webkit-background-clip: text; background-clip: text; color: transparent` |

**Conflict:** Calendar adds gradient text fill. Profile adds a slightly different gradient. The last imported CSS wins, so whichever page loads last affects the others.

#### `.animate-in` — Defined in 3 files

| File | Line(s) | Animation |
|------|---------|-----------|
| `styles/animations.css` | 97–99 | `fadeUp 0.55s cubic-bezier(0.22,1,0.36,1) backwards` |
| `Shifts/Shifts.css` | ~565 | `shiftsFadeUp 0.6s cubic-bezier(0.22,1,0.36,1) both` |
| `Calendar/Calendar.css` | ~786 (1st copy) | `fadeInUp 0.45s cubic-bezier(0.22,1,0.36,1)` |

**Conflict:** Three different animations with different durations (0.45s, 0.55s, 0.6s) and fill modes.

### 1.3 Keyframe Animations Duplicated

#### `shiftsSheetIn` / `shiftsSheetOut` — Defined in 2 files

| File | Lines |
|------|-------|
| `Shifts/Shifts.css` | ~530–550 |
| `Calendar/Calendar.css` | ~792–810 (1st copy) AND ~1010–1025 (2nd copy) |

**Issue:** These keyframes are Shifts-specific but are also in Calendar.css (twice). Calendar.css uses `calendarModalSlideUp`/`calendarModalOut` for its own modals.

#### `calendarSpin` — Defined twice in Calendar.css

| Occurrence | Lines |
|------------|-------|
| 1st copy | ~770 |
| 2nd copy | ~960 |

#### `calendarModalSlideUp` — Defined THREE times in Calendar.css

| Occurrence | Lines | Value |
|------------|-------|-------|
| 1st | ~792 | `translateY(100%)` |
| 2nd | ~980 | `translateY(24px) scale(0.92)` (different!) |
| 3rd | ~1030 | `translateY(110%)` |

**Conflict:** Three different definitions of the same animation name. The last one wins.

#### `fadeInUp` / `fadeUp` / `shiftsFadeUp` — Same concept, 3 names

| File | Keyframe name | Duration |
|------|--------------|----------|
| `animations.css` | `fadeUp` | 0.55s |
| `Shifts.css` | `shiftsFadeUp` | 0.6s |
| `Calendar.css` | `fadeInUp` | 0.45s |

All do the same thing: `translateY` + `opacity` transition.

### 1.4 `@media (prefers-reduced-motion)` — Duplicated in 5 files

| File | Line(s) | Scope |
|------|---------|-------|
| `index.css` | 62–67 | `body::before, body::after` |
| `animations.css` | 119–134 | `.page-transition, .animate-in, .animate-scale, .navbar, ...` |
| `Shifts/Shifts.css` | **None** | ❌ Missing! |
| `Calendar/Calendar.css` | ~764 (1st) + ~1040 (2nd) | `* { animation: none; transition: none; }` (nuclear option) + component-specific |
| `profile/Profile.css` | ~476–488 | Component-specific selectors |
| `glass_toast.css` | 237–243 | `.glass-toast, .glass-toast__timer-fill, .glass-toast__close` |

**Issue:** Calendar.css uses `* { animation: none !important; transition: none !important; }` which is a nuclear override that affects ALL elements globally, including Shifts and Profile when on the Calendar page.

### 1.5 `:root` Variable Conflicts

| File | Variables defined |
|------|-------------------|
| `index.css` | **None** — uses hardcoded values in `body` |
| `Shifts/Shifts.css` | `--sheet-ease`, `--sheet-overlay-bg`, `--sheet-border`, `--sheet-shadow` |
| `Calendar/Calendar.css` | Full set: `--primary`, `--secondary`, `--accent`, `--success`, `--danger`, `--warning`, `--bg`, `--surface`, `--surface-hover`, `--border`, `--border-strong`, `--text`, `--text-muted`, `--blur`, `--shadow-sm/md/lg`, `--radius-sm/radius/radius-lg/radius-xl`, `--transition` — **defined TWICE** |
| `Profile.css` | **None** — uses hardcoded values |

**Issue:** Calendar.css defines a comprehensive `:root` token system that Shifts and Profile don't use. This creates inconsistency — Calendar uses `var(--primary)` while Shifts hardcodes `#8b5cf6`.

---

## 2. Code Issues & Bugs

### 2.1 Duplicate Import (App.jsx)

**File:** `src/App.jsx`, lines 4–5

```jsx
import PageTransition from "./components/Page_transition.jsx";
import Page_transition from "./components/Page_transition.jsx";
```

Two imports of the same file with different names. Only `Page_transition` is used (line 36). `PageTransition` is unused.

**Fix:** Remove line 4.

### 2.2 Inconsistent Import Casing (Navbar.jsx)

**File:** `src/components/navbar/Navbar.jsx`, line 4

```jsx
import nav_Shifts from "../navbar/Nav_Shifts";
```

Imports `nav_Shifts` (lowercase `n`) but the file exports `Nav_Shifts`. Lines 5–6 use PascalCase (`Nav_Calendar`, `Nav_Profile`). The component is then used as `nav_Shifts` in the `NAV_ITEMS` array (line 9).

**Issue:** While JavaScript import names are arbitrary, the inconsistency with `nav_Shifts` vs `Nav_Calendar`/`Nav_Profile` is confusing. The actual file is `Nav_Shifts.jsx` with `export default Nav_Shifts`.

**Fix:** Change to `import Nav_Shifts from "../navbar/Nav_Shifts";` and update line 9.

### 2.3 Hook Defined Inside Component (Shifts.jsx)

**File:** `src/components/Pages/Shifts/Shifts.jsx`, lines 107–122

```jsx
function Shifts() {
  // ... state declarations ...
  
  function useCountUp(value, duration = 500) {  // ← Hook inside component!
    const [display, setDisplay] = useState(value);
    const prevRef = useRef(value);
    useEffect(() => {
      // ...
    }, [value]);
    return display;
  }
```

**Issue:** `useCountUp` is defined inside the `Shifts` component function. This means:
1. It's recreated on every render (wasteful)
2. React's linter can't properly check hook rules
3. It can't be reused by other components

**Note:** The hook is defined but **never actually called** anywhere in the Shifts component. The `totals` values are displayed directly without animation.

**Fix:** Either extract to a separate file (`src/hooks/useCountUp.js`) or remove it entirely since it's unused.

### 2.4 `:root` Variables in Calendar.css Conflict with index.css

**File:** `src/components/Pages/Calendar/Calendar.css`, lines 1–33

Calendar.css defines `--bg: #0b1020` but `index.css` body uses `background: linear-gradient(160deg, #0f0c29 0%, #1a1a2e 40%, #16213e 100%)`. The `--bg` variable is defined but never used by Calendar itself (Calendar uses `var(--surface)` for backgrounds). This is dead code that could confuse developers.

### 2.5 SVG Attribute Inconsistency (Nav_Calendar.jsx)

**File:** `src/components/navbar/Nav_Calendar.jsx`, lines 18–19

```jsx
stroke-width="2"        // ← kebab-case (HTML)
stroke-linecap="round"  // ← kebab-case (HTML)
```

Compare with `Nav_Shifts.jsx` (line 18) and `Nav_Profile.jsx` (lines 17, 23):
```jsx
strokeWidth="1.75"      // ← camelCase (React JSX)
strokeLinejoin="round"  // ← camelCase (React JSX)
```

**Issue:** React expects camelCase attributes. Using kebab-case in JSX works for SVG (React passes them through) but generates console warnings in development and is inconsistent.

**Fix:** Change to `strokeWidth="2"` and `strokeLinecap="round"`.

### 2.6 Profile Uses Emoji Characters as Icons

**File:** `src/components/Pages/profile/Profile.jsx`

- Line ~620: `✎` (U+270E, pencil) used for edit button
- Line ~630: `×` (U+00D7, multiplication sign) used for delete button

Compare with Shifts which uses text labels ("Edit", "Delete") and Calendar which also uses text.

**Issues:**
1. Emoji rendering varies across platforms (iOS vs Android vs desktop)
2. `✎` may render as an emoji on some systems, breaking the design
3. No `aria-hidden="true"` on decorative characters
4. Inconsistent with the rest of the app which uses SVG icons or text labels

**Fix:** Replace with SVG icons matching the app's stroke style, or use text labels like Shifts does.

### 2.7 Calendar Delete Modal Reuses Shifts CSS Classes

**File:** `src/components/Pages/Calendar/Calendar.jsx`, line ~530

```jsx
<div className="shifts__delete-icon" aria-hidden="true">
```

Calendar's delete modal uses `shifts__delete-icon` class from Shifts.css. This creates a hidden dependency — if Shifts.css is ever removed or the class renamed, Calendar's delete icon breaks.

**Fix:** Either duplicate the styles under `calendar__delete-icon` or create a shared component.

### 2.8 `yearOptions` Memoization Uses Stale `now`

**File:** `src/components/Pages/Shifts/Shifts.jsx`, lines 129–133

```jsx
const yearOptions = useMemo(() => {
  const current = now.getFullYear();
  return Array.from({ length: 101 }, (_, i) => current + i);
}, []);
```

`now` is defined at line 83 (`const now = new Date()`) inside the component body but outside the `useMemo`. Since the dependency array is empty, the year options are calculated once and never update. If the user keeps the app open past midnight on Dec 31, the year list won't include the new year until refresh.

**Impact:** Low — edge case. But the pattern is fragile.

### 2.9 No Error Boundary

The app has no React Error Boundary. If any component throws during render (e.g., Supabase returns unexpected data shape), the entire app crashes with a white screen.

### 2.10 Toast Timer Tick Interval

**File:** `src/lib/glass_toast_provider.jsx`, line 59

```jsx
const TICK_MS = 40;
```

The toast system runs a `setInterval` every 40ms (25fps) to update toast remaining time. This is aggressive — `requestAnimationFrame` or a 100–200ms interval would be sufficient for a progress bar and would reduce CPU usage, especially on mobile.

---

## 3. CSS Architecture Recommendations

### 3.1 Unified CSS Variable System

**Current state:** Variables are scattered across `Shifts.css` (`:root`), `Calendar.css` (`:root` × 2), and hardcoded in `Profile.css` and `pages.css`.

**Recommendation:** Single `:root` block in `index.css`:

```css
:root {
  /* ── Brand Colors ── */
  --color-primary: #6366f1;
  --color-primary-hover: #7c7ff5;
  --color-primary-glow: rgba(99, 102, 241, 0.35);
  --color-secondary: #a855f7;
  --color-accent: #f472b6;
  --color-success: #22c55e;
  --color-danger: #ef4444;
  --color-warning: #f59e0b;

  /* ── Surfaces ── */
  --surface: rgba(255, 255, 255, 0.05);
  --surface-hover: rgba(255, 255, 255, 0.08);
  --surface-glass: linear-gradient(135deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 100%);

  /* ── Borders ── */
  --border: rgba(255, 255, 255, 0.12);
  --border-strong: rgba(255, 255, 255, 0.2);

  /* ── Text ── */
  --text: #f8fafc;
  --text-muted: rgba(248, 250, 252, 0.62);
  --text-dim: rgba(255, 255, 255, 0.45);

  /* ── Glassmorphism ── */
  --blur: blur(18px);
  --blur-heavy: blur(32px) saturate(180%);

  /* ── Shadows ── */
  --shadow-sm: 0 4px 12px rgba(0, 0, 0, 0.15);
  --shadow-md: 0 12px 30px rgba(0, 0, 0, 0.25);
  --shadow-lg: 0 24px 50px rgba(0, 0, 0, 0.35);

  /* ── Radius ── */
  --radius-sm: 0.75rem;
  --radius: 1rem;
  --radius-lg: 1.5rem;
  --radius-xl: 2rem;
  --radius-pill: 999px;

  /* ── Transitions ── */
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --duration-fast: 0.18s;
  --duration-normal: 0.3s;
  --duration-slow: 0.5s;
  --transition: 0.22s cubic-bezier(0.22, 1, 0.36, 1);

  /* ── Sheet/Modal ── */
  --sheet-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --sheet-overlay-bg: rgba(8, 10, 20, 0.4);
  --sheet-border: rgba(255, 255, 255, 0.12);
  --sheet-shadow: 0 -8px 30px rgba(0,0,0,0.18), 0 -24px 80px rgba(0,0,0,0.22);
}
```

Then remove all `:root` blocks from `Shifts.css`, `Calendar.css`, and add body background to `index.css` body rule.

### 3.2 Shared vs Component-Specific Styles

**Move to `styles/pages.css` (shared):**
- `.page`, `.page__header`, `.page__eyebrow`, `.page__title`, `.page__subtitle`
- `.glass-card`, `.glass-card__value`, `.glass-card__label`
- `.animate-in` and stagger variants (`.animate-in--1` through `--4`)
- `.animate-scale`
- Common modal patterns (overlay, form fields, form actions, buttons)
- Common FAB pattern (stack, fab, fab--up, fab--add)

**Keep component-specific:**
- `.shifts__*` (all BEM-prefixed styles)
- `.calendar__*` (all BEM-prefixed styles)
- `.profile__*` (all BEM-prefixed styles)
- Component-specific animations (`shiftsSheetIn`, `calendarModalSlideUp`, etc.)

**Current problem:** `.glass-card__value` and `.glass-card__label` are generic class names used by ALL three pages but defined with different values in each component's CSS. They should either:
1. Be truly shared with consistent values in `pages.css`, OR
2. Be scoped per component (e.g., `.shifts .glass-card__value`)

### 3.3 Animation Consolidation

**Create `styles/animations.css` as the single source of truth:**

```css
/* ── Shared Keyframes ── */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(1.25rem); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.85); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(110%); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideDown {
  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: translateY(110%); }
}

@keyframes overlayIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes overlayOut {
  from { opacity: 1; }
  to { opacity: 0; }
}

/* ── Shared Animation Classes ── */
.animate-in { animation: fadeUp 0.5s var(--ease-out) backwards; }
.animate-in--1 { animation-delay: 0.06s; }
.animate-in--2 { animation-delay: 0.12s; }
.animate-in--3 { animation-delay: 0.18s; }
.animate-in--4 { animation-delay: 0.24s; }
```

Then each component references these shared keyframes instead of defining its own `fadeInUp`/`shiftsFadeUp`/`fadeUp`.

### 3.4 Font Family

**Current:** `index.css` uses `"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`

**Recommendation:** The task spec says to use Barlow Condensed / Barlow. Add to `:root`:

```css
--font-heading: "Barlow Condensed", "SF Pro Display", sans-serif;
--font-body: "Barlow", "SF Pro Display", -apple-system, sans-serif;
```

And load via Google Fonts or a local `@font-face` in `index.css`.

---

## 4. Animation & UX Improvements

### 4.1 Missing Hover/Focus States

| Element | File | Issue |
|---------|------|-------|
| `.shifts__filter select` | Shifts.css ~72 | No `:focus` style (only `transition` on base) |
| `.shifts__place-btn` | Shifts.css ~99 | No `:hover` style |
| `.shifts__pay-toggle-btn` | Shifts.css ~375 | No `:hover` style |
| `.shifts__btn--primary` | Shifts.css ~420 | No `:hover` or `:active` style |
| `.shifts__btn--danger` | Shifts.css ~440 | Has `:hover` but no `:focus-visible` |
| `.calendar__week-day` | Calendar.css | Has `:hover` but no `:focus-visible` |
| `.calendar__view-btn` | Calendar.css | Has `:hover` but no `:focus-visible` |
| `.calendar__reminder-delete` | Calendar.css | Has `:hover` but no `:focus-visible` |
| `.profile__icon-btn` | Profile.css | Has `:hover` but no `:focus-visible` |
| `.profile__text-btn` | Profile.css | Has `:hover` but no `:focus-visible` |
| `.profile__link-btn` | Profile.css | Has `:hover` but no `:focus-visible` |

### 4.2 Inconsistent Animation Timing

| Component | Entrance animation | Duration |
|-----------|-------------------|----------|
| Page transition | `pageEnterForward/Backward` | 0.45s |
| Shifts cards | `shiftsFadeUp` | 0.6s |
| Calendar items | `fadeInUp` | 0.45s |
| Profile stat values | `statFadeUp` | 0.4s |
| History items | `historyItemIn` | 0.28s |
| Navbar | `navbarEnter` | 0.7s |

**Recommendation:** Standardize on 3 tiers:
- **Micro** (buttons, toggles): 150–200ms
- **Medium** (cards, list items): 300–400ms
- **Large** (page transitions, modals): 400–500ms

### 4.3 Missing Staggered Reveals

Shifts uses `--card-delay` CSS custom property for staggered card animation (line ~340: `style={{ "--card-delay": `${index * 0.06}s` }}`), but the CSS never references `var(--card-delay)`. The stagger delay is set but has no effect.

**Fix:** Add `animation-delay: var(--card-delay)` to `.shifts__card` or use the `.animate-in--N` pattern.

### 4.4 Scroll-Snap Missing

The calendar week view on mobile (Calendar.css ~680–710) has `scroll-snap-type: x proximity` but the month view doesn't use scroll-snap at all. The shifts list and profile history have no vertical scroll-snap.

### 4.5 Modal Close on Overlay Click — No Animation Feedback

All three pages close modals on overlay click, but there's no visual feedback (ripple, flash) to indicate the click was registered. The close animation starts immediately which is fine, but a subtle overlay dim would improve perceived responsiveness.

---

## 5. Accessibility Issues

### 5.1 ARIA Attributes

| Issue | File | Line(s) | Details |
|-------|------|---------|---------|
| ✅ Good | Navbar.jsx | 48 | `aria-label="Main navigation"` on `<nav>` |
| ✅ Good | Nav_Shifts.jsx | 10 | `aria-current={isActive ? "page" : undefined}` |
| ✅ Good | Shifts.jsx | 310 | `aria-pressed={placeFilter === id}` on filter buttons |
| ✅ Good | Shifts.jsx | 355 | `role="alert"` on error message |
| ✅ Good | Shifts.jsx | 420 | `aria-modal="true"` on form modal |
| ✅ Good | Shifts.jsx | 421 | `aria-labelledby="shift-modal-title"` |
| ✅ Good | Shifts.jsx | 510 | `role="alertdialog"` on delete modal |
| ✅ Good | Calendar.jsx | 290 | `aria-pressed={isSelected}` on day buttons |
| ✅ Good | Calendar.jsx | 310 | `role="tablist"` on view toggle |
| ✅ Good | Profile.jsx | 540 | `role="progressbar"` with `aria-valuenow/min/max` |
| ⚠️ Missing | Shifts.jsx | 370 | `.shifts__list` is `<ul>` but has no `aria-label` |
| ⚠️ Missing | Calendar.jsx | ~400 | `.calendar__grid` has `role="presentation"` but clicking opens add modal — should have `aria-label="Click to add event"` |
| ⚠️ Missing | Profile.jsx | ~600 | `.profile__history` `<ul>` has no `aria-label` |
| ⚠️ Missing | All modals | — | No `aria-describedby` on form modals (only delete modals have it) |

### 5.2 Color Contrast Issues

| Element | Foreground | Background | Ratio | WCAG AA? |
|---------|-----------|------------|-------|----------|
| `.page__eyebrow` (pages.css) | `rgba(255,255,255,0.45)` ≈ #737373 | dark gradient bg | ~3.8:1 | ⚠️ Borderline (needs 4.5:1 for normal text) |
| `.glass-card__label` (pages.css) | `rgba(255,255,255,0.55)` ≈ #8C8C8C | dark gradient bg | ~4.7:1 | ✅ Passes |
| `.shifts__date` | `rgba(255,255,255,0.35)` ≈ #595959 | dark bg | ~2.8:1 | ❌ Fails |
| `.shifts__card-details` (secondary text) | `#fff` on `rgba(255,255,255,0.03)` | dark bg | ~15:1 | ✅ Passes |
| `.glass-toast__message` | `rgba(255,255,255,0.55)` | dark glass | ~4.7:1 | ✅ Passes |
| `.calendar__text-muted` | `rgba(248,250,252,0.62)` ≈ #9EA0A3 | dark bg | ~5.5:1 | ✅ Passes |
| `.profile__history-note` | `rgba(255,255,255,0.45)` | dark bg | ~3.8:1 | ⚠️ Borderline |
| `.profile__form-hint` | `rgba(255,255,255,0.4)` | dark bg | ~3.4:1 | ❌ Fails |
| Calendar disabled/completed events | `opacity: 0.5` + `filter: grayscale(0.35)` | dark bg | ~2.5:1 | ❌ Fails |

**Worst offenders:**
1. `.shifts__date` — `rgba(255,255,255,0.35)` — increase to at least `0.55`
2. `.profile__form-hint` — `rgba(255,255,255,0.4)` — increase to at least `0.55`
3. `.profile__history-note` — `rgba(255,255,255,0.45)` — borderline, increase to `0.55`
4. `.page__eyebrow` — `rgba(255,255,255,0.45)` — increase to `0.55`

### 5.3 Keyboard Navigation

| Issue | File | Details |
|-------|------|---------|
| ❌ Calendar grid click | Calendar.jsx ~370 | `handleGridClick` is on a `div` with `role="presentation"`. Keyboard users cannot click the grid to add events. Should be a `<button>` or have `tabIndex={0}` + `onKeyDown`. |
| ❌ Shift note toggle | Shifts.jsx ~330 | The note toggle button is small (icon-only) but has proper `aria-label`. ✅ OK. |
| ⚠️ Calendar event actions | Calendar.css ~560 | Event action buttons (`Edit`/`Delete`) are `opacity: 0` by default and only show on hover. Keyboard users can't see them. Should show on `:focus-within` too. |
| ⚠️ Chart dots | Profile.jsx ~300 | Chart dots have `tabIndex={0}` and `onFocus`/`onBlur` handlers. ✅ Good. |
| ❌ Profile emoji buttons | Profile.jsx ~620 | `✎` and `×` emoji buttons have `aria-label` but the emoji itself isn't `aria-hidden`. Screen readers may announce both the emoji and the label. |
| ⚠️ Modal trap | All modals | None of the modals implement focus trapping. Tab can escape the modal to elements behind it. |

### 5.4 Touch Target Sizes

**Minimum recommended: 44×44px (WCAG 2.5.5)**

| Element | File | Computed Size | Pass? |
|---------|------|--------------|-------|
| `.nav-option` | Navbar.css | `min-height: 3.25rem` (52px) | ✅ |
| `.shifts__place-btn` | Shifts.css | `padding: 0.55rem 0.75rem` (~36px height) | ⚠️ Borderline on desktop, passes on mobile (44px at 640px) |
| `.shifts__action` (Edit/Delete) | Shifts.css | `min-width: 4.5rem` (72px), `padding: 0.45rem` (~34px height) | ❌ Height too small |
| `.calendar__check` | Calendar.css | `1.15rem × 1.15rem` (18.4px) | ❌ Way too small |
| `.calendar__event-action` | Calendar.css | `padding: 0.18rem 0.4rem` (~14px height) | ❌ Way too small |
| `.calendar__nav-btn` | Calendar.css | `3rem × 3rem` (48px) | ✅ |
| `.calendar__color` (color picker) | Calendar.css | `2.4rem × 2.4rem` (38.4px) | ⚠️ Borderline |
| `.profile__icon-btn` | Profile.css | `32px × 32px` | ❌ Too small |
| `.glass-toast__close` | glass_toast.css | `1.75rem × 1.75rem` (28px) | ❌ Too small |
| `.calendar__week-day` | Calendar.css | `aspect-ratio: 0.9`, varies by width | ⚠️ Depends on viewport |

**Critical fixes needed:**
1. `.calendar__check` — increase to at least 44×44px (with padding or min-size)
2. `.calendar__event-action` — increase to at least 44×44px tap area
3. `.profile__icon-btn` — increase from 32px to 44px
4. `.glass-toast__close` — increase from 28px to at least 40px
5. `.shifts__action` — increase height to at least 44px

### 5.5 Missing `prefers-reduced-motion` in Shifts.css

**File:** `src/components/Pages/Shifts/Shifts.css`

Shifts.css has multiple animations (`shiftsFadeUp`, `shiftsSheetIn`, `shiftsSheetOut`, `shiftsOverlayIn`, `shiftsOverlayOut`, `shiftsModalSlideUp`, `goalShimmer`, `historyItemIn`) but **no `@media (prefers-reduced-motion: reduce)` block**.

Users who prefer reduced motion will still see all Shifts animations.

### 5.6 Screen Reader Issues

1. **Loading states** — `shifts__spinner` and `calendar__spinner` have `aria-hidden="true"` but the accompanying text ("Loading shifts…", "Loading events…") lacks `role="status"` or `aria-live`.

2. **Toast notifications** — The toast viewport has `aria-live="polite"` ✅, but individual toasts also have `role="status"` + `aria-live="polite"`, creating redundant announcements.

3. **Dynamic content updates** — When shifts/events are fetched, there's no announcement to screen readers. Consider adding a visually-hidden `aria-live="polite"` region for data load confirmations.

---

## Summary of Priority Fixes

### 🔴 Critical (do first)
1. **Calendar.css duplication** — Remove the entire second copy (~500 lines of dead/conflicting CSS)
2. **Shared class conflicts** — Scope `.glass-card__value`, `.glass-card__label`, `.page__eyebrow`, `.page__title`, `.animate-in` properly
3. **`@keyframes shiftsSheetIn/Out` in Calendar.css** — Remove (belongs to Shifts only)
4. **`@keyframes calendarModalSlideUp` triple definition** — Consolidate to one

### 🟡 High Priority
5. **Unified `:root` variables** in `index.css`
6. **Remove duplicate import** in `App.jsx` (line 4)
7. **Fix import casing** in `Navbar.jsx` (`nav_Shifts` → `Nav_Shifts`)
8. **Extract or remove `useCountUp`** from Shifts.jsx
9. **Fix SVG attributes** in `Nav_Calendar.jsx` (kebab-case → camelCase)
10. **Add `prefers-reduced-motion`** to Shifts.css
11. **Fix color contrast** for `.shifts__date`, `.profile__form-hint`, `.profile__history-note`

### 🟢 Medium Priority
12. **Replace emoji icons** in Profile with SVGs
13. **Fix touch target sizes** (calendar checkbox, event actions, icon buttons, toast close)
14. **Add `:focus-visible` styles** to interactive elements
15. **Add focus trapping** to modals
16. **Fix Calendar grid keyboard accessibility**
17. **Show event actions on `:focus-within`** (not just `:hover`)
18. **Consolidate animation keyframes** into shared definitions
19. **Fix staggered card animation** in Shifts (CSS variable not consumed)

### 🔵 Low Priority
20. **Add Error Boundary** component
21. **Reduce toast tick interval** (40ms → 100ms)
22. **Add `aria-label`** to list elements
23. **Add loading state announcements** for screen readers
24. **Standardize animation timing** across components
