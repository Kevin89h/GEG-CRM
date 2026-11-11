-- G1 (décision GEG du 11/11/2026) : taux de change du MARCHÉ réservés aux indicateurs de pilotage.
-- Table distincte de geg_*.exchange_rates (taux utilisés par les achats et factures fournisseurs), qui n'est pas touchée :
-- aucun montant, devise ou taux enregistré dans les documents ou la comptabilité n'est modifié.
-- Les taux sont des données de marché (non propres à une société) : lecture pour tout utilisateur connecté, écriture
-- uniquement par le serveur (clé de service : tâche quotidienne et actualisation à la demande).
-- Rollback : supabase/rollback/20261113120000_taux_marche_pilotage_rollback.sql

begin;

create table if not exists public.market_rates (
  rate_date date not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  per_eur numeric not null check (per_eur > 0),   -- units of the currency for 1 EUR
  source text not null,
  fetched_at timestamptz not null default now(),
  primary key (rate_date, currency)
);

alter table public.market_rates enable row level security;
revoke all on public.market_rates from anon, authenticated;
grant select on public.market_rates to authenticated;
grant all on public.market_rates to service_role;
drop policy if exists market_rates_read on public.market_rates;
create policy market_rates_read on public.market_rates for select to authenticated using (true);

notify pgrst, 'reload schema';

commit;
