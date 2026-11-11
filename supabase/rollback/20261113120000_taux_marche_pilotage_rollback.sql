-- Rollback of 20261113120000_taux_marche_pilotage.sql (market rates used only by the steering indicators).
-- No business data depends on this table: dropping it only removes the stored market rates.
begin;
drop table if exists public.market_rates;
notify pgrst, 'reload schema';
commit;
