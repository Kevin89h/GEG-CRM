-- Retour arrière de 20261116150000_precision_taux_documents (D-07).
-- Remet les types d'origine. ATTENTION : les taux enregistrés APRÈS la migration avec plus de 4 (ou 6) décimales
-- seront arrondis à la précision d'origine (c'est l'effet inverse du correctif). Les valeurs antérieures à la
-- migration, qui tenaient déjà dans l'ancienne précision, restent identiques.
begin;
alter table geg_guinee.exchange_rates alter column rate type numeric(18,4);
alter table geg_singapore.exchange_rates alter column rate type numeric(18,6);
alter table geg_guinee.supplier_payments alter column exchange_rate type numeric(18,6);
notify pgrst, 'reload schema';
commit;
