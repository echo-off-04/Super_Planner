/*
  # Update default working-hour values

  Aligns database-level defaults with the new working-hour assumptions used
  throughout the application:

  1. Modified Tables
    - `default_week_settings`
      - `afternoon_end` default changed from `'16:00'` to `'17:00'`.
    - `contract_settings`
      - `daily_max_hours` default changed from `10` to `8`.

  2. Notes
    1. Existing rows are left untouched. Only newly created rows pick up the
       new defaults.
*/

ALTER TABLE default_week_settings
  ALTER COLUMN afternoon_end SET DEFAULT '17:00';

ALTER TABLE contract_settings
  ALTER COLUMN daily_max_hours SET DEFAULT 8;
