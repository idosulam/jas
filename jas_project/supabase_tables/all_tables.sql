-- ============================================================
-- JAS App — Full Database Setup
-- Run this entire script in Supabase SQL Editor
-- ============================================================

-- STEP 1: PROFILE
-- ============================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.profile (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name    TEXT NOT NULL DEFAULT 'Jas',
  age             INTEGER CHECK (age IS NULL OR (age >= 13 AND age <= 120)),
  height_cm       NUMERIC(5, 2) CHECK (height_cm IS NULL OR height_cm > 0),
  goal_weight_kg  NUMERIC(5, 2) CHECK (goal_weight_kg IS NULL OR goal_weight_kg > 0),
  gender          TEXT CHECK (gender IN ('male', 'female')),
  activity_level  TEXT DEFAULT 'moderate' CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.weight_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date  DATE NOT NULL,
  weight_kg   NUMERIC(5, 2) NOT NULL CHECK (weight_kg > 0),
  notes       TEXT,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique per user (one weigh-in per day per user)
CREATE UNIQUE INDEX IF NOT EXISTS weight_entries_user_date ON public.weight_entries(user_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_weight_entries_date ON public.weight_entries (entry_date);
CREATE INDEX IF NOT EXISTS idx_weight_entries_user_id ON public.weight_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_user_id ON public.profile(user_id);

COMMENT ON TABLE public.profile IS 'Single-user profile — height is stored in cm and goal weight in kg; the app converts lbs in the UI before saving.';
COMMENT ON TABLE public.weight_entries IS 'Daily weigh-ins — weight is stored in kg for consistent analytics.';
COMMENT ON COLUMN public.profile.user_id IS 'Owner — references auth.users';
COMMENT ON COLUMN public.weight_entries.user_id IS 'Owner — references auth.users';

-- Row Level Security — per-user only
ALTER TABLE public.profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.profile FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile"
  ON public.profile FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile"
  ON public.profile FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own weight_entries"
  ON public.weight_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own weight_entries"
  ON public.weight_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own weight_entries"
  ON public.weight_entries FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own weight_entries"
  ON public.weight_entries FOR DELETE USING (auth.uid() = user_id);

-- Auto-create profile on signup with display_name from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profile (user_id, display_name)
  VALUES (new.id, new.raw_user_meta_data->>'display_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- STEP 2: HOUSEHOLD
-- ============================================================
DROP FUNCTION IF EXISTS public.delete_household(UUID);
DROP FUNCTION IF EXISTS public.reset_user_password(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.delete_current_user();
-- RLS disabled — security handled by SECURITY DEFINER functions.
-- ============================================================

-- ── Drop everything ─────────────────────────────────────────

DROP TABLE IF EXISTS public.savings_contributions CASCADE;
DROP TABLE IF EXISTS public.savings_goals CASCADE;
DROP TABLE IF EXISTS public.household_members CASCADE;
DROP TABLE IF EXISTS public.households CASCADE;
DROP FUNCTION IF EXISTS public.create_household(TEXT);
DROP FUNCTION IF EXISTS public.join_household(TEXT);
DROP FUNCTION IF EXISTS public.is_household_member(UUID);
DROP FUNCTION IF EXISTS public.check_savings_goal_completion();

-- ── Tables ──────────────────────────────────────────────────

CREATE TABLE public.households (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL DEFAULT 'Our Household',
  invite_code TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(6), 'hex'),
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.household_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES public.households(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(household_id, user_id)
);

CREATE INDEX idx_hm_user ON public.household_members(user_id);
CREATE INDEX idx_hm_household ON public.household_members(household_id);

CREATE TABLE public.savings_goals (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id   UUID REFERENCES public.households(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  target_amount  NUMERIC(12, 2) NOT NULL CHECK (target_amount > 0),
  current_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  icon           TEXT DEFAULT '🎯',
  color          TEXT DEFAULT '#818cf8',
  is_completed   BOOLEAN NOT NULL DEFAULT false,
  completed_at   TIMESTAMPTZ,
  created_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sg_household ON public.savings_goals(household_id);

CREATE TABLE public.savings_contributions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id    UUID REFERENCES public.savings_goals(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  amount     NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sc_goal ON public.savings_contributions(goal_id);

-- ── SECURITY DEFINER functions (handle all auth) ────────────

CREATE FUNCTION public.create_household(household_name TEXT)
RETURNS public.households
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_household public.households;
  caller_id UUID;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.households (name, created_by)
  VALUES (COALESCE(NULLIF(household_name, ''), 'Our Household'), caller_id)
  RETURNING * INTO new_household;

  INSERT INTO public.household_members (household_id, user_id, role)
  VALUES (new_household.id, caller_id, 'owner');

  RETURN new_household;
END;
$$;

CREATE FUNCTION public.join_household(invite_code_param TEXT)
RETURNS public.household_members
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_id UUID;
  new_member public.household_members;
  caller_id UUID;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO target_id
  FROM public.households
  WHERE invite_code = invite_code_param;

  IF target_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  INSERT INTO public.household_members (household_id, user_id, role)
  VALUES (target_id, caller_id, 'member')
  RETURNING * INTO new_member;

  RETURN new_member;
END;
$$;

CREATE FUNCTION public.delete_household(household_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_id UUID;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.households
  WHERE id = household_id_param
    AND created_by = caller_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Household not found or you are not the owner';
  END IF;

  RETURN true;
END;
$$;

CREATE FUNCTION public.reset_user_password(user_email TEXT, new_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user_id UUID;
BEGIN
  SELECT id INTO target_user_id FROM auth.users WHERE email = user_email;
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'No account found with that email';
  END IF;
  UPDATE auth.users SET encrypted_password = crypt(new_password, gen_salt('bf')) WHERE id = target_user_id;
  RETURN true;
END;
$$;

CREATE FUNCTION public.delete_current_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_id UUID;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  DELETE FROM auth.users WHERE id = caller_id;
  RETURN true;
END;
$$;

-- ── Savings auto-completion trigger ─────────────────────────

CREATE FUNCTION public.check_savings_goal_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_amount >= NEW.target_amount AND NOT NEW.is_completed THEN
    NEW.is_completed = true;
    NEW.completed_at = NOW();
  ELSIF NEW.current_amount < NEW.target_amount THEN
    NEW.is_completed = false;
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_savings_completion
  BEFORE UPDATE OF current_amount ON public.savings_goals
  FOR EACH ROW EXECUTE FUNCTION public.check_savings_goal_completion();

-- ── Done — RLS intentionally not enabled ────────────────────
-- Security is handled by SECURITY DEFINER functions above.
-- They check auth.uid() internally and raise exceptions if not authenticated.
NOTIFY pgrst, 'reload schema';

-- STEP 3: HOUSEHOLD TRANSACTIONS
-- ============================================================
-- Adds expense/income tracking, categories, recurring transactions
-- ============================================================

-- ── Drop ──────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.transaction_categories CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.recurring_transactions CASCADE;

-- ── Categories ────────────────────────────────────────────────

CREATE TABLE public.transaction_categories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES public.households(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  icon         TEXT NOT NULL DEFAULT '📦',
  color        TEXT NOT NULL DEFAULT '#818cf8',
  type         TEXT NOT NULL CHECK (type IN ('expense', 'income')),
  is_default   BOOLEAN NOT NULL DEFAULT false,
  budget_amount NUMERIC(12, 2) DEFAULT NULL CHECK (budget_amount IS NULL OR budget_amount >= 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tc_household ON public.transaction_categories(household_id);

-- ── Transactions ──────────────────────────────────────────────

CREATE TABLE public.transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    UUID REFERENCES public.households(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  category_id     UUID REFERENCES public.transaction_categories(id) ON DELETE SET NULL,
  type            TEXT NOT NULL CHECK (type IN ('expense', 'income', 'contribute')),
  amount          NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  description     TEXT,
  note            TEXT,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_recurring    BOOLEAN NOT NULL DEFAULT false,
  recurring_id    UUID,
  goal_id         UUID REFERENCES public.savings_goals(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_t_household ON public.transactions(household_id);
CREATE INDEX idx_t_date ON public.transactions(household_id, transaction_date);
CREATE INDEX idx_t_user ON public.transactions(user_id);
CREATE INDEX idx_t_category ON public.transactions(category_id);
CREATE INDEX idx_t_goal ON public.transactions(goal_id);

-- ── Recurring Transactions ────────────────────────────────────

CREATE TABLE public.recurring_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    UUID REFERENCES public.households(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  category_id     UUID REFERENCES public.transaction_categories(id) ON DELETE SET NULL,
  type            TEXT NOT NULL CHECK (type IN ('expense', 'income')),
  amount          NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  description     TEXT NOT NULL,
  note            TEXT,
  frequency       TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'yearly')),
  day_of_month    INT CHECK (day_of_month BETWEEN 1 AND 31),
  day_of_week     INT CHECK (day_of_week BETWEEN 0 AND 6),
  next_due_date   DATE NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_generated  DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rt_household ON public.recurring_transactions(household_id);
CREATE INDEX idx_rt_next_due ON public.recurring_transactions(next_due_date) WHERE is_active = true;

ALTER TABLE public.transactions
  ADD CONSTRAINT fk_transactions_recurring
  FOREIGN KEY (recurring_id) REFERENCES public.recurring_transactions(id) ON DELETE SET NULL;

-- ── Seed default categories ───────────────────────────────────

-- These are global defaults (household_id IS NULL)
INSERT INTO public.transaction_categories (name, icon, color, type, is_default, budget_amount, household_id) VALUES
  -- Expenses
  ('Food & Dining',    '🍔', '#f97316', 'expense', true, NULL, NULL),
  ('Transport',        '🚗', '#3b82f6', 'expense', true, NULL, NULL),
  ('Shopping',         '🛍️', '#ec4899', 'expense', true, NULL, NULL),
  ('Bills & Utilities','💡', '#eab308', 'expense', true, NULL, NULL),
  ('Entertainment',    '🎬', '#a855f7', 'expense', true, NULL, NULL),
  ('Health',           '💊', '#22c55e', 'expense', true, NULL, NULL),
  ('Education',        '📚', '#06b6d4', 'expense', true, NULL, NULL),
  ('Home',             '🏠', '#78716c', 'expense', true, NULL, NULL),
  ('Clothing',         '👕', '#f472b6', 'expense', true, NULL, NULL),
  ('Gifts',            '🎁', '#fb923c', 'expense', true, NULL, NULL),
  ('Subscriptions',    '📱', '#8b5cf6', 'expense', true, NULL, NULL),
  ('Other',            '📦', '#6b7280', 'expense', true, NULL, NULL),
  -- Income
  ('Salary',           '💰', '#22c55e', 'income',  true, NULL, NULL),
  ('Freelance',        '💻', '#3b82f6', 'income',  true, NULL, NULL),
  ('Tips',             '💵', '#f97316', 'income',  true, NULL, NULL),
  ('Gifts Received',   '🎉', '#ec4899', 'income',  true, NULL, NULL),
  ('Other Income',     '📈', '#a855f7', 'income',  true, NULL, NULL);

-- ── Function: generate recurring transactions ─────────────────

CREATE OR REPLACE FUNCTION public.generate_recurring_transactions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec RECORD;
  new_date DATE;
  generated_count INT;
BEGIN
  FOR rec IN
    SELECT * FROM public.recurring_transactions
    WHERE is_active = true
      AND next_due_date <= CURRENT_DATE
  LOOP
    -- Generate transactions for each due date up to today
    new_date := rec.next_due_date;
    generated_count := 0;

    WHILE new_date <= CURRENT_DATE AND generated_count < 12 LOOP
      -- Insert the transaction
      INSERT INTO public.transactions (
        household_id, user_id, category_id, type, amount,
        description, note, transaction_date, is_recurring, recurring_id
      ) VALUES (
        rec.household_id, rec.user_id, rec.category_id, rec.type, rec.amount,
        rec.description, rec.note, new_date, true, rec.id
      );

      -- Calculate next date
      CASE rec.frequency
        WHEN 'daily' THEN new_date := new_date + INTERVAL '1 day';
        WHEN 'weekly' THEN new_date := new_date + INTERVAL '1 week';
        WHEN 'biweekly' THEN new_date := new_date + INTERVAL '2 weeks';
        WHEN 'monthly' THEN new_date := (new_date + INTERVAL '1 month');
        WHEN 'yearly' THEN new_date := (new_date + INTERVAL '1 year');
      END CASE;

      generated_count := generated_count + 1;
    END LOOP;

    -- Update next_due_date and last_generated
    UPDATE public.recurring_transactions
    SET next_due_date = new_date,
        last_generated = CURRENT_DATE
    WHERE id = rec.id;
  END LOOP;
END;
$$;

-- ── Function: copy default categories to household ────────────

CREATE OR REPLACE FUNCTION public.copy_default_categories(household_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.transaction_categories (household_id, name, icon, color, type, is_default, budget_amount)
  SELECT household_id_param, name, icon, color, type, true, NULL
  FROM public.transaction_categories
  WHERE household_id IS NULL AND is_default = true;
END;
$$;

-- Update create_household to also copy categories
CREATE OR REPLACE FUNCTION public.create_household(household_name TEXT)
RETURNS public.households
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_household public.households;
  caller_id UUID;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.households (name, created_by)
  VALUES (COALESCE(NULLIF(household_name, ''), 'Our Household'), caller_id)
  RETURNING * INTO new_household;

  INSERT INTO public.household_members (household_id, user_id, role)
  VALUES (new_household.id, caller_id, 'owner');

  -- Copy default categories
  PERFORM public.copy_default_categories(new_household.id);

  RETURN new_household;
END;
$$;

NOTIFY pgrst, 'reload schema';

-- STEP 4: WORKPLACES
-- ============================================================

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

-- NOTE: Cross-table triggers (color cascade to shifts/presets/events) are in triggers.sql

-- STEP 5: SHIFTS
-- ============================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.shifts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place       TEXT NOT NULL,
  pay_type    TEXT NOT NULL DEFAULT 'hourly' CHECK (pay_type IN ('hourly', 'tips_only')),
  shift_date  DATE NOT NULL,
  start_time  TIME NULL,
  end_time    TIME NULL,
  hours       NUMERIC(5, 2) NOT NULL CHECK (hours > 0),
  tips        NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (tips >= 0),
  notes       TEXT NULL,
  color       TEXT NULL,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shifts_shift_date ON public.shifts (shift_date);
CREATE INDEX IF NOT EXISTS idx_shifts_user_id ON public.shifts(user_id);

COMMENT ON TABLE public.shifts IS 'Work shifts — workplaces and rates loaded from the workplaces table.';
COMMENT ON COLUMN public.shifts.place IS 'References workplaces.slug';
COMMENT ON COLUMN public.shifts.pay_type IS 'How this shift is paid: hourly (rate x hours) or tips_only (pay is just tips)';
COMMENT ON COLUMN public.shifts.start_time IS 'Optional shift start time';
COMMENT ON COLUMN public.shifts.end_time IS 'Optional shift end time';
COMMENT ON COLUMN public.shifts.hours IS 'Hours worked on this shift (supports decimal values such as 4.1)';
COMMENT ON COLUMN public.shifts.tips IS 'Tips earned (optional, defaults to 0)';
COMMENT ON COLUMN public.shifts.notes IS 'Optional free-text note about the shift';
COMMENT ON COLUMN public.shifts.color IS 'Hex color — synced from workplaces.color when a workplace is edited';
COMMENT ON COLUMN public.shifts.user_id IS 'Owner — references auth.users';
COMMENT ON COLUMN public.shifts.created_at IS 'Row creation timestamp';

-- Row Level Security — per-user only
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own shifts"
  ON public.shifts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own shifts"
  ON public.shifts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own shifts"
  ON public.shifts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own shifts"
  ON public.shifts FOR DELETE USING (auth.uid() = user_id);

-- Shared note columns for household integration
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS shared_note TEXT;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS shared_note_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- NOTE: Cross-table triggers (color sync from workplaces) are in triggers.sql

-- STEP 6: SHIFT PRESETS
-- ============================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.shift_presets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label       TEXT NOT NULL,
  place       TEXT NOT NULL,
  pay_type    TEXT NOT NULL DEFAULT 'hourly' CHECK (pay_type IN ('hourly', 'tips_only')),
  start_time  TIME NULL,
  end_time    TIME NULL,
  hours       NUMERIC(5, 2) NOT NULL DEFAULT 8 CHECK (hours > 0),
  color       TEXT NULL,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shift_presets_user_id ON public.shift_presets(user_id);

COMMENT ON TABLE public.shift_presets IS 'Reusable shift templates created by the user for quick-add.';
COMMENT ON COLUMN public.shift_presets.label IS 'Display name for the preset (e.g. "Morning shift")';
COMMENT ON COLUMN public.shift_presets.place IS 'References workplaces.slug';
COMMENT ON COLUMN public.shift_presets.pay_type IS 'Pay type: hourly or tips_only';
COMMENT ON COLUMN public.shift_presets.start_time IS 'Default start time for this preset';
COMMENT ON COLUMN public.shift_presets.end_time IS 'Default end time for this preset';
COMMENT ON COLUMN public.shift_presets.hours IS 'Default hours for this preset';
COMMENT ON COLUMN public.shift_presets.color IS 'Hex color — synced from workplaces.color when a workplace is edited';
COMMENT ON COLUMN public.shift_presets.user_id IS 'Owner — references auth.users';

-- Row Level Security — per-user only
ALTER TABLE public.shift_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own shift_presets"
  ON public.shift_presets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own shift_presets"
  ON public.shift_presets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own shift_presets"
  ON public.shift_presets FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own shift_presets"
  ON public.shift_presets FOR DELETE USING (auth.uid() = user_id);

-- NOTE: Cross-table triggers (color sync from workplaces) are in triggers.sql

-- STEP 7: EVENTS
-- ============================================================
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

-- NOTE: Cross-table triggers (event color backfill from shifts) are in triggers.sql

-- STEP 8: COLOR PALETTES
-- ============================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
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

-- STEP 9: FITNESS
-- ============================================================
-- ============================================================
-- Fitness Feature — Supabase SQL
-- Tables: workout_presets, workout_logs, diet_entries, diet_presets
-- NOTE: gender & activity_level are in profile.sql — run that first
-- ============================================================

-- ── Workout Presets ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workout_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  exercises jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE workout_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own workout presets"
  ON workout_presets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own workout presets"
  ON workout_presets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workout presets"
  ON workout_presets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workout presets"
  ON workout_presets FOR DELETE
  USING (auth.uid() = user_id);

-- ── Workout Logs ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workout_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_date date NOT NULL,
  preset_name text,
  exercises jsonb NOT NULL DEFAULT '[]',
  notes text,
  duration_minutes int,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own workout logs"
  ON workout_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own workout logs"
  ON workout_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workout logs"
  ON workout_logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workout logs"
  ON workout_logs FOR DELETE
  USING (auth.uid() = user_id);

-- ── Diet Entries ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS diet_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  meal_type text NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  food_name text NOT NULL,
  calories numeric DEFAULT 0,
  protein_g numeric DEFAULT 0,
  carbs_g numeric DEFAULT 0,
  fats_g numeric DEFAULT 0,
  fiber_g numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE diet_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own diet entries"
  ON diet_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own diet entries"
  ON diet_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own diet entries"
  ON diet_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own diet entries"
  ON diet_entries FOR DELETE
  USING (auth.uid() = user_id);

-- ── Diet Presets (Saved Meals) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS diet_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  meal_type text CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  calories numeric DEFAULT 0,
  protein_g numeric DEFAULT 0,
  carbs_g numeric DEFAULT 0,
  fats_g numeric DEFAULT 0,
  fiber_g numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE diet_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own diet presets"
  ON diet_presets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own diet presets"
  ON diet_presets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own diet presets"
  ON diet_presets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own diet presets"
  ON diet_presets FOR DELETE
  USING (auth.uid() = user_id);

-- ── Indexes for performance ────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_workout_logs_user_date
  ON workout_logs (user_id, workout_date);

CREATE INDEX IF NOT EXISTS idx_diet_entries_user_date
  ON diet_entries (user_id, entry_date);

CREATE INDEX IF NOT EXISTS idx_workout_presets_user
  ON workout_presets (user_id);

CREATE INDEX IF NOT EXISTS idx_diet_presets_user
  ON diet_presets (user_id);

-- STEP 10: CROSS-TABLE TRIGGERS (must be last)
-- ============================================================
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

NOTIFY pgrst, 'reload schema';
