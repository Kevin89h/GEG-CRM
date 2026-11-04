-- Customisable permissions per company, blocking, general audit log, document rules
-- (PLAN_PERMISSIONS_PERSONNALISABLES_GEG.md, decisions Q1-Q8 and B1-B3 of 04/11/2026).
-- Requires 20261027120000_p0_security.sql and 20261104120000_super_admin.sql.
-- Rollback: supabase/rollback/20261105120000_permissions_personnalisables_rollback.sql
-- No business row is deleted or rewritten: tables, columns, functions, policies and triggers are added.

begin;

-- =================================================================================================
-- 1. Blocking
-- =================================================================================================

alter table public.profiles add column if not exists is_blocked boolean not null default false;
alter table public.profiles add column if not exists blocked_at timestamptz;
alter table public.profiles add column if not exists blocked_by uuid references public.profiles (id);

create or replace function public.has_company_access(p_schema text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    join public.companies c on c.id = any (p.company_access)
    where p.id = auth.uid() and not p.is_blocked and c.schema_name = p_schema and c.is_active
  )
$$;

-- =================================================================================================
-- 2. Permission catalogue, role standards, personal exceptions per company
-- =================================================================================================

create table if not exists public.permission_catalog (
  key text primary key,
  module text not null,
  label text not null,
  sort int not null default 0,
  sensitive boolean not null default false,
  -- false: prerogative reserved to the role, never granted nor removed by exception
  customizable boolean not null default true,
  -- false: never granted to a Commercial by exception (deletions, Q2)
  grantable_to_sales_rep boolean not null default true
);

create table if not exists public.role_permissions (
  role text not null,
  permission_key text not null references public.permission_catalog (key) on delete cascade,
  primary key (role, permission_key)
);

create table if not exists public.user_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  company_id uuid not null references public.companies (id),
  permission_key text not null references public.permission_catalog (key),
  effect text not null check (effect in ('grant', 'deny')),
  reason text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (user_id, permission_key, company_id)
);

alter table public.permission_catalog enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_permission_overrides enable row level security;
drop policy if exists read_catalog on public.permission_catalog;
create policy read_catalog on public.permission_catalog for select to authenticated using (true);
drop policy if exists read_role_permissions on public.role_permissions;
create policy read_role_permissions on public.role_permissions for select to authenticated using (true);
-- Exceptions: written and read by the server only (service role)
revoke all on public.user_permission_overrides from anon, authenticated;
revoke insert, update, delete on public.permission_catalog, public.role_permissions from anon, authenticated;

delete from public.role_permissions;

insert into public.permission_catalog (key, module, label, sort, sensitive, customizable, grantable_to_sales_rep) values
  -- CRM
  ('comptes.voir', 'CRM', 'Comptes clients : voir', 100, false, true, true),
  ('comptes.creer', 'CRM', 'Comptes clients : créer', 101, false, true, true),
  ('comptes.modifier', 'CRM', 'Comptes clients : modifier', 102, false, true, true),
  ('comptes.exporter', 'CRM', 'Comptes clients : exporter', 103, false, true, true),
  ('comptes.archiver', 'CRM', 'Comptes clients : archiver', 104, false, true, true),
  ('contacts.voir', 'CRM', 'Contacts : voir', 110, false, true, true),
  ('contacts.creer', 'CRM', 'Contacts : créer', 111, false, true, true),
  ('contacts.modifier', 'CRM', 'Contacts : modifier', 112, false, true, true),
  ('contacts.archiver', 'CRM', 'Contacts : archiver', 113, false, true, true),
  ('opportunites.voir', 'CRM', 'Opportunités : voir', 120, false, true, true),
  ('opportunites.creer', 'CRM', 'Opportunités : créer', 121, false, true, true),
  ('opportunites.modifier', 'CRM', 'Opportunités : modifier, marquer perdue', 122, false, true, true),
  ('opportunites.transferer', 'CRM', 'Opportunités : transférer entre sociétés', 123, false, true, true),
  ('opportunites.couts_voir', 'CRM', 'Opportunités : voir coûts et marge', 124, true, true, true),
  ('opportunites.couts_modifier', 'CRM', 'Opportunités : saisir les coûts', 125, true, true, true),
  ('activites.voir', 'CRM', 'Activités : voir', 130, false, true, true),
  ('activites.creer', 'CRM', 'Activités : créer', 131, false, true, true),
  ('activites.modifier', 'CRM', 'Activités : modifier', 132, false, true, true),
  ('documents.voir', 'CRM', 'Documents : voir', 140, false, true, true),
  ('documents.ajouter', 'CRM', 'Documents : ajouter', 141, false, true, true),
  ('documents.modifier', 'CRM', 'Documents : modifier', 142, false, true, true),
  -- Ventes
  ('devis.voir', 'Ventes', 'Devis : voir, PDF, partager', 200, false, true, true),
  ('devis.creer', 'Ventes', 'Devis : créer, dupliquer', 201, false, true, true),
  ('devis.modifier', 'Ventes', 'Devis : modifier (non facturé)', 202, false, true, true),
  ('devis.confirmer', 'Ventes', 'Devis : confirmer en commande', 203, false, true, true),
  ('devis.annuler', 'Ventes', 'Devis : annuler un devis non facturé', 204, false, true, true),
  ('factures.voir', 'Ventes', 'Factures : voir, PDF, partager', 210, false, true, true),
  ('factures.creer', 'Ventes', 'Factures : créer', 211, false, true, true),
  ('factures.modifier_brouillon', 'Ventes', 'Factures : modifier un brouillon', 212, false, true, true),
  ('factures.annuler_brouillon', 'Ventes', 'Factures : annuler un brouillon', 213, false, true, true),
  ('factures.emettre', 'Ventes', 'Factures : émettre / valider', 214, false, true, true),
  ('factures.avoir', 'Ventes', 'Factures : créer un avoir', 215, false, true, true),
  ('livraisons.voir', 'Ventes', 'Bons de livraison : voir, PDF', 220, false, true, true),
  ('livraisons.creer', 'Ventes', 'Bons de livraison : créer, modifier en brouillon', 221, false, true, true),
  ('livraisons.confirmer', 'Ventes', 'Bons de livraison : confirmer la livraison', 222, false, true, true),
  ('livraisons.annuler', 'Ventes', 'Bons de livraison : annuler avant livraison', 223, false, true, true),
  -- Achats
  ('achats.voir', 'Achats', 'Commandes d''achat et réceptions : voir', 300, false, true, true),
  ('achats.creer', 'Achats', 'Commandes d''achat : créer', 301, false, true, true),
  ('achats.modifier', 'Achats', 'Commandes d''achat : modifier, confirmer, frais', 302, false, true, true),
  ('achats.receptionner', 'Achats', 'Commandes d''achat : réceptionner', 303, false, true, true),
  ('achats.annuler', 'Achats', 'Commandes d''achat : annuler sans réception', 304, false, true, true),
  ('factures_fournisseurs.voir', 'Achats', 'Factures fournisseurs : voir', 310, false, true, true),
  ('factures_fournisseurs.gerer', 'Achats', 'Factures fournisseurs : créer, modifier, avoir, importer', 311, false, true, true),
  ('factures_fournisseurs.annuler', 'Achats', 'Factures fournisseurs : annuler avant validation, sans paiement', 312, false, true, true),
  ('fournisseurs.voir', 'Achats', 'Fournisseurs : voir', 320, false, true, true),
  ('fournisseurs.gerer', 'Achats', 'Fournisseurs : créer, modifier, archiver', 321, false, true, true),
  -- Comptabilité
  ('paiements_clients.voir', 'Comptabilité', 'Paiements clients : voir', 400, false, true, true),
  ('paiements_clients.enregistrer', 'Comptabilité', 'Paiements clients : enregistrer', 401, true, true, true),
  ('paiements_fournisseurs.enregistrer', 'Comptabilité', 'Paiements fournisseurs : voir et enregistrer', 402, true, true, true),
  ('paiements.supprimer', 'Comptabilité', 'Paiements : supprimer un paiement saisi par erreur (temporaire)', 403, true, true, false),
  ('tresorerie.voir', 'Comptabilité', 'Trésorerie : voir comptes et soldes', 410, true, true, true),
  ('tresorerie.saisir', 'Comptabilité', 'Trésorerie : saisir, modifier, exporter', 411, true, true, true),
  ('tresorerie.comptes', 'Comptabilité', 'Trésorerie : créer / modifier un compte bancaire', 412, true, true, true),
  ('resultat.voir', 'Comptabilité', 'Résultat : voir, exporter', 420, true, true, true),
  -- Stock, produits, logistique
  ('produits.voir', 'Stock', 'Produits : voir, sélectionner', 500, false, true, true),
  ('produits.gerer', 'Stock', 'Produits : créer, modifier, archiver', 501, false, true, true),
  ('produits.prix_achat', 'Stock', 'Produits : voir prix d''achat et références internes', 502, true, true, true),
  ('stock.voir', 'Stock', 'Stock : voir niveaux et mouvements', 510, false, true, true),
  ('stock.mouvement_manuel', 'Stock', 'Stock : mouvement manuel, pertes', 511, false, true, true),
  ('stock.inventaire', 'Stock', 'Stock : inventaire (ajustement)', 512, false, true, true),
  ('stock.valeur', 'Stock', 'Stock : valeur financière', 513, true, true, true),
  ('stock.entrepots', 'Stock', 'Stock : créer / modifier les entrepôts', 514, false, true, true),
  ('expeditions.voir', 'Stock', 'Suivi des expéditions : voir', 520, false, true, true),
  ('expeditions.gerer', 'Stock', 'Suivi des expéditions : créer, modifier', 521, false, true, true),
  ('projets.voir', 'Stock', 'Projets : voir', 530, false, true, true),
  ('projets.marges', 'Stock', 'Projets : voir coûts et marges', 531, true, true, true),
  -- Équipe, pilotage, paramètres
  ('employes.voir', 'Équipe', 'Employés : voir', 600, false, true, true),
  ('employes.gerer', 'Équipe', 'Employés : créer, modifier', 601, false, true, true),
  ('commissions.gerer', 'Équipe', 'Commissions : voir, payer', 602, true, true, true),
  ('tableau_de_bord.financier', 'Équipe', 'Tableau de bord financier (trésorerie, valeur du stock)', 610, true, true, true),
  ('parametres.gerer', 'Équipe', 'Paramètres métier : taux, unités, réglages des documents', 620, false, true, true),
  ('assistant_ia.utiliser', 'Équipe', 'Assistant IA', 630, false, true, true),
  ('suppression', 'Équipe', 'Supprimer une fiche ou un document métier', 640, false, true, false),
  -- Prérogatives réservées (rôle uniquement)
  ('utilisateurs.gerer', 'Administration', 'Gérer les comptes utilisateurs', 900, false, false, false),
  ('journal.voir', 'Administration', 'Journal d''audit', 901, false, false, false),
  ('doublons.fusionner', 'Administration', 'Fusionner les doublons', 902, false, false, false),
  ('societes.gerer', 'Administration', 'Attribuer et modifier les sociétés', 903, false, false, false),
  ('comptes_bancaires.supprimer', 'Administration', 'Supprimer un compte bancaire', 904, false, false, false)
on conflict (key) do update set module = excluded.module, label = excluded.label, sort = excluded.sort, sensitive = excluded.sensitive,
  customizable = excluded.customizable, grantable_to_sales_rep = excluded.grantable_to_sales_rep;

-- Standards: Manager = every customisable permission; Admin = Manager + users, audit, duplicates;
-- Super admin = everything; Commercial = list below
insert into public.role_permissions (role, permission_key)
select 'manager', key from public.permission_catalog where customizable;
insert into public.role_permissions (role, permission_key)
select 'admin', key from public.permission_catalog where customizable or key in ('utilisateurs.gerer', 'journal.voir', 'doublons.fusionner');
insert into public.role_permissions (role, permission_key)
select 'super_admin', key from public.permission_catalog;
insert into public.role_permissions (role, permission_key)
select 'sales_rep', unnest(array[
  'comptes.voir', 'comptes.creer', 'comptes.modifier', 'comptes.exporter',
  'contacts.voir', 'contacts.creer', 'contacts.modifier',
  'opportunites.voir', 'opportunites.creer', 'opportunites.modifier',
  'activites.voir', 'activites.creer', 'activites.modifier',
  'documents.voir', 'documents.ajouter', 'documents.modifier',
  'devis.voir', 'devis.creer', 'devis.modifier', 'devis.confirmer', 'devis.annuler',
  'factures.voir', 'factures.creer', 'factures.modifier_brouillon', 'factures.annuler_brouillon', 'factures.emettre',
  'livraisons.voir', 'livraisons.creer', 'livraisons.confirmer',
  'achats.voir', 'fournisseurs.voir', 'paiements_clients.voir',
  'produits.voir', 'stock.voir', 'expeditions.voir', 'expeditions.gerer', 'projets.voir',
  'employes.voir', 'assistant_ia.utiliser'
]);

-- Effective permissions of a user in a company: role standard + grants − denies (Q4: per company),
-- with the absolute limits: company assigned, account not blocked, reserved prerogatives from the role only,
-- deletions never granted to a Commercial.
create or replace function public.effective_permissions(p_user uuid, p_schema text)
returns text[] language sql stable security definer set search_path = public as $$
  with u as (
    select p.id, p.role, c.id as company_id
    from public.profiles p
    join public.companies c on c.id = any (p.company_access) and c.schema_name = p_schema and c.is_active
    where p.id = p_user and not p.is_blocked
  )
  select coalesce(array_agg(pc.key order by pc.sort), '{}')
  from u
  cross join public.permission_catalog pc
  left join public.role_permissions rp on rp.role = u.role and rp.permission_key = pc.key
  left join public.user_permission_overrides o
    on o.user_id = u.id and o.company_id = u.company_id and o.permission_key = pc.key and pc.customizable
  where case
    when o.effect = 'deny' then false
    when o.effect = 'grant' then (u.role <> 'sales_rep' or pc.grantable_to_sales_rep) or rp.role is not null
    else rp.role is not null
  end
$$;

create or replace function public.my_permissions(p_schema text)
returns text[] language sql stable security definer set search_path = public as $$
  select public.effective_permissions(auth.uid(), p_schema)
$$;

create or replace function public.has_permission(p_key text, p_schema text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_key = any (public.effective_permissions(auth.uid(), p_schema))
$$;

create or replace function public.has_any_permission(p_keys text[], p_schema text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.effective_permissions(auth.uid(), p_schema) && p_keys
$$;

revoke all on function public.effective_permissions(uuid, text) from public, anon, authenticated;
grant execute on function public.effective_permissions(uuid, text) to service_role;
revoke all on function public.my_permissions(text), public.has_permission(text, text), public.has_any_permission(text[], text) from public, anon;
grant execute on function public.my_permissions(text), public.has_permission(text, text), public.has_any_permission(text[], text) to authenticated, service_role;

-- =================================================================================================
-- 3. General audit log (Q6, Q8): append only, written by the database itself
-- =================================================================================================

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default clock_timestamp(),
  actor_id uuid,
  origin text not null,            -- utilisateur | api | automatisation | systeme
  company text,                    -- company schema
  module text not null,
  action text not null,
  entity_type text,
  entity_id text,
  entity_label text,
  old_values jsonb,
  new_values jsonb,
  request_id text,
  parent_event_id bigint
);
create index if not exists audit_events_time on public.audit_events (occurred_at desc);
create index if not exists audit_events_entity on public.audit_events (entity_type, entity_id);
create index if not exists audit_events_actor on public.audit_events (actor_id, occurred_at desc);
create index if not exists audit_events_request on public.audit_events (request_id) where request_id is not null;

alter table public.audit_events enable row level security;
revoke all on public.audit_events from anon, authenticated;

create or replace function public.audit_events_readonly()
returns trigger language plpgsql as $$
begin
  raise exception 'Le journal d''audit ne peut être ni modifié ni supprimé';
end $$;
drop trigger if exists audit_events_readonly on public.audit_events;
create trigger audit_events_readonly before update or delete on public.audit_events
  for each row execute function public.audit_events_readonly();
drop trigger if exists audit_events_no_truncate on public.audit_events;
create trigger audit_events_no_truncate before truncate on public.audit_events
  for each statement execute function public.audit_events_readonly();

-- Who is acting: the user's own session (direct access), or the actor passed by the CRM server
-- (headers trusted only for the service role), or nobody (automations, migrations).
create or replace function public.audit_context(out actor uuid, out origin text, out request_id text)
language plpgsql stable set search_path = public as $$
declare h json; c json; r text;
begin
  begin h := nullif(current_setting('request.headers', true), '')::json; exception when others then h := null; end;
  begin c := nullif(current_setting('request.jwt.claims', true), '')::json; exception when others then c := null; end;
  r := coalesce(c ->> 'role', '');
  if r = 'service_role' then
    begin actor := nullif(h ->> 'x-geg-actor', '')::uuid; exception when others then actor := null; end;
    origin := coalesce(nullif(h ->> 'x-geg-origin', ''), case when actor is null then 'automatisation' else 'utilisateur' end);
    request_id := nullif(h ->> 'x-geg-request', '');
  elsif r = 'authenticated' then
    begin actor := (c ->> 'sub')::uuid; exception when others then actor := null; end;
    origin := 'api';
    request_id := nullif(h ->> 'x-geg-request', '');
  else
    actor := null; origin := 'systeme'; request_id := null;
  end if;
end $$;

create or replace function public.audit_redact(j jsonb)
returns jsonb language sql immutable as $$
  select coalesce(jsonb_object_agg(k, case when k ~* '(token|password|secret|p256dh|auth_key|endpoint|api_key)' then '"***"'::jsonb else v end), '{}'::jsonb)
  from jsonb_each(j) as e(k, v)
$$;

create or replace function public.audit_write(
  p_company text, p_module text, p_action text, p_entity_type text, p_entity_id text, p_label text,
  p_old jsonb, p_new jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare ctx record; v_parent bigint; v_id bigint;
begin
  select * into ctx from public.audit_context();
  if ctx.request_id is not null then
    select id into v_parent from public.audit_events where request_id = ctx.request_id order by id limit 1;
  end if;
  insert into public.audit_events (actor_id, origin, company, module, action, entity_type, entity_id, entity_label,
                                   old_values, new_values, request_id, parent_event_id)
  values (ctx.actor, ctx.origin, p_company, p_module, p_action, p_entity_type, p_entity_id, p_label,
          public.audit_redact(p_old), public.audit_redact(p_new), ctx.request_id, v_parent)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.audit_module(p_table text)
returns text language sql immutable as $$
  select case
    when p_table in ('accounts', 'contacts', 'deals', 'deal_costs', 'activities', 'documents', 'document_categories') then 'crm'
    when p_table in ('sales_orders', 'sales_order_lines', 'invoices', 'invoice_lines', 'delivery_notes', 'delivery_note_lines') then 'ventes'
    when p_table in ('purchase_orders', 'purchase_order_lines', 'purchase_order_events', 'purchase_costs', 'purchase_receptions',
                     'purchase_reception_lines', 'supplier_invoices', 'supplier_invoice_lines', 'suppliers') then 'achats'
    when p_table in ('payments', 'supplier_payments', 'treasury_accounts', 'treasury_transactions') then 'comptabilite'
    when p_table in ('products', 'product_categories', 'product_documents', 'product_packaging', 'stock_moves', 'stock_levels', 'warehouses', 'shipments') then 'stock'
    when p_table in ('employees', 'commissions') then 'equipe'
    else 'parametres'
  end
$$;

create or replace function public.audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
declare o jsonb; n jsonb; diff_old jsonb := '{}'; diff_new jsonb := '{}'; k text; v_action text; v_row jsonb; v_label text;
begin
  if tg_op = 'INSERT' then
    n := to_jsonb(new); v_row := n; v_action := 'creation'; diff_new := n;
  elsif tg_op = 'DELETE' then
    o := to_jsonb(old); v_row := o; v_action := 'suppression'; diff_old := o;
  else
    o := to_jsonb(old); n := to_jsonb(new); v_row := n;
    for k in select jsonb_object_keys(n) loop
      if k not in ('updated_at') and (o -> k) is distinct from (n -> k) then
        diff_old := diff_old || jsonb_build_object(k, o -> k);
        diff_new := diff_new || jsonb_build_object(k, n -> k);
      end if;
    end loop;
    if diff_new = '{}'::jsonb then return null; end if;
    v_action := case
      when diff_new ? 'status' and n ->> 'status' = 'cancelled' then 'annulation'
      when diff_new ? 'status' then 'changement_statut'
      else 'modification' end;
  end if;
  v_label := coalesce(v_row ->> 'number', v_row ->> 'reference', v_row ->> 'name', v_row ->> 'title',
                      v_row ->> 'subject', v_row ->> 'full_name', v_row ->> 'description');
  perform public.audit_write(tg_table_schema, public.audit_module(tg_table_name), v_action, tg_table_name,
                             coalesce(v_row ->> 'id', ''), left(v_label, 200),
                             nullif(diff_old, '{}'::jsonb), nullif(diff_new, '{}'::jsonb));
  return null;
end $$;

-- Rights, roles, companies and blocking
create or replace function public.audit_profile()
returns trigger language plpgsql security definer set search_path = public as $$
declare d_old jsonb := '{}'; d_new jsonb := '{}'; k text;
begin
  if tg_op = 'INSERT' then
    perform public.audit_write(null, 'droits', 'compte.creation', 'profile', new.id::text, new.email, null,
      jsonb_build_object('role', new.role, 'company_access', new.company_access));
    return null;
  end if;
  foreach k in array array['role', 'company_access', 'is_blocked', 'permissions'] loop
    if (to_jsonb(old) -> k) is distinct from (to_jsonb(new) -> k) then
      d_old := d_old || jsonb_build_object(k, to_jsonb(old) -> k);
      d_new := d_new || jsonb_build_object(k, to_jsonb(new) -> k);
    end if;
  end loop;
  if d_new <> '{}'::jsonb then
    perform public.audit_write(null, 'droits',
      case when d_new ? 'is_blocked' then case when new.is_blocked then 'compte.blocage' else 'compte.reactivation' end
           when d_new ? 'role' then 'compte.role' when d_new ? 'company_access' then 'compte.societes' else 'compte.grille' end,
      'profile', new.id::text, new.email, d_old, d_new);
  end if;
  return null;
end $$;
drop trigger if exists audit_profile on public.profiles;
create trigger audit_profile after insert or update on public.profiles for each row execute function public.audit_profile();

create or replace function public.audit_override()
returns trigger language plpgsql security definer set search_path = public as $$
declare r public.user_permission_overrides; v_schema text; v_email text;
begin
  r := case when tg_op = 'DELETE' then old else new end;
  select schema_name into v_schema from public.companies where id = r.company_id;
  select email into v_email from public.profiles where id = r.user_id;
  perform public.audit_write(v_schema, 'droits',
    case tg_op when 'INSERT' then 'permission.' || r.effect when 'DELETE' then 'permission.retour_standard' else 'permission.' || r.effect end,
    'profile', r.user_id::text, v_email,
    case when tg_op = 'INSERT' then null else jsonb_build_object('permission', old.permission_key, 'effet', old.effect) end,
    case when tg_op = 'DELETE' then null else jsonb_build_object('permission', new.permission_key, 'effet', new.effect, 'motif', new.reason) end);
  return null;
end $$;
drop trigger if exists audit_override on public.user_permission_overrides;
create trigger audit_override after insert or update or delete on public.user_permission_overrides
  for each row execute function public.audit_override();

-- Events written by the server (logins, refusals, payment corrections) and by the user's own session (refusals)
create or replace function public.audit_log_event(p_company text, p_module text, p_action text, p_entity_type text,
  p_entity_id text, p_label text, p_details jsonb)
returns bigint language sql security definer set search_path = public as $$
  select public.audit_write(p_company, p_module, p_action, p_entity_type, p_entity_id, p_label, null, p_details)
$$;
revoke all on function public.audit_log_event(text, text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.audit_log_event(text, text, text, text, text, text, jsonb) to service_role;

create or replace function public.audit_refusal(p_company text, p_module text, p_target text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  perform public.audit_write(p_company, coalesce(p_module, 'acces'), 'refus', 'route', left(p_target, 200), null, null,
                             jsonb_build_object('motif', left(p_reason, 300)));
end $$;
revoke all on function public.audit_refusal(text, text, text, text) from public, anon;
grant execute on function public.audit_refusal(text, text, text, text) to authenticated, service_role;

-- =================================================================================================
-- 4. Author of creations (Q8): created_by filled by the database; old rows keep no author
-- =================================================================================================

create or replace function public.set_created_by()
returns trigger language plpgsql security definer set search_path = public as $$
declare ctx record;
begin
  if new.created_by is null then
    select * into ctx from public.audit_context();
    new.created_by := ctx.actor;
  end if;
  return new;
end $$;

-- =================================================================================================
-- 5. Payments ↔ treasury: explicit link (B3)
-- =================================================================================================

do $$
declare s text;
begin
  foreach s in array array['geg_guinee', 'geg_singapore'] loop
    execute format('alter table %I.treasury_transactions add column if not exists supplier_payment_id uuid references %I.supplier_payments (id) on delete restrict', s, s);
    execute format('create unique index if not exists treasury_one_per_payment on %I.treasury_transactions (payment_id) where payment_id is not null', s);
    execute format('create unique index if not exists treasury_one_per_supplier_payment on %I.treasury_transactions (supplier_payment_id) where supplier_payment_id is not null', s);
  end loop;
end $$;

-- Deletes ONE payment and ONLY its own treasury operation, atomically, or refuses (B3).
-- Legacy payments (no explicit link): allowed only when exactly one operation matches account, amount,
-- currency, date, type and category, that operation is linked to nothing, and no other payment
-- (customer or supplier) has the same account, amount, currency and date. Any doubt → refusal.
create or replace function public.delete_payment_safe(p_schema text, p_kind text, p_payment_id uuid, p_invoice_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  pay jsonb; tx jsonb; v_tx_id uuid; n_linked int; n_candidates int; n_rivals int;
  v_table text; v_fk text; v_link text; v_type text; v_category text; v_inv_table text;
  v_paid numeric; v_total numeric; v_status text; v_new_status text;
begin
  if p_schema not in ('geg_guinee', 'geg_singapore') then raise exception 'Société inconnue'; end if;
  if p_kind = 'client' then
    v_table := 'payments'; v_fk := 'invoice_id'; v_link := 'payment_id'; v_type := 'credit'; v_category := 'invoice_payment'; v_inv_table := 'invoices';
  elsif p_kind = 'fournisseur' then
    v_table := 'supplier_payments'; v_fk := 'supplier_invoice_id'; v_link := 'supplier_payment_id'; v_type := 'debit'; v_category := 'supplier_payment'; v_inv_table := 'supplier_invoices';
  else raise exception 'Type de paiement inconnu'; end if;

  execute format('select to_jsonb(p) from %I.%I p where id = $1 and %I = $2 for update', p_schema, v_table, v_fk)
    into pay using p_payment_id, p_invoice_id;
  if pay is null then raise exception 'Paiement introuvable pour cette facture'; end if;

  -- 1. Explicit link
  execute format('select count(*) from %I.treasury_transactions where %I = $1', p_schema, v_link) into n_linked using p_payment_id;
  if n_linked > 1 then raise exception 'Suppression refusée : plusieurs opérations de trésorerie sont liées à ce paiement'; end if;
  if n_linked = 1 then
    execute format('select to_jsonb(t) from %I.treasury_transactions t where %I = $1 for update', p_schema, v_link) into tx using p_payment_id;
    if (tx ->> 'account_id') is distinct from (pay ->> 'treasury_account_id')
       or (tx ->> 'amount')::numeric <> (pay ->> 'amount')::numeric
       or tx ->> 'type' <> v_type
       or (tx ->> 'payment_id' is not null and tx ->> 'supplier_payment_id' is not null) then
      raise exception 'Suppression refusée : l''opération de trésorerie liée ne correspond pas au paiement';
    end if;
  elsif pay ->> 'treasury_account_id' is not null then
    -- 2. Legacy payment: strict single match, no rival payment
    execute format(
      'select count(*) from %I.treasury_transactions t
        where t.account_id = $1 and t.amount = $2 and coalesce(t.currency, '''') = coalesce($3, '''')
          and t.date = ($4)::date and t.type = $5 and t.category = $6
          and t.payment_id is null and t.supplier_payment_id is null', p_schema)
      into n_candidates using (pay ->> 'treasury_account_id')::uuid, (pay ->> 'amount')::numeric, pay ->> 'currency',
                              (pay ->> 'paid_at')::timestamptz, v_type, v_category;
    execute format(
      'select (select count(*) from %1$I.payments where treasury_account_id = $1 and amount = $2 and coalesce(currency, '''') = coalesce($3, '''') and paid_at::date = ($4)::date)
            + (select count(*) from %1$I.supplier_payments where treasury_account_id = $1 and amount = $2 and coalesce(currency, '''') = coalesce($3, '''') and paid_at::date = ($4)::date)', p_schema)
      into n_rivals using (pay ->> 'treasury_account_id')::uuid, (pay ->> 'amount')::numeric, pay ->> 'currency', (pay ->> 'paid_at')::timestamptz;
    if n_candidates <> 1 then
      raise exception 'Suppression refusée : impossible d''identifier avec certitude l''opération de trésorerie de ce paiement (% correspondance(s))', n_candidates;
    end if;
    if n_rivals <> 1 then
      raise exception 'Suppression refusée : un autre paiement du même montant, sur le même compte et à la même date existe (% paiements)', n_rivals;
    end if;
    execute format(
      'select to_jsonb(t) from %I.treasury_transactions t
        where t.account_id = $1 and t.amount = $2 and coalesce(t.currency, '''') = coalesce($3, '''')
          and t.date = ($4)::date and t.type = $5 and t.category = $6
          and t.payment_id is null and t.supplier_payment_id is null for update', p_schema)
      into tx using (pay ->> 'treasury_account_id')::uuid, (pay ->> 'amount')::numeric, pay ->> 'currency',
                    (pay ->> 'paid_at')::timestamptz, v_type, v_category;
  end if;

  v_tx_id := (tx ->> 'id')::uuid;
  perform set_config('geg.payment_correction', 'on', true);
  if v_tx_id is not null then
    execute format('delete from %I.treasury_transactions where id = $1', p_schema) using v_tx_id;
  end if;
  execute format('delete from %I.%I where id = $1', p_schema, v_table) using p_payment_id;

  -- Invoice status from what remains paid
  if p_kind = 'client' then
    execute format('select coalesce(sum(coalesce(amount_in_invoice_currency, amount)), 0) from %I.payments where invoice_id = $1', p_schema) into v_paid using p_invoice_id;
    execute format('select total_ttc, status from %I.invoice_totals where id = $1', p_schema) into v_total, v_status using p_invoice_id;
    v_new_status := case when v_paid <= 0 then 'sent' when v_total is not null and v_paid >= v_total - 0.005 then 'paid' else 'partial' end;
    if v_status in ('sent', 'partial', 'paid') and v_new_status <> v_status then
      execute format('update %I.invoices set status = $1 where id = $2', p_schema) using v_new_status, p_invoice_id;
    end if;
  else
    execute format('select coalesce(sum(case when currency is not null and currency <> coalesce(si.currency, ''GNF'') and exchange_rate is not null and exchange_rate <> 0 then amount / exchange_rate else amount end), 0)
                     from %1$I.supplier_payments sp, %1$I.supplier_invoices si where sp.supplier_invoice_id = $1 and si.id = $1', p_schema)
      into v_paid using p_invoice_id;
    execute format('select total_ttc, status from %I.supplier_invoices where id = $1', p_schema) into v_total, v_status using p_invoice_id;
    v_new_status := case when v_total is not null and v_paid >= v_total - 0.005 then 'paid' when v_paid > 0 then 'partial' else 'pending' end;
    if v_status in ('pending', 'partial', 'paid') and v_new_status <> v_status then
      execute format('update %I.supplier_invoices set status = $1 where id = $2', p_schema) using v_new_status, p_invoice_id;
    end if;
  end if;

  perform public.audit_write(p_schema, 'comptabilite', 'paiement.suppression_correction', v_table, p_payment_id::text,
    pay ->> 'reference', jsonb_build_object('paiement', pay, 'operation_tresorerie', tx), jsonb_build_object('statut_facture', v_new_status));
  perform set_config('geg.payment_correction', 'off', true);
  return jsonb_build_object('ok', true, 'treasury_transaction_id', v_tx_id, 'invoice_status', v_new_status);
end $$;
revoke all on function public.delete_payment_safe(text, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.delete_payment_safe(text, text, uuid, uuid) to service_role;

-- A treasury operation linked to a payment can only disappear with its payment (through delete_payment_safe)
create or replace function public.protect_payment_treasury()
returns trigger language plpgsql as $$
begin
  if (old.payment_id is not null or old.supplier_payment_id is not null)
     and coalesce(current_setting('geg.payment_correction', true), 'off') <> 'on' then
    raise exception 'Cette opération de trésorerie appartient à un paiement : supprimez le paiement depuis sa facture';
  end if;
  return old;
end $$;

-- =================================================================================================
-- 6. Document rules for every role (D1, Q2, B1)
-- =================================================================================================

create or replace function public.document_rules()
returns trigger language plpgsql set search_path = public as $$
declare v_status text; n int;
begin
  if tg_table_name = 'invoices' then
    if old.status is distinct from 'draft' then
      if new.status = 'draft' then raise exception 'Facture émise : elle ne peut pas revenir en brouillon (corriger par un avoir)'; end if;
      if new.status = 'cancelled' and old.status <> 'cancelled' then raise exception 'Facture émise : elle ne peut pas être annulée (corriger par un avoir)'; end if;
      if old.status = 'cancelled' and new.status <> 'cancelled' then raise exception 'Facture annulée : son statut ne peut plus changer'; end if;
      if (new.account_id, new.issue_date, new.due_date, new.currency, new.number, new.order_id)
         is distinct from (old.account_id, old.issue_date, old.due_date, old.currency, old.number, old.order_id) then
        raise exception 'Facture émise : client, dates, devise et numéro ne sont plus modifiables (corriger par un avoir)';
      end if;
    end if;
    return new;

  elsif tg_table_name = 'invoice_lines' then
    execute format('select status from %I.invoices where id = $1', tg_table_schema) into v_status
      using case when tg_op = 'DELETE' then old.invoice_id else new.invoice_id end;
    if v_status is not null and v_status <> 'draft' then raise exception 'Facture émise : ses lignes ne sont plus modifiables (corriger par un avoir)'; end if;
    if tg_op = 'UPDATE' and new.invoice_id is distinct from old.invoice_id then
      execute format('select status from %I.invoices where id = $1', tg_table_schema) into v_status using old.invoice_id;
      if v_status is not null and v_status <> 'draft' then raise exception 'Facture émise : ses lignes ne sont plus modifiables'; end if;
    end if;
    return case when tg_op = 'DELETE' then old else new end;

  elsif tg_table_name = 'sales_orders' then
    if new.status is distinct from old.status then
      execute format('select count(*) from %I.invoices where order_id = $1 and status <> ''cancelled''', tg_table_schema) into n using old.id;
      if old.status = 'invoiced' and n > 0 then raise exception 'Devis facturé : son statut ne peut plus changer'; end if;
      if new.status = 'cancelled' and n > 0 then raise exception 'Ce devis a une facture : il ne peut pas être annulé'; end if;
    end if;
    return new;

  elsif tg_table_name = 'delivery_notes' then
    if old.status = 'delivered' and new.status is distinct from 'delivered' then
      raise exception 'Bon de livraison livré : il ne peut plus être annulé ni modifié (retour de stock : second chantier)';
    end if;
    if old.status = 'cancelled' and new.status <> 'cancelled' then raise exception 'Bon de livraison annulé : son statut ne peut plus changer'; end if;
    return new;

  elsif tg_table_name = 'purchase_orders' then
    if new.status = 'cancelled' and old.status <> 'cancelled' then
      execute format('select count(*) from %I.purchase_receptions where order_id = $1', tg_table_schema) into n using old.id;
      if n > 0 or old.status in ('partial', 'received') then
        raise exception 'Commande d''achat déjà réceptionnée : elle ne peut pas être annulée';
      end if;
    end if;
    return new;

  elsif tg_table_name = 'supplier_invoices' then
    if new.status = 'cancelled' and old.status <> 'cancelled' then
      execute format('select count(*) from %I.supplier_payments where supplier_invoice_id = $1', tg_table_schema) into n using old.id;
      if n > 0 or old.status not in ('draft', 'pending') then
        raise exception 'Facture fournisseur validée ou payée : elle ne peut pas être annulée (corriger par un avoir)';
      end if;
    end if;
    return new;
  end if;
  return new;
end $$;

-- =================================================================================================
-- 7. Triggers and row level security on every company table
-- =================================================================================================

do $$
declare
  -- table → permissions allowing direct creation / modification (any of)
  write_keys constant jsonb := '{
    "accounts": ["comptes.creer","comptes.modifier","comptes.archiver"],
    "contacts": ["contacts.creer","contacts.modifier","contacts.archiver"],
    "deals": ["opportunites.creer","opportunites.modifier","opportunites.transferer"],
    "deal_costs": ["opportunites.couts_modifier"],
    "activities": ["activites.creer","activites.modifier"],
    "documents": ["documents.ajouter","documents.modifier"],
    "document_categories": ["documents.ajouter","documents.modifier"],
    "shipments": ["expeditions.gerer"],
    "sales_orders": ["devis.creer","devis.modifier","devis.confirmer","devis.annuler"],
    "sales_order_lines": ["devis.creer","devis.modifier"],
    "invoices": ["factures.creer","factures.modifier_brouillon","factures.emettre","factures.annuler_brouillon","factures.avoir"],
    "invoice_lines": ["factures.creer","factures.modifier_brouillon","factures.avoir"],
    "delivery_notes": ["livraisons.creer","livraisons.confirmer","livraisons.annuler"],
    "delivery_note_lines": ["livraisons.creer","livraisons.confirmer"],
    "payments": ["paiements_clients.enregistrer"],
    "purchase_orders": ["achats.creer","achats.modifier","achats.annuler","achats.receptionner"],
    "purchase_order_lines": ["achats.creer","achats.modifier","achats.receptionner"],
    "purchase_order_events": ["achats.creer","achats.modifier","achats.annuler","achats.receptionner"],
    "purchase_costs": ["achats.modifier"],
    "purchase_receptions": ["achats.receptionner"],
    "purchase_reception_lines": ["achats.receptionner"],
    "supplier_invoices": ["factures_fournisseurs.gerer","factures_fournisseurs.annuler","paiements_fournisseurs.enregistrer"],
    "supplier_invoice_lines": ["factures_fournisseurs.gerer"],
    "supplier_payments": ["paiements_fournisseurs.enregistrer"],
    "suppliers": ["fournisseurs.gerer"],
    "treasury_accounts": ["tresorerie.comptes"],
    "treasury_transactions": ["tresorerie.saisir"],
    "stock_moves": ["stock.mouvement_manuel","stock.inventaire"],
    "stock_levels": ["stock.mouvement_manuel","stock.inventaire"],
    "warehouses": ["stock.entrepots"],
    "products": ["produits.gerer"],
    "product_categories": ["produits.gerer"],
    "product_documents": ["produits.gerer"],
    "product_packaging": ["produits.gerer"],
    "employees": ["employes.gerer"],
    "commissions": ["commissions.gerer"],
    "units": ["parametres.gerer"],
    "exchange_rates": ["parametres.gerer"]
  }';
  -- table → permissions allowing deletion (default: "suppression", never given to a Commercial)
  delete_keys constant jsonb := '{
    "sales_order_lines": ["devis.modifier"],
    "invoice_lines": ["factures.modifier_brouillon"],
    "delivery_note_lines": ["livraisons.creer"],
    "purchase_order_lines": ["achats.modifier"],
    "payments": ["paiements.supprimer"],
    "supplier_payments": ["paiements.supprimer"],
    "treasury_accounts": ["comptes_bancaires.supprimer"],
    "activity_logs": ["societes.gerer"]
  }';
  -- table → permission needed to read at all (sensitive data, D3)
  read_keys constant jsonb := '{
    "treasury_accounts": ["tresorerie.voir"],
    "treasury_transactions": ["tresorerie.voir"],
    "commissions": ["commissions.gerer"]
  }';
  audited constant text[] := array[
    'accounts','contacts','deals','deal_costs','activities','documents','document_categories','shipments',
    'sales_orders','sales_order_lines','invoices','invoice_lines','delivery_notes','delivery_note_lines',
    'payments','purchase_orders','purchase_order_lines','purchase_costs','purchase_receptions','purchase_reception_lines',
    'supplier_invoices','supplier_invoice_lines','supplier_payments','suppliers','treasury_accounts','treasury_transactions',
    'stock_moves','stock_levels','warehouses','products','product_categories','product_documents','product_packaging',
    'employees','commissions','units','exchange_rates'];
  needs_author constant text[] := array[
    'accounts','contacts','deals','deal_costs','documents','shipments','suppliers','supplier_invoices','supplier_payments',
    'treasury_accounts','products','product_documents','employees','commissions','warehouses','units','purchase_costs'];
  t record; keys jsonb;
begin
  for t in
    select n.nspname as s, c.relname as r
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'r' and n.nspname in ('geg_guinee', 'geg_singapore')
  loop
    -- Row level security: on top of the company check, the effective permission in THIS company
    execute format('drop policy if exists perm_delete on %I.%I', t.s, t.r);
    execute format('drop policy if exists perm_insert on %I.%I', t.s, t.r);
    execute format('drop policy if exists perm_update on %I.%I', t.s, t.r);
    execute format('drop policy if exists perm_select on %I.%I', t.s, t.r);

    if t.r not in ('chat_messages', 'chat_read_receipts', 'chat_rooms') then
      keys := coalesce(delete_keys -> t.r, '["suppression"]');
      execute format('create policy perm_delete on %I.%I as restrictive for delete to authenticated using ((select public.has_any_permission(%L::text[], %L)))',
        t.s, t.r, array(select jsonb_array_elements_text(keys)), t.s);
    end if;
    keys := write_keys -> t.r;
    if keys is not null then
      execute format('create policy perm_insert on %1$I.%2$I as restrictive for insert to authenticated with check ((select public.has_any_permission(%3$L::text[], %1$L)))',
        t.s, t.r, array(select jsonb_array_elements_text(keys)));
      execute format('create policy perm_update on %1$I.%2$I as restrictive for update to authenticated using ((select public.has_any_permission(%3$L::text[], %1$L))) with check ((select public.has_any_permission(%3$L::text[], %1$L)))',
        t.s, t.r, array(select jsonb_array_elements_text(keys)));
    end if;
    keys := read_keys -> t.r;
    if keys is not null then
      execute format('create policy perm_select on %I.%I as restrictive for select to authenticated using ((select public.has_any_permission(%L::text[], %L)))',
        t.s, t.r, array(select jsonb_array_elements_text(keys)), t.s);
    end if;

    -- Audit
    if t.r = any (audited) then
      execute format('drop trigger if exists audit_row on %I.%I', t.s, t.r);
      execute format('create trigger audit_row after insert or update or delete on %I.%I for each row execute function public.audit_row()', t.s, t.r);
    end if;

    -- Author of creations
    if t.r = any (needs_author) then
      execute format('alter table %I.%I add column if not exists created_by uuid', t.s, t.r);
      execute format('drop trigger if exists set_created_by on %I.%I', t.s, t.r);
      execute format('create trigger set_created_by before insert on %I.%I for each row execute function public.set_created_by()', t.s, t.r);
    end if;
  end loop;

end $$;

do $$
declare s text; t text;
begin
  foreach s in array array['geg_guinee', 'geg_singapore'] loop
    foreach t in array array['invoices', 'sales_orders', 'delivery_notes', 'purchase_orders', 'supplier_invoices'] loop
      execute format('drop trigger if exists document_rules on %I.%I', s, t);
      execute format('create trigger document_rules before update on %I.%I for each row execute function public.document_rules()', s, t);
    end loop;
    execute format('drop trigger if exists document_rules on %I.invoice_lines', s);
    execute format('create trigger document_rules before insert or update or delete on %I.invoice_lines for each row execute function public.document_rules()', s);
    execute format('drop trigger if exists protect_payment_treasury on %I.treasury_transactions', s);
    execute format('create trigger protect_payment_treasury before delete on %I.treasury_transactions for each row execute function public.protect_payment_treasury()', s);
  end loop;
end $$;

-- The older supplier rule is replaced by perm_delete
drop policy if exists suppliers_delete_role on geg_guinee.suppliers;
drop policy if exists suppliers_delete_role on geg_singapore.suppliers;

notify pgrst, 'reload schema';

commit;
