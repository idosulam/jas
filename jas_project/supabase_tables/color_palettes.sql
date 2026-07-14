-- Run this in the Supabase SQL Editor to create the color_palettes table.
-- Stores user-defined colors for the palette picker (Calendar + Shifts).

CREATE TABLE IF NOT EXISTS public.color_palettes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hex         TEXT NOT NULL,
  label       TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.color_palettes IS 'User-defined color palette for Calendar and Shifts.';
COMMENT ON COLUMN public.color_palettes.hex IS 'Hex color value (e.g. #818cf8)';
COMMENT ON COLUMN public.color_palettes.label IS 'Display name for the color (e.g. Indigo)';
COMMENT ON COLUMN public.color_palettes.sort_order IS 'Display order in the palette picker';

-- Row Level Security
ALTER TABLE public.color_palettes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on color_palettes"
  ON public.color_palettes FOR SELECT USING (true);

CREATE POLICY "Allow public insert on color_palettes"
  ON public.color_palettes FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update on color_palettes"
  ON public.color_palettes FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete on color_palettes"
  ON public.color_palettes FOR DELETE USING (true);

-- Seed default colors
INSERT INTO public.color_palettes (hex, label, sort_order) VALUES
  ('#818cf8', 'Indigo', 1),
  ('#f472b6', 'Pink',   2),
  ('#fb923c', 'Orange', 3),
  ('#4ade80', 'Green',  4),
  ('#22d3ee', 'Cyan',   5)
ON CONFLICT DO NOTHING;
