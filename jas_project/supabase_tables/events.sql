-- Run this in the Supabase SQL Editor to create the events table.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  notes         TEXT,
  event_date    DATE NOT NULL,
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  color         TEXT NOT NULL DEFAULT '#818cf8',
  is_completed  BOOLEAN NOT NULL DEFAULT false,
  completed_at  TIMESTAMPTZ,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_events_event_date ON public.events (event_date);
CREATE INDEX IF NOT EXISTS idx_events_date_time ON public.events (event_date, start_time);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON public.events(user_id);

COMMENT ON TABLE public.events IS 'Calendar events & reminders — one row per timed block on a given day.';
COMMENT ON COLUMN public.events.is_completed IS 'Checked off when the reminder/event is done.';
COMMENT ON COLUMN public.events.color IS 'Hex color from the palette';
COMMENT ON COLUMN public.events.user_id IS 'Owner — references auth.users';

-- Row Level Security — per-user only
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own events"
  ON public.events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own events"
  ON public.events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own events"
  ON public.events FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own events"
  ON public.events FOR DELETE USING (auth.uid() = user_id);
