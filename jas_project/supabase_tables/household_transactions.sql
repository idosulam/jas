-- ============================================================
-- Household Transactions migration — Run AFTER household.sql
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
INSERT INTO public.transaction_categories (name, icon, color, type, is_default, household_id) VALUES
  -- Expenses
  ('Food & Dining',    '🍔', '#f97316', 'expense', true, NULL),
  ('Transport',        '🚗', '#3b82f6', 'expense', true, NULL),
  ('Shopping',         '🛍️', '#ec4899', 'expense', true, NULL),
  ('Bills & Utilities','💡', '#eab308', 'expense', true, NULL),
  ('Entertainment',    '🎬', '#a855f7', 'expense', true, NULL),
  ('Health',           '💊', '#22c55e', 'expense', true, NULL),
  ('Education',        '📚', '#06b6d4', 'expense', true, NULL),
  ('Home',             '🏠', '#78716c', 'expense', true, NULL),
  ('Clothing',         '👕', '#f472b6', 'expense', true, NULL),
  ('Gifts',            '🎁', '#fb923c', 'expense', true, NULL),
  ('Subscriptions',    '📱', '#8b5cf6', 'expense', true, NULL),
  ('Other',            '📦', '#6b7280', 'expense', true, NULL),
  -- Income
  ('Salary',           '💰', '#22c55e', 'income',  true, NULL),
  ('Freelance',        '💻', '#3b82f6', 'income',  true, NULL),
  ('Tips',             '💵', '#f97316', 'income',  true, NULL),
  ('Gifts Received',   '🎉', '#ec4899', 'income',  true, NULL),
  ('Other Income',     '📈', '#a855f7', 'income',  true, NULL);

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
  INSERT INTO public.transaction_categories (household_id, name, icon, color, type, is_default)
  SELECT household_id_param, name, icon, color, type, true
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
