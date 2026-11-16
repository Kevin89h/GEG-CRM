-- Retour arrière de 20261116140000_securite_droits_par_defaut — à n'utiliser qu'en cas de blocage.
-- ATTENTION : rétablit les droits d'exécution par défaut (dont anon) et rouvre audit_write.
-- Il n'est PAS nécessaire de l'utiliser pour défaire d'autres migrations : celle-ci ne crée aucun objet.
begin;
alter default privileges for role postgres grant execute on functions to public;
alter default privileges for role postgres in schema public grant execute on functions to anon;
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname in ('public', 'geg_guinee', 'geg_singapore') and p.prorettype = 'trigger'::regtype
  loop
    execute format('grant execute on function %s to public', f.sig);
  end loop;
  if to_regprocedure('public.audit_write(text,text,text,text,text,text,jsonb,jsonb)') is not null then
    grant execute on function public.audit_write(text,text,text,text,text,text,jsonb,jsonb) to public;
  end if;
end $$;
commit;
