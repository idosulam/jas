# JSX Modularization Plan

## Goal
Break the 8 largest page components into smaller, focused sub-components. Each extracted component stays in the same directory as its parent.

## Files to Create

### Profile (1,601 → ~800)
**Directory:** `src/components/Pages/profile/`

| New File | Extract From | Lines | What |
|---|---|---|---|
| `WeightForm.jsx` | Profile.jsx | ~150 | Weight entry modal form (the SheetModal with kg/lbs toggle, date, weight, note inputs) |
| `ProfileHistory.jsx` | Profile.jsx | ~100 | Weight history list (the `.profile__history` ul with items, edit/delete buttons) |
| `ProfileStats.jsx` | Profile.jsx | ~60 | Summary stat cards (the 4 glass-card stats: current, goal, BMI, streak) |
| `weight_utils.js` | Profile.jsx | ~80 | `buildInsight`, `daysBetween`, `healthyWeightRangeKg` — pure functions |

Already done: `WeightChart.jsx`, `ProfileOnboarding.jsx`

### Shifts (1,857 → ~700)
**Directory:** `src/components/Pages/Shifts/`

| New File | Extract From | Lines | What |
|---|---|---|---|
| `ShiftForm.jsx` | Shifts.jsx | ~250 | Add/edit shift form (place select, date, times, pay type, tips, notes, preview) |
| `ShiftDeleteConfirm.jsx` | Shifts.jsx | ~40 | Delete confirmation modal content (badge, date, amount preview) |
| `PlacePicker.jsx` | Shifts.jsx | ~80 | Filter-by-workplace picker sheet (the place filter pills + picker modal) |
| `ShiftPresets.jsx` | Shifts.jsx | ~60 | Quick-add preset chips (template chips + preset edit form) |
| `ShiftCard.jsx` | Shifts.jsx | ~100 | Individual shift card (badge, date, details, actions, note panel) |
| `shift_utils.js` | Shifts.jsx | ~40 | `getCurrentLocalTime`, `calculateHoursFromTimes`, `calcPay`, `formatMoney` |

### WorkoutLogger (1,327 → ~600)
**Directory:** `src/components/Pages/Fitness/`

| New File | Extract From | Lines | What |
|---|---|---|---|
| `WorkoutForm.jsx` | WorkoutLogger.jsx | ~200 | Add/edit workout form (preset select, date, exercise rows, notes) |
| `ExerciseRow.jsx` | WorkoutLogger.jsx | ~50 | Single exercise input row (name, sets, reps, weight, remove button) |
| `WorkoutCard.jsx` | WorkoutLogger.jsx | ~80 | Workout list card (preset badge, date, exercises, volume, actions) |
| `workout_utils.js` | WorkoutLogger.jsx | ~30 | `emptyExercise`, `emptyForm`, `calcVolume`, `formatVolume` |

### DietTracker (1,239 → ~700)
**Directory:** `src/components/Pages/Fitness/`

| New File | Extract From | Lines | What |
|---|---|---|---|
| `DietEntryForm.jsx` | DietTracker.jsx | ~150 | Add/edit food entry form (name, macros, meal select) |
| `MealGroup.jsx` | DietTracker.jsx | ~80 | Single meal section header + entry list |

Already done: `MacroProgressBar.jsx`

### Household (1,287 → ~600)
**Directory:** `src/components/Pages/Household/`

| New File | Extract From | Lines | What |
|---|---|---|---|
| `HouseholdInvite.jsx` | Household.jsx | ~200 | Create household / join with code / invite code display |
| `HouseholdStats.jsx` | Household.jsx | ~100 | Summary cards (income, expense, balance, shift stats) |
| `HouseholdShiftList.jsx` | Household.jsx | ~80 | Recent shifts list with earnings |

### Transactions (1,238 → ~600)
**Directory:** `src/components/Pages/Household/`

| New File | Extract From | Lines | What |
|---|---|---|---|
| `TransactionForm.jsx` | Transactions.jsx | ~200 | Add/edit transaction form (amount, category, type, date, note, goal) |
| `TransactionCard.jsx` | Transactions.jsx | ~60 | Single transaction row (icon, name, amount, category, actions) |
| `CategoryManager.jsx` | Transactions.jsx | ~100 | Category list with add/edit/delete |

### Calendar (1,201 → ~600)
**Directory:** `src/components/Pages/Calendar/`

| New File | Extract From | Lines | What |
|---|---|---|---|
| `EventForm.jsx` | Calendar.jsx | ~150 | Add/edit event form (title, date, times, color, notes) |
| `CalendarGrid.jsx` | Calendar.jsx | ~120 | Week/month day grid (the day selector with dots and labels) |
| `TimelineView.jsx` | Calendar.jsx | ~150 | Hour-by-hour timeline with events, now-line, wake-line |
| `ReminderList.jsx` | Calendar.jsx | ~60 | Reminder cards with check and delete |

### Auth (880 → ~400)
**Directory:** `src/components/Auth/`

| New File | Extract From | Lines | What |
|---|---|---|---|
| `AuthForm.jsx` | Auth.jsx | ~200 | Login/register/forgot form fields and submit logic |

Already done: `PasswordStrengthBar.jsx`

## Pattern for Each Extraction

1. Read the parent file and identify the JSX block to extract
2. Identify which state/props/callbacks the block depends on
3. Create the new component file with those as props
4. Replace the JSX block in the parent with `<NewComponent {...props} />`
5. Verify syntax (brace/paren balance)
6. Test one page at a time

## Props Passing Strategy

- **Simple data:** Pass as props (e.g. `entries`, `unit`, `goalKg` to WeightChart)
- **Callbacks:** Pass handler functions as props (e.g. `onSubmit`, `onDelete`, `onClose`)
- **State:** Keep state in parent, pass down. Only move state to child if it's self-contained.
- **Context:** Components that need `useUserId`, `useHousehold`, etc. can call hooks directly — don't pass context through props.

## Don't Extract

- Components that are <30 lines
- Components tightly coupled to parent state (would need 10+ props)
- JSX blocks that are just a few elements with no logic
