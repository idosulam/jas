-- ============================================================
-- JAS — Full Database Setup
-- Run this single file in the Supabase SQL Editor.
-- Safe to run on a fresh or existing database (drops first).
-- ============================================================

-- ── Cleanup ──────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_cascade_workplace_color ON public.workplaces;
DROP TRIGGER IF EXISTS trg_sync_shift_color ON public.shifts;
DROP TRIGGER IF EXISTS trg_sync_preset_color ON public.shift_presets;
DROP FUNCTION IF EXISTS public.cascade_workplace_color();
DROP FUNCTION IF EXISTS public.sync_shift_color_from_workplace();
DROP FUNCTION IF EXISTS public.sync_preset_color_from_workplace();
DROP TABLE IF EXISTS public.weight_entries CASCADE;
DROP TABLE IF EXISTS public.shift_presets CASCADE;
DROP TABLE IF EXISTS public.shifts CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.color_palettes CASCADE;
DROP TABLE IF EXISTS public.profile CASCADE;
DROP TABLE IF EXISTS public.workplaces CASCADE;

-- ── Grants ───────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- ============================================================
-- ── Tables (create all tables first, triggers after) ────────
-- ============================================================

-- Workplaces
CREATE TABLE IF NOT EXISTS public.workplaces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL,
  label       TEXT NOT NULL,
  rate        NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (rate >= 0),
  color       TEXT NOT NULL DEFAULT '#818cf8',
  active      BOOLEAN NOT NULL DEFAULT true,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS workplaces_user_slug ON public.workplaces(user_id, slug);
CREATE INDEX IF NOT EXISTS idx_workplaces_user_id ON public.workplaces(user_id);
ALTER TABLE public.workplaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own workplaces" ON public.workplaces FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own workplaces" ON public.workplaces FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own workplaces" ON public.workplaces FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own workplaces" ON public.workplaces FOR DELETE USING (auth.uid() = user_id);

-- Shifts
CREATE TABLE IF NOT EXISTS public.shifts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place       TEXT NOT NULL,
  pay_type    TEXT NOT NULL DEFAULT 'hourly' CHECK (pay_type IN ('hourly', 'tips_only')),
  shift_date  DATE NOT NULL,
  start_time  TIME NULL,
  end_time    TIME NULL,
  hours       NUMERIC(5, 2) NOT NULL CHECK (hours > 0),
  tips        NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (tips >= 0),
  notes       TEXT NULL,
  color       TEXT NULL,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shifts_shift_date ON public.shifts (shift_date);
CREATE INDEX IF NOT EXISTS idx_shifts_user_id ON public.shifts(user_id);
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own shifts" ON public.shifts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own shifts" ON public.shifts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own shifts" ON public.shifts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own shifts" ON public.shifts FOR DELETE USING (auth.uid() = user_id);

-- Shift Presets
CREATE TABLE IF NOT EXISTS public.shift_presets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label       TEXT NOT NULL,
  place       TEXT NOT NULL,
  pay_type    TEXT NOT NULL DEFAULT 'hourly' CHECK (pay_type IN ('hourly', 'tips_only')),
  start_time  TIME NULL,
  end_time    TIME NULL,
  hours       NUMERIC(5, 2) NOT NULL DEFAULT 8 CHECK (hours > 0),
  color       TEXT NULL,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shift_presets_user_id ON public.shift_presets(user_id);
ALTER TABLE public.shift_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own shift_presets" ON public.shift_presets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own shift_presets" ON public.shift_presets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own shift_presets" ON public.shift_presets FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own shift_presets" ON public.shift_presets FOR DELETE USING (auth.uid() = user_id);

-- Events
CREATE TABLE IF NOT EXISTS public.events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  notes         TEXT,
  event_date    DATE NOT NULL,
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  color         TEXT NOT NULL DEFAULT '#818cf8',
  is_completed  BOOLEAN NOT NULL DEFAULT false,
  completed_at  TIMESTAMPTZ,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON public.events (event_date);
CREATE INDEX IF NOT EXISTS idx_events_date_time ON public.events (event_date, start_time);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON public.events(user_id);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own events" ON public.events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own events" ON public.events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own events" ON public.events FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own events" ON public.events FOR DELETE USING (auth.uid() = user_id);

-- Profile
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.profile (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name    TEXT NOT NULL DEFAULT '',
  age             INTEGER CHECK (age IS NULL OR (age >= 13 AND age <= 120)),
  height_cm       NUMERIC(5, 2) CHECK (height_cm IS NULL OR height_cm > 0),
  goal_weight_kg  NUMERIC(5, 2) CHECK (goal_weight_kg IS NULL OR goal_weight_kg > 0),
  gender          TEXT CHECK (gender IS NULL OR gender IN ('female', 'male', 'other')),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.weight_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date  DATE NOT NULL,
  weight_kg   NUMERIC(5, 2) NOT NULL CHECK (weight_kg > 0),
  notes       TEXT,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS weight_entries_user_date ON public.weight_entries(user_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_weight_entries_date ON public.weight_entries (entry_date);
CREATE INDEX IF NOT EXISTS idx_weight_entries_user_id ON public.weight_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_user_id ON public.profile(user_id);
ALTER TABLE public.profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile" ON public.profile FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profile FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profile FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
ALTER TABLE public.weight_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own weight_entries" ON public.weight_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own weight_entries" ON public.weight_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own weight_entries" ON public.weight_entries FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own weight_entries" ON public.weight_entries FOR DELETE USING (auth.uid() = user_id);

-- Color Palettes
CREATE TABLE IF NOT EXISTS public.color_palettes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hex         TEXT NOT NULL,
  label       TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_color_palettes_user_id ON public.color_palettes(user_id);
ALTER TABLE public.color_palettes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own color_palettes" ON public.color_palettes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own color_palettes" ON public.color_palettes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own color_palettes" ON public.color_palettes FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own color_palettes" ON public.color_palettes FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- ── Triggers (all tables exist now, safe to reference) ──────
-- ============================================================

-- Cascade workplace color → shifts, presets, events
CREATE OR REPLACE FUNCTION public.cascade_workplace_color()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.color IS DISTINCT FROM OLD.color THEN
    UPDATE public.shifts SET color = NEW.color
      WHERE place = NEW.slug AND user_id = NEW.user_id;
    UPDATE public.shift_presets SET color = NEW.color
      WHERE place = NEW.slug AND user_id = NEW.user_id;
    UPDATE public.events e SET color = NEW.color
      WHERE e.user_id = NEW.user_id
        AND EXISTS (
          SELECT 1 FROM public.shifts s
            WHERE s.place = NEW.slug
              AND s.user_id = NEW.user_id
              AND e.notes LIKE '%Linked shift id: ' || s.id || '%'
        );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_cascade_workplace_color
  AFTER UPDATE OF color ON public.workplaces
  FOR EACH ROW EXECUTE FUNCTION public.cascade_workplace_color();

-- Auto-sync shift color from workplace
CREATE OR REPLACE FUNCTION public.sync_shift_color_from_workplace()
RETURNS TRIGGER AS $$
BEGIN
  SELECT color INTO NEW.color FROM public.workplaces
    WHERE slug = NEW.place AND user_id = NEW.user_id LIMIT 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_sync_shift_color
  BEFORE INSERT OR UPDATE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.sync_shift_color_from_workplace();

-- Auto-sync preset color from workplace
CREATE OR REPLACE FUNCTION public.sync_preset_color_from_workplace()
RETURNS TRIGGER AS $$
BEGIN
  SELECT color INTO NEW.color FROM public.workplaces
    WHERE slug = NEW.place AND user_id = NEW.user_id LIMIT 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_sync_preset_color
  BEFORE INSERT OR UPDATE ON public.shift_presets
  FOR EACH ROW EXECUTE FUNCTION public.sync_preset_color_from_workplace();

-- ============================================================
-- ── Backfill (for existing data) ────────────────────────────
-- ============================================================

UPDATE public.shifts s SET color = w.color
FROM public.workplaces w
WHERE s.place = w.slug AND s.user_id = w.user_id AND s.color IS NULL;

UPDATE public.shift_presets sp SET color = w.color
FROM public.workplaces w
WHERE sp.place = w.slug AND sp.user_id = w.user_id AND sp.color IS NULL;

UPDATE public.events e SET color = s.color
FROM public.shifts s
WHERE e.notes LIKE '%Linked shift id: ' || s.id || '%'
  AND e.color IS DISTINCT FROM s.color;
