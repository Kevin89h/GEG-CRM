-- PRODUCTION — correctif de sécurité isolé (préparé le 13/11/2026, NON EXÉCUTÉ : attend la confirmation de GEG).
--
-- Faille : 10 fonctions Singapour (SECURITY DEFINER, donc sans contrôle des règles d'accès) sont exécutables par
-- PUBLIC, anon et authenticated. Avec la clé publique Supabase (présente dans le navigateur de tout visiteur),
-- n'importe qui peut, SANS passer par le site : lire les opportunités et les fournisseurs Singapour (IBAN, SWIFT),
-- modifier ou supprimer des fournisseurs, supprimer ou transférer des opportunités, créer comptes et prospects.
--
-- Correctif : ces fonctions ne sont plus exécutables que par le serveur du CRM (service_role). Le site les appelle
-- déjà uniquement côté serveur, APRÈS avoir vérifié la connexion (middleware /api), la société autorisée
-- (resolveCompanySchema / requireSchemaAccess) et le formulaire public par sa clé secrète.
-- Identique à l'état de la base Dev depuis la migration P0 ; aucune autre partie du CRM n'est déployée.
-- Ne modifie aucune donnée, aucune fonction (corps inchangés), aucune table.
begin;

revoke execute on function public.get_singapore_deals()                                                     from public, anon, authenticated;
revoke execute on function public.get_singapore_deal(uuid)                                                  from public, anon, authenticated;
revoke execute on function public.delete_singapore_deal(uuid)                                               from public, anon, authenticated;
revoke execute on function public.transfer_singapore_to_guinee(uuid)                                        from public, anon, authenticated;
revoke execute on function public.insert_singapore_lead(text, text, text, text, text, text, text, text)     from public, anon, authenticated;
revoke execute on function public.insert_singapore_account(text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.get_singapore_suppliers()                                                 from public, anon, authenticated;
revoke execute on function public.insert_singapore_supplier(text, text, text, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.update_singapore_supplier(uuid, text, text, text, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.delete_singapore_supplier(uuid)                                           from public, anon, authenticated;

-- the CRM server keeps its access (already granted; restated for safety)
grant execute on function public.get_singapore_deals()                                                     to service_role;
grant execute on function public.get_singapore_deal(uuid)                                                  to service_role;
grant execute on function public.delete_singapore_deal(uuid)                                               to service_role;
grant execute on function public.transfer_singapore_to_guinee(uuid)                                        to service_role;
grant execute on function public.insert_singapore_lead(text, text, text, text, text, text, text, text)     to service_role;
grant execute on function public.insert_singapore_account(text, text, text, text, text, text, text, text, text) to service_role;
grant execute on function public.get_singapore_suppliers()                                                 to service_role;
grant execute on function public.insert_singapore_supplier(text, text, text, text, text, text, text, text, text, text, text, text) to service_role;
grant execute on function public.update_singapore_supplier(uuid, text, text, text, text, text, text, text, text, text, text, text, text) to service_role;
grant execute on function public.delete_singapore_supplier(uuid)                                           to service_role;

-- abort everything if a single function is still reachable by anon / authenticated, or no longer by the server
do $$
declare r record; bad text := '';
begin
  for r in select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('get_singapore_deals','get_singapore_deal','delete_singapore_deal',
             'transfer_singapore_to_guinee','insert_singapore_lead','insert_singapore_account','get_singapore_suppliers',
             'insert_singapore_supplier','update_singapore_supplier','delete_singapore_supplier')
  loop
    if has_function_privilege('anon', r.oid, 'execute') or has_function_privilege('authenticated', r.oid, 'execute')
       or not has_function_privilege('service_role', r.oid, 'execute') then
      bad := bad || r.proname || ' ';
    end if;
  end loop;
  if bad <> '' then raise exception 'Correctif incomplet, annulé : %', bad; end if;
end $$;

commit;

-- Vérification (attendu : 10 lignes, anon = false, authenticated = false, serveur = true)
select p.proname as fonction,
       has_function_privilege('anon', p.oid, 'execute')          as anon,
       has_function_privilege('authenticated', p.oid, 'execute') as utilisateur_connecte,
       has_function_privilege('service_role', p.oid, 'execute')  as serveur_crm
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('get_singapore_deals','get_singapore_deal','delete_singapore_deal',
   'transfer_singapore_to_guinee','insert_singapore_lead','insert_singapore_account','get_singapore_suppliers',
   'insert_singapore_supplier','update_singapore_supplier','delete_singapore_supplier')
 order by 1;
