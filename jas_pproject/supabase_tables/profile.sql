-- Run this in the Supabase SQL Editor to create profile & weight tracking tables.

CREATE TABLE IF NOT EXISTS public.profile (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name    TEXT NOT NULL DEFAULT 'Jas',
  age             INTEGER CHECK (age IS NULL OR (age >= 13 AND age <= 120)),
  height_cm       NUMERIC(5, 2) CHECK (height_cm IS NULL OR height_cm > 0),
  goal_weight_kg  NUMERIC(5, 2) CHECK (goal_weight_kg IS NULL OR goal_weight_kg > 0),
  gender          TEXT CHECK (gender IS NULL OR gender IN ('female', 'male', 'other')),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.weight_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date  DATE NOT NULL,
  weight_kg   NUMERIC(5, 2) NOT NULL CHECK (weight_kg > 0),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entry_date)
);

CREATE INDEX IF NOT EXISTS idx_weight_entries_date ON public.weight_entries (entry_date);

COMMENT ON TABLE public.profile IS 'Single-user profile — height & goal stored in metric (cm, kg).';
COMMENT ON TABLE public.weight_entries IS 'Daily weigh-ins — weight always stored in kg.';

ALTER TABLE public.profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on profile"
  ON public.profile FOR SELECT USING (true);
CREATE POLICY "Allow public insert on profile"
  ON public.profile FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on profile"
  ON public.profile FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read on weight_entries"
  ON public.weight_entries FOR SELECT USING (true);
CREATE POLICY "Allow public insert on weight_entries"
  ON public.weight_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on weight_entries"
  ON public.weight_entries FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete on weight_entries"
  ON public.weight_entries FOR DELETE USING (true);

-- Optional seed row (edit values to match Jas)
INSERT INTO public.profile (display_name, age, height_cm, goal_weight_kg, gender)
SELECT 'Jas', 26, 165, 58, 'female'
WHERE NOT EXISTS (SELECT 1 FROM public.profile);
