-- Migration: Add color column to shifts table
-- Run this if you already have the shifts table.

ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS color TEXT NULL;

COMMENT ON COLUMN public.shifts.color IS 'Optional hex color from the palette';
