-- GEG Singapour : suppression des anciens champs de totaux stockés, jamais alimentés (décision GEG du 16/11/2026).
--
-- Champs supprimés (numeric(18,2), défaut 0, toujours à 0 en Dev comme en production) :
--   geg_singapore.invoices          : total_ht, total_paid, balance
--   geg_singapore.treasury_accounts : total_in, total_out
--   geg_singapore.supplier_invoices : balance
--
-- Pourquoi : aucun mécanisme ne les alimentait. Les montants réels sont calculés par les vues invoice_totals,
-- supplier_invoice_totals et treasury_balances (migration 20261114120000).
--
-- Dépendances vérifiées avant suppression (16/11/2026) :
--   * base : aucune vue, fonction, contrainte, index, publication temps réel ni webhook n'utilise ces champs
--     (Dev et production) ; les déclencheurs génériques (audit_row, document_rules, set_created_by) ne les citent pas ;
--   * code : les dernières lectures / écritures ont été corrigées (A1 recherche et rattachement de factures,
--     A3 ajustement du solde, A4 duplication de facture fournisseur) ; seul le rapport Telegram, exclu du
--     chantier, lit des colonnes de totaux, et uniquement pour la Guinée (où elles n'existent pas).
-- Aucun montant, paiement, solde ou document n'est modifié : seules des colonnes vides (0) disparaissent.
begin;

-- safety: abort if any of these columns holds a value other than 0 (it would be business data)
do $$
declare n int;
begin
  select (select count(*) from geg_singapore.invoices where coalesce(total_ht,0) <> 0 or coalesce(total_paid,0) <> 0 or coalesce(balance,0) <> 0)
       + (select count(*) from geg_singapore.treasury_accounts where coalesce(total_in,0) <> 0 or coalesce(total_out,0) <> 0)
       + (select count(*) from geg_singapore.supplier_invoices where coalesce(balance,0) <> 0)
    into n;
  if n > 0 then raise exception 'Suppression annulée : % ligne(s) contiennent une valeur non nulle dans un ancien champ de total', n; end if;
end $$;

alter table geg_singapore.invoices          drop column if exists total_ht, drop column if exists total_paid, drop column if exists balance;
alter table geg_singapore.treasury_accounts drop column if exists total_in, drop column if exists total_out;
alter table geg_singapore.supplier_invoices drop column if exists balance;

notify pgrst, 'reload schema';
commit;
