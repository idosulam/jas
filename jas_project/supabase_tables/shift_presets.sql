-- Run this in the Supabase SQL Editor to create the shift_presets table.

CREATE TABLE IF NOT EXISTS public.shift_presets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label       TEXT NOT NULL,
  place       TEXT NOT NULL,
  pay_type    TEXT NOT NULL DEFAULT 'hourly' CHECK (pay_type IN ('hourly', 'tips_only')),
  start_time  TIME NULL,
  end_time    TIME NULL,
  hours       NUMERIC(5, 2) NOT NULL DEFAULT 8 CHECK (hours > 0),
  color       TEXT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.shift_presets IS 'Reusable shift templates created by the user for quick-add.';
COMMENT ON COLUMN public.shift_presets.label IS 'Display name for the preset (e.g. "Morning shift")';
COMMENT ON COLUMN public.shift_presets.place IS 'References workplaces.slug'
COMMENT ON COLUMN public.shift_presets.pay_type IS 'Pay type: hourly or tips_only';
COMMENT ON COLUMN public.shift_presets.start_time IS 'Default start time for this preset';
COMMENT ON COLUMN public.shift_presets.end_time IS 'Default end time for this preset';
COMMENT ON COLUMN public.shift_presets.hours IS 'Default hours for this preset';
COMMENT ON COLUMN public.shift_presets.color IS 'Optional hex color from the palette';

-- Row Level Security (public access — same pattern as shifts)
ALTER TABLE public.shift_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on shift_presets"
  ON public.shift_presets FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on shift_presets"
  ON public.shift_presets FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update on shift_presets"
  ON public.shift_presets FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete on shift_presets"
  ON public.shift_presets FOR DELETE
  USING (true);
