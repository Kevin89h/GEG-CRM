-- PRODUCTION — restauration d'un profil historique DÉSACTIVÉ (préparé le 16/11/2026, NON EXÉCUTÉ :
-- nécessite une autorisation spécifique de GEG pour les données de production).
--
-- But : retrouver l'identité de l'auteur de 108 mouvements de stock, 11 bons de livraison et 10 commandes
-- d'achat (juillet–août 2026), dont le profil CRM avait été supprimé.
--
-- Garanties :
--   * le compte de connexion n'est PAS réactivé (il reste banni) ;
--   * aucune société (company_access vide), aucun ajustement de permission, profil bloqué (is_blocked) ;
--     le rôle « sales_rep » est imposé par la base (colonne obligatoire), mais sans société il ne donne
--     accès à rien, et un profil bloqué est refusé partout (middleware, serveur, règles de la base) ;
--   * même identifiant que le compte d'origine : toutes ses opérations retrouvent leur auteur ;
--   * aucune opération historique n'est modifiée.
begin;
do $$
declare
  v_id    constant uuid := 'ff4e90ce-6a80-4c6c-91df-f182f85b667b';
  v_email constant text := 'habakomou86@gmail.com';
  v_name  constant text := 'habakomou86 (ancien collaborateur, compte désactivé)';
  u record;
begin
  select id, email, banned_until into u from auth.users where id = v_id;
  if not found then raise exception 'Compte de connexion % introuvable : arrêt', v_id; end if;
  if u.email <> v_email then raise exception 'L''identifiant ne correspond pas à % : arrêt', v_email; end if;
  if u.banned_until is null or u.banned_until < now() then raise exception 'Le compte de connexion n''est pas bloqué : arrêt'; end if;
  if exists (select 1 from public.profiles where id = v_id) then raise exception 'Un profil existe déjà : arrêt'; end if;

  insert into public.profiles (id, email, full_name, role, company_access, permissions, is_blocked, blocked_at)
  values (v_id, v_email, v_name, 'sales_rep', '{}', '{}'::jsonb, true, now());   -- '{}': no legacy menu permission either
end $$;
commit;

-- Vérification (attendu : 1 ligne, bloqué, aucune société, aucun ajustement, connexion toujours bannie)
select p.id, p.email, p.full_name, p.is_blocked, coalesce(array_length(p.company_access, 1), 0) as societes,
       (select count(*) from public.user_permission_overrides o where o.user_id = p.id) as ajustements,
       (select banned_until from auth.users u where u.id = p.id) as connexion_bannie_jusqu_au
  from public.profiles p where p.id = 'ff4e90ce-6a80-4c6c-91df-f182f85b667b';
