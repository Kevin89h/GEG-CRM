-- Sécurité : droits par défaut des futures fonctions et fonctions techniques (exigence GEG du 16/11/2026, P0).
--
-- 1. Plus aucun droit d'exécution automatique pour les visiteurs anonymes sur les FUTURES fonctions.
--    Supabase donnait par défaut l'exécution à PUBLIC et à anon pour toute nouvelle fonction du schéma public
--    (c'est ce qui avait ouvert les 10 fonctions Singapour en production). La migration P0 ne le faisait que
--    pour le schéma geg_guinee.
-- 2. Fonctions techniques fermées : toutes les fonctions de DÉCLENCHEUR (dont handle_new_user,
--    update_invoice_status, payment_to_treasury signalées par l'audit) ne sont plus exécutables par
--    PUBLIC / anon / authenticated. Un déclencheur continue de s'exécuter normalement : PostgreSQL ne vérifie
--    pas ce droit quand il se déclenche.
-- 3. audit_write (écriture dans le journal d'audit) n'est plus appelable par l'API : elle n'est utilisée que
--    par les déclencheurs d'audit. Sans cela, un visiteur pouvait écrire de fausses entrées dans le journal.
-- Cette migration préserve les deux correctifs de sécurité déjà appliqués en production et ne rouvre rien ;
-- un contrôle final annule tout s'il restait une fonction « SECURITY DEFINER » exécutable par anon.
begin;

-- 1. default privileges of future functions (created by postgres, the role used by migrations)
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon;
alter default privileges for role postgres in schema geg_guinee revoke execute on functions from anon;
alter default privileges for role postgres in schema geg_singapore revoke execute on functions from anon;
alter default privileges for role postgres in schema geg_singapore revoke all on tables from anon;
alter default privileges for role postgres in schema geg_singapore revoke all on sequences from anon;

-- 2. trigger functions: never callable directly
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname in ('public', 'geg_guinee', 'geg_singapore') and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

-- 3. audit journal writer: internal use only (called by the audit triggers, which run with the owner's rights)
do $$
begin
  if to_regprocedure('public.audit_write(text,text,text,text,text,text,jsonb,jsonb)') is not null then
    revoke execute on function public.audit_write(text,text,text,text,text,text,jsonb,jsonb) from public, anon, authenticated;
  end if;
end $$;

-- 4. final check: no SECURITY DEFINER function of the CRM schemas executable by an anonymous visitor
do $$
declare bad text;
begin
  select string_agg(p.proname, ', ') into bad from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'geg_guinee', 'geg_singapore') and p.prosecdef and has_function_privilege('anon', p.oid, 'execute');
  if bad is not null then raise exception 'Migration annulée : fonctions SECURITY DEFINER encore exécutables par anon : %', bad; end if;
end $$;

commit;
