/*
  # Protected activity types

  1. New table
    - `protected_activity_types`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `activity_type` (text) — the activity type value (e.g. "prestation")
      - `created_at` (timestamptz)
    - Unique index on (user_id, activity_type) to prevent duplicates.

  2. Security
    - Enable RLS.
    - Separate SELECT / INSERT / UPDATE / DELETE policies scoped to owner (auth.uid() = user_id).

  3. Purpose
    - Replaces the previous title-based "protected_activity_titles" approach.
    - Activities whose `activity_type` is in this list will be excluded from
      automatic bulk operations (default-week overwrite, recuperation planning,
      rest-day cleanup, etc.).
    - The previous `protected_activity_titles` table is preserved to avoid data
      loss but is no longer used by the application.
*/

CREATE TABLE IF NOT EXISTS protected_activity_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS protected_activity_types_user_type_idx
  ON protected_activity_types (user_id, activity_type);

ALTER TABLE protected_activity_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own protected types"
  ON protected_activity_types
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add own protected types"
  ON protected_activity_types
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own protected types"
  ON protected_activity_types
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own protected types"
  ON protected_activity_types
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
