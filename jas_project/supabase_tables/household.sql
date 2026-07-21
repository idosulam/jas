-- ============================================================
-- Household migration — Run in Supabase SQL Editor
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

-- Add shared_note columns to shifts
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS shared_note TEXT;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS shared_note_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

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
