# Fitness Feature — Code Review

> Reviewed: 2026-07-26
> Reviewer: Code Pattern Reviewer (subagent)
> Scope: All new Fitness feature files + modified integration files

---

## ✅ What Follows Patterns Correctly

### Supabase Query Patterns
- ✅ All queries use `.eq("user_id", userId)` — consistent with Shifts/Profile/Workplaces
- ✅ `.select("*")` used on all read queries
- ✅ `.order("created_at", { ascending: true })` on preset fetches (matches Shifts pattern)
- ✅ Date-range filtering with `.gte()/.lte()` on workout_logs (same as Shifts)
- ✅ `.limit(1).maybeSingle()` on profile fetch in Fitness.jsx (matches Profile.jsx)
- ✅ `getUserFacingError()` on all error paths in all async operations
- ✅ Optimistic UI: `setRemovingId` + `setTimeout` removal after delete (WorkoutLogger line ~340, DietTracker line ~310)

### State Management
- ✅ `useCallback` on all fetcher functions: `fetchWorkouts`, `fetchPresets`, `fetchEntries`, `fetchProfile`
- ✅ `useCallback` on `savePreset`, `deletePreset` in both WorkoutLogger and DietTracker
- ✅ `useMemo` on `totals`/`dailyTotals`, `isFormValid`, `groupedEntries`, `yearOptions`
- ✅ Correct dependency arrays — `userId`, `month`, `year`, `selectedDate` included where needed

### Modal Lifecycle
- ✅ `useModal(MODAL_EXIT_MS)` with MODAL_EXIT_MS = 320 (same as Shifts)
- ✅ `setTimeout` cleanup after close: form state cleared after animation completes
- ✅ Separate modals for form, delete, preset — each with own `useModal` instance
- ✅ `useBodyScrollLock` called with all modal `.open` states

### Form Validation
- ✅ `validateField` function with switch/case pattern (matches Shifts)
- ✅ `handleFieldBlur` sets `fieldErrors` and `fieldStates` (matches Shifts)
- ✅ `shakeKey` + `hapticError()` on validation failure (matches Shifts)
- ✅ `isFormValid` `useMemo` disables submit button (matches Shifts/Workplaces)
- ✅ Full-form validation on submit as fallback (matches Shifts `handleSubmit`)
- ✅ FormField enhanced mode with `state`, `showIndicator`, `shake` props

### Security — Sanitization
- ✅ `sanitizeDate()` on all date inputs (WorkoutLogger, DietTracker)
- ✅ `sanitizeNumber()` on all numeric inputs with appropriate min/max bounds
- ✅ `sanitizeText()` on text inputs: exercise names (80), food names (120), notes (500)
- ✅ `getUserFacingError()` on all `.catch` and error branches
- ✅ `userId && { user_id: userId }` spread pattern on all payloads (matches Shifts)

### Toast Notifications
- ✅ `useGlassToast()` destructured as `{ success: toastSuccess, error: toastError }`
- ✅ `toastSuccess` on successful create/update/delete
- ✅ `toastError` on all failure paths with descriptive messages
- ✅ Toast messages match reference style: "Workout logged.", "Entry updated.", etc.

### Loading / Empty States
- ✅ `<LoadingSkeleton count={3} height="5.5rem" />` during loading (matches Shifts)
- ✅ `<EmptyState>` with SVG icon, title, text when list is empty
- ✅ Conditional rendering: loading → empty → list (same order as Shifts)

### Event Dispatching
- ✅ Not needed in Fitness (no cross-component dependencies like calendar sync)
- ✅ `fetchWorkouts`/`fetchEntries` called after CRUD to refresh local state

### CSS Quality
- ✅ `prefers-reduced-motion: reduce` media query (good accessibility)
- ✅ Responsive breakpoints at 768px and 640px
- ✅ CSS custom properties used (`--font-heading`, `--border`, `--radius`, etc.)
- ✅ `animation: fadeUp` with `--card-delay` for staggered card animations (matches Shifts)
- ✅ `@keyframes fitnessCardRemove` for deletion animation (matches Shifts pattern)
- ✅ Minimum touch target sizes (46px height on mobile selects, 44px min-height on actions)

### Nav Integration
- ✅ Nav_Fitness follows exact pattern of other nav items (Nav_Shifts, Nav_Calendar, etc.)
- ✅ `aria-current={isActive ? "page" : undefined}` for active state
- ✅ `aria-hidden="true"` on SVG icon
- ✅ App.jsx: lazy import, TAB_ORDER array, PAGES map — all correctly extended
- ✅ Navbar.jsx: NAV_ITEMS array extended with Fitness entry
- ✅ index.js: Fitness components exported

### SQL Structure
- ✅ All tables have `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- ✅ All tables have `user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE`
- ✅ All tables have `created_at timestamptz DEFAULT now()`
- ✅ RLS enabled on all 4 tables
- ✅ All 4 CRUD policies per table (SELECT, INSERT, UPDATE, DELETE)
- ✅ All policies use `auth.uid() = user_id` (correct RLS)
- ✅ INSERT policies use `WITH CHECK`, others use `USING` — correct syntax
- ✅ Performance indexes on `(user_id, workout_date)` and `(user_id, entry_date)`
- ✅ `CHECK` constraint on `meal_type` in diet_entries and diet_presets
- ✅ `ON DELETE CASCADE` on foreign keys ensures cleanup

### Macro Calculator
- ✅ Mifflin-St Jeor equation is **correctly implemented**:
  - Male: `10 × weight + 6.25 × height - 5 × age + 5` ✓
  - Female: `10 × weight + 6.25 × height - 5 × age - 161` ✓
- ✅ Activity level multipliers are standard: 1.2, 1.375, 1.55, 1.725, 1.9
- ✅ Macro split is reasonable: 2g/kg protein, 0.8g/kg fats, remainder as carbs
- ✅ `Math.max(0, ...)` on carbs prevents negative values if TDEE is very low
- ✅ Returns `null` gracefully when inputs are missing
- ✅ 25g fiber target aligns with general dietary guidelines

---

## 🐛 Bugs Found

### BUG-1: Exercise form inputs lack `sanitizeText`/`sanitizeNumber` on blur — XSS surface on presets
**File:** `WorkoutLogger.jsx` — `savePreset()` (line ~230)
**Issue:** When saving a preset, exercise names are sanitized with `sanitizeText(ex.name, 80)`, but the raw `presetForm.exercises` state is stored with unsanitized values. When `applyPreset()` copies exercises to the form, unsanitized text flows through. While `handleSubmit` sanitizes on workout save, the preset itself stores unsanitized data in the DB.
**Impact:** Low — the data is user's own, and sanitized on workout save. But stored preset data could contain HTML-like strings.
**Fix:** Sanitize exercise fields in `savePreset` payload (already done ✓), and also sanitize in `applyPreset`:

```js
const applyPreset = (preset) => {
  const exercises = Array.isArray(preset.exercises) && preset.exercises.length > 0
    ? preset.exercises.map((ex) => ({
        ...ex,
        name: sanitizeText(ex.name, 80),  // Add sanitization
      }))
    : [emptyExercise()];
  // ...
};
```

### BUG-2: `calcTDEE` can return null when `activityLevel` is not in ACTIVITY_LEVELS — macro dashboard shows stale data
**File:** `DietTracker.jsx` (line ~65) + `macro_calculator.js`
**Issue:** If `profileData.activity_level` contains an unexpected value (e.g., `"very active"` with a space instead of `"very_active"`), `calcTDEE` returns `null`, which causes `calcMacroTargets` to return `null`. The dashboard then shows the "Set up your profile" prompt even though the user has a complete profile.
**Impact:** Medium — confusing UX for users with non-standard activity_level values.
**Fix:** Add a fallback in `calcTDEE`:

```js
export function calcTDEE(bmr, activityLevel) {
  if (!bmr) return null;
  const level = ACTIVITY_LEVELS.find((l) => l.id === activityLevel);
  if (!level) return Math.round(bmr * 1.55); // fallback to moderate
  return Math.round(bmr * level.multiplier);
}
```

Or normalize the activity_level in DietTracker:

```js
const activityLevel = ACTIVITY_LEVELS.some(l => l.id === profile?.activity_level)
  ? profile.activity_level
  : "moderate";
```

### BUG-3: `confirmDelete` in WorkoutLogger sets `setDeleting(false)` before modal close animation finishes
**File:** `WorkoutLogger.jsx` — `confirmDelete()` (line ~335)
**Issue:** `setDeleting(false)` is called immediately after the DB delete succeeds, before `closeDeleteModal()` animation completes. This causes the ConfirmModal's `loading` prop to become `false` mid-animation, potentially showing the confirm button again briefly.
**Pattern match:** This is the same pattern used in Shifts.jsx, so it's a **pre-existing pattern inconsistency** rather than a new bug. But DietTracker does the same thing, so at least it's consistent within the Fitness feature.
**Severity:** Low — cosmetic flash at most.

### BUG-4: Diet entries can be created with empty `food_name` after sanitization strips all content
**File:** `DietTracker.jsx` — `handleSubmit()` (line ~290)
**Issue:** If `form.food_name` contains only HTML tags (e.g., `"<br><br>"`), `sanitizeText` will strip them and return `""`. The check `if (!foodName || !entryDate)` catches this, but the error message says "Enter food name" — the user might not understand why their input was rejected.
**Severity:** Low — edge case. The `sanitizeText` function strips HTML tags, so this only happens with markup-only input.

### BUG-5: No CHECK constraint on `gender` column in SQL — invalid values possible
**File:** `supabase_fitness.sql` (line ~115)
**Issue:** `ALTER TABLE profile ADD COLUMN IF NOT EXISTS gender text DEFAULT 'male'` has no CHECK constraint. A user could insert `"other"` or `""` via direct API call, which would cause `calcBMR` to use the male formula (since `gender !== "female"`).
**Fix:** Add constraint:

```sql
ALTER TABLE profile ADD COLUMN IF NOT EXISTS gender text DEFAULT 'male'
  CHECK (gender IN ('male', 'female'));
```

### BUG-6: No CHECK constraint on `activity_level` column — invalid values cause TDEE=null
**File:** `supabase_fitness.sql` (line ~116)
**Issue:** Similar to BUG-5. Invalid activity_level values bypass the ACTIVITY_LEVELS lookup, causing `calcTDEE` to return null.
**Fix:**

```sql
ALTER TABLE profile ADD COLUMN IF NOT EXISTS activity_level text DEFAULT 'moderate'
  CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active'));
```

---

## ⚠️ Warnings

### WARN-1: Profile.jsx doesn't expose `gender` and `activity_level` fields in the edit form
**File:** `Profile.jsx` (reference)
**Issue:** DietTracker reads `profile.gender` and `profile.activity_level` for BMR/TDEE calculations, but the Profile edit form (`openProfileEdit`, `saveProfile`) doesn't include fields for gender or activity level. Users have no way to set these values through the UI.
**Impact:** **High** — the macro dashboard will always show "Set up your profile" or use defaults (`"male"`, `"moderate"`) unless the user manually sets values in the database.
**Action required:** Add gender and activity_level fields to Profile.jsx's edit form and `saveProfile` payload.

### WARN-2: Diet entries have no unique constraint on `(user_id, entry_date, meal_type, food_name)`
**File:** `supabase_fitness.sql`
**Issue:** Unlike weight_entries (which has `ON CONFLICT (user_id, entry_date)`), diet entries have no duplicate prevention. A user could log the exact same food item multiple times for the same meal.
**Impact:** Low — may be intentional (users might eat the same food twice). But no dedup logic exists.

### WARN-3: `workout_logs` has no unique constraint on `(user_id, workout_date)`
**File:** `supabase_fitness.sql`
**Issue:** Multiple workouts can be logged for the same date. This is likely intentional (e.g., morning + evening sessions), but worth confirming.
**Impact:** Low — probably correct behavior.

### WARN-4: Exercise form inputs don't use `FormField` component — inconsistent with pattern
**File:** `WorkoutLogger.jsx` — exercise rows in form
**Issue:** The exercise name, weight, sets, reps inputs are raw `<input>` elements without `<FormField>` wrapper. The reference pattern (Shifts, Workplaces) wraps all inputs in `<FormField>` with error/state/shake props. This means exercise fields lack:
- Error indicators (FieldIndicator)
- Animated error text (FieldError)
- Shake animation on validation failure
- Consistent label styling
**Impact:** Medium — UX inconsistency. The exercises section has its own error display (`fieldErrors.exercises` shown as plain text), but individual exercise fields don't get visual feedback.

### WARN-5: `fetchEntries` triggers `setLoading(true)` on every date change — potential flicker
**File:** `DietTracker.jsx` — `fetchEntries()`
**Issue:** Every time the user navigates dates (prev/next day), `setLoading(true)` is called, which shows the loading skeleton briefly. For fast networks, this causes a visible flash. Profile.jsx avoids this with `hasLoadedOnce` ref.
**Fix:** Add a `hasLoadedOnce` ref like Profile.jsx:

```js
const hasLoadedOnce = useRef(false);
// In fetchEntries:
if (!hasLoadedOnce.current) setLoading(true);
// After fetch:
hasLoadedOnce.current = true;
```

### WARN-6: `fetchWorkouts` in WorkoutLogger triggers loading skeleton on month/year change
**File:** `WorkoutLogger.jsx` — `fetchWorkouts()`
**Issue:** Same as WARN-5. Changing month shows loading skeleton even for instant responses.
**Impact:** Low — month changes are less frequent than date navigation.

### WARN-7: CSS `fitness__exercise-name` and `fitness__exercise-input` set `font-size: 16px` only on mobile
**File:** `Fitness.css` (line ~640 breakpoint)
**Issue:** On mobile Safari, inputs with font-size < 16px auto-zoom on focus. The CSS correctly adds `font-size: 16px` at the 640px breakpoint, but the base styles use `0.9rem` and `0.85rem` which could be < 16px on some devices. This is handled correctly in the responsive section ✓, just noting it's intentional.

### WARN-8: No `updated_at` column on fitness tables
**File:** `supabase_fitness.sql`
**Issue:** The `profile` table has `updated_at`, but workout_logs, workout_presets, diet_entries, and diet_presets only have `created_at`. This makes it impossible to know when a record was last edited.
**Impact:** Low — not critical for the feature, but useful for debugging and future features (e.g., "last edited" display).

### WARN-9: `presetForm.exercises` in WorkoutLogger can grow unbounded
**File:** `WorkoutLogger.jsx`
**Issue:** No limit on how many exercises can be added to a preset. A user could add 100+ exercises, creating a large JSONB payload. Same applies to the workout form.
**Impact:** Low — unlikely in practice, but no guard rail exists.
**Fix:** Add a max exercise limit (e.g., 20):

```js
const addExercise = () => {
  if (form.exercises.length >= 20) return;
  // ...
};
```

### WARN-10: DietTracker doesn't dispatch a custom event after CRUD operations
**File:** `DietTracker.jsx`
**Issue:** Unlike Shifts (which dispatches `"shifts:refresh"` and `"calendar:refresh"`), DietTracker doesn't dispatch any events. If another component ever needs to react to diet data changes, there's no mechanism.
**Impact:** Low — currently no cross-component dependency exists for diet data.

---

## 💡 Suggestions

### SUG-1: Extract shared exercise input component
Both WorkoutLogger and DietTracker have inline exercise/food input rows. Consider extracting a reusable `<ExerciseRow>` component to reduce duplication and ensure consistent styling/validation.

### SUG-2: Add `onBlur` sanitization to exercise and food name inputs
Currently, raw values are stored in state and only sanitized on submit. Adding `onBlur` handlers that call `sanitizeText` would prevent visual glitches when HTML-like text is entered:

```js
onBlur={(e) => {
  const cleaned = sanitizeText(e.target.value, 80);
  updateExercise(i, "name", cleaned);
}}
```

### SUG-3: Add `autoComplete="off"` to exercise and food name inputs
The reference (Workplaces) uses `autoComplete="off"` on text inputs. Exercise names and food names should also disable autocomplete to avoid browser suggestions interfering:

```html
<input type="text" autoComplete="off" ... />
```

### SUG-4: Add a "Copy workout" action (like Shifts has "Copy shift to today")
Shifts has a "Copy" action that duplicates a shift to today's date. WorkoutLogger could benefit from the same feature for repeating workouts.

### SUG-5: Consider debouncing `fetchEntries` on date change
When rapidly clicking prev/next day, each click triggers a Supabase query. Adding a 200ms debounce would prevent unnecessary requests:

```js
const debouncedFetch = useMemo(
  () => debounce(fetchEntries, 200),
  [fetchEntries]
);
```

### SUG-6: Add `meal_type` CHECK constraint with proper error message
The current CHECK constraint on `meal_type` will throw a raw Postgres error if violated. Consider adding a more descriptive constraint name:

```sql
CONSTRAINT valid_meal_type CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack'))
```

### SUG-7: Add fiber to the daily summary cards
The DietTracker summary shows Calories, Protein, Carbs, Fats but omits Fiber. Since fiber has a target (25g) and a progress bar, adding it to the summary would provide consistency:

```jsx
<GlassCard value={`${Math.round(dailyTotals.fiber)}g`} label="Fiber" ... />
```

### SUG-8: Add `numeric` precision constraints to diet columns
The `calories`, `protein_g`, etc. columns are `numeric` with no precision/scale. This allows values like `999999999.999999`. Consider:

```sql
calories numeric(7,1) DEFAULT 0,
protein_g numeric(6,1) DEFAULT 0,
```

### SUG-9: Add `aria-label` to the date navigation buttons in DietTracker
The prev/next day buttons have `aria-label` ✓, but the "Today" button doesn't:

```jsx
<button type="button" className="fitness__date-today" onClick={...} aria-label="Go to today">
  Today
</button>
```

### SUG-10: Consider adding `NOT NULL` to `workout_logs.duration_minutes`
Currently `duration_minutes` is nullable. If the intent is "duration is optional," the null handling is correct. But if most workouts should have a duration, consider a default of 0:

```sql
duration_minutes int NOT NULL DEFAULT 0,
```

---

## Summary

| Category | Count |
|----------|-------|
| ✅ Pattern matches | 45+ |
| 🐛 Bugs | 6 (2 medium, 4 low) |
| ⚠️ Warnings | 10 (1 high, 3 medium, 6 low) |
| 💡 Suggestions | 10 |

### Critical Action Items
1. **WARN-1 (HIGH):** Add `gender` and `activity_level` fields to Profile.jsx edit form — without this, the macro dashboard is essentially non-functional for most users
2. **BUG-5 + BUG-6:** Add CHECK constraints on `gender` and `activity_level` columns in SQL
3. **BUG-2:** Normalize `activity_level` with fallback to prevent silent TDEE calculation failure

### Overall Assessment
The Fitness feature follows the existing codebase patterns **very well**. The Supabase query patterns, modal lifecycle, form validation, security sanitization, toast notifications, and error handling are all consistent with Shifts/Profile/Workplaces. The SQL schema is well-structured with proper RLS policies and indexes. The macro calculator uses correct formulas. The main gap is the missing Profile form fields for gender/activity_level, which blocks the BMR/TDEE feature from working in practice.
