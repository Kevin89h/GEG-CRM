-- PRODUCTION — correctif de sécurité (alerte Supabase « rls_disabled_in_public » du 08/11/2026).
-- À EXÉCUTER UNIQUEMENT APRÈS AUTORISATION EXPLICITE.
-- Constat (lecture seule, 11/11/2026) : deux tables de GEG Guinée sans Row-Level Security, donc lisibles,
-- modifiables et supprimables par n'importe qui disposant de l'adresse du projet et de la clé publique (anon) :
--   geg_guinee.warehouses         (dépôts ; une règle d'accès existe mais n'est pas appliquée faute de RLS)
--   geg_guinee.product_packaging  (conditionnements ; vide en production aujourd'hui, aucune règle)
-- Correctif : activer RLS avec la même règle que les autres tables de GEG Guinée (utilisateurs connectés ayant
-- accès à la société). Aucune donnée modifiée. L'application (clé serveur) n'est pas affectée.
-- Retour arrière : alter table geg_guinee.warehouses disable row level security;
--                  alter table geg_guinee.product_packaging disable row level security;
--                  drop policy if exists company_access_product_packaging on geg_guinee.product_packaging;

begin;

alter table geg_guinee.warehouses enable row level security;

alter table geg_guinee.product_packaging enable row level security;
drop policy if exists company_access_product_packaging on geg_guinee.product_packaging;
create policy company_access_product_packaging on geg_guinee.product_packaging
  for all to authenticated
  using (exists (select 1 from public.profiles p join public.companies c on c.id = any (p.company_access)
                 where p.id = auth.uid() and c.schema_name = 'geg_guinee'))
  with check (exists (select 1 from public.profiles p join public.companies c on c.id = any (p.company_access)
                 where p.id = auth.uid() and c.schema_name = 'geg_guinee'));

-- Contrôle : doit renvoyer 0 ligne (plus aucune table sans RLS dans les schémas exposés)
select n.nspname, c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p') and n.nspname in ('public', 'geg_guinee', 'geg_singapore') and not c.relrowsecurity;

commit;
