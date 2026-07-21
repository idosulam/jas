-- ============================================================
-- Household migration — Run in Supabase SQL Editor
-- Idempotent: drops and recreates cleanly every time.
-- ============================================================

-- ── Drop in reverse dependency order ────────────────────────

DROP POLICY IF EXISTS "Members can read own household" ON public.households;
DROP POLICY IF EXISTS "Authenticated users can create households" ON public.households;
DROP POLICY IF EXISTS "Owners can update household" ON public.households;
DROP POLICY IF EXISTS "Members can read household members" ON public.household_members;
DROP POLICY IF EXISTS "Users can join households" ON public.household_members;
DROP POLICY IF EXISTS "Users can leave households" ON public.household_members;
DROP POLICY IF EXISTS "Members can read savings goals" ON public.savings_goals;
DROP POLICY IF EXISTS "Members can create savings goals" ON public.savings_goals;
DROP POLICY IF EXISTS "Members can update savings goals" ON public.savings_goals;
DROP POLICY IF EXISTS "Members can delete savings goals" ON public.savings_goals;
DROP POLICY IF EXISTS "Members can read contributions" ON public.savings_contributions;
DROP POLICY IF EXISTS "Users can add contributions" ON public.savings_contributions;

DROP TRIGGER IF EXISTS trg_check_savings_completion ON public.savings_goals;
DROP TABLE IF EXISTS public.savings_contributions CASCADE;
DROP TABLE IF EXISTS public.savings_goals CASCADE;
DROP TABLE IF EXISTS public.household_members CASCADE;
DROP TABLE IF EXISTS public.households CASCADE;
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

-- Add shared_note columns to shifts
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS shared_note TEXT;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS shared_note_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── RLS ─────────────────────────────────────────────────────

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_contributions ENABLE ROW LEVEL SECURITY;

-- ── Helper function (SECURITY DEFINER = no recursion) ───────

CREATE FUNCTION public.is_household_member(p_household_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = p_household_id AND user_id = auth.uid()
  );
$$;

-- ── Policies ────────────────────────────────────────────────

-- households
CREATE POLICY "Members can read own household"
  ON public.households FOR SELECT
  USING (public.is_household_member(id));

CREATE POLICY "Authenticated users can create households"
  ON public.households FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owners can update household"
  ON public.households FOR UPDATE
  USING (public.is_household_member(id));

-- household_members
CREATE POLICY "Members can read household members"
  ON public.household_members FOR SELECT
  USING (public.is_household_member(household_id));

CREATE POLICY "Users can join households"
  ON public.household_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave households"
  ON public.household_members FOR DELETE
  USING (auth.uid() = user_id);

-- savings_goals
CREATE POLICY "Members can read savings goals"
  ON public.savings_goals FOR SELECT
  USING (public.is_household_member(household_id));

CREATE POLICY "Members can create savings goals"
  ON public.savings_goals FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND public.is_household_member(household_id)
  );

CREATE POLICY "Members can update savings goals"
  ON public.savings_goals FOR UPDATE
  USING (public.is_household_member(household_id));

CREATE POLICY "Members can delete savings goals"
  ON public.savings_goals FOR DELETE
  USING (public.is_household_member(household_id));

-- savings_contributions
CREATE POLICY "Members can read contributions"
  ON public.savings_contributions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.savings_goals sg
      WHERE sg.id = savings_contributions.goal_id
        AND public.is_household_member(sg.household_id)
    )
  );

CREATE POLICY "Users can add contributions"
  ON public.savings_contributions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

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

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
