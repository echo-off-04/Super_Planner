/*
  # Create vacations table

  1. New Tables
    - `vacations`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `start_date` (date) — first vacation day (inclusive)
      - `end_date` (date) — last vacation day (inclusive)
      - `label` (text, default '') — optional description (e.g. "Été", "Noël")
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Policies: users can only read/write their own vacations
*/

CREATE TABLE IF NOT EXISTS vacations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vacations_dates_check CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS vacations_user_range_idx
  ON vacations (user_id, start_date, end_date);

ALTER TABLE vacations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vacations' AND policyname = 'Users can view own vacations'
  ) THEN
    CREATE POLICY "Users can view own vacations"
      ON vacations FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vacations' AND policyname = 'Users can insert own vacations'
  ) THEN
    CREATE POLICY "Users can insert own vacations"
      ON vacations FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vacations' AND policyname = 'Users can update own vacations'
  ) THEN
    CREATE POLICY "Users can update own vacations"
      ON vacations FOR UPDATE TO authenticated
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vacations' AND policyname = 'Users can delete own vacations'
  ) THEN
    CREATE POLICY "Users can delete own vacations"
      ON vacations FOR DELETE TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;
