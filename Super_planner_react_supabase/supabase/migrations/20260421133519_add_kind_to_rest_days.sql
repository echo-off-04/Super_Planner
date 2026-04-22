/*
  # Add `kind` column to `rest_days`

  Introduces a new column to distinguish between regular rest days and sick
  rest days (repos maladie) so both can coexist in the same table while being
  rendered and filtered differently in the UI.

  1. Modified Tables
    - `rest_days`
      - Added `kind` (text, default `'regular'`, NOT NULL) with values limited
        to `regular` or `sick`.

  2. Notes
    1. Existing rows default to `regular`, preserving current behavior.
    2. A CHECK constraint prevents invalid values.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rest_days' AND column_name = 'kind'
  ) THEN
    ALTER TABLE rest_days ADD COLUMN kind text NOT NULL DEFAULT 'regular';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'rest_days' AND constraint_name = 'rest_days_kind_check'
  ) THEN
    ALTER TABLE rest_days
      ADD CONSTRAINT rest_days_kind_check
      CHECK (kind IN ('regular', 'sick'));
  END IF;
END $$;
