-- PRODUCTION — correctif de sécurité isolé n° 2 (préparé le 13/11/2026, NON EXÉCUTÉ : attend la confirmation de GEG).
--
-- Faille : la migration de sécurité P0 n'ayant jamais été appliquée en production, des règles d'accès laissent un
-- visiteur NON CONNECTÉ (rôle anon, clé publique présente dans le navigateur) lire, créer, modifier et supprimer,
-- directement par l'API Supabase (schémas geg_guinee et geg_singapore exposés) :
--   * les factures fournisseurs, leurs lignes et les paiements fournisseurs (Guinée) ;
--   * les coûts des opportunités (Guinée) et les documents produits (Guinée) ;
--   * et créer des notifications.
--
-- Correctif : on retire uniquement l'accès anonyme. Les utilisateurs connectés gardent EXACTEMENT les mêmes droits
-- qu'aujourd'hui (aucune règle « authenticated » n'est modifiée ou supprimée), et le CRM, qui lit et écrit ces tables
-- côté serveur, n'est pas affecté. Ne modifie aucune donnée. Aucune autre partie du CRM n'est déployée.
begin;

-- 0. a visitor who is not logged in can no longer use the company schemas at all (same as migration P0 and Dev).
--    The CRM reads them server-side or as a logged-in user; the public share link and lead form go through the server.
revoke usage on schema geg_guinee, geg_singapore from anon;

-- 1. supplier invoices / lines / payments: the dedicated anonymous rules are removed
drop policy if exists allow_all_supplier_invoices_anon      on geg_guinee.supplier_invoices;
drop policy if exists allow_all_supplier_invoice_lines_anon on geg_guinee.supplier_invoice_lines;
drop policy if exists allow_all_supplier_payments_anon      on geg_guinee.supplier_payments;

-- 2. rules written for every role (public): kept as they are, but for logged-in users only
alter policy "Authenticated users can manage deal_costs" on geg_guinee.deal_costs       to authenticated;
alter policy product_documents_all                         on geg_guinee.product_documents to authenticated;
alter policy "Service role inserts notifications"          on public.notifications       to authenticated;

-- 3. belt and braces: no table right at all for anon on these tables
revoke all on geg_guinee.supplier_invoices, geg_guinee.supplier_invoice_lines, geg_guinee.supplier_payments,
              geg_guinee.deal_costs, geg_guinee.product_documents from anon;

-- 4. abort everything if anon can still reach one of these tables
do $$
declare t text; bad text := '';
begin
  foreach t in array array['geg_guinee.supplier_invoices','geg_guinee.supplier_invoice_lines','geg_guinee.supplier_payments',
                           'geg_guinee.deal_costs','geg_guinee.product_documents']
  loop
    if has_table_privilege('anon', t::regclass, 'select') or has_table_privilege('anon', t::regclass, 'insert')
       or has_table_privilege('anon', t::regclass, 'update') or has_table_privilege('anon', t::regclass, 'delete') then
      bad := bad || t || ' ';
    end if;
  end loop;
  if exists (select 1 from pg_policies p
              where (p.schemaname, p.tablename) in (('geg_guinee','supplier_invoices'),('geg_guinee','supplier_invoice_lines'),
                    ('geg_guinee','supplier_payments'),('geg_guinee','deal_costs'),('geg_guinee','product_documents'),('public','notifications'))
                and (p.roles::text like '%anon%' or p.roles::text like '%public%')
                and coalesce(p.qual, 'true') in ('true', '(true)') and coalesce(p.with_check, 'true') in ('true', '(true)')) then
    bad := bad || '(règle encore ouverte à anon/public) ';
  end if;
  if has_schema_privilege('anon', 'geg_guinee', 'usage') or has_schema_privilege('anon', 'geg_singapore', 'usage') then
    bad := bad || '(anon peut encore utiliser les schémas) ';
  end if;
  if bad <> '' then raise exception 'Correctif incomplet, annulé : %', bad; end if;
end $$;

commit;

-- Vérification : plus aucune règle « toujours vraie » ouverte à anon / public sur les schémas du CRM,
-- avec un droit anon sur la table (attendu : 0 ligne).
select p.schemaname || '.' || p.tablename as table_concernee, p.policyname as regle, p.roles::text as roles, p.cmd
  from pg_policies p
 where p.schemaname in ('geg_guinee', 'geg_singapore', 'public')
   and (p.roles::text like '%anon%' or p.roles::text like '%public%')
   and coalesce(p.qual, 'true') in ('true', '(true)') and coalesce(p.with_check, 'true') in ('true', '(true)')
   and (has_table_privilege('anon', (p.schemaname || '.' || p.tablename)::regclass, 'select')
     or has_table_privilege('anon', (p.schemaname || '.' || p.tablename)::regclass, 'insert')
     or has_table_privilege('anon', (p.schemaname || '.' || p.tablename)::regclass, 'update')
     or has_table_privilege('anon', (p.schemaname || '.' || p.tablename)::regclass, 'delete'))
 order by 1;
