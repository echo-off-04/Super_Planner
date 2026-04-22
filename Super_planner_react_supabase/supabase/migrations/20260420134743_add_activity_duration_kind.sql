/*
  # Add duration tracking to activities

  1. New Columns on `activities`
    - `duration_kind` (text) - one of 'full_day', 'morning', 'afternoon', 'custom'. Tracks whether the activity is a full day, half-day morning, half-day afternoon, or custom slot.
    - `break_minutes` (integer, default 0) - break time not counted as work (e.g. 60 for a typical full day).

  2. Notes
    - Existing rows get default values ('custom' and 0) so historical data is preserved.
    - No data is destroyed.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activities' AND column_name = 'duration_kind'
  ) THEN
    ALTER TABLE activities ADD COLUMN duration_kind text DEFAULT 'custom';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activities' AND column_name = 'break_minutes'
  ) THEN
    ALTER TABLE activities ADD COLUMN break_minutes integer DEFAULT 0;
  END IF;
END $$;
