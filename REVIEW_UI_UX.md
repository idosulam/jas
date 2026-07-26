# UI/UX Consistency Review — Fitness Feature

**Reviewed files:**
- `src/components/Pages/Fitness/Fitness.jsx`
- `src/components/Pages/Fitness/Fitness.css`
- `src/components/Pages/Fitness/WorkoutLogger.jsx`
- `src/components/Pages/Fitness/DietTracker.jsx`
- `src/components/navbar/Nav_Fitness.jsx`

**Reference files:** Shifts (primary), Profile, Household, shared UI components

---

## ✅ What Looks Correct

### 1. CSS Class Naming Conventions (BEM)
All fitness classes follow the `fitness__element--modifier` BEM pattern consistently, matching the `shifts__*` and `profile__*` convention:
- `fitness__card`, `fitness__card-main`, `fitness__card-actions` ✅
- `fitness__stat--workout`, `fitness__stat--diet` ✅
- `fitness__tab-btn--active`, `fitness__card--removing` ✅
- `fitness__template-chip--add`, `fitness__action--edit`, `fitness__action--delete` ✅

### 2. Animation Classes (`animate-in`)
Staggered entrance animations are applied correctly:
- `animate-in` on PageHeader ✅
- `animate-in animate-in--1` on filters/tabs ✅
- `animate-in animate-in--2` on summary ✅
- `animate-in animate-in--3` on templates/presets ✅
- `animate-in animate-in--4` on list header ✅
- Matches Shifts pattern exactly.

### 3. SheetModal Usage
Both `WorkoutLogger.jsx` and `DietTracker.jsx` use SheetModal identically to Shifts:
```jsx
<SheetModal open={formModal.open} closing={formModal.closing} onClose={closeFormModal} title={...}>
```
- `MODAL_EXIT_MS = 320` matches Shifts ✅
- `useModal(MODAL_EXIT_MS)` hook pattern ✅
- `useBodyScrollLock(formModal.open, deleteModal.open, ...)` ✅
- ConfirmModal for delete with `open`, `closing`, `onClose`, `onConfirm`, `loading`, `title`, `description`, `confirmLabel`, `icon`, `preview` — all match Shifts ✅

### 4. FormField Usage
FormField is used correctly with enhanced mode props:
```jsx
<FormField label="Date" error={fieldErrors.workout_date} state={fieldStates.workout_date} showIndicator shake={fieldErrors.workout_date ? shakeKey : 0}>
```
- `label`, `error`, `state`, `showIndicator`, `shake` all match Shifts/Profile patterns ✅
- `optional` and `charCount`/`maxChars` props used correctly ✅
- Field validation → `handleFieldBlur` → `setFieldErrors`/`setFieldStates` → `hapticError()` flow matches ✅

### 5. Button Classes
- `btn btn--ghost` for Cancel ✅
- `btn btn--primary` for submit with `btn__spinner` loading state ✅
- `btn btn--danger-outline` for delete in preset modal ✅
- `btn-row` wrapper for action buttons ✅
- All match the shared `Buttons.css` system.

### 6. Glass Card Styling
```css
.fitness__stat {
  background: var(--surface-glass);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  backdrop-filter: var(--blur);
  -webkit-backdrop-filter: var(--blur);
}
```
- Matches Shifts `shifts__stat` exactly ✅
- Scoped `.fitness .glass-card__value` and `.fitness .glass-card__label` overrides match Shifts exactly ✅ (same font-size, font-weight, color, text-transform)

### 7. Color Scheme
- Green (`#34d399`) for workout accent — semantically appropriate ✅
- Blue (`#60a5fa`) for diet accent — semantically appropriate ✅
- Purple gradient (`var(--color-primary)` → `var(--color-secondary)`) for tab indicator — matches app palette ✅
- Red (`#ef4444`/`#f87171`) for delete actions — matches Shifts ✅
- All colors stay within the app's established palette.

### 8. Typography
- `--font-heading` for titles, stat values, labels — consistent ✅
- `--font-body` for template chips — matches Shifts ✅
- Font sizes (0.7rem labels, 0.75rem meta, 0.82rem body, 0.95rem titles, 1.4rem stat values) — all within app norms ✅
- Font weights (500, 600, 700, 800) — consistent ✅

### 9. Empty States
```jsx
<EmptyState className="fitness__empty" icon={...} title="No workouts this month" text='Tap "+ Add workout" to log your first one.' />
```
- Uses shared `EmptyState` component ✅
- Passes `icon`, `title`, `text` props — matches Shifts pattern ✅
- CSS: `flex-direction: column; align-items: center; text-align: center; padding: 2.5rem 1.5rem` — matches `shifts__empty-card` ✅

### 10. Loading States
```jsx
<LoadingSkeleton count={3} height="5.5rem" />
```
- Matches Shifts exactly ✅

### 11. FAB Positioning & Behavior
```jsx
<FAB visible={showFloatingActions} onScrollTop={...} onAdd={openAddModal} addLabel="Log workout" />
```
- Uses shared `FAB` component with identical prop pattern ✅
- IntersectionObserver for `showFloatingActions` — same logic as Shifts ✅

### 12. Nav Icon Style (`Nav_Fitness.jsx`)
- Uses `nav-option` / `nav-option--active` classes — matches `Nav_Shifts.jsx` ✅
- `aria-current={isActive ? "page" : undefined}` — matches ✅
- SVG with `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `strokeWidth="1.75"` — matches ✅
- `<span className="nav-option__label">` — matches ✅
- Icon is a dumbbell — clear, appropriate, well-designed ✅

### 13. Prefers-reduced-motion Support
```css
@media (prefers-reduced-motion: reduce) {
  .fitness__stat, .fitness__card, .fitness__entry, .fitness__tab-btn,
  .fitness__add-btn, .fitness__template-chip, .fitness__meal-add,
  .fitness__date-btn, .fitness__macro-bar-fill {
    animation: none !important;
    transition: none !important;
  }
}
```
- Covers all interactive/animated elements ✅
- Note: Fitness doesn't define its own modal/overlay styles (uses shared SheetModal), so no need to include those here — the global `animations.css` handles `animate-in` classes ✅

### 14. Deletion Animation
```css
.fitness__card--removing { animation: fitnessCardRemove 0.35s var(--ease-smooth) forwards; }
```
- Keyframes match `shiftsCardRemove` exactly (translateX(30px) scale(0.95), max-height collapse) ✅
- `setTimeout(() => { ... }, 380)` timing in JS matches animation duration ✅

### 15. Date Navigation (Diet)
- Clean, accessible design with `aria-label` on prev/next buttons ✅
- "Today" button with pill style — nice touch, consistent with app aesthetic ✅

### 16. Macro Progress Bars (Diet)
- `MacroProgressBar` is a clean, self-contained component ✅
- Color-coded (amber calories, green protein, blue carbs, pink fats, purple fiber) — within palette ✅
- Over-limit state with red (#f87171) — consistent with app's error color ✅

---

## ❌ Issues That Need Fixing

### Issue 1: Filter label `font-family` inconsistency
**File:** `Fitness.css`, line ~53 (`.fitness__filter`)
**Problem:** Uses `font-family: var(--font-heading)` but Shifts `.shifts__filter` uses `font-family: inherit`.
**Fix:**
```css
/* Fitness.css */
.fitness__filter {
  /* Change: */
  font-family: var(--font-heading);
  /* To: */
  font-family: inherit;
}
```

### Issue 2: Missing 420px responsive breakpoint
**File:** `Fitness.css`
**Problem:** Shifts.css defines a `@media (max-width: 420px)` breakpoint with refined spacing for small phones. Fitness.css stops at 640px. This means on very small screens (< 420px), the fitness page won't have the tighter spacing that Shifts applies.
**Fix:** Add a 420px breakpoint:
```css
@media (max-width: 420px) {
  .fitness__header {
    margin-bottom: 1.1rem;
  }

  .fitness__tabs {
    padding: 0.24rem;
  }

  .fitness__tab-btn {
    padding: 0.5rem 0.6rem;
    font-size: 0.78rem;
  }

  .fitness__card {
    padding: 0.82rem;
  }

  .fitness__stat {
    padding: 0.75rem 0.5rem;
  }

  .fitness .glass-card__value {
    font-size: 1.1rem;
  }

  .fitness .glass-card__label {
    font-size: 0.6rem;
  }

  .fitness__macro-inputs {
    grid-template-columns: 1fr;
  }
}
```

### Issue 3: Filter missing `flex-wrap: wrap` at 768px
**File:** `Fitness.css`, `.fitness__filters` in the 768px media query
**Problem:** Shifts has `.shifts__filters { flex-wrap: wrap; }` at 768px. Fitness omits this, so on tablets the month/year selects could overflow instead of wrapping.
**Fix:**
```css
@media (max-width: 768px) {
  .fitness__filters {
    flex-wrap: wrap;
  }
}
```

### Issue 4: Filter select missing `min-height` at 640px
**File:** `Fitness.css`, `.fitness__filter select` in the 640px media query
**Problem:** Shifts defines `min-height: 46px; font-size: 16px;` for filter selects at 640px. Fitness only sets `font-size: 16px` for exercise inputs but not for filter selects. This means filter dropdowns on mobile may be smaller than the 44px minimum touch target.
**Fix:**
```css
@media (max-width: 640px) {
  .fitness__filter select {
    min-height: 46px;
    font-size: 16px;
  }
}
```

### Issue 5: Summary grid — missing `flex-wrap` / layout change at 768px
**File:** `Fitness.css`, `.fitness__summary` at 768px
**Problem:** At 768px, the summary stays `repeat(3, 1fr)` which can feel cramped on tablets. Shifts uses `repeat(2, 1fr)` at 768px (its base) and `1fr` at 640px. For the DietTracker which has 4 stat cards (Calories, Protein, Carbs, Fats), the 3-column grid means the 4th card wraps to a new row alone, looking unbalanced.
**Fix:** Consider 2-column layout at 768px for diet stats:
```css
@media (max-width: 768px) {
  .fitness__summary {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.55rem;
  }
}
```

### Issue 6: Stat cards missing hover transform
**File:** `Fitness.css`, `.fitness__stat`
**Problem:** Shifts `.shifts__stat:hover` applies `transform: translateY(-4px) scale(1.02)` plus `box-shadow: var(--shadow-md), var(--shadow-glow)`. Fitness `.fitness__stat:hover` has these same properties ✅ — wait, actually it does! Let me re-check... Yes, `.fitness__stat:hover` does have the transform. ✅ Actually fine.

**Correction:** This is NOT an issue. Both have the same hover effect. Removing from issues.

### Issue 7: Exercise remove button — no minimum touch target
**File:** `Fitness.css`, `.fitness__exercise-remove`
**Problem:** The remove button is `width: 2rem; height: 2rem` (32px) which is below the 44px minimum touch target recommended by WCAG/Apple HIG. On mobile, this will be hard to tap. Compare with Shifts' `.shifts__action` which has `min-height: 2.75rem` (44px).
**Fix:**
```css
.fitness__exercise-remove {
  width: 2.25rem;
  height: 2.25rem;
  /* Or better, match the entry-btn pattern: */
  min-width: 44px;
  min-height: 44px;
}
```

### Issue 8: Diet stat grid — 4 cards in 3-column grid
**File:** `DietTracker.jsx`, line ~330 (summary section)
**Problem:** DietTracker renders 4 GlassCard stats (Calories, Protein, Carbs, Fats) but the `.fitness__summary` grid is `repeat(3, 1fr)`. This means the 4th card (Fats) wraps to a new row by itself, looking orphaned and unbalanced.
**Fix options:**
1. Change to `repeat(2, 1fr)` for diet stats (better balanced), OR
2. Add a `fitness__summary--diet` modifier with `grid-template-columns: repeat(2, 1fr)`, OR
3. Use `repeat(auto-fill, minmax(5rem, 1fr))` for flexible layout

### Issue 9: Missing `420px` and `360px` breakpoints for filter selects
**File:** `Fitness.css`
**Problem:** At very small widths (< 420px), the filter selects and date nav buttons may be too cramped. Shifts has specific 420px and 360px refinements for place filters and cards.
**Fix:** Covered by Issue 2's 420px breakpoint addition.

### Issue 10: Diet presets missing kcal in workout presets
**File:** `WorkoutLogger.jsx`, preset template chip
**Problem:** Diet presets show `{preset.name}<span className="fitness__template-cal">{preset.calories}kcal</span>` but workout presets only show `{preset.name}`. Shifts presets show `{preset.label}<span className="shifts__template-time">{preset.start_time}–{preset.end_time}</span>`. The workout presets could benefit from showing exercise count or estimated volume for quick identification.
**Severity:** Low — suggestion, not a bug.

---

## 💡 Suggestions for Improvement

### S1: Add `focus-visible` to filter selects
**File:** `Fitness.css`
Fitness filter selects have a `:focus` style but no `:focus-visible`. Shifts adds:
```css
.shifts__filter select:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```
Add the same to `.fitness__filter select:focus-visible`.

### S2: Add `focus-visible` to tab buttons
Already present ✅ — `.fitness__tab-btn:focus-visible` is defined. Good.

### S3: Staggered glass-card entrance animation
Profile defines staggered entrance animations for stat cards:
```css
.profile__summary .profile__stat:nth-child(1) .glass-card__value { animation-delay: 0.05s; }
.profile__summary .profile__stat:nth-child(2) .glass-card__value { animation-delay: 0.1s; }
/* etc. */
```
Consider adding similar staggered delays for fitness stat cards for a more polished entrance.

### S4: Diet summary — consider `repeat(2, 1fr)` as default
Since DietTracker has 4 stats, a 2-column grid would look more balanced (2×2) than 3-column (3+1). Consider:
```css
.fitness__diet .fitness__summary {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
```

### S5: Workout preset chips — add contextual info
Like Shifts shows `start_time–end_time` in preset chips, consider showing exercise count:
```jsx
<span className="fitness__template-cal">{preset.exercises?.length || 0} exercises</span>
```

### S6: Error shake animation — consider matching Shifts keyframe pattern
Fitness defines `fitnessErrorShake` with `-8px, 8px, -4px, 4px` offsets. Shifts defines `shiftsErrorShake` with identical values. Since these are identical, consider extracting to a shared `shake` keyframe in `animations.css` to avoid duplication.

### S7: Date nav could benefit from a `--card-delay` animation
The date navigation in DietTracker uses `animate-in animate-in--2` but the individual buttons could have a subtle stagger. Low priority.

### S8: DietTracker — no FAB for food logging
WorkoutLogger has a FAB for "Log workout" but DietTracker doesn't have one. Consider adding a FAB for quick food logging, since the "add" buttons are per-meal-group and require scrolling.

### S9: WorkoutLogger — add "Copy" action like Shifts
Shifts has a "Copy" action button on each card to duplicate a shift to today. Consider adding a similar "Copy" action for workouts to quickly repeat a previous workout.

### S10: Macro dashboard could show fiber bar
The MacroDashboard shows Calories, Protein, Carbs, Fats, Fiber in the progress bars, but the summary stat cards only show Calories, Protein, Carbs, Fats. Consider adding a Fiber stat card or showing it as a secondary metric.

---

## Summary

| Category | Status |
|----------|--------|
| BEM naming | ✅ Correct |
| Animations | ✅ Correct |
| SheetModal | ✅ Matches Shifts |
| FormField | ✅ Matches Shifts |
| Buttons | ✅ Correct |
| Glass cards | ✅ Correct |
| Color scheme | ✅ Consistent |
| Typography | ⚠️ 1 minor issue (filter font-family) |
| Responsive | ❌ Missing 420px breakpoint, 640px select sizing |
| Empty states | ✅ Correct |
| Loading states | ✅ Correct |
| FAB | ✅ Correct |
| Nav icon | ✅ Correct |
| Reduced motion | ✅ Correct |
| Touch targets | ❌ Exercise remove button too small |

**Overall:** The Fitness feature is **well-implemented** and closely follows the app's established patterns. The 10 issues found are mostly minor responsive/touch-target gaps. No architectural or pattern-breaking problems. The code quality is high and matches the Shifts reference closely.
