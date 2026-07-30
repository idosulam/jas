-- ============================================================
-- Multi-Category Budgets migration
-- Run AFTER household.sql and household_transactions.sql
-- Creates budgets that track spending across multiple categories
-- ============================================================

-- ── Drop ──────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.budget_categories CASCADE;
DROP TABLE IF EXISTS public.budgets CASCADE;

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

-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_categories ENABLE ROW LEVEL SECURITY;

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

NOTIFY pgrst, 'reload schema';
