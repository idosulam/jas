-- Run this in the Supabase SQL Editor to create the workplaces table.

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

COMMENT ON TABLE public.workplaces IS 'Configurable workplaces with pay rates. Replaces hardcoded PLACES object.';
COMMENT ON COLUMN public.workplaces.slug IS 'Short unique identifier used in code (e.g. pasta, coffee, warehouse)';
COMMENT ON COLUMN public.workplaces.label IS 'Display name (e.g. "Pasta Via", "Cafe Nimrod")';
COMMENT ON COLUMN public.workplaces.rate IS 'Hourly pay rate in local currency';
COMMENT ON COLUMN public.workplaces.color IS 'Hex color for badges and UI elements';
COMMENT ON COLUMN public.workplaces.active IS 'Soft delete — false hides from UI but keeps data';
COMMENT ON COLUMN public.workplaces.user_id IS 'Owner — references auth.users';

-- Unique per user
CREATE UNIQUE INDEX IF NOT EXISTS workplaces_user_slug ON public.workplaces(user_id, slug);
CREATE INDEX IF NOT EXISTS idx_workplaces_user_id ON public.workplaces(user_id);

-- Row Level Security — per-user only
ALTER TABLE public.workplaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own workplaces"
  ON public.workplaces FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own workplaces"
  ON public.workplaces FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own workplaces"
  ON public.workplaces FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own workplaces"
  ON public.workplaces FOR DELETE USING (auth.uid() = user_id);
