-- Migration: Add color column to shift_presets table
-- Run this if you already have the shift_presets table.

ALTER TABLE public.shift_presets
  ADD COLUMN IF NOT EXISTS color TEXT NULL;

COMMENT ON COLUMN public.shift_presets.color IS 'Optional hex color from the palette';
