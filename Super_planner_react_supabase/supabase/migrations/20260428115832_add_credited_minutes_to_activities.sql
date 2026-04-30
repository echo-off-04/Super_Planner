/*
  # Add credited_minutes to activities

  1. Changes
    - Add `credited_minutes` integer column to `activities` (default 0)
      Tracks how many minutes of a recuperation slot have been "credited"
      against due-hours, allowing the slot to remain visible (greyed out)
      while having been redeemed in part or in full.

  2. Security
    - No RLS policy changes required; existing policies cover the new column.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activities' AND column_name = 'credited_minutes'
  ) THEN
    ALTER TABLE activities
      ADD COLUMN credited_minutes integer NOT NULL DEFAULT 0;
  END IF;
END $$;
