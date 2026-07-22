-- ============================================================
-- Transactions v2 migration — Run AFTER household_transactions.sql
-- Adds 'contribute' transaction type + goal_id reference
-- ============================================================

-- Add goal_id column to transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS goal_id UUID REFERENCES public.savings_goals(id) ON DELETE SET NULL;

-- Update the type CHECK constraint to include 'contribute'
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_type_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_type_check CHECK (type IN ('expense', 'income', 'contribute'));

CREATE INDEX idx_t_goal ON public.transactions(goal_id);

NOTIFY pgrst, 'reload schema';
