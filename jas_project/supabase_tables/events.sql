-- Run this in the Supabase SQL Editor to create the events table.

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
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_events_event_date ON public.events (event_date);
CREATE INDEX IF NOT EXISTS idx_events_date_time ON public.events (event_date, start_time);

COMMENT ON TABLE public.events IS 'Calendar events & reminders — one row per timed block on a given day.';
COMMENT ON COLUMN public.events.is_completed IS 'Checked off when the reminder/event is done.';
COMMENT ON COLUMN public.events.color IS 'Hex color from the palette';

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on events"
  ON public.events FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on events"
  ON public.events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update on events"
  ON public.events FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete on events"
  ON public.events FOR DELETE
  USING (true);
