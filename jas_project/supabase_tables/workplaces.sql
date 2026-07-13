-- Run this in the SupabSQL Editor to create the workplaces table.
-- After creating this, run the migration below to seed your existing workplaces.

CREATE TABLE IF NOT EXISTS public.workplaces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,
  label       TEXT NOT NULL,
  rate        NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (rate >= 0),
  color       TEXT NOT NULL DEFAULT '#818cf8',
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.workplaces IS 'Configurable workplaces with pay rates. Replaces hardcoded PLACES object.';
COMMENT ON COLUMN public.workplaces.slug IS 'Short unique identifier used in code (e.g. pasta, coffee, warehouse)';
COMMENT ON COLUMN public.workplaces.label IS 'Display name (e.g. "Pasta Via", "Cafe Nimrod")';
COMMENT ON COLUMN public.workplaces.rate IS 'Hourly pay rate in local currency';
COMMENT ON COLUMN public.workplaces.color IS 'Hex color for badges and UI elements';
COMMENT ON COLUMN public.workplaces.active IS 'Soft delete — false hides from UI but keeps data';

-- Row Level Security
ALTER TABLE public.workplaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on workplaces"
  ON public.workplaces FOR SELECT USING (true);

CREATE POLICY "Allow public insert on workplaces"
  ON public.workplaces FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update on workplaces"
  ON public.workplaces FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete on workplaces"
  ON public.workplaces FOR DELETE USING (true);

-- Seed existing workplaces (run this once)
INSERT INTO public.workplaces (slug, label, rate, color) VALUES
  ('pasta',  'Pasta Via',    50,  '#fb923c'),
  ('coffee', 'Cafe Nimrod',  34,  '#a78bfa')
ON CONFLICT (slug) DO NOTHING;
