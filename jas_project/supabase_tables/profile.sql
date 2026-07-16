-- Run this in the Supabase SQL Editor to create profile & weight tracking tables.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.profile (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name    TEXT NOT NULL DEFAULT 'Jas',
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

-- Unique per user (one weigh-in per day per user)
CREATE UNIQUE INDEX IF NOT EXISTS weight_entries_user_date ON public.weight_entries(user_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_weight_entries_date ON public.weight_entries (entry_date);
CREATE INDEX IF NOT EXISTS idx_weight_entries_user_id ON public.weight_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_user_id ON public.profile(user_id);

COMMENT ON TABLE public.profile IS 'Single-user profile — height is stored in cm and goal weight in kg; the app converts lbs in the UI before saving.';
COMMENT ON TABLE public.weight_entries IS 'Daily weigh-ins — weight is stored in kg for consistent analytics.';
COMMENT ON COLUMN public.profile.user_id IS 'Owner — references auth.users';
COMMENT ON COLUMN public.weight_entries.user_id IS 'Owner — references auth.users';

-- Row Level Security — per-user only
ALTER TABLE public.profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.profile FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile"
  ON public.profile FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile"
  ON public.profile FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own weight_entries"
  ON public.weight_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own weight_entries"
  ON public.weight_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own weight_entries"
  ON public.weight_entries FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own weight_entries"
  ON public.weight_entries FOR DELETE USING (auth.uid() = user_id);

-- Auto-create profile on signup with display_name from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profile (user_id, display_name)
  VALUES (new.id, new.raw_user_meta_data->>'display_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
