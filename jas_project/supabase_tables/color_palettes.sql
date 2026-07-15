-- Run this in the Supabase SQL Editor to create the color_palettes table.
-- Stores user-defined colors for the palette picker (Calendar + Shifts).

CREATE TABLE IF NOT EXISTS public.color_palettes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hex         TEXT NOT NULL,
  label       TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_color_palettes_user_id ON public.color_palettes(user_id);

COMMENT ON TABLE public.color_palettes IS 'User-defined color palette for Calendar and Shifts.';
COMMENT ON COLUMN public.color_palettes.hex IS 'Hex color value (e.g. #818cf8)';
COMMENT ON COLUMN public.color_palettes.label IS 'Display name for the color (e.g. Indigo)';
COMMENT ON COLUMN public.color_palettes.sort_order IS 'Display order in the palette picker';
COMMENT ON COLUMN public.color_palettes.user_id IS 'Owner — references auth.users';

-- Row Level Security — per-user only
ALTER TABLE public.color_palettes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own color_palettes"
  ON public.color_palettes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own color_palettes"
  ON public.color_palettes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own color_palettes"
  ON public.color_palettes FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own color_palettes"
  ON public.color_palettes FOR DELETE USING (auth.uid() = user_id);
