-- Taux de change des documents : précision suffisante (décision GEG D-07 du 16/11/2026).
--
-- Constat : geg_guinee.exchange_rates.rate était en numeric(18,4) : les taux de faible valeur étaient arrondis
-- (XOF → EUR enregistré 0,0015 au lieu de 0,00152449… : −1,6 % ; XOF → USD 0,0018 au lieu d'environ 0,00176 : +2,3 %).
-- Le taux appliqué à un paiement fournisseur (supplier_payments.exchange_rate) était limité à 6 décimales.
--
-- Changement : passage à numeric(24,12) (12 décimales, jusqu'à 10^12 avant la virgule) pour
--   * geg_guinee.exchange_rates.rate        (numeric(18,4) → numeric(24,12))
--   * geg_singapore.exchange_rates.rate     (numeric(18,6) → numeric(24,12))
--   * geg_guinee.supplier_payments.exchange_rate (numeric(18,6) → numeric(24,12))
-- geg_*.payments.exchange_rate est déjà un numeric sans limite : inchangé.
--
-- AUCUNE valeur existante n'est modifiée : un élargissement de l'échelle conserve chaque valeur à l'identique
-- (0,0015 reste 0,0015). Les taux et paiements historiques gardent exactement leur valeur ; seuls les NOUVEAUX
-- taux sont enregistrés avec la précision complète. Aucune vue, fonction ni règle ne dépend de ces colonnes
-- (vérifié sur Dev et en production le 16/11/2026).
begin;

-- garde-fou : mémorise les valeurs avant, puis vérifie qu'elles sont strictement identiques après
create temp table _before on commit drop as
  select 'g_er' k, id::text id, rate v from geg_guinee.exchange_rates
  union all select 's_er', id::text, rate from geg_singapore.exchange_rates
  union all select 'g_sp', id::text, exchange_rate from geg_guinee.supplier_payments;

alter table geg_guinee.exchange_rates alter column rate type numeric(24,12);
alter table geg_singapore.exchange_rates alter column rate type numeric(24,12);
alter table geg_guinee.supplier_payments alter column exchange_rate type numeric(24,12);

do $$
declare n_changed int;
begin
  select count(*) into n_changed from _before b
  left join (
    select 'g_er' k, id::text id, rate v from geg_guinee.exchange_rates
    union all select 's_er', id::text, rate from geg_singapore.exchange_rates
    union all select 'g_sp', id::text, exchange_rate from geg_guinee.supplier_payments
  ) a on a.k = b.k and a.id = b.id
  where a.id is null or a.v is distinct from b.v;
  if n_changed > 0 then
    raise exception 'Précision des taux : % valeur(s) historique(s) modifiée(s) — migration annulée', n_changed;
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
