# Fitness Feature — Fixes Applied

**Date:** 2026-07-26
**Reviewed by:** UI/UX Review + Code Review subagents

---

## Fix 1: Profile.jsx — Add gender and activity_level fields (WARN-1)

**File:** `src/components/Pages/profile/Profile.jsx`

**Changes:**
- Imported `ACTIVITY_LEVELS` and `GENDER_OPTIONS` from `../Fitness/macro_calculator`
- Added `gender: "male"` and `activity_level: "moderate"` to `emptyProfileForm`
- Updated `openProfileEdit` to populate `gender` and `activity_level` from profile data
- Added validation cases for `gender` and `activity_level` in `validateProfileField`
- Added `gender` and `activity_level` to `saveProfile` payload
- Added Gender `<FormField>` with `<select>` (options from `GENDER_OPTIONS`) before the hint text
- Added Activity Level `<FormField>` with `<select>` (options from `ACTIVITY_LEVELS` with labels + descriptions) before the hint text
- Both fields use the existing FormField pattern with `state`, `showIndicator`, `shake` props

---

## Fix 2: macro_calculator.js — Add fallback in calcTDEE (BUG-2)

**File:** `src/components/Pages/Fitness/macro_calculator.js`

**Changes:**
- Modified `calcTDEE` to return `Math.round(bmr * 1.55)` (moderate multiplier) when `activityLevel` is not found in `ACTIVITY_LEVELS`, instead of returning `null`
- Added comment: `// fallback to moderate`

**File:** `src/components/Pages/Fitness/DietTracker.jsx`

**Changes:**
- Added normalization of `activity_level` when reading from profile: checks if the value exists in `ACTIVITY_LEVELS`, falls back to `"moderate"` if not
- Uses `ACTIVITY_LEVELS.some()` lookup for validation

---

## Fix 3: supabase_fitness.sql — Add CHECK constraints (BUG-5, BUG-6)

**File:** `supabase_fitness.sql`

**Changes:**
- Added `CHECK (gender IN ('male', 'female'))` constraint to gender column
- Added `CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active'))` constraint to activity_level column

---

## Fix 4: Fitness.css — Fix CSS issues (UI/UX Review)

**File:** `src/components/Pages/Fitness/Fitness.css`

**Changes:**
1. **Filter font-family** — Added `font-family: inherit` to `.fitness__filter` (matches Shifts `.shifts__filter`)
2. **focus-visible** — Added `.fitness__filter select:focus-visible` rule with `outline: 2px solid var(--color-primary); outline-offset: 2px`
3. **Touch target** — Added `min-width: 44px; min-height: 44px` to `.fitness__exercise-remove`
4. **768px breakpoint** — Added `.fitness__filters { flex-wrap: wrap; }` to 768px media query
5. **768px breakpoint** — Changed `.fitness__summary` from `repeat(3, 1fr)` to `repeat(2, 1fr)` at 768px
6. **Diet stats grid** — Added `.fitness__diet .fitness__summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }` for 2×2 layout of 4 diet stat cards
7. **420px breakpoint** — Added new `@media (max-width: 420px)` block with tighter spacing for header, tabs, tab buttons, cards, stats, glass card values/labels, and macro inputs

---

## Fix 5: DietTracker.jsx — Fix loading flicker (WARN-5)

**File:** `src/components/Pages/Fitness/DietTracker.jsx`

**Changes:**
- Added `hasLoadedOnce = useRef(false)` ref (matches Profile.jsx pattern)
- Changed `setLoading(true)` in `fetchEntries` to only run when `!hasLoadedOnce.current`
- Set `hasLoadedOnce.current = true` after fetch completes
- Result: loading skeleton only shows on first load, not on date navigation

---

## Fix 6: WorkoutLogger.jsx — Sanitize preset exercises in applyPreset (BUG-1)

**File:** `src/components/Pages/Fitness/WorkoutLogger.jsx`

**Changes:**
- In `applyPreset`, added `sanitizeText(ex.name, 80)` when mapping preset exercises to form state
- Ensures exercise names from presets are sanitized before being displayed/used

---

## Fix 7: DietTracker.jsx — Add Today button aria-label (SUG-9)

**File:** `src/components/Pages/Fitness/DietTracker.jsx`

**Changes:**
- Added `aria-label="Go to today"` to the Today button in the date navigation

---

## Fix 8: WorkoutLogger.jsx — Add max exercise limit (WARN-9)

**File:** `src/components/Pages/Fitness/WorkoutLogger.jsx`

**Changes:**
- Added `if (form.exercises.length >= 20) return;` guard in `addExercise`
- Added `if (presetForm.exercises.length >= 20) return;` guard in `addPresetExercise`
- Limits both workout forms and preset forms to 20 exercises maximum

---

## Summary

| Fix | File(s) | Issue | Severity |
|-----|---------|-------|----------|
| 1 | Profile.jsx | Add gender/activity_level fields | HIGH |
| 2 | macro_calculator.js, DietTracker.jsx | calcTDEE fallback + normalization | MEDIUM |
| 3 | supabase_fitness.sql | CHECK constraints on gender/activity_level | MEDIUM |
| 4 | Fitness.css | 7 CSS fixes (font, responsive, touch targets) | MEDIUM |
| 5 | DietTracker.jsx | Loading flicker on date navigation | LOW |
| 6 | WorkoutLogger.jsx | Sanitize preset exercise names | LOW |
| 7 | DietTracker.jsx | Today button aria-label | LOW |
| 8 | WorkoutLogger.jsx | Max 20 exercises limit | LOW |
