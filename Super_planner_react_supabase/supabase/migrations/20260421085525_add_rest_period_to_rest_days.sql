/*
  # Add rest period to rest_days

  1. Changes
    - `rest_days.rest_period` (text, default 'full_day'): indicates whether the
      rest is for the whole day, only the morning, or only the afternoon.
      Allowed values: 'full_day' | 'morning' | 'afternoon'.

  2. Notes
    - Existing rows keep 'full_day' behavior (no data loss).
    - A check constraint restricts values. Added only if missing.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rest_days' AND column_name = 'rest_period'
  ) THEN
    ALTER TABLE rest_days
      ADD COLUMN rest_period text NOT NULL DEFAULT 'full_day';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'rest_days' AND constraint_name = 'rest_days_rest_period_check'
  ) THEN
    ALTER TABLE rest_days
      ADD CONSTRAINT rest_days_rest_period_check
      CHECK (rest_period IN ('full_day', 'morning', 'afternoon'));
  END IF;
END $$;
