-- ============================================================
-- MIGRATION: Add per-user isolation to all tables
-- Run this ONCE in the Supabase SQL Editor after enabling Auth.
-- ============================================================

-- ── 1. Add user_id columns ──────────────────────────────────

ALTER TABLE public.workplaces
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.shift_presets
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.weight_entries
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.profile
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Indexes for user_id lookups
CREATE INDEX IF NOT EXISTS idx_workplaces_user_id ON public.workplaces(user_id);
CREATE INDEX IF NOT EXISTS idx_shifts_user_id ON public.shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_shift_presets_user_id ON public.shift_presets(user_id);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON public.events(user_id);
CREATE INDEX IF NOT EXISTS idx_weight_entries_user_id ON public.weight_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_user_id ON public.profile(user_id);

-- Make workplaces.slug unique per user (drop old global unique, add composite)
ALTER TABLE public.workplaces DROP CONSTRAINT IF EXISTS workplaces_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS workplaces_user_slug ON public.workplaces(user_id, slug);

-- Make weight_entries.entry_date unique per user
ALTER TABLE public.weight_entries DROP CONSTRAINT IF EXISTS weight_entries_entry_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS weight_entries_user_date ON public.weight_entries(user_id, entry_date);

-- ── 2. Drop old public policies ─────────────────────────────

-- workplaces
DROP POLICY IF EXISTS "Allow public read on workplaces" ON public.workplaces;
DROP POLICY IF EXISTS "Allow public insert on workplaces" ON public.workplaces;
DROP POLICY IF EXISTS "Allow public update on workplaces" ON public.workplaces;
DROP POLICY IF EXISTS "Allow public delete on workplaces" ON public.workplaces;

-- shifts
DROP POLICY IF EXISTS "Allow public read on shifts" ON public.shifts;
DROP POLICY IF EXISTS "Allow public insert on shifts" ON public.shifts;
DROP POLICY IF EXISTS "Allow public update on shifts" ON public.shifts;
DROP POLICY IF EXISTS "Allow public delete on shifts" ON public.shifts;

-- shift_presets
DROP POLICY IF EXISTS "Allow public read on shift_presets" ON public.shift_presets;
DROP POLICY IF EXISTS "Allow public insert on shift_presets" ON public.shift_presets;
DROP POLICY IF EXISTS "Allow public update on shift_presets" ON public.shift_presets;
DROP POLICY IF EXISTS "Allow public delete on shift_presets" ON public.shift_presets;

-- events
DROP POLICY IF EXISTS "Allow public read on events" ON public.events;
DROP POLICY IF EXISTS "Allow public insert on events" ON public.events;
DROP POLICY IF EXISTS "Allow public update on events" ON public.events;
DROP POLICY IF EXISTS "Allow public delete on events" ON public.events;

-- weight_entries
DROP POLICY IF EXISTS "Allow public read on weight_entries" ON public.weight_entries;
DROP POLICY IF EXISTS "Allow public insert on weight_entries" ON public.weight_entries;
DROP POLICY IF EXISTS "Allow public update on weight_entries" ON public.weight_entries;
DROP POLICY IF EXISTS "Allow public delete on weight_entries" ON public.weight_entries;

-- profile
DROP POLICY IF EXISTS "Allow public read on profile" ON public.profile;
DROP POLICY IF EXISTS "Allow public insert on profile" ON public.profile;
DROP POLICY IF EXISTS "Allow public update on profile" ON public.profile;

-- ── 3. Create per-user RLS policies ─────────────────────────

-- === workplaces ===
CREATE POLICY "Users can read own workplaces"
  ON public.workplaces FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workplaces"
  ON public.workplaces FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workplaces"
  ON public.workplaces FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own workplaces"
  ON public.workplaces FOR DELETE
  USING (auth.uid() = user_id);

-- === shifts ===
CREATE POLICY "Users can read own shifts"
  ON public.shifts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own shifts"
  ON public.shifts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own shifts"
  ON public.shifts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own shifts"
  ON public.shifts FOR DELETE
  USING (auth.uid() = user_id);

-- === shift_presets ===
CREATE POLICY "Users can read own shift_presets"
  ON public.shift_presets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own shift_presets"
  ON public.shift_presets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own shift_presets"
  ON public.shift_presets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own shift_presets"
  ON public.shift_presets FOR DELETE
  USING (auth.uid() = user_id);

-- === events ===
CREATE POLICY "Users can read own events"
  ON public.events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own events"
  ON public.events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own events"
  ON public.events FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own events"
  ON public.events FOR DELETE
  USING (auth.uid() = user_id);

-- === weight_entries ===
CREATE POLICY "Users can read own weight_entries"
  ON public.weight_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weight_entries"
  ON public.weight_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weight_entries"
  ON public.weight_entries FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own weight_entries"
  ON public.weight_entries FOR DELETE
  USING (auth.uid() = user_id);

-- === profile ===
CREATE POLICY "Users can read own profile"
  ON public.profile FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON public.profile FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profile FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 4. Backfill existing rows (assign to first user) ────────
-- Uncomment and replace YOUR_USER_ID if you have existing data:
-- UPDATE public.workplaces SET user_id = 'YOUR_USER_ID' WHERE user_id IS NULL;
-- UPDATE public.shifts SET user_id = 'YOUR_USER_ID' WHERE user_id IS NULL;
-- UPDATE public.shift_presets SET user_id = 'YOUR_USER_ID' WHERE user_id IS NULL;
-- UPDATE public.events SET user_id = 'YOUR_USER_ID' WHERE user_id IS NULL;
-- UPDATE public.weight_entries SET user_id = 'YOUR_USER_ID' WHERE user_id IS NULL;
-- UPDATE public.profile SET user_id = 'YOUR_USER_ID' WHERE user_id IS NULL;
