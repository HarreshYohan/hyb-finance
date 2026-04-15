-- ══════════════════════════════════════════════════════════════════
--  Centa — Production Supabase Schema  v2
--  Safe to re-run on existing databases — all operations idempotent.
--  Run entire file in Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
--  1. PROFILES  (public extension of auth.users)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id                   UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name         TEXT,
  currency             TEXT NOT NULL DEFAULT 'LKR',
  plan                 TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'lifetime')),
  revenue_cat_id       TEXT,
  avatar_url           TEXT,
  onboarding_completed BOOLEAN DEFAULT false,
  estimated_income     NUMERIC(14,2) DEFAULT 0,
  target_savings_rate  NUMERIC(14,2) DEFAULT 20.00,
  investment_enabled   BOOLEAN DEFAULT true,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed  BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS estimated_income      NUMERIC(14,2) DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS target_savings_rate   NUMERIC(14,2) DEFAULT 20.00;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS investment_enabled    BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id    TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_expires_at       TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at            TIMESTAMPTZ DEFAULT NOW();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'display_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────
--  2. TRANSACTIONS
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  desc_text   TEXT NOT NULL,
  amount      NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  type        TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  date        DATE NOT NULL,
  category    TEXT NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
-- NOTE: if your existing DB has a `tags` column on transactions, you can drop it:
-- ALTER TABLE transactions DROP COLUMN IF EXISTS tags;

CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_type ON transactions (user_id, type);

-- ─────────────────────────────────────────────────────────────────
--  3. DEBTS
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS debts (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name        TEXT NOT NULL,
  desc_text   TEXT,
  amount      NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  paid        NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (paid >= 0),
  dir         TEXT NOT NULL CHECK (dir IN ('owe', 'owed')),
  category    TEXT,
  due         DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_debts_user ON debts (user_id);

-- ─────────────────────────────────────────────────────────────────
--  3b. DEBT PAYMENT LOG
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS debt_payments (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  debt_id     TEXT NOT NULL REFERENCES debts ON DELETE CASCADE,
  amount      NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_debt_payments_debt ON debt_payments (debt_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_user ON debt_payments (user_id);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fixed_expenses JSONB DEFAULT '[]'::jsonb;

-- ─────────────────────────────────────────────────────────────────
--  4. GOALS
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goals (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name        TEXT NOT NULL,
  note        TEXT,
  target      NUMERIC(14, 2) NOT NULL CHECK (target > 0),
  saved       NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (saved >= 0),
  color       TEXT DEFAULT '#1A7F4E',
  deadline    DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goals_user ON goals (user_id);

-- ─────────────────────────────────────────────────────────────────
--  5. BUDGETS  (one row per category per user)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS budgets (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  category      TEXT NOT NULL,
  limit_amount  NUMERIC(14, 2) NOT NULL CHECK (limit_amount >= 0),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, category)
);

CREATE INDEX IF NOT EXISTS idx_budgets_user ON budgets (user_id);

-- ─────────────────────────────────────────────────────────────────
--  6. RECURRING TRANSACTIONS
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recurring_transactions (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  desc_text   TEXT NOT NULL,
  amount      NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  type        TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category    TEXT NOT NULL,
  frequency   TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
  next_due    DATE NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_user_active ON recurring_transactions (user_id, active);

-- ─────────────────────────────────────────────────────────────────
--  7. FINANCIAL PLANS  (one row per user — created via onboarding wizard)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS financial_plans (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE UNIQUE,
  monthly_income         NUMERIC(14,2) NOT NULL DEFAULT 0,
  income_freq            TEXT NOT NULL DEFAULT 'monthly' CHECK (income_freq IN ('monthly','biweekly','weekly')),
  rent                   NUMERIC(14,2) NOT NULL DEFAULT 0,
  utilities              NUMERIC(14,2) NOT NULL DEFAULT 0,
  loan_emis              NUMERIC(14,2) NOT NULL DEFAULT 0,
  insurance              NUMERIC(14,2) NOT NULL DEFAULT 0,
  fixed_expenses         NUMERIC(14,2) NOT NULL DEFAULT 0,
  food                   NUMERIC(14,2) NOT NULL DEFAULT 0,
  transport              NUMERIC(14,2) NOT NULL DEFAULT 0,
  entertainment          NUMERIC(14,2) NOT NULL DEFAULT 0,
  shopping               NUMERIC(14,2) NOT NULL DEFAULT 0,
  variable_expenses      NUMERIC(14,2) NOT NULL DEFAULT 0,
  primary_goal           TEXT,
  goal_amount            NUMERIC(14,2),
  goal_months            INTEGER,
  risk_profile           TEXT NOT NULL DEFAULT 'moderate' CHECK (risk_profile IN ('conservative','moderate','aggressive')),
  lifestyle              TEXT NOT NULL DEFAULT 'single' CHECK (lifestyle IN ('single','couple','family')),
  dependents             INTEGER NOT NULL DEFAULT 0,
  alloc_needs            NUMERIC(5,2) NOT NULL DEFAULT 50,
  alloc_wants            NUMERIC(5,2) NOT NULL DEFAULT 30,
  alloc_savings          NUMERIC(5,2) NOT NULL DEFAULT 10,
  alloc_invest           NUMERIC(5,2) NOT NULL DEFAULT 10,
  emergency_fund_target  NUMERIC(14,2) NOT NULL DEFAULT 0,
  monthly_savings_target NUMERIC(14,2) NOT NULL DEFAULT 0,
  monthly_invest_target  NUMERIC(14,2) NOT NULL DEFAULT 0,
  target_needs           NUMERIC(14,2) NOT NULL DEFAULT 0,
  target_wants           NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_plans_user ON financial_plans (user_id);

-- ─────────────────────────────────────────────────────────────────
--  8. CUSTOM CATEGORIES
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS custom_categories (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id   UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name      TEXT NOT NULL,
  type      TEXT NOT NULL CHECK (type IN ('income','expense')),
  color     TEXT DEFAULT '#5C5A55',
  UNIQUE (user_id, name, type)
);

CREATE INDEX IF NOT EXISTS idx_custom_cats_user ON custom_categories (user_id);

-- ─────────────────────────────────────────────────────────────────
--  9. CREDIT CARDS  (Pro)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_cards (
  id            TEXT PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name          TEXT NOT NULL,              -- "HSBC Platinum"
  bank          TEXT,
  last4         CHAR(4),
  credit_limit  NUMERIC(14,2) NOT NULL DEFAULT 0,
  billing_day   INTEGER NOT NULL DEFAULT 1  CHECK (billing_day  BETWEEN 1 AND 28),
  due_day       INTEGER NOT NULL DEFAULT 15 CHECK (due_day      BETWEEN 1 AND 28),
  -- Annual interest rate as decimal: 0.24 = 24% p.a.
  interest_rate NUMERIC(6,4) NOT NULL DEFAULT 0.2400,
  color         TEXT DEFAULT '#1A7F4E',
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_cards_user ON credit_cards (user_id);

-- ─────────────────────────────────────────────────────────────────
--  10. CREDIT CARD STATEMENTS  (monthly billing cycle)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_card_statements (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id         TEXT NOT NULL REFERENCES credit_cards ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  -- First day of statement month e.g. 2024-03-01
  statement_month DATE NOT NULL,
  total_spent     NUMERIC(14,2) NOT NULL DEFAULT 0,
  opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0,  -- carried over from last month
  closing_balance NUMERIC(14,2) NOT NULL DEFAULT 0,  -- = opening + spent - paid
  min_payment     NUMERIC(14,2) NOT NULL DEFAULT 0,
  full_payment    NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid_on         DATE,
  due_date        DATE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','partial','paid','overdue')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (card_id, statement_month)
);

CREATE INDEX IF NOT EXISTS idx_cc_statements_card   ON credit_card_statements (card_id, statement_month DESC);
CREATE INDEX IF NOT EXISTS idx_cc_statements_user   ON credit_card_statements (user_id, statement_month DESC);
CREATE INDEX IF NOT EXISTS idx_cc_statements_status ON credit_card_statements (user_id, status);

-- ─────────────────────────────────────────────────────────────────
--  11. CREDIT CARD INSTALLMENT PLANS  (0% EMI / interest-bearing)
--  Each row is one purchase split across N months.
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_card_installments (
  id             TEXT PRIMARY KEY,
  card_id        TEXT NOT NULL REFERENCES credit_cards ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  description    TEXT NOT NULL,
  total_amount   NUMERIC(14,2) NOT NULL CHECK (total_amount > 0),
  total_months   INTEGER NOT NULL CHECK (total_months > 0),
  paid_months    INTEGER NOT NULL DEFAULT 0,
  -- Monthly amount including any flat processing fee split
  monthly_amount NUMERIC(14,2) NOT NULL,
  -- Annual interest rate as decimal (0 for 0% schemes)
  interest_rate  NUMERIC(6,4) NOT NULL DEFAULT 0,
  -- Total interest cost over the full term
  total_interest NUMERIC(14,2) NOT NULL DEFAULT 0,
  start_date     DATE NOT NULL,
  -- Computed: start_date + total_months months
  end_date       DATE NOT NULL,
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cc_installments_card   ON credit_card_installments (card_id);
CREATE INDEX IF NOT EXISTS idx_cc_installments_user   ON credit_card_installments (user_id, active);

-- ─────────────────────────────────────────────────────────────────
--  12. INVESTMENTS  (Pro / Lifetime)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS investments (
  id              TEXT PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN (
                    'stock','mutual_fund','etf','crypto',
                    'gold','bond','fixed_deposit','other')),
  invested_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (invested_amount >= 0),
  current_value   NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (current_value >= 0),
  units           NUMERIC(18,6),
  purchase_price  NUMERIC(14,4),
  current_price   NUMERIC(14,4),
  currency        TEXT DEFAULT 'LKR',
  platform        TEXT,          -- "CSE", "eToro", "Comex", etc.
  purchase_date   DATE,
  expected_return NUMERIC(6,4),  -- annual % as decimal e.g. 0.12 = 12%
  notes           TEXT,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investments_user      ON investments (user_id);
CREATE INDEX IF NOT EXISTS idx_investments_user_type ON investments (user_id, type);

-- ─────────────────────────────────────────────────────────────────
--  13. INVESTMENT SNAPSHOTS  (value history for charts & projection)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS investment_snapshots (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  investment_id TEXT NOT NULL REFERENCES investments ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  value         NUMERIC(14,2) NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (investment_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_inv_snapshots_inv  ON investment_snapshots (investment_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_inv_snapshots_user ON investment_snapshots (user_id, snapshot_date DESC);

-- ─────────────────────────────────────────────────────────────────
--  14. FIXED OBLIGATIONS  (loans, mortgages, subscriptions, gold)
--  Covers anything with a recurring fixed payment + possible interest.
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fixed_obligations (
  id              TEXT PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN (
                    'loan','mortgage','hire_purchase',
                    'subscription','gold_scheme','other')),
  -- Loan / mortgage fields
  principal       NUMERIC(14,2),            -- original borrowed amount
  outstanding     NUMERIC(14,2) NOT NULL,   -- remaining balance
  monthly_payment NUMERIC(14,2) NOT NULL,
  -- Annual interest rate as decimal; 0 for subscriptions
  interest_rate   NUMERIC(6,4) NOT NULL DEFAULT 0,
  -- Schedule
  start_date      DATE,
  end_date        DATE,                     -- contractual end / subscription renewal
  next_due        DATE NOT NULL,
  payment_day     INTEGER CHECK (payment_day BETWEEN 1 AND 31),
  -- Metadata
  lender          TEXT,                     -- "BOC", "Netflix", "Malabar Gold", etc.
  category        TEXT DEFAULT 'Fixed',
  notes           TEXT,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_obligations_user        ON fixed_obligations (user_id);
CREATE INDEX IF NOT EXISTS idx_obligations_user_active ON fixed_obligations (user_id, active);

-- ─────────────────────────────────────────────────────────────────
--  15. TAGS  (Pro — user-defined labels, separate from transactions)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tags (
  id        TEXT PRIMARY KEY,
  user_id   UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name      TEXT NOT NULL,
  color     TEXT DEFAULT '#5C5A55',
  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_tags_user ON tags (user_id);

-- ─────────────────────────────────────────────────────────────────
--  16. NOTIFICATION PREFERENCES  (extended with push support)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_prefs (
  user_id                  UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  daily_reminder           BOOLEAN NOT NULL DEFAULT TRUE,
  reminder_time            TIME    NOT NULL DEFAULT '20:00',
  weekly_report            BOOLEAN NOT NULL DEFAULT TRUE,
  budget_alerts            BOOLEAN NOT NULL DEFAULT TRUE,
  -- Push notification fields
  push_enabled             BOOLEAN NOT NULL DEFAULT FALSE,
  push_token               TEXT,            -- Web Push subscription JSON or FCM token
  reminder_interval_minutes INTEGER NOT NULL DEFAULT 240, -- 4 h default; min 30
  last_push_at             TIMESTAMPTZ,
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

-- Idempotent patches for existing notification_prefs rows
ALTER TABLE notification_prefs ADD COLUMN IF NOT EXISTS push_enabled              BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE notification_prefs ADD COLUMN IF NOT EXISTS push_token                TEXT;
ALTER TABLE notification_prefs ADD COLUMN IF NOT EXISTS reminder_interval_minutes INTEGER NOT NULL DEFAULT 240;
ALTER TABLE notification_prefs ADD COLUMN IF NOT EXISTS last_push_at              TIMESTAMPTZ;

-- ═══════════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets                ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_plans        ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_cards           ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_card_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_card_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_snapshots   ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_obligations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_prefs     ENABLE ROW LEVEL SECURITY;

-- Standard user_id-based policies (bulk)
DO $$ DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'transactions','debts','goals','budgets','recurring_transactions',
    'credit_cards','credit_card_statements','credit_card_installments',
    'investments','investment_snapshots','fixed_obligations',
    'tags','notification_prefs','custom_categories'
  ]
  LOOP
    EXECUTE format('
      DROP POLICY IF EXISTS "select_own_%1$s" ON %1$s;
      DROP POLICY IF EXISTS "insert_own_%1$s" ON %1$s;
      DROP POLICY IF EXISTS "update_own_%1$s" ON %1$s;
      DROP POLICY IF EXISTS "delete_own_%1$s" ON %1$s;
      CREATE POLICY "select_own_%1$s" ON %1$s FOR SELECT USING      (auth.uid() = user_id);
      CREATE POLICY "insert_own_%1$s" ON %1$s FOR INSERT WITH CHECK  (auth.uid() = user_id);
      CREATE POLICY "update_own_%1$s" ON %1$s FOR UPDATE USING      (auth.uid() = user_id);
      CREATE POLICY "delete_own_%1$s" ON %1$s FOR DELETE USING      (auth.uid() = user_id);
    ', tbl);
  END LOOP;
END $$;

-- financial_plans
DROP POLICY IF EXISTS "select_own_financial_plans" ON financial_plans;
DROP POLICY IF EXISTS "insert_own_financial_plans" ON financial_plans;
DROP POLICY IF EXISTS "update_own_financial_plans" ON financial_plans;
DROP POLICY IF EXISTS "delete_own_financial_plans" ON financial_plans;
CREATE POLICY "select_own_financial_plans" ON financial_plans FOR SELECT USING      (auth.uid() = user_id);
CREATE POLICY "insert_own_financial_plans" ON financial_plans FOR INSERT WITH CHECK  (auth.uid() = user_id);
CREATE POLICY "update_own_financial_plans" ON financial_plans FOR UPDATE USING      (auth.uid() = user_id);
CREATE POLICY "delete_own_financial_plans" ON financial_plans FOR DELETE USING      (auth.uid() = user_id);

-- profiles (uses `id` not `user_id`)
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT USING      (auth.uid() = id);
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT WITH CHECK  (auth.uid() = id);
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE USING      (auth.uid() = id);

-- ─────────────────────────────────────────────────────────────────
--  IDEMPOTENT COLUMN PATCHES  (safe to run on existing databases)
--  Adds updated_at to any table that was created without it.
--  budgets and custom_categories intentionally excluded — custom_categories has no updated_at.
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE budgets                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE transactions           ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE debts                  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE goals                  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE recurring_transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE financial_plans        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE credit_cards           ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE credit_card_statements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE credit_card_installments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE investments             ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE fixed_obligations       ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE notification_prefs      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ═══════════════════════════════════════════════════════════════════
--  UPDATED_AT  trigger
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$ DECLARE tbl TEXT;
BEGIN
  -- NOTE: custom_categories is excluded — it has no updated_at column.
  FOREACH tbl IN ARRAY ARRAY[
    'profiles','transactions','debts','goals',
    'recurring_transactions','financial_plans',
    'credit_cards','credit_card_statements','credit_card_installments',
    'investments','fixed_obligations','notification_prefs','budgets'
  ]
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_updated_at_%1$s ON %1$s;
      CREATE TRIGGER trg_updated_at_%1$s
        BEFORE UPDATE ON %1$s
        FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
    ', tbl);
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════
--  HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Update monthly income ──────────────────────────────────────
--  Call via: supabase.rpc('update_monthly_income', { p_amount: 150000 })
--  Updates both financial_plans and profiles in one call.
CREATE OR REPLACE FUNCTION public.update_monthly_income(p_amount NUMERIC)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE financial_plans
     SET monthly_income = p_amount
   WHERE user_id = auth.uid();

  UPDATE profiles
     SET estimated_income = p_amount
   WHERE id = auth.uid();
END;
$$;

-- ── 2. Credit card installment payoff plan (Avalanche method) ────
--  Returns all active installments for the caller, ranked highest-
--  interest-first with calculated remaining cost and payoff date.
--  Call via: supabase.rpc('get_installment_payoff_plan')
CREATE OR REPLACE FUNCTION public.get_installment_payoff_plan()
RETURNS TABLE (
  installment_id  TEXT,
  card_name       TEXT,
  description     TEXT,
  monthly_amount  NUMERIC,
  months_left     INTEGER,
  remaining_cost  NUMERIC,
  interest_rate   NUMERIC,
  total_interest  NUMERIC,
  payoff_date     DATE,
  priority_rank   INTEGER
) LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    i.id,
    c.name,
    i.description,
    i.monthly_amount,
    (i.total_months - i.paid_months)                            AS months_left,
    i.monthly_amount * (i.total_months - i.paid_months)        AS remaining_cost,
    i.interest_rate,
    i.total_interest,
    (i.start_date + ((i.total_months) * INTERVAL '1 month'))::DATE AS payoff_date,
    RANK() OVER (ORDER BY i.interest_rate DESC, i.monthly_amount DESC)::INTEGER AS priority_rank
  FROM credit_card_installments i
  JOIN credit_cards c ON c.id = i.card_id
  WHERE i.user_id = auth.uid()
    AND i.active   = TRUE
    AND i.paid_months < i.total_months
  ORDER BY priority_rank;
$$;

-- ── 3. Fixed obligation amortization schedule ─────────────────────
--  Returns a month-by-month breakdown for a given obligation:
--  principal paid, interest paid, remaining balance, cumulative interest.
--  Call via: supabase.rpc('get_obligation_amortization', { p_obligation_id: '...' })
CREATE OR REPLACE FUNCTION public.get_obligation_amortization(p_obligation_id TEXT)
RETURNS TABLE (
  month_number    INTEGER,
  payment_date    DATE,
  monthly_payment NUMERIC,
  principal_paid  NUMERIC,
  interest_paid   NUMERIC,
  balance         NUMERIC,
  cumulative_interest NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_balance         NUMERIC;
  v_rate            NUMERIC;   -- monthly rate
  v_payment         NUMERIC;
  v_next_due        DATE;
  v_months          INTEGER := 0;
  v_max_months      INTEGER := 600; -- safety cap (50 years)
  v_cum_interest    NUMERIC := 0;
  v_interest_charge NUMERIC;
  v_principal_charge NUMERIC;
BEGIN
  SELECT outstanding, interest_rate / 12, monthly_payment, next_due
    INTO v_balance, v_rate, v_payment, v_next_due
    FROM fixed_obligations
   WHERE id = p_obligation_id
     AND user_id = auth.uid();

  IF NOT FOUND THEN RETURN; END IF;

  -- For subscriptions / zero-interest obligations
  IF v_rate = 0 THEN
    WHILE v_balance > 0 AND v_months < v_max_months LOOP
      v_months := v_months + 1;
      v_principal_charge := LEAST(v_payment, v_balance);
      v_balance  := v_balance - v_principal_charge;
      month_number    := v_months;
      payment_date    := (v_next_due + ((v_months - 1) * INTERVAL '1 month'))::DATE;
      monthly_payment := v_principal_charge;
      principal_paid  := v_principal_charge;
      interest_paid   := 0;
      balance         := ROUND(v_balance, 2);
      cumulative_interest := 0;
      RETURN NEXT;
    END LOOP;
    RETURN;
  END IF;

  WHILE v_balance > 0.01 AND v_months < v_max_months LOOP
    v_months          := v_months + 1;
    v_interest_charge := ROUND(v_balance * v_rate, 2);
    v_principal_charge := LEAST(v_payment - v_interest_charge, v_balance);
    IF v_principal_charge < 0 THEN v_principal_charge := 0; END IF;
    v_balance          := v_balance - v_principal_charge;
    v_cum_interest     := v_cum_interest + v_interest_charge;

    month_number        := v_months;
    payment_date        := (v_next_due + ((v_months - 1) * INTERVAL '1 month'))::DATE;
    monthly_payment     := ROUND(v_interest_charge + v_principal_charge, 2);
    principal_paid      := ROUND(v_principal_charge, 2);
    interest_paid       := ROUND(v_interest_charge, 2);
    balance             := ROUND(v_balance, 2);
    cumulative_interest := ROUND(v_cum_interest, 2);
    RETURN NEXT;
  END LOOP;
END;
$$;

-- ── 4. Auto-update installment end_date on insert/update ─────────
CREATE OR REPLACE FUNCTION public.set_installment_end_date()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.end_date := (NEW.start_date + (NEW.total_months * INTERVAL '1 month'))::DATE;
  -- Compute total interest using PMT if rate > 0
  IF NEW.interest_rate > 0 THEN
    DECLARE
      r NUMERIC := NEW.interest_rate / 12;
      n INTEGER := NEW.total_months;
      pv NUMERIC := NEW.total_amount;
    BEGIN
      NEW.monthly_amount  := ROUND(pv * r * POWER(1 + r, n) / (POWER(1 + r, n) - 1), 2);
      NEW.total_interest  := ROUND(NEW.monthly_amount * n - pv, 2);
    END;
  ELSE
    NEW.total_interest := 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_installment_end_date ON credit_card_installments;
CREATE TRIGGER trg_installment_end_date
  BEFORE INSERT OR UPDATE OF total_months, start_date, interest_rate, total_amount
  ON credit_card_installments
  FOR EACH ROW EXECUTE PROCEDURE public.set_installment_end_date();

-- ═══════════════════════════════════════════════════════════════════
--  ANALYTICAL VIEWS  (read-only, uses auth.uid() via RLS on base tables)
-- ═══════════════════════════════════════════════════════════════════

-- ── v_credit_card_health ─────────────────────────────────────────
--  Per-card: current utilization, outstanding balance, active installment burden,
--  next statement due date.
CREATE OR REPLACE VIEW v_credit_card_health AS
SELECT
  c.id,
  c.user_id,
  c.name,
  c.bank,
  c.last4,
  c.credit_limit,
  c.interest_rate,
  -- Latest statement data
  s.closing_balance                                         AS outstanding_balance,
  s.due_date                                                AS next_due_date,
  s.status                                                  AS statement_status,
  -- Utilization % (outstanding / limit)
  CASE WHEN c.credit_limit > 0
    THEN ROUND(s.closing_balance / c.credit_limit * 100, 1)
    ELSE 0
  END                                                       AS utilization_pct,
  -- Active installment monthly burden
  COALESCE(inst.monthly_burden, 0)                          AS installment_monthly_burden,
  COALESCE(inst.active_count, 0)                            AS active_installments,
  COALESCE(inst.total_remaining, 0)                         AS installment_remaining_total
FROM credit_cards c
LEFT JOIN LATERAL (
  SELECT closing_balance, due_date, status
    FROM credit_card_statements
   WHERE card_id = c.id
   ORDER BY statement_month DESC
   LIMIT 1
) s ON TRUE
LEFT JOIN LATERAL (
  SELECT
    SUM(monthly_amount)                                     AS monthly_burden,
    COUNT(*)                                                AS active_count,
    SUM(monthly_amount * (total_months - paid_months))     AS total_remaining
  FROM credit_card_installments
  WHERE card_id = c.id AND active = TRUE AND paid_months < total_months
) inst ON TRUE
WHERE c.active = TRUE;

-- ── v_investment_summary ─────────────────────────────────────────
--  Portfolio-level and per-investment performance with projected value.
CREATE OR REPLACE VIEW v_investment_summary AS
SELECT
  i.id,
  i.user_id,
  i.name,
  i.type,
  i.platform,
  i.invested_amount,
  i.current_value,
  i.expected_return,
  -- P&L
  ROUND(i.current_value - i.invested_amount, 2)            AS unrealised_pnl,
  CASE WHEN i.invested_amount > 0
    THEN ROUND((i.current_value - i.invested_amount) / i.invested_amount * 100, 2)
    ELSE 0
  END                                                       AS roi_pct,
  -- 12-month projected value (compound monthly)
  CASE WHEN i.expected_return IS NOT NULL AND i.expected_return > 0
    THEN ROUND(i.current_value * POWER(1 + i.expected_return / 12, 12), 2)
    ELSE i.current_value
  END                                                       AS projected_value_12m,
  -- Days held
  COALESCE((CURRENT_DATE - i.purchase_date), 0)            AS days_held,
  i.purchase_date,
  i.active
FROM investments i
WHERE i.active = TRUE;

-- ── v_obligations_summary ────────────────────────────────────────
--  Total monthly debt burden + estimated months to freedom per obligation.
CREATE OR REPLACE VIEW v_obligations_summary AS
SELECT
  o.id,
  o.user_id,
  o.name,
  o.type,
  o.lender,
  o.outstanding,
  o.monthly_payment,
  o.interest_rate,
  o.next_due,
  o.end_date,
  -- Months remaining (simple: outstanding / payment for 0% or Newton approx for interest)
  CASE
    WHEN o.interest_rate = 0 AND o.monthly_payment > 0
      THEN CEIL(o.outstanding / o.monthly_payment)::INTEGER
    WHEN o.interest_rate > 0 AND o.monthly_payment > 0
      THEN CEIL(
        -LN(1 - (o.interest_rate / 12 * o.outstanding / o.monthly_payment))
        / LN(1 + o.interest_rate / 12)
      )::INTEGER
    ELSE NULL
  END                                                        AS months_remaining,
  -- Projected payoff date
  CASE
    WHEN o.interest_rate = 0 AND o.monthly_payment > 0
      THEN (CURRENT_DATE + CEIL(o.outstanding / o.monthly_payment)::INTEGER
            * INTERVAL '1 month')::DATE
    WHEN o.interest_rate > 0 AND o.monthly_payment > 0
      THEN (CURRENT_DATE + CEIL(
              -LN(1 - (o.interest_rate / 12 * o.outstanding / o.monthly_payment))
              / LN(1 + o.interest_rate / 12)
            )::INTEGER * INTERVAL '1 month')::DATE
    ELSE o.end_date
  END                                                        AS estimated_payoff_date,
  -- Remaining interest cost
  CASE
    WHEN o.interest_rate > 0 AND o.monthly_payment > 0
      THEN ROUND(
        o.monthly_payment * CEIL(
          -LN(1 - (o.interest_rate / 12 * o.outstanding / o.monthly_payment))
          / LN(1 + o.interest_rate / 12)
        ) - o.outstanding, 2)
    ELSE 0
  END                                                        AS remaining_interest_cost,
  o.active
FROM fixed_obligations o
WHERE o.active = TRUE;
