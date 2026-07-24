-- Nouveaux champs sur deals (geg_guinee)
ALTER TABLE geg_guinee.deals
  ADD COLUMN IF NOT EXISTS deal_date date,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS original_request text,
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_role text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS sector text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferred_channel text;
