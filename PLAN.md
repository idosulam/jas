# Implementation Plan: Goals/Budgets Toggle, Tab Removal & Empty States

## Overview

Three changes to the Household page:
1. **Merge Budgets into Overview tab** — alongside Savings Goals with a sliding toggle
2. **Remove Budgets as a separate tab** — clean up tab nav
3. **Add consistent empty states** — using the existing `EmptyState` component across all sections

---

## Architecture Summary (Current State)

- **Sliding toggle pattern** already exists in `Transactions.jsx` (Expense/Income/Contribute) — uses `useRef` + `getBoundingClientRect` + CSS `transform` transitions on an absolutely-positioned indicator
- **Tab sliding indicator** in `Household.jsx` — same technique for tab nav
- **Budgets** is a standalone component rendered in its own tab (`activeTab === "budgets"`)
- **SavingsGoals** is rendered inside the Overview tab
- **EmptyState** is a reusable component at `src/components/ui/Empty_state.jsx`

---

## Step-by-Step Plan

### Step 1: Create the Goals/Budgets Sliding Toggle Component (inline in Household.jsx)

**File:** `src/components/Pages/Household/Household.jsx`

Add a new sub-view toggle inside the Overview tab, positioned right after the Savings Goals section header. This replaces the current standalone Savings Goals section with a combined "Goals | Budgets" toggle section.

**Changes:**

1. Add state for the sub-view:
   ```js
   const [savingsSubView, setSavingsSubView] = useState("goals"); // "goals" | "budgets"
   ```

2. Add refs for the sliding indicator (same pattern as Transactions.jsx):
   ```js
   const savingsToggleRef = useRef(null);
   const savingsBtnRefs = useRef({});
   const [savingsIndicatorStyle, setSavingsIndicatorStyle] = useState({ left: 0, width: 0 });
   ```

3. Add useEffect to measure and update indicator position:
   ```js
   useEffect(() => {
     const btn = savingsBtnRefs.current[savingsSubView];
     const container = savingsToggleRef.current;
     if (btn && container) {
       const containerRect = container.getBoundingClientRect();
       const btnRect = btn.getBoundingClientRect();
       setSavingsIndicatorStyle({
         left: btnRect.left - containerRect.left,
         width: btnRect.width,
       });
     }
   }, [savingsSubView]);
   ```

4. Replace the current `household__savings-section` in the Overview tab with:
   ```jsx
   <div className="household__savings-section">
     {/* Toggle Header */}
     <div className="household__goals-budgets-toggle" ref={savingsToggleRef}>
       <span
         className={`household__goals-budgets-indicator ${savingsSubView}`}
         style={{
           transform: `translateX(${savingsIndicatorStyle.left}px)`,
           width: `${savingsIndicatorStyle.width}px`,
         }}
       />
       <button
         ref={(el) => { if (el) savingsBtnRefs.current["goals"] = el; }}
         className={`household__goals-budgets-btn ${savingsSubView === "goals" ? "household__goals-budgets-btn--active goals" : ""}`}
         onClick={() => setSavingsSubView("goals")}
       >
         💰 Goals
       </button>
       <button
         ref={(el) => { if (el) savingsBtnRefs.current["budgets"] = el; }}
         className={`household__goals-budgets-btn ${savingsSubView === "budgets" ? "household__goals-budgets-btn--active budgets" : ""}`}
         onClick={() => setSavingsSubView("budgets")}
       >
         📊 Budgets
       </button>
     </div>

     {/* Sub-view Content */}
     {savingsSubView === "goals" && (
       <SavingsGoals
         householdId={household?.id}
         userId={userId}
         members={members}
       />
     )}
     {savingsSubView === "budgets" && (
       <Budgets
         householdId={household?.id}
         transactions={allTransactions}
         month={month}
         year={year}
       />
     )}
   </div>
   ```

5. **Remove** the `{activeTab === "budgets" && ...}` block from the tab content area.

6. **Remove** the budgets tab from the `TABS` array:
   ```js
   const TABS = [
     { id: "overview", label: "Overview", icon: "📊" },
     { id: "transactions", label: "Transactions", icon: "💳" },
     // { id: "budgets", ... }  ← REMOVE
     { id: "recurring", label: "Recurring", icon: "🔄" },
     { id: "analytics", label: "Analytics", icon: "📈" },
   ];
   ```

7. Also remove the `Budgets.css` import if all budget styles are already loaded (they are — `Budgets.css` is already imported at the top of Household.jsx).

---

### Step 2: CSS for the Goals/Budgets Toggle

**File:** `src/components/Pages/Household/Household.css`

Add the following styles, reusing the exact same sliding indicator pattern from `HouseholdSpendee.css`:

```css
/* ── Goals / Budgets Toggle ─────────────────────────────────── */

.household__goals-budgets-toggle {
  position: relative;
  display: flex;
  padding: 0.3rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  gap: 0.3rem;
  margin-bottom: 1rem;
}

.household__goals-budgets-indicator {
  position: absolute;
  top: 0.3rem;
  bottom: 0.3rem;
  left: 0;
  border-radius: 999px;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
              width 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
              background 0.2s ease;
  pointer-events: none;
  z-index: 0;
}

.household__goals-budgets-indicator.goals {
  background: rgba(52, 211, 153, 0.12);
}

.household__goals-budgets-indicator.budgets {
  background: rgba(129, 140, 248, 0.12);
}

.household__goals-budgets-btn {
  flex: 1;
  padding: 0.5rem;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  font-weight: 700;
  font-size: 0.8rem;
  cursor: pointer;
  transition: color 0.2s ease;
  position: relative;
  z-index: 1;
}

.household__goals-budgets-btn:hover {
  color: rgba(255, 255, 255, 0.8);
}

.household__goals-budgets-btn--active.goals {
  color: #34d399;
}

.household__goals-budgets-btn--active.budgets {
  color: #818cf8;
}
```

---

### Step 3: Remove Budgets Tab from Tab Navigation

**File:** `src/components/Pages/Household/Household.jsx`

Already covered in Step 1 — remove from `TABS` array and remove the `{activeTab === "budgets" && ...}` render block.

Also consider: the `Budgets` import at the top of Household.jsx is still needed (it's now rendered inline in Overview). Keep the import.

---

### Step 4: Add Empty States to All Sections

#### 4a. Savings Goals — Enhanced Empty State

**File:** `src/components/Pages/Household/SavingsGoals.jsx`

Current state: simple `<p>` tag with text. Replace with `EmptyState` component.

**Changes:**

1. Import `EmptyState`:
   ```js
   import EmptyState from "../../ui/Empty_state";
   ```

2. Replace the empty state JSX:
   ```jsx
   // BEFORE:
   <p className="savings-goals__empty">
     No savings goals yet. Create one to start tracking together!
   </p>

   // AFTER:
   <EmptyState
     className="savings-goals__empty-state"
     icon={<span style={{ fontSize: "2rem" }}>🎯</span>}
     title="No savings goals yet"
     text="Create a goal to start tracking your savings together!"
     action={
       <button type="button" className="btn btn--primary btn--sm" onClick={openNewGoal}>
         + Create goal
       </button>
     }
   />
   ```

#### 4b. Budgets — Enhanced Empty State

**File:** `src/components/Pages/Household/Budgets.jsx`

Current state: simple `<span>` and `<p>` with emoji. Replace with `EmptyState`.

**Changes:**

1. Import `EmptyState`:
   ```js
   import EmptyState from "../../ui/Empty_state";
   ```

2. Replace the empty state block:
   ```jsx
   // BEFORE:
   {categoryBudgets.length === 0 && (
     <div className="budgets__empty">
       <span className="budgets__empty-icon">📊</span>
       <p>No expense categories yet.</p>
       <span>Create categories in the Transactions tab first.</span>
     </div>
   )}

   // AFTER:
   {categoryBudgets.length === 0 && (
     <EmptyState
       className="budgets__empty-state"
       icon={
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 32, height: 32 }}>
           <path d="M3 3v18h18" />
           <path d="M7 16l4-8 4 4 4-6" />
         </svg>
       }
       title="No budgets set yet"
       text="Set monthly budgets for your expense categories to stay on track."
       action={
         <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.35)" }}>
           Add expense categories in the Transactions tab first.
         </p>
       }
     />
   )}
   ```

3. Also add an empty state for when there are categories but **no budgets set** (all unbudgeted). Currently this falls through to showing categories with "Set budget →". Keep that UX, but if the user wants a more prominent prompt, we can add a subtle hint above the category list:
   ```jsx
   {/* Show when categories exist but none have budgets */}
   {budgeted.length === 0 && categoryBudgets.length > 0 && (
     <EmptyState
       className="budgets__empty-state"
       icon={<span style={{ fontSize: "2rem" }}>📊</span>}
       title="Set your first budget"
       text="Tap a category below to set a monthly spending limit."
     />
   )}
   ```

#### 4c. Earnings Chart — Enhanced Empty State

**File:** `src/components/Pages/Household/EarningsChart.jsx`

Check if this component has its own empty state. Based on the CSS class `earnings-chart__empty`, it does. Enhance it with `EmptyState` if desired, or leave as-is since it's inline SVG.

**Recommendation:** Leave the chart empty state as-is — it's contextually fine within the chart wrapper.

#### 4d. Transactions Empty State

**File:** `src/components/Pages/Household/Transactions.jsx`

Current state: simple `<p>` and `<span>`. Enhance:

```jsx
// BEFORE:
<div className="transactions__empty">
  <p>No transactions this month</p>
  <span>Add an expense, income, or contribution to get started.</span>
</div>

// AFTER:
<EmptyState
  className="transactions__empty-state"
  icon={<span style={{ fontSize: "2rem" }}>💳</span>}
  title="No transactions this month"
  text="Add an expense, income, or contribution to get started."
  action={
    <button type="button" className="btn btn--primary btn--sm" onClick={() => openAdd("expense")}>
      + Add transaction
    </button>
  }
/>
```

Import `EmptyState` in Transactions.jsx:
```js
import EmptyState from "../../ui/Empty_state";
```

#### 4e. Household Empty State (no household)

Already uses `EmptyState` component — no changes needed.

---

### Step 5: Update SavingsGoals Header for Toggle Context

**File:** `src/components/Pages/Household/SavingsGoals.jsx`

Since the toggle header now lives in `Household.jsx`, remove the section title from `SavingsGoals.jsx` to avoid duplication:

```jsx
// BEFORE:
<div className="savings-goals__header">
  <h3 className="household__section-title">💰 Savings Goals</h3>
  <button ...>+ New goal</button>
</div>

// AFTER:
<div className="savings-goals__header">
  {/* Title removed — now handled by parent toggle */}
  <div style={{ flex: 1 }} />
  <button ...>+ New goal</button>
</div>
```

Or better: pass a prop `hideTitle` and conditionally render:
```jsx
{!hideTitle && <h3 className="household__section-title">💰 Savings Goals</h3>}
```

And in Household.jsx:
```jsx
<SavingsGoals ... hideTitle />
```

Same for `Budgets.jsx` — remove the section title "📊 January Budget" header from the Budgets component since the parent toggle handles context. Or keep the budget summary header (it shows month-specific data) and just remove the top-level title.

**Decision:** Keep the Budgets summary header (it has month-specific budget info). Remove only the SavingsGoals top-level title.

---

### Step 6: Remove Unused Budget Tab CSS

**File:** `src/components/Pages/Household/Household.css`

No cleanup needed — the tab indicator CSS is generic and still used by the remaining tabs. The `household__budget-overview` compact widget on Overview can stay (it shows a quick budget summary even when not in the budgets sub-view).

---

## Files Modified (Summary)

| File | Changes |
|------|---------|
| `Household.jsx` | Add toggle state/refs/useEffect, replace savings section with toggle, remove budgets tab from TABS array, remove budgets tab content render |
| `Household.css` | Add `.household__goals-budgets-toggle` and related sliding indicator styles |
| `SavingsGoals.jsx` | Import EmptyState, replace empty `<p>` with EmptyState component, add `hideTitle` prop |
| `Budgets.jsx` | Import EmptyState, replace empty div with EmptyState component |
| `Transactions.jsx` | Import EmptyState, replace empty div with EmptyState component |

---

## CSS Animation Details

The sliding indicator uses the same proven pattern from the Transactions toggle:

```
transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
            width 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
            background 0.2s ease;
```

- `cubic-bezier(0.34, 1.56, 0.64, 1)` — spring/bounce effect on the slide
- `transform: translateX(...)` — moves the pill indicator
- `width` — adapts to button width differences
- `background` — color transitions between green (goals) and purple (budgets)

---

## Visual Layout (After Changes)

```
┌─────────────────────────────────────┐
│ Overview Tab                         │
│                                      │
│ [Income] [Expenses] [Balance]        │
│                                      │
│ 💰 Budget: ₪1200/₪2000             │
│                                      │
│ Shift Earnings ...                   │
│ Per Member ...                       │
│ Today ...                            │
│ Daily Earnings Chart ...             │
│                                      │
│ ┌─────────────────────────────────┐ │
│ │ [💰 Goals] [📊 Budgets]        │ │ ← Sliding toggle
│ └─────────────────────────────────┘ │
│                                      │
│ (Goals view or Budgets view)        │
│                                      │
└─────────────────────────────────────┘

Tab Nav: [Overview] [Transactions] [Recurring] [Analytics]
                                         ↑ Budgets tab removed
```

---

## Implementation Order

1. **Step 1** — Household.jsx: Add toggle, remove tab (biggest change)
2. **Step 2** — Household.css: Add toggle styles
3. **Step 5** — SavingsGoals.jsx: Add `hideTitle` prop
4. **Step 4** — All components: Add EmptyState imports and replace empty states
5. **Test** — Verify toggle animation, tab removal, empty states render correctly
