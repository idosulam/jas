-- Run this in the Supabase SQL Editor to create the workplaces table.
-- This must be run FIRST — it grants schema access to Supabase roles.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

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

-- Cascade color changes to shifts and presets when workplace color is updated
CREATE OR REPLACE FUNCTION public.cascade_workplace_color()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.color IS DISTINCT FROM OLD.color THEN
    -- Update shifts
    UPDATE public.shifts SET color = NEW.color
      WHERE place = NEW.slug AND user_id = NEW.user_id;
    -- Update presets
    UPDATE public.shift_presets SET color = NEW.color
      WHERE place = NEW.slug AND user_id = NEW.user_id;
    -- Update linked calendar events
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
