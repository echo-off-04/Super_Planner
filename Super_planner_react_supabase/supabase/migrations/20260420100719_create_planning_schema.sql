/*
  # Planning Management Schema

  1. New Tables
    - `profiles` - User profile with role
    - `contract_settings` - User contract hours config (weekly hours, overtime threshold)
    - `activities` - Scheduled activities (start/end time, type, title)
    - `rest_rules` - User preferences for rest days (preferred day, min rest hours)
    - `rest_days` - Validated or suggested rest days

  2. Security
    - Enable RLS on all tables
    - Policies ensure users only access their own data
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text DEFAULT '',
  role text DEFAULT 'logisticien',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE IF NOT EXISTS contract_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  weekly_hours numeric DEFAULT 35,
  daily_max_hours numeric DEFAULT 10,
  min_rest_hours numeric DEFAULT 11,
  overtime_rate numeric DEFAULT 1.25,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE contract_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own contract" ON contract_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own contract" ON contract_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own contract" ON contract_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own contract" ON contract_settings FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text DEFAULT '',
  activity_type text DEFAULT 'prestation',
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  location text DEFAULT '',
  notes text DEFAULT '',
  source text DEFAULT 'manual',
  external_id text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activities_user_time ON activities(user_id, start_time);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own activities" ON activities FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own activities" ON activities FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own activities" ON activities FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own activities" ON activities FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS rest_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  preferred_rest_days integer[] DEFAULT '{1,5}',
  preferred_time_of_day text DEFAULT 'any',
  min_consecutive_rest_days integer DEFAULT 1,
  auto_suggest boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE rest_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own rules" ON rest_rules FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own rules" ON rest_rules FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own rules" ON rest_rules FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own rules" ON rest_rules FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS rest_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rest_date date NOT NULL,
  status text DEFAULT 'suggested',
  reason text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, rest_date)
);

CREATE INDEX IF NOT EXISTS idx_rest_days_user_date ON rest_days(user_id, rest_date);

ALTER TABLE rest_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own rest days" ON rest_days FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own rest days" ON rest_days FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own rest days" ON rest_days FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own rest days" ON rest_days FOR DELETE TO authenticated USING (auth.uid() = user_id);
