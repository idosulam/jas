# CSS Consolidation Plan

## Goal
Extract repeated CSS patterns from page-specific files into shared stylesheets, then import them. This reduces duplication and makes maintenance easier.

## Shared Files to Create/Extend

### 1. `src/styles/shared.css` (NEW)
Consolidated shared patterns used across 3+ page CSS files.

#### 1a. Focus Visible Outline (21 occurrences in 7 files)
```css
/* Replaces all individual :focus-visible rules */
.focusable:focus-visible,
button:focus-visible,
a:focus-visible,
[tabindex]:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```
**Files affected:** Calendar.css (5x), Fitness.css (4x), Shifts.css (5x), Profile.css (3x), Navbar.css (1x), Buttons.css (2x), FAB.css (1x)

**Action:** Remove individual `:focus-visible` rules from each file. Add a single shared rule in `shared.css`. Keep file-specific overrides only (e.g. `outline-offset: -2px` for Calendar grid).

#### 1b. Page Base Layout (3 files)
```css
.page--scrollable {
  text-align: left;
  padding-bottom: 5.5rem;
  min-width: 0;
}

@media (min-width: 1024px) {
  .page--scrollable {
    max-width: 56rem;
    margin-inline: auto;
  }
}
```
**Files affected:** Fitness.css, Household.css, Shifts.css (each has both `.fitness`/`.household`/`.shifts` base AND the `@media` block)

**Action:** Replace local `.fitness`, `.household`, `.shifts` base rules with a shared class. In JSX: `<section className="shifts page page--scrollable">`.

#### 1c. Page Header (5 files)
```css
.page-header {
  text-align: center;
  margin-bottom: 1.5rem;
}
```
**Files affected:** Auth.css (`.auth__header`), Fitness.css (`.fitness__header`), Household.css (`.household__header`), Shifts.css (`.shifts__header`), Profile.css (`.profile__header`)

**Action:** Replace all 5 with a shared `.page-header` class. Already have `.page__header` in pages.css but it's unused — rename and use it.

#### 1d. Form Column Layout (7 occurrences in 5 files)
```css
.form-column {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
```
**Files affected:** Auth.css (`.auth__form`), Calendar.css (`.calendar__form`), Budgets.css (`.budgets__form`), Household.css (`.household__form`), HouseholdSpendee.css (`.transactions__groups`, `.transactions__form`, `.recurring__form`)

**Action:** Replace local form layout rules with shared `.form-column` class. Keep file-specific gap overrides if needed.

#### 1e. Stat Card Hover (3 files)
```css
.stat-card:hover {
  transform: translateY(-4px) scale(1.02);
  border-color: var(--border-hover);
  box-shadow: var(--shadow-md), var(--shadow-glow);
}
```
**Files affected:** Calendar.css (`.calendar__stat:hover`), Fitness.css (`.fitness__stat:hover`), Shifts.css (`.shifts__stat:hover`)

**Action:** Replace all 3 with shared `.stat-card:hover`. Already have `.glass-card:hover` in pages.css with similar but not identical effect.

### 2. `src/styles/animations.css` (EXTEND)
Add shared keyframes that are duplicated.

#### 2a. Spinner Rotation (6 occurrences in 4 files)
```css
/* Already exists in Buttons.css as btnSpin */
/* Rename to shared: */
@keyframes spin {
  to { transform: rotate(360deg); }
}
.spin {
  animation: spin 0.8s linear infinite;
}
```
**Files affected:** Auth.css (`authSpin`), Calendar.css (`calendarSpin`, `calendar-spin`), Shifts.css (`shifts-spin`), Buttons.css (`btnSpin`)

**Action:** Remove all local `@keyframes *spin*` definitions. Use shared `spin` keyframe. Add `.spin` utility class.

#### 2b. Modal Slide-Up (5 files)
```css
/* Already in Sheet_modal.css as sheetModalSlideUp */
/* Reuse instead of duplicating per-page */
```
**Files affected:** Calendar.css (`calendarModalSlideUp`), Shifts.css (`shiftsModalSlideUp`), Profile.css (`profileModalSlideUp`), Color_palette_picker.css, Sheet_modal.css

**Action:** Each page CSS has its own copy of the same animation. Remove local copies, use `sheetModalSlideUp` from Sheet_modal.css (or move to animations.css).

#### 2c. Modal Center-In (4 files)
Same as above — `calendarModalCenterIn`, `shiftsModalCenterIn`, `profileModalCenterIn` are identical to `sheetModalCenterIn`.

**Action:** Consolidate into one shared keyframe.

#### 2d. Error Shake (3 files)
```css
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-6px); }
  75% { transform: translateX(6px); }
}
```
**Files affected:** Fitness.css (`fitnessErrorShake`), Shifts.css (`shifts-field-shake`), Form.css (`profile-field-shake`)

**Action:** Single `@keyframes shake` in animations.css. Remove local copies.

#### 2e. Card Remove Animation (3 files)
Fitness.css, Shifts.css, animations.css all have variants of the same "slide out and collapse" animation.

**Action:** Consolidate into animations.css with a shared `@keyframes cardRemove`.

### 3. `src/styles/Sheet_modal.css` (EXTEND)
The modal overlay/modal pattern is duplicated in Calendar.css, Shifts.css, Profile.css with their own `__overlay` and `__modal` classes.

**Current:** Each page has `*__overlay`, `*__modal`, `*__modal--closing`, `*__overlay--closing` with near-identical CSS.

**Action:** These are now handled by the shared `SheetModal` component. Remove all page-specific overlay/modal CSS from Calendar.css, Shifts.css, Profile.css. The shared Sheet_modal.css already handles everything.

**Lines removable:**
- Calendar.css: ~60 lines (`.calendar__overlay`, `.calendar__modal`, `.calendar__modal--closing`, `.calendar__overlay--closing`, related keyframes)
- Shifts.css: ~100 lines (`.shifts__overlay`, `.shifts__modal`, `.shifts__modal--closing`, `.shifts__overlay--closing`, `.shifts__modal--delete`, `.shifts__modal--picker`, etc.)
- Profile.css: ~60 lines (`.profile__overlay`, `.profile__modal`, `.profile__modal--closing`, `.profile__overlay--closing`)

### 4. `src/styles/Form.css` (EXTEND)
Form field patterns duplicated across pages.

#### 4a. Field Layout
```css
.form-field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}
```
Used in Calendar.css (`.calendar__field-row`), Shifts.css (`.shifts__time-row`), Profile.css (`.profile__height-row`, `.profile__weight-row`).

#### 4b. Error Field State
```css
.form-field--shake {
  animation: shake 0.4s ease-in-out;
}
```
Used in Shifts.css, Profile.css, Form.css.

### 5. `src/styles/pages.css` (EXTEND)
Already has `.page`, `.glass-card`, `.animate-in`, `.skeleton`. Add:

#### 5a. Card Stat Hover (merge with glass-card)
The `glass-card:hover` is close but not identical to the per-page stat hover. Align them.

## Summary: Lines Removable Per File

| File | Est. Lines Removable | What |
|---|---|---|
| Calendar.css | ~120 | modal/overlay, focus-visible, spinner, form layout |
| Shifts.css | ~180 | modal/overlay, focus-visible, spinner, form layout, error shake |
| Profile.css | ~100 | modal/overlay, focus-visible, spinner, form layout |
| Fitness.css | ~60 | focus-visible, error shake, page base, stat hover |
| Household.css | ~20 | page base, page header |
| Auth.css | ~30 | focus-visible, spinner, page header, form layout |
| Budgets.css | ~10 | form layout |
| HouseholdSpendee.css | ~15 | form layout |
| Form.css | ~10 | error shake |
| **Total** | **~545** | |

## Implementation Order

1. Create `src/styles/shared.css` with the utility classes above
2. Import it in `src/index.css` (alongside existing global styles)
3. For each page CSS file:
   a. Remove duplicated rules
   b. Add shared classes to JSX `className` where needed
   c. Keep only page-specific overrides
4. Consolidate keyframes into `animations.css`
5. Remove page-specific modal/overlay CSS (already handled by SheetModal component)
6. Verify with `npm run build`

## Important Notes

- **Don't break specificity.** Shared classes should have the same or lower specificity than what they replace. Use `.page-header` not `section .page-header`.
- **Keep page-specific overrides.** If Calendar's stat hover has a different shadow than Shifts', keep the override and only share the common base.
- **Test after each file.** Remove CSS from one file at a time and verify the page still looks correct.
- **CSS custom properties stay in index.css.** Don't move `:root` variables.
