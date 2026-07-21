-- Household system for couples sharing the app.
-- Run AFTER all other table scripts.

-- 1. Households table
CREATE TABLE IF NOT EXISTS public.households (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL DEFAULT 'Our Household',
  invite_code TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(6), 'hex'),
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Household members (links users to a household)
CREATE TABLE IF NOT EXISTS public.household_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES public.households(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(household_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_hm_user ON public.household_members(user_id);
CREATE INDEX IF NOT EXISTS idx_hm_household ON public.household_members(household_id);

-- 3. Savings goals (shared within a household)
CREATE TABLE IF NOT EXISTS public.savings_goals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES public.households(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  target_amount NUMERIC(12, 2) NOT NULL CHECK (target_amount > 0),
  current_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  icon         TEXT DEFAULT '🎯',
  color        TEXT DEFAULT '#818cf8',
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sg_household ON public.savings_goals(household_id);

-- 4. Savings contributions (who added what)
CREATE TABLE IF NOT EXISTS public.savings_contributions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id      UUID REFERENCES public.savings_goals(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  amount       NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sc_goal ON public.savings_contributions(goal_id);

-- 5. Couple notes on shifts
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS shared_note TEXT;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS shared_note_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- RLS for households
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_contributions ENABLE ROW LEVEL SECURITY;

-- Household policies: members can read their own household
CREATE POLICY "Members can read own household"
  ON public.households FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.household_members
      WHERE household_id = households.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can create households"
  ON public.households FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owners can update household"
  ON public.households FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.household_members
      WHERE household_id = households.id AND user_id = auth.uid() AND role = 'owner'
    )
  );

-- Household members policies
CREATE POLICY "Members can read household members"
  ON public.household_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.household_members hm
      WHERE hm.household_id = household_members.household_id AND hm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join households"
  ON public.household_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave households"
  ON public.household_members FOR DELETE
  USING (auth.uid() = user_id);

-- Savings goals policies: household members can CRUD
CREATE POLICY "Members can read savings goals"
  ON public.savings_goals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.household_members
      WHERE household_id = savings_goals.household_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Members can create savings goals"
  ON public.savings_goals FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM public.household_members
      WHERE household_id = savings_goals.household_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Members can update savings goals"
  ON public.savings_goals FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.household_members
      WHERE household_id = savings_goals.household_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Members can delete savings goals"
  ON public.savings_goals FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.household_members
      WHERE household_id = savings_goals.household_id AND user_id = auth.uid()
    )
  );

-- Savings contributions policies
CREATE POLICY "Members can read contributions"
  ON public.savings_contributions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.savings_goals sg
      JOIN public.household_members hm ON hm.household_id = sg.household_id
      WHERE sg.id = savings_contributions.goal_id AND hm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add contributions"
  ON public.savings_contributions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Function to auto-update goal completion
CREATE OR REPLACE FUNCTION public.check_savings_goal_completion()
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

-- Function to get household partner's shifts (for the dashboard)
CREATE OR REPLACE FUNCTION public.get_household_shifts(p_user_id UUID, p_start DATE, p_end DATE)
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  shift_date DATE,
  hours NUMERIC,
  tips NUMERIC,
  pay_type TEXT,
  place TEXT,
  color TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.user_id,
    COALESCE(p.display_name, 'User') as display_name,
    s.shift_date,
    s.hours,
    s.tips,
    s.pay_type,
    s.place,
    s.color
  FROM public.shifts s
  JOIN public.household_members hm ON hm.user_id = s.user_id
  JOIN public.household_members me ON me.household_id = hm.household_id AND me.user_id = p_user_id
  LEFT JOIN public.profile p ON p.user_id = s.user_id
  WHERE s.shift_date >= p_start
    AND s.shift_date <= p_end;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
