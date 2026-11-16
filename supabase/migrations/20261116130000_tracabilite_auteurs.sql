-- Traçabilité permanente des auteurs (règle générale GEG du 16/11/2026).
--
-- 1. L'AUTEUR DE CHAQUE NOUVEL ENREGISTREMENT EST POSÉ PAR LA BASE
--    Jusqu'ici, sur les devis, factures, commandes d'achat, réceptions, bons de livraison, mouvements de stock,
--    paiements, opérations de trésorerie et activités, l'auteur (user_id) était envoyé par l'écran : il pouvait
--    être oublié (40 factures et 47 devis sans auteur en production) ou être celui d'un autre.
--    Désormais, à la création, user_id = l'utilisateur réellement connecté (public.audit_context()). Pour une
--    automatisation (tâche planifiée, formulaire public), sans utilisateur, la valeur fournie est conservée.
--    Les enregistrements existants ne sont pas modifiés (y compris ceux sans auteur connu).
--
-- 2. UN PROFIL QUI A UN HISTORIQUE NE PEUT PLUS ÊTRE SUPPRIMÉ
--    Supprimer un profil effaçait le nom de l'auteur de toutes ses opérations (et ses activités en cascade).
--    Un collaborateur qui quitte GEG est BLOQUÉ (profiles.is_blocked + connexion bannie) : son profil reste, son
--    nom reste visible sur ses opérations et dans le journal d'audit. La suppression reste possible uniquement
--    pour un compte créé par erreur, sans aucune trace.
begin;

-- 1. author set from the real actor at insert time
create or replace function public.set_author_user_id() returns trigger
language plpgsql security definer set search_path = public as $$
declare ctx record;
begin
  select * into ctx from public.audit_context();
  if ctx.actor is not null then
    new.user_id := ctx.actor;   -- a logged-in user: always the real actor (cannot be forgotten nor forged)
  end if;                       -- automation (no actor): the value given by the server is kept
  return new;
end $$;
revoke all on function public.set_author_user_id() from public, anon, authenticated;

do $$
declare s text; t text;
begin
  foreach s in array array['geg_guinee', 'geg_singapore'] loop
    foreach t in array array['sales_orders', 'invoices', 'purchase_orders', 'purchase_receptions', 'delivery_notes',
                             'stock_moves', 'payments', 'treasury_transactions', 'activities', 'purchase_order_events'] loop
      if exists (select 1 from information_schema.columns where table_schema = s and table_name = t and column_name = 'user_id') then
        execute format('drop trigger if exists set_author_user_id on %I.%I', s, t);
        execute format('create trigger set_author_user_id before insert on %I.%I for each row execute function public.set_author_user_id()', s, t);
      end if;
    end loop;
  end loop;
end $$;

-- 2. a profile with history can never be deleted (block it instead)
create or replace function public.protect_profile_history() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record; found_in text := null; n bigint;
begin
  if exists (select 1 from public.audit_events where actor_id = old.id) then
    found_in := 'journal d''audit';
  else
    for r in select c.table_schema, c.table_name, c.column_name from information_schema.columns c
             join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
             where c.table_schema in ('geg_guinee', 'geg_singapore')
               and c.column_name in ('user_id', 'created_by', 'validated_by', 'cancelled_by', 'blocked_by')
               and c.data_type = 'uuid'
    loop
      execute format('select count(*) from %I.%I where %I = $1', r.table_schema, r.table_name, r.column_name) into n using old.id;
      if n > 0 then found_in := r.table_schema || '.' || r.table_name; exit; end if;
    end loop;
  end if;
  if found_in is not null then
    raise exception 'Profil conservé : cet utilisateur a un historique (%). Bloquez son compte au lieu de le supprimer.', found_in
      using errcode = 'P0001';
  end if;
  return old;
end $$;
revoke all on function public.protect_profile_history() from public, anon, authenticated;

drop trigger if exists protect_profile_history on public.profiles;
create trigger protect_profile_history before delete on public.profiles
  for each row execute function public.protect_profile_history();

commit;
