-- Run this in the Supabase SQL Editor to create the shifts table.

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
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shifts_shift_date ON public.shifts (shift_date);

COMMENT ON TABLE public.shifts IS 'Work shifts — workplaces and rates loaded from the workplaces table.';
COMMENT ON COLUMN public.shifts.place IS 'References workplaces.slug';
COMMENT ON COLUMN public.shifts.pay_type IS 'How this shift is paid: hourly (rate x hours) or tips_only (pay is just tips)';
COMMENT ON COLUMN public.shifts.start_time IS 'Optional shift start time';
COMMENT ON COLUMN public.shifts.end_time IS 'Optional shift end time';
COMMENT ON COLUMN public.shifts.hours IS 'Hours worked on this shift (supports decimal values such as 4.1)';
COMMENT ON COLUMN public.shifts.tips IS 'Tips earned (optional, defaults to 0)';
COMMENT ON COLUMN public.shifts.notes IS 'Optional free-text note about the shift';
COMMENT ON COLUMN public.shifts.color IS 'Optional hex color from the palette';
COMMENT ON COLUMN public.shifts.created_at IS 'Row creation timestamp';

-- Row Level Security (adjust if you add auth later)
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on shifts"
  ON public.shifts FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on shifts"
  ON public.shifts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update on shifts"
  ON public.shifts FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete on shifts"
  ON public.shifts FOR DELETE
  USING (true);