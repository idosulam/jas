-- Run this to backfill shift and preset colors from their workplace.
-- Safe to run multiple times (idempotent).

-- Sync shift colors from workplaces
UPDATE public.shifts s
SET color = w.color
FROM public.workplaces w
WHERE s.place = w.slug
  AND s.user_id = w.user_id
  AND (s.color IS NULL OR s.color != w.color);

-- Sync preset colors from workplaces
UPDATE public.shift_presets sp
SET color = w.color
FROM public.workplaces w
WHERE sp.place = w.slug
  AND sp.user_id = w.user_id
  AND (sp.color IS NULL OR sp.color != w.color);
