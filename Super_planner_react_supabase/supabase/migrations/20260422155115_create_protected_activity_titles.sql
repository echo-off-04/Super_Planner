/*
  # Protected activity titles

  1. New table
    - `protected_activity_titles`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `title` (text) - exact activity title that must never be touched
      - `created_at` (timestamptz)
    - Unique index per user per title to prevent duplicates.

  2. Security
    - Enable RLS.
    - Separate SELECT / INSERT / UPDATE / DELETE policies scoped to owner (auth.uid() = user_id).

  3. Purpose
    - Users can list activity titles that must be excluded from any automatic
      bulk operation: overwrite of the default week, automatic recuperation
      planning, rest-day cleanup, etc.
*/

CREATE TABLE IF NOT EXISTS protected_activity_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS protected_activity_titles_user_title_idx
  ON protected_activity_titles (user_id, lower(title));

ALTER TABLE protected_activity_titles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own protected titles"
  ON protected_activity_titles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add own protected titles"
  ON protected_activity_titles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own protected titles"
  ON protected_activity_titles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own protected titles"
  ON protected_activity_titles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
