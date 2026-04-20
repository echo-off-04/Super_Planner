/*
  # Custom Activity Types

  1. New Tables
    - `activity_types` - User-defined activity types
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK to auth.users)
      - `value` (text, unique per user, used as identifier stored in activities.activity_type)
      - `label` (text, displayed name)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `activity_types`
    - Users can only view/create/update/delete their own types
*/

CREATE TABLE IF NOT EXISTS activity_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  value text NOT NULL,
  label text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, value)
);

CREATE INDEX IF NOT EXISTS idx_activity_types_user ON activity_types(user_id);

ALTER TABLE activity_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own activity types" ON activity_types FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own activity types" ON activity_types FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own activity types" ON activity_types FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own activity types" ON activity_types FOR DELETE TO authenticated USING (auth.uid() = user_id);
