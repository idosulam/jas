-- ============================================================
-- Multi-Category Budgets migration
-- Run AFTER household_transactions.sql
-- Creates budgets that track spending across multiple categories
-- ============================================================

-- ── Drop ──────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.budget_categories CASCADE;
DROP TABLE IF EXISTS public.budgets CASCADE;
DROP TABLE IF EXISTS public.goal_categories CASCADE;

-- ── Helper function ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_household_member(household_id_param UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = household_id_param
    AND user_id = auth.uid()
  );
$$;

-- ── Budgets ──────────────────────────────────────────────────

CREATE TABLE public.budgets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  UUID REFERENCES public.households(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  icon          TEXT NOT NULL DEFAULT '📊',
  color         TEXT NOT NULL DEFAULT '#818cf8',
  amount        NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_budgets_household ON public.budgets(household_id);

-- ── Budget ↔ Category junction ───────────────────────────────

CREATE TABLE public.budget_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id   UUID REFERENCES public.budgets(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.transaction_categories(id) ON DELETE CASCADE,
  UNIQUE (budget_id, category_id)
);

CREATE INDEX idx_bc_budget ON public.budget_categories(budget_id);
CREATE INDEX idx_bc_category ON public.budget_categories(category_id);

-- ── Goal ↔ Category junction (for category-tracked goals) ────

CREATE TABLE public.goal_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id     UUID REFERENCES public.savings_goals(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.transaction_categories(id) ON DELETE CASCADE,
  UNIQUE (goal_id, category_id)
);

CREATE INDEX idx_gc_goal ON public.goal_categories(goal_id);
CREATE INDEX idx_gc_category ON public.goal_categories(category_id);

-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_categories ENABLE ROW LEVEL SECURITY;

-- Budgets: household members can manage
CREATE POLICY "Household members can view budgets"
  ON public.budgets FOR SELECT
  USING (public.is_household_member(household_id));

CREATE POLICY "Household members can insert budgets"
  ON public.budgets FOR INSERT
  WITH CHECK (public.is_household_member(household_id));

CREATE POLICY "Household members can update budgets"
  ON public.budgets FOR UPDATE
  USING (public.is_household_member(household_id));

CREATE POLICY "Household members can delete budgets"
  ON public.budgets FOR DELETE
  USING (public.is_household_member(household_id));

-- Budget categories: same household check via budget
CREATE POLICY "Household members can view budget_categories"
  ON public.budget_categories FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.budgets b
    WHERE b.id = budget_categories.budget_id
    AND public.is_household_member(b.household_id)
  ));

CREATE POLICY "Household members can insert budget_categories"
  ON public.budget_categories FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.budgets b
    WHERE b.id = budget_categories.budget_id
    AND public.is_household_member(b.household_id)
  ));

CREATE POLICY "Household members can delete budget_categories"
  ON public.budget_categories FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.budgets b
    WHERE b.id = budget_categories.budget_id
    AND public.is_household_member(b.household_id)
  ));

-- Goal categories: same household check via goal
CREATE POLICY "Household members can view goal_categories"
  ON public.goal_categories FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.savings_goals g
    WHERE g.id = goal_categories.goal_id
    AND public.is_household_member(g.household_id)
  ));

CREATE POLICY "Household members can insert goal_categories"
  ON public.goal_categories FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.savings_goals g
    WHERE g.id = goal_categories.goal_id
    AND public.is_household_member(g.household_id)
  ));

CREATE POLICY "Household members can delete goal_categories"
  ON public.goal_categories FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.savings_goals g
    WHERE g.id = goal_categories.goal_id
    AND public.is_household_member(g.household_id)
  ));

-- ── Remove old budget_amount column from transaction_categories ──
-- (optional: keep for backward compat, but new budgets use budgets table)
-- ALTER TABLE public.transaction_categories DROP COLUMN IF EXISTS budget_amount;

-- ── Add weight_unit to profile ──────────────────────────────

ALTER TABLE public.profile
  ADD COLUMN IF NOT EXISTS weight_unit TEXT NOT NULL DEFAULT 'kg' CHECK (weight_unit IN ('kg', 'lbs'));

NOTIFY pgrst, 'reload schema';
