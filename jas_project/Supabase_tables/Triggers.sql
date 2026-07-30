-- ============================================================
-- Cross-Table Triggers — Run AFTER all tables are created
-- Contains: workplace color cascade, shift/preset color sync, event backfill
-- ============================================================

-- ── 1. Sync shift color from workplace on insert/update ──────

CREATE OR REPLACE FUNCTION public.sync_shift_color_from_workplace()
RETURNS TRIGGER AS $$
BEGIN
  SELECT color INTO NEW.color FROM public.workplaces
    WHERE slug = NEW.place AND user_id = NEW.user_id LIMIT 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_sync_shift_color
  BEFORE INSERT OR UPDATE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.sync_shift_color_from_workplace();

-- Backfill: set color on any existing shifts that are missing it
UPDATE public.shifts s SET color = w.color
FROM public.workplaces w
WHERE s.place = w.slug AND s.user_id = w.user_id AND s.color IS NULL;

-- ── 2. Sync preset color from workplace on insert/update ─────

CREATE OR REPLACE FUNCTION public.sync_preset_color_from_workplace()
RETURNS TRIGGER AS $$
BEGIN
  SELECT color INTO NEW.color FROM public.workplaces
    WHERE slug = NEW.place AND user_id = NEW.user_id LIMIT 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_sync_preset_color
  BEFORE INSERT OR UPDATE ON public.shift_presets
  FOR EACH ROW EXECUTE FUNCTION public.sync_preset_color_from_workplace();

-- Backfill: set color on any existing presets that are missing it
UPDATE public.shift_presets sp SET color = w.color
FROM public.workplaces w
WHERE sp.place = w.slug AND sp.user_id = w.user_id AND sp.color IS NULL;

-- ── 3. Cascade workplace color to shifts/presets/events ──────

CREATE OR REPLACE FUNCTION public.cascade_workplace_color()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.color IS DISTINCT FROM OLD.color THEN
    UPDATE public.shifts SET color = NEW.color
      WHERE place = NEW.slug AND user_id = NEW.user_id;
    UPDATE public.shift_presets SET color = NEW.color
      WHERE place = NEW.slug AND user_id = NEW.user_id;
    UPDATE public.events e SET color = NEW.color
      WHERE e.user_id = NEW.user_id
        AND EXISTS (
          SELECT 1 FROM public.shifts s
            WHERE s.place = NEW.slug
              AND s.user_id = NEW.user_id
              AND e.notes LIKE '%Linked shift id: ' || s.id || '%'
        );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_cascade_workplace_color
  AFTER UPDATE OF color ON public.workplaces
  FOR EACH ROW EXECUTE FUNCTION public.cascade_workplace_color();

-- ── 4. Backfill event colors from linked shifts ──────────────

UPDATE public.events e SET color = s.color
FROM public.shifts s
WHERE e.notes LIKE '%Linked shift id: ' || s.id || '%'
  AND e.color IS DISTINCT FROM s.color;
