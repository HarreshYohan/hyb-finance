-- ══════════════════════════════════════════════════════════════════
--  Centa — Production Supabase Schema
--  Run this entire file in your Supabase SQL Editor.
--  All tables use auth.users for identity — no custom users table needed.
-- ══════════════════════════════════════════════════════════════════

-- UUID helper (already available in Supabase by default)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- uncomment if needed

-- ─────────────────────────────────────────────────────────────────
--  1. PROFILES  (public extension of auth.users)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name    TEXT,
  currency        TEXT NOT NULL DEFAULT 'LKR',
  plan            TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'lifetime')),
  revenue_cat_id  TEXT,
  avatar_url      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'display_name');
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
  tags        TEXT[] DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

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
  UNIQUE (user_id, category)
);

CREATE INDEX IF NOT EXISTS idx_budgets_user ON budgets (user_id);

-- ─────────────────────────────────────────────────────────────────
--  6. RECURRING TRANSACTIONS  (salary, loan EMIs, subscriptions)
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
--  7. TAGS  (Pro plan feature)
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
--  8. NOTIFICATION PREFERENCES
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_prefs (
  user_id           UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  daily_reminder    BOOLEAN NOT NULL DEFAULT TRUE,
  reminder_time     TIME NOT NULL DEFAULT '20:00',
  weekly_report     BOOLEAN NOT NULL DEFAULT TRUE,
  budget_alerts     BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets               ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_prefs    ENABLE ROW LEVEL SECURITY;

-- RLS policies — DROP first so the file is safe to re-run
DO $$ DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['transactions','debts','goals','budgets','recurring_transactions','tags','notification_prefs']
  LOOP
    EXECUTE format('
      DROP POLICY IF EXISTS "select_own_%1$s" ON %1$s;
      DROP POLICY IF EXISTS "insert_own_%1$s" ON %1$s;
      DROP POLICY IF EXISTS "update_own_%1$s" ON %1$s;
      DROP POLICY IF EXISTS "delete_own_%1$s" ON %1$s;
      CREATE POLICY "select_own_%1$s" ON %1$s FOR SELECT  USING (auth.uid() = user_id);
      CREATE POLICY "insert_own_%1$s" ON %1$s FOR INSERT  WITH CHECK (auth.uid() = user_id);
      CREATE POLICY "update_own_%1$s" ON %1$s FOR UPDATE  USING (auth.uid() = user_id);
      CREATE POLICY "delete_own_%1$s" ON %1$s FOR DELETE  USING (auth.uid() = user_id);
    ', tbl);
  END LOOP;
END $$;

-- profiles uses id instead of user_id
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT  USING (auth.uid() = id);
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT  WITH CHECK (auth.uid() = id);
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE  USING (auth.uid() = id);

-- ═══════════════════════════════════════════════════════════════════
--  UPDATED_AT trigger (keeps updated_at fresh on every UPDATE)
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
  FOREACH tbl IN ARRAY ARRAY[
    'profiles','transactions','debts','goals','budgets',
    'recurring_transactions','notification_prefs'
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
