-- PRODUCTION — correctif de sécurité (Security Advisor Supabase : 9 erreurs « Security Definer View », 11/11/2026).
-- À EXÉCUTER UNIQUEMENT APRÈS AUTORISATION EXPLICITE.
-- Constat (lecture seule) : ces vues de calcul contournent les protections des tables (elles s'exécutent avec les
-- droits de leur créateur) et 8 d'entre elles sont lisibles SANS connexion avec la clé publique du site :
--   geg_guinee.invoice_totals (178 factures), sales_order_totals (257 devis), purchase_landed_costs (511 lignes,
--   prix FOB et coûts de revient), supplier_invoice_totals (99 factures fournisseurs), treasury_balances (7 comptes,
--   soldes bancaires : lisible par tout utilisateur connecté), et 4 vues du schéma public (vides).
-- Correctif (identique à celui déjà en place sur la base de test) : chaque vue applique désormais les droits de
-- l'utilisateur qui l'interroge, et l'accès sans connexion est retiré. Aucune donnée modifiée.
-- L'application (clé serveur) n'est pas affectée ; les utilisateurs connectés gardent leur accès actuel.
-- Retour arrière : alter view <vue> reset (security_invoker); grant select on <vue> to anon;

begin;

alter view geg_guinee.invoice_totals          set (security_invoker = true);
alter view geg_guinee.purchase_landed_costs   set (security_invoker = true);
alter view geg_guinee.sales_order_totals      set (security_invoker = true);
alter view geg_guinee.supplier_invoice_totals set (security_invoker = true);
alter view geg_guinee.treasury_balances       set (security_invoker = true);
alter view public.invoice_totals              set (security_invoker = true);
alter view public.purchase_landed_costs       set (security_invoker = true);
alter view public.sales_order_totals          set (security_invoker = true);
alter view public.treasury_balances           set (security_invoker = true);

revoke select on geg_guinee.invoice_totals, geg_guinee.purchase_landed_costs, geg_guinee.sales_order_totals,
  geg_guinee.supplier_invoice_totals, geg_guinee.treasury_balances,
  public.invoice_totals, public.purchase_landed_costs, public.sales_order_totals, public.treasury_balances from anon;

commit;

-- Contrôle : doit renvoyer 0 ligne
select n.nspname, c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'v' and n.nspname in ('public', 'geg_guinee', 'geg_singapore')
  and (coalesce((select option_value from pg_options_to_table(c.reloptions) where option_name = 'security_invoker'), 'false') <> 'true'
       or has_table_privilege('anon', c.oid, 'select'));
