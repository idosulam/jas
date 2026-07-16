-- Run this in the Supabase SQL Editor to create the shifts table.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

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

COMMENT ON TABLE public.shifts IS 'Work shifts — workplaces and rates loaded from the workplaces table.';
COMMENT ON COLUMN public.shifts.place IS 'References workplaces.slug';
COMMENT ON COLUMN public.shifts.pay_type IS 'How this shift is paid: hourly (rate x hours) or tips_only (pay is just tips)';
COMMENT ON COLUMN public.shifts.start_time IS 'Optional shift start time';
COMMENT ON COLUMN public.shifts.end_time IS 'Optional shift end time';
COMMENT ON COLUMN public.shifts.hours IS 'Hours worked on this shift (supports decimal values such as 4.1)';
COMMENT ON COLUMN public.shifts.tips IS 'Tips earned (optional, defaults to 0)';
COMMENT ON COLUMN public.shifts.notes IS 'Optional free-text note about the shift';
COMMENT ON COLUMN public.shifts.color IS 'Hex color — synced from workplaces.color when a workplace is edited';
COMMENT ON COLUMN public.shifts.user_id IS 'Owner — references auth.users';
COMMENT ON COLUMN public.shifts.created_at IS 'Row creation timestamp';

-- Row Level Security — per-user only
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own shifts"
  ON public.shifts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own shifts"
  ON public.shifts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own shifts"
  ON public.shifts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own shifts"
  ON public.shifts FOR DELETE USING (auth.uid() = user_id);

-- Auto-sync color from workplace on insert/update
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

-- Backfill: set color on any existing shifts that are missing it
UPDATE public.shifts s SET color = w.color
FROM public.workplaces w
WHERE s.place = w.slug AND s.user_id = w.user_id AND s.color IS NULL;
