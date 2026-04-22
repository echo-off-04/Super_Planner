/*
  # Ajout des horaires de pause à la semaine type

  1. Modifications de la table `default_week_settings`
    - Nouvelle colonne `pause_start` (text, HH:MM) heure de début de la pause.
      Défaut '13:00'.
    - Nouvelle colonne `pause_end` (text, HH:MM) heure de fin de la pause.
      Défaut '14:00'.

  2. Notes
    - Ces colonnes permettent de générer automatiquement une activité de type
      "pause" entre les créneaux matin et après-midi lors de l'application de
      la semaine type.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'default_week_settings' AND column_name = 'pause_start'
  ) THEN
    ALTER TABLE default_week_settings
      ADD COLUMN pause_start text NOT NULL DEFAULT '13:00';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'default_week_settings' AND column_name = 'pause_end'
  ) THEN
    ALTER TABLE default_week_settings
      ADD COLUMN pause_end text NOT NULL DEFAULT '14:00';
  END IF;
END $$;
