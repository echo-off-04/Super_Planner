/*
  # Paramètres de semaine par défaut

  1. Nouvelle table
    - `default_week_settings` - template de semaine type par utilisateur
      - `id` (uuid)
      - `user_id` (uuid, unique, FK profiles)
      - `rest_days` (int[]) jours de repos (1=Lundi..7=Dimanche). Défaut [6,7] (samedi, dimanche)
      - `default_title` (text) titre par défaut des activités auto-générées. Défaut "Travail"
      - `default_type` (text) type d'activité. Défaut "prestation"
      - `morning_start`, `morning_end` (text HH:MM) créneau matin. Défaut 09:00-13:00
      - `afternoon_start`, `afternoon_end` (text HH:MM) créneau après-midi. Défaut 14:00-16:00
      - `break_minutes` (int) pause entre les deux créneaux. Défaut 60
      - `created_at`, `updated_at`

  2. Sécurité
    - RLS activée
    - Policies pour que chaque utilisateur ne puisse lire/écrire que ses propres paramètres
*/

CREATE TABLE IF NOT EXISTS default_week_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  rest_days int[] NOT NULL DEFAULT ARRAY[6,7]::int[],
  default_title text NOT NULL DEFAULT 'Travail',
  default_type text NOT NULL DEFAULT 'prestation',
  morning_start text NOT NULL DEFAULT '09:00',
  morning_end text NOT NULL DEFAULT '13:00',
  afternoon_start text NOT NULL DEFAULT '14:00',
  afternoon_end text NOT NULL DEFAULT '16:00',
  break_minutes int NOT NULL DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE default_week_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own default week"
  ON default_week_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own default week"
  ON default_week_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own default week"
  ON default_week_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own default week"
  ON default_week_settings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
