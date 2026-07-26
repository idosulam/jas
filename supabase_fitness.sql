-- ============================================================
-- Fitness Feature — Supabase SQL
-- Tables: workout_presets, workout_logs, diet_entries, diet_presets
-- Profile extensions: gender, activity_level
-- ============================================================

-- ── Workout Presets ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workout_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  exercises jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE workout_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own workout presets"
  ON workout_presets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own workout presets"
  ON workout_presets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workout presets"
  ON workout_presets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workout presets"
  ON workout_presets FOR DELETE
  USING (auth.uid() = user_id);

-- ── Workout Logs ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workout_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_date date NOT NULL,
  preset_name text,
  exercises jsonb NOT NULL DEFAULT '[]',
  notes text,
  duration_minutes int,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own workout logs"
  ON workout_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own workout logs"
  ON workout_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workout logs"
  ON workout_logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workout logs"
  ON workout_logs FOR DELETE
  USING (auth.uid() = user_id);

-- ── Diet Entries ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS diet_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  meal_type text NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  food_name text NOT NULL,
  calories numeric DEFAULT 0,
  protein_g numeric DEFAULT 0,
  carbs_g numeric DEFAULT 0,
  fats_g numeric DEFAULT 0,
  fiber_g numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE diet_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own diet entries"
  ON diet_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own diet entries"
  ON diet_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own diet entries"
  ON diet_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own diet entries"
  ON diet_entries FOR DELETE
  USING (auth.uid() = user_id);

-- ── Diet Presets (Saved Meals) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS diet_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  meal_type text CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  calories numeric DEFAULT 0,
  protein_g numeric DEFAULT 0,
  carbs_g numeric DEFAULT 0,
  fats_g numeric DEFAULT 0,
  fiber_g numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE diet_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own diet presets"
  ON diet_presets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own diet presets"
  ON diet_presets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own diet presets"
  ON diet_presets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own diet presets"
  ON diet_presets FOR DELETE
  USING (auth.uid() = user_id);

-- ── Profile Extensions ─────────────────────────────────────────

ALTER TABLE profile ADD COLUMN IF NOT EXISTS gender text DEFAULT 'male'
  CHECK (gender IN ('male', 'female'));
ALTER TABLE profile ADD COLUMN IF NOT EXISTS activity_level text DEFAULT 'moderate'
  CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active'));

-- ── Indexes for performance ────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_workout_logs_user_date
  ON workout_logs (user_id, workout_date);

CREATE INDEX IF NOT EXISTS idx_diet_entries_user_date
  ON diet_entries (user_id, entry_date);

CREATE INDEX IF NOT EXISTS idx_workout_presets_user
  ON workout_presets (user_id);

CREATE INDEX IF NOT EXISTS idx_diet_presets_user
  ON diet_presets (user_id);
