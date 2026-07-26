# Fitness & Nutrition Feature - Implementation Plan

## Overview
Add a new "Fitness" tab to the JAS app with:
1. **Workout Logger** - Track exercises with weight, sets, reps + save presets
2. **Diet/Nutrition Tracker** - BMR calculator, macro targets, daily food logging
3. **Auto-calculations** - BMR/TDEE/macro targets based on age, weight, height, gender from Profile

## Architecture

### New Files to Create
```
src/components/Pages/Fitness/
├── Fitness.jsx          # Main page with sub-tabs (Workouts | Diet)
├── Fitness.css          # All Fitness-specific styles
├── WorkoutLogger.jsx    # Workout tracking + presets
├── DietTracker.jsx      # Diet logging + BMR/macro display
└── macro_calculator.js  # BMR/TDEE/macro calculation utilities
```

### Files to Modify
- `src/App.jsx` — Add Fitness to PAGES + TAB_ORDER
- `src/components/navbar/Navbar.jsx` — Add Nav_Fitness
- `src/components/navbar/Nav_Fitness.jsx` — New nav icon (create)
- `src/components/index.js` — Export new components

### Supabase Tables Needed (SQL)

```sql
-- Workout presets (like shift_presets)
CREATE TABLE workout_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  name text NOT NULL,
  exercises jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

-- Workout logs
CREATE TABLE workout_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  workout_date date NOT NULL,
  preset_name text,
  exercises jsonb NOT NULL DEFAULT '[]',
  notes text,
  duration_minutes int,
  created_at timestamptz DEFAULT now()
);

-- Diet entries (daily food log)
CREATE TABLE diet_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  entry_date date NOT NULL,
  meal_type text NOT NULL, -- breakfast/lunch/dinner/snack
  food_name text NOT NULL,
  calories numeric DEFAULT 0,
  protein_g numeric DEFAULT 0,
  carbs_g numeric DEFAULT 0,
  fats_g numeric DEFAULT 0,
  fiber_g numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Diet presets (saved meals)
CREATE TABLE diet_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  name text NOT NULL,
  meal_type text,
  calories numeric DEFAULT 0,
  protein_g numeric DEFAULT 0,
  carbs_g numeric DEFAULT 0,
  fats_g numeric DEFAULT 0,
  fiber_g numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Add gender to profile table
ALTER TABLE profile ADD COLUMN IF NOT EXISTS gender text DEFAULT 'male';
ALTER TABLE profile ADD COLUMN IF NOT EXISTS activity_level text DEFAULT 'moderate';
```

### BMR Calculation (Mifflin-St Jeor)
- Male: BMR = 10 × weight(kg) + 6.25 × height(cm) − 5 × age − 161 + 166
  Simplified: BMR = 10 × weight + 6.25 × height − 5 × age + 5
- Female: BMR = 10 × weight + 6.25 × height − 5 × age − 161

### Activity Multipliers
- Sedentary (1.2)
- Light (1.375)
- Moderate (1.55)
- Active (1.725)
- Very Active (1.9)

### Macro Targets (default split)
- Protein: 2g per kg bodyweight
- Fats: 0.8g per kg bodyweight  
- Carbs: remaining calories / 4
- Fiber: 25-30g target

### UI Design (matching existing patterns)
- Uses `PageHeader`, `GlassCard`, `SheetModal`, `FormField`, `FAB`, `EmptyState`, `Badge`
- Sub-tab toggle using the sliding indicator pattern from Household/Transactions
- Cards with same glass-card styling
- Form validation with shake + field errors (FormField enhanced mode)
- Animations: `animate-in`, `fadeUp`, same keyframes
- Color scheme: green (#34d399) for workouts, blue (#60a5fa) for diet
