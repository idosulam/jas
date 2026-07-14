-- Migration: Remove hardcoded place CHECK constraints
-- Run this if you already have the shifts and shift_presets tables.
-- This allows any workplace slug from the workplaces table,
-- not just the original 'pasta' and 'coffee'.

ALTER TABLE public.shifts
  DROP CONSTRAINT IF EXISTS shifts_place_check;

ALTER TABLE public.shift_presets
  DROP CONSTRAINT IF EXISTS shift_presets_place_check;
