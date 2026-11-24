-- Fiabilisation du stock, phases 1 à 5 (plan technique A1–A7 du 23/11/2026, M1 à M6 validés par GEG le 24/11/2026).
-- DEV UNIQUEMENT tant que GEG n'a pas autorisé la production. Aucune donnée historique n'est modifiée :
-- seules des colonnes, contraintes, vues, fonctions et un emplacement « Livraison directe » sont ajoutés.
--
-- M1  Moteur de stock atomique : stock_appliquer, inventaire_valider, livraison_confirmer, achat_receptionner,
--     livraison_preparer. Chaque opération = une transaction ; les stocks concernés sont verrouillés dans un ordre
--     stable, tout est contrôlé AVANT d'écrire, aucun stock ne devient négatif. Un refus annule tout (exception
--     « GEG_REFUS » : message précis + détail JSON lu par l'application).
-- M2  Traçabilité : document / ligne d'origine / motif / sens sur chaque mouvement ; une seule écriture de stock par
--     ligne de document (index unique) ; ligne de BL -> ligne de facture ; stock jamais négatif (contrainte posée
--     « NOT VALID » si des stocks négatifs historiques existent : ils sont signalés, jamais corrigés).
-- M3  Emplacement non physique « Livraison directe » (warehouses.kind = 'direct') : entrée à la réception directe
--     (liée à la ligne de facture du client), sortie à la livraison de cette ligne.
-- M4  Contrôle à l'émission d'une facture : stock + acheté non réceptionné − facturé non livré >= quantité facturée.
-- M5  Unité de la ligne de devis = unité de la fiche ; conditionnement obligatoire (liste fermée, « Autre » validé
--     par un Manager ou plus avant usage).
-- M6  Type de fiche « Remise » (discount) : jamais de stock, seul type autorisé à un montant négatif.
begin;

-- Refus métier : message lisible + détail JSON ; l'appelant reçoit hint = 'GEG_REFUS'
create or replace function public.geg_refus(p_message text, p_detail jsonb default '{}'::jsonb) returns void
language plpgsql as $$
begin
  raise exception using message = p_message, detail = coalesce(p_detail, '{}'::jsonb)::text, hint = 'GEG_REFUS', errcode = 'P0001';
end $$;
revoke all on function public.geg_refus(text, jsonb) from public, anon, authenticated;
grant execute on function public.geg_refus(text, jsonb) to service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Structure (les deux sociétés ; GEG Singapour reçoit les colonnes qui lui manquaient pour un moteur identique)
-- ---------------------------------------------------------------------------------------------------------------
do $$
declare s text; n int;
begin
  foreach s in array array['geg_guinee', 'geg_singapore'] loop
    -- M3 : emplacement non physique
    execute format('alter table %I.warehouses add column if not exists kind text not null default ''physical''', s);
    execute format('alter table %I.warehouses drop constraint if exists warehouses_kind_check', s);
    execute format('alter table %I.warehouses add constraint warehouses_kind_check check (kind in (''physical'', ''direct''))', s);
    execute format('insert into %I.warehouses (name, is_active, kind) select ''Livraison directe'', true, ''direct'' where not exists (select 1 from %I.warehouses where kind = ''direct'')', s, s);

    -- M2 : traçabilité des mouvements
    execute format('alter table %I.stock_moves add column if not exists doc_type text, add column if not exists doc_id uuid, add column if not exists doc_line_id uuid, add column if not exists reason text, add column if not exists direction text', s);
    execute format('alter table %I.stock_moves drop constraint if exists stock_moves_direction_check', s);
    execute format('alter table %I.stock_moves add constraint stock_moves_direction_check check (direction in (''+'', ''-''))', s);
    execute format('create unique index if not exists stock_moves_une_ecriture_par_ligne on %I.stock_moves (doc_type, doc_line_id) where doc_line_id is not null', s);
    execute format('create index if not exists stock_moves_document on %I.stock_moves (doc_type, doc_id)', s);

    -- M2 : stock jamais négatif. Stocks négatifs historiques : contrainte NOT VALID (nouvelles écritures contrôlées), signalés
    execute format('select count(*) from %I.stock_levels where quantity < 0', s) into n;
    execute format('alter table %I.stock_levels drop constraint if exists stock_levels_jamais_negatif', s);
    if n = 0 then
      execute format('alter table %I.stock_levels add constraint stock_levels_jamais_negatif check (quantity >= 0)', s);
    else
      execute format('alter table %I.stock_levels add constraint stock_levels_jamais_negatif check (quantity >= 0) not valid', s);
      raise notice '% : % stock(s) négatif(s) historique(s), signalé(s) sans correction', s, n;
    end if;
    execute format('alter table %I.stock_levels add column if not exists updated_at timestamptz not null default now()', s);

    -- M2 : ligne de BL -> ligne de facture ; réception directe -> ligne de facture du client
    execute format('alter table %I.delivery_note_lines add column if not exists invoice_line_id uuid references %I.invoice_lines(id) on delete set null', s, s);
    execute format('create index if not exists delivery_note_lines_invoice_line on %I.delivery_note_lines (invoice_line_id)', s);
    execute format('alter table %I.purchase_reception_lines add column if not exists invoice_line_id uuid references %I.invoice_lines(id) on delete set null', s, s);
    execute format('create index if not exists purchase_reception_lines_invoice_line on %I.purchase_reception_lines (invoice_line_id)', s);
    execute format('alter table %I.delivery_note_lines add column if not exists order_line_id uuid references %I.sales_order_lines(id) on delete set null', s, s);
    execute format('alter table %I.delivery_note_lines add column if not exists qty_delivered numeric', s);
    execute format('alter table %I.sales_order_lines add column if not exists qty_delivered numeric not null default 0', s);
    execute format('alter table %I.purchase_order_lines add column if not exists qty_received numeric not null default 0', s);
    execute format('alter table %I.purchase_order_lines add column if not exists warehouse_id uuid references %I.warehouses(id) on delete set null', s, s);

    -- M6 : type « Remise » ; M5 : conditionnement
    execute format('alter table %I.products drop constraint if exists products_product_type_check', s);
    execute format('alter table %I.products add constraint products_product_type_check check (product_type in (''storable'', ''consumable'', ''service'', ''discount''))', s);
    execute format('alter table %I.products add column if not exists packaging text, add column if not exists packaging_other text, add column if not exists packaging_status text, add column if not exists packaging_validated_by uuid, add column if not exists packaging_validated_at timestamptz', s);
    execute format('alter table %I.products drop constraint if exists products_packaging_check', s);
    execute format('alter table %I.products add constraint products_packaging_check check (packaging in (''1 L'', ''4 L'', ''5 L'', ''20 L'', ''200 L'', ''208 L'', ''Autre''))', s);
    execute format('alter table %I.products drop constraint if exists products_packaging_other_check', s);
    execute format('alter table %I.products add constraint products_packaging_other_check check (packaging is distinct from ''Autre'' or nullif(btrim(packaging_other), '''') is not null)', s);
    execute format('alter table %I.products drop constraint if exists products_packaging_status_check', s);
    execute format('alter table %I.products add constraint products_packaging_status_check check (packaging_status in (''valide'', ''a_valider''))', s);
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Règles des lignes de vente (M5 unité, M6 remise, conditionnement « Autre » non validé)
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.catalog_line_rules() returns trigger
language plpgsql set search_path = public as $function$
declare v_active boolean; v_type text; v_number text; v_amount_changed boolean; v_pack text;
begin
  if tg_table_name = 'invoice_lines' then
    execute format('select number from %I.invoices where id = $1', tg_table_schema) into v_number using new.invoice_id;
    if coalesce(v_number, '') like 'AVR-%' then return new; end if;   -- credit notes copy the original lines
  end if;

  -- Comment line: text only, never a product, a quantity, a price nor an amount
  if new.line_type = 'comment' then
    if new.product_id is not null or new.quantity <> 0 or new.unit_price <> 0 or new.discount <> 0 then
      raise exception 'Ligne de commentaire : elle ne peut avoir ni produit, ni quantité, ni prix, ni remise';
    end if;
    if tg_table_name = 'sales_order_lines' then
      if coalesce((to_jsonb(new) ->> 'qty_delivered')::numeric, 0) <> 0 then
        raise exception 'Ligne de commentaire : elle ne peut pas être livrée';
      end if;
    end if;
    if btrim(coalesce(new.description, '')) = '' then raise exception 'Ligne de commentaire vide'; end if;
    return new;
  end if;

  v_amount_changed := tg_op = 'INSERT' or new.unit_price is distinct from old.unit_price;
  -- Historical lines are left as they are while their product does not change (R1 applies to new lines)
  if tg_op = 'UPDATE' and old.line_type = 'product' and new.product_id is not distinct from old.product_id then
    if v_amount_changed and new.unit_price < 0 then
      if new.product_id is not null then
        execute format('select product_type from %I.products where id = $1', tg_table_schema) into v_type using new.product_id;
      end if;
      if v_type is distinct from 'discount' then
        raise exception 'Montant négatif refusé : seule une fiche de type « Remise » peut avoir un montant négatif';
      end if;
    end if;
    return new;
  end if;

  if new.product_id is null then
    raise exception 'Ligne refusée : chaque ligne doit être un produit, un service ou une remise du catalogue GEG (aucune ligne libre)';
  end if;
  execute format('select is_active, product_type, packaging_status from %I.products where id = $1', tg_table_schema)
    into v_active, v_type, v_pack using new.product_id;
  if v_active is null then raise exception 'Ligne refusée : produit introuvable dans le catalogue'; end if;
  if not v_active then raise exception 'Ligne refusée : ce produit est désactivé et ne peut plus être vendu'; end if;
  if v_pack = 'a_valider' then
    raise exception 'Ligne refusée : le conditionnement « Autre » de cette fiche doit d''abord être validé par un Manager';
  end if;
  if new.unit_price < 0 and v_type is distinct from 'discount' then
    raise exception 'Montant négatif refusé : seule une fiche de type « Remise » peut avoir un montant négatif';
  end if;
  return new;
end $function$;

-- M5 : l'unité d'une ligne de devis est celle de la fiche (aucune autre unité, aucune conversion)
create or replace function public.sales_line_unit_rule() returns trigger
language plpgsql set search_path = public as $function$
declare v_unit uuid;
begin
  if new.line_type = 'comment' or new.product_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.product_id is not distinct from old.product_id and new.unit_id is not distinct from old.unit_id then
    return new;   -- historical lines are never touched
  end if;
  execute format('select unit_id from %I.products where id = $1', tg_table_schema) into v_unit using new.product_id;
  if v_unit is null then return new; end if;
  if new.unit_id is null then
    new.unit_id := v_unit;
  elsif new.unit_id <> v_unit then
    raise exception 'Unité refusée : l''unité d''une ligne est celle de la fiche produit (aucune autre unité ni conversion). Pour un autre conditionnement, choisissez la fiche correspondante.';
  end if;
  return new;
end $function$;

do $$
declare s text; t text;
begin
  foreach s in array array['geg_guinee', 'geg_singapore'] loop
    -- règle de lignes temporaire du déploiement ciblé « stock » (PROD_14) : retirée dès que les règles du catalogue
    -- (catalog_line_rules, migration 20261110) sont attachées, car elles la contiennent
    foreach t in array array['invoice_lines', 'sales_order_lines'] loop
      if exists (select 1 from pg_trigger tg join pg_class c on c.oid = tg.tgrelid where c.relnamespace = s::regnamespace and c.relname = t and tg.tgname = 'catalog_line_rules') then
        execute format('drop trigger if exists stock_line_rules on %I.%I', s, t);
      end if;
    end loop;
    if exists (select 1 from information_schema.columns where table_schema = s and table_name = 'sales_order_lines' and column_name = 'unit_id') then
      execute format('drop trigger if exists unite_de_la_fiche on %I.sales_order_lines', s);
      execute format('create trigger unite_de_la_fiche before insert or update on %I.sales_order_lines for each row execute function public.sales_line_unit_rule()', s);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 3. Vues : quantités livrées / restant à livrer par ligne de facture (A1), état de livraison par facture
-- ---------------------------------------------------------------------------------------------------------------
-- Les BL historiques n'ont pas de lien vers la ligne de facture : leurs quantités sont réparties par produit
-- (ou par désignation pour une ligne libre non rattachée), dans l'ordre des lignes de la facture.
do $$
declare s text; v_hl text;
begin
  foreach s in array array['geg_guinee', 'geg_singapore'] loop
    -- correspondances historiques validées : seulement là où la table existe (déploiement ciblé « stock » : pas encore)
    v_hl := case when to_regclass(s || '.historical_line_links') is not null
      then format('left join %I.historical_line_links hl on il.product_id is null and hl.line_table = ''invoice_lines'' and hl.line_id = il.id and hl.status = ''validated''', s)
      else 'left join (select null::uuid as product_id) hl on false' end;
    execute format('drop view if exists %I.invoice_delivery_status', s);
    execute format('drop view if exists %I.invoice_line_delivery', s);
    execute format($v$
      create or replace view %1$I.invoice_line_delivery with (security_invoker = true) as
      with lines as (
        select il.id as invoice_line_id, il.invoice_id, il.position, il.description, il.quantity,
               coalesce(il.product_id, hl.product_id) as product_id
        from %1$I.invoice_lines il
        %2$s
        where il.line_type <> 'comment' and il.quantity > 0
      ), goods as (
        select l.* from lines l left join %1$I.products p on p.id = l.product_id
        where l.product_id is null or coalesce(p.product_type, 'storable') in ('storable', 'consumable')
      ), dn as (
        select d.invoice_id, dl.invoice_line_id, dl.product_id, dl.description, dl.quantity
        from %1$I.delivery_note_lines dl join %1$I.delivery_notes d on d.id = dl.delivery_note_id
        where d.status = 'delivered' and d.invoice_id is not null and dl.line_type <> 'comment' and dl.quantity > 0
      ), linked as (
        select invoice_line_id, sum(quantity) as q from dn where invoice_line_id is not null group by 1
      ), hist as (
        select invoice_id, product_id, sum(quantity) as q from dn where invoice_line_id is null and product_id is not null group by 1, 2
      ), histdesc as (
        select invoice_id, btrim(lower(description)) as d, sum(quantity) as q from dn where invoice_line_id is null and product_id is null group by 1, 2
      ), base as (
        select g.*, coalesce(li.q, 0) as linked_q, greatest(g.quantity - coalesce(li.q, 0), 0) as open_q
        from goods g left join linked li on li.invoice_line_id = g.invoice_line_id
      ), alloc as (
        select b.*, coalesce(sum(b.open_q) over (
                 partition by b.invoice_id, coalesce(b.product_id::text, btrim(lower(b.description)))
                 order by b.position, b.invoice_line_id rows between unbounded preceding and 1 preceding), 0) as before_q
        from base b
      ), res as (
        select a.invoice_id, a.invoice_line_id, a.product_id, a.description, a.position, a.quantity,
               a.linked_q + least(a.open_q, greatest(coalesce(case when a.product_id is not null then h.q else hd.q end, 0) - a.before_q, 0)) as delivered
        from alloc a
        left join hist h on a.product_id is not null and h.invoice_id = a.invoice_id and h.product_id = a.product_id
        left join histdesc hd on a.product_id is null and hd.invoice_id = a.invoice_id and hd.d = btrim(lower(a.description))
      )
      select res.*, greatest(res.quantity - res.delivered, 0) as remaining from res
    $v$, s, v_hl);

    execute format($v$
      create or replace view %1$I.invoice_delivery_status with (security_invoker = true) as
      select i.id as invoice_id, i.status as invoice_status,
             coalesce(sum(x.quantity), 0) as goods_qty,
             coalesce(sum(x.delivered), 0) as delivered_qty,
             coalesce(sum(x.remaining), 0) as remaining_qty,
             case when i.status = 'cancelled' then 'annulee'
                  when i.status = 'draft' then 'brouillon'
                  when coalesce(i.number, '') like 'AVR-%%' then 'avoir'
                  when count(x.invoice_line_id) = 0 then 'sans_marchandise'
                  when coalesce(sum(x.delivered), 0) <= 0 then 'non_livree'
                  when coalesce(sum(x.remaining), 0) <= 0 then 'livree'
                  else 'partielle' end as delivery_state,
             (select count(*) from %1$I.delivery_notes d where d.invoice_id = i.id and d.status = 'draft') as draft_notes
      from %1$I.invoices i
      left join %1$I.invoice_line_delivery x on x.invoice_id = i.id
      group by i.id, i.status, i.number
    $v$, s);

    execute format('revoke all on %I.invoice_line_delivery, %I.invoice_delivery_status from anon, authenticated', s, s);
    -- lus par le serveur uniquement (jamais directement depuis le navigateur, quelle que soit la société)
    execute format('grant select on %I.invoice_line_delivery, %I.invoice_delivery_status to service_role', s, s);
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 4. Fonctions du moteur (créées à l'identique dans chaque société, search_path = la société)
-- ---------------------------------------------------------------------------------------------------------------
do $do$
declare s text; f text;
begin
  foreach s in array array['geg_guinee', 'geg_singapore'] loop

    -- Libellé d'une fiche : « PRD-00012 Désignation »
    execute format($f$
      create or replace function %1$I.geg_libelle_produit(p uuid) returns text language sql stable set search_path = %1$I, public as $b$
        select coalesce((to_jsonb(x) ->> 'product_code') || ' ', '') || x.name from products x where x.id = p
      $b$ $f$, s);

    execute format($f$
      create or replace function %1$I.geg_qte(q numeric) returns text language sql immutable as $b$
        select replace(trim_scale(coalesce(q, 0))::text, '.', ',')
      $b$ $f$, s);

    -- Verrouille le stock d'un produit dans un emplacement (jusqu'à la fin de la transaction) et le renvoie
    execute format($f$
      create or replace function %1$I.stock_verrouiller(p_product uuid, p_wh uuid) returns numeric
      language plpgsql set search_path = %1$I, public as $b$
      declare q numeric;
      begin
        perform pg_advisory_xact_lock(hashtextextended(%2$L || ':' || p_product::text || ':' || p_wh::text, 0));
        select quantity into q from stock_levels where product_id = p_product and warehouse_id = p_wh for update;
        return coalesce(q, 0);
      end $b$ $f$, s, s);

    -- Fixe le stock (jamais négatif)
    execute format($f$
      create or replace function %1$I.stock_fixer(p_product uuid, p_wh uuid, p_qty numeric) returns void
      language plpgsql set search_path = %1$I, public as $b$
      begin
        if p_qty < 0 then perform public.geg_refus('Le stock ne peut pas devenir négatif. Rien n''a été enregistré.'); end if;
        insert into stock_levels (product_id, warehouse_id, quantity, updated_at) values (p_product, p_wh, p_qty, now())
        on conflict (product_id, warehouse_id) do update set quantity = excluded.quantity, updated_at = now();
      end $b$ $f$, s);

    -- M1 : entrée, sortie, perte, transfert, ajustement manuels
    execute format($f$
      create or replace function %1$I.stock_appliquer(p_type text, p_product uuid, p_from uuid, p_to uuid, p_quantity numeric,
                                                      p_user uuid, p_notes text default null, p_reason text default null) returns jsonb
      language plpgsql set search_path = %1$I, public as $b$
      declare v_prod record; v_from boolean; v_to boolean; v_from_name text; v_to_name text; q_from numeric; q_to numeric;
              v_label text; v_delta numeric; v_id uuid; v_ok boolean;
      begin
        if p_type is null or p_type not in ('in', 'out', 'transfer', 'adjustment', 'damaged', 'lost', 'destroyed') then
          perform public.geg_refus('Type de mouvement inconnu');
        end if;
        if p_quantity is null or (p_type = 'adjustment' and p_quantity < 0) or (p_type <> 'adjustment' and p_quantity <= 0) then
          perform public.geg_refus(case when p_type = 'adjustment' then 'La quantité cible ne peut pas être négative' else 'La quantité doit être supérieure à 0' end);
        end if;
        select * into v_prod from products where id = p_product;
        if not found then perform public.geg_refus('Produit introuvable'); end if;
        if v_prod.product_type in ('service', 'discount') then
          perform public.geg_refus(format('« %%s » n''est pas une marchandise : aucun mouvement de stock possible', v_prod.name));
        end if;
        v_label := geg_libelle_produit(p_product);
        v_from := p_type in ('out', 'transfer', 'damaged', 'lost', 'destroyed');
        v_to := p_type in ('in', 'transfer', 'adjustment');
        if v_from then
          if p_from is null then perform public.geg_refus('Choisissez le dépôt de départ'); end if;
          select name, coalesce(is_active, false) and kind = 'physical' into v_from_name, v_ok from warehouses where id = p_from;
          if not coalesce(v_ok, false) then perform public.geg_refus('Dépôt de départ introuvable, inactif ou non physique'); end if;
        end if;
        if v_to then
          if p_to is null then perform public.geg_refus('Choisissez le dépôt'); end if;
          select name, coalesce(is_active, false) and kind = 'physical' into v_to_name, v_ok from warehouses where id = p_to;
          if not coalesce(v_ok, false) then perform public.geg_refus('Dépôt introuvable, inactif ou non physique'); end if;
        end if;
        if p_type = 'transfer' and p_from = p_to then perform public.geg_refus('Les deux dépôts doivent être différents'); end if;

        -- verrous dans un ordre stable (pas d'interblocage entre deux transferts croisés)
        if v_from and v_to and p_to::text < p_from::text then
          q_to := stock_verrouiller(p_product, p_to); q_from := stock_verrouiller(p_product, p_from);
        else
          if v_from then q_from := stock_verrouiller(p_product, p_from); end if;
          if v_to then q_to := stock_verrouiller(p_product, p_to); end if;
        end if;

        if v_from and q_from < p_quantity then
          perform public.geg_refus(
            format('Stock insuffisant : %%s — dépôt %%s : %%s disponible(s), %%s demandé(s). Rien n''a été enregistré.', v_label, v_from_name, geg_qte(q_from), geg_qte(p_quantity)),
            jsonb_build_object('shortage', jsonb_build_object('product', v_label, 'warehouse', v_from_name, 'requested', p_quantity, 'available', q_from)));
        end if;
        if p_type = 'adjustment' then
          v_delta := p_quantity - q_to;
          if v_delta = 0 then return jsonb_build_object('ok', true, 'delta', 0); end if;
        end if;

        if v_from then perform stock_fixer(p_product, p_from, q_from - p_quantity); end if;
        if v_to then perform stock_fixer(p_product, p_to, case when p_type = 'adjustment' then p_quantity else q_to + p_quantity end); end if;

        insert into stock_moves (type, product_id, from_warehouse_id, to_warehouse_id, quantity, notes, user_id, doc_type, reason, direction)
        values (p_type, p_product, case when v_from then p_from end, case when v_to then p_to end,
                case when p_type = 'adjustment' then abs(v_delta) else p_quantity end,
                case when p_type = 'adjustment' then 'Ajustement : ' || geg_qte(q_to) || ' → ' || geg_qte(p_quantity) || coalesce(' — ' || nullif(btrim(p_notes), ''), '')
                     else nullif(btrim(p_notes), '') end,
                p_user, 'manual', nullif(btrim(p_reason), ''),
                case when p_type = 'adjustment' then case when v_delta > 0 then '+' else '-' end end)
        returning id into v_id;
        return jsonb_build_object('ok', true, 'move_id', v_id) || case when p_type = 'adjustment' then jsonb_build_object('delta', v_delta) else '{}'::jsonb end;
      end $b$ $f$, s);

    -- M1 / A5 : validation d'un inventaire (tout ou rien, écart calculé sur la base au moment même)
    execute format($f$
      create or replace function %1$I.inventaire_valider(p_items jsonb, p_user uuid, p_reason text default null) returns jsonb
      language plpgsql set search_path = %1$I, public as $b$
      declare it record; v_inv uuid := gen_random_uuid(); v_changed jsonb := '[]'::jsonb; q numeric; n int := 0; v_ok boolean; v_type text;
      begin
        if p_items is null or jsonb_typeof(p_items) <> 'array' then perform public.geg_refus('Aucune ligne d''inventaire'); end if;
        if (select count(*) from jsonb_array_elements(p_items)) <> (select count(distinct (e ->> 'product_id') || '|' || (e ->> 'warehouse_id')) from jsonb_array_elements(p_items) e) then
          perform public.geg_refus('Un même produit apparaît deux fois pour le même dépôt dans l''inventaire');
        end if;
        for it in select (e ->> 'product_id')::uuid as pid, (e ->> 'warehouse_id')::uuid as wid, (e ->> 'counted')::numeric as counted, (e ->> 'shown')::numeric as shown
                  from jsonb_array_elements(p_items) e order by e ->> 'warehouse_id', e ->> 'product_id' loop
          if it.counted is null or it.counted < 0 then perform public.geg_refus('Une quantité comptée ne peut pas être négative'); end if;
          select product_type into v_type from products where id = it.pid;
          if not found then perform public.geg_refus('Produit introuvable'); end if;
          if v_type in ('service', 'discount') then perform public.geg_refus(format('« %%s » n''est pas une marchandise : pas d''inventaire', geg_libelle_produit(it.pid))); end if;
          select coalesce(is_active, false) and kind = 'physical' into v_ok from warehouses where id = it.wid;
          if not coalesce(v_ok, false) then perform public.geg_refus('Dépôt introuvable, inactif ou non physique'); end if;
          q := stock_verrouiller(it.pid, it.wid);
          if it.shown is null or q <> it.shown then
            v_changed := v_changed || jsonb_build_object('product_id', it.pid, 'warehouse_id', it.wid, 'product', geg_libelle_produit(it.pid), 'shown', it.shown, 'current', q);
          end if;
        end loop;
        if jsonb_array_length(v_changed) > 0 then
          perform public.geg_refus(
            'Le stock a changé depuis l''ouverture de l''inventaire pour : ' ||
            (select string_agg(format('%%s (affiché %%s, actuel %%s)', e ->> 'product', geg_qte((e ->> 'shown')::numeric), geg_qte((e ->> 'current')::numeric)), ', ') from jsonb_array_elements(v_changed) e) ||
            '. Rien n''a été enregistré : rechargez la page et vérifiez à nouveau.',
            jsonb_build_object('changed', v_changed));
        end if;
        for it in select (e ->> 'product_id')::uuid as pid, (e ->> 'warehouse_id')::uuid as wid, (e ->> 'counted')::numeric as counted, (e ->> 'shown')::numeric as shown
                  from jsonb_array_elements(p_items) e where (e ->> 'counted')::numeric <> (e ->> 'shown')::numeric loop
          perform stock_fixer(it.pid, it.wid, it.counted);
          insert into stock_moves (type, product_id, to_warehouse_id, quantity, notes, user_id, doc_type, doc_id, reason, direction)
          values ('adjustment', it.pid, it.wid, abs(it.counted - it.shown), 'Inventaire : ' || geg_qte(it.shown) || ' → ' || geg_qte(it.counted),
                  p_user, 'inventory', v_inv, coalesce(nullif(btrim(p_reason), ''), 'Inventaire'), case when it.counted > it.shown then '+' else '-' end);
          n := n + 1;
        end loop;
        return jsonb_build_object('ok', true, 'count', n, 'inventory_id', v_inv);
      end $b$ $f$, s);

    -- M1 / A1 : confirmation d'un BL (une seule fois, plafonnée au reste à livrer, stock revérifié au moment même)
    execute format($f$
      create or replace function %1$I.livraison_confirmer(p_dn uuid, p_lines jsonb, p_user uuid) returns jsonb
      language plpgsql set search_path = %1$I, public as $b$
      declare v_dn record; v_inv_status text; v_e jsonb; v_src record; v_l record; v_txt text; v_q numeric; v_rec numeric; v_out numeric;
              v_fact numeric; v_done numeric; v_short jsonb := '[]'::jsonb; n int := 0; v_il record;
      begin
        select * into v_dn from delivery_notes where id = p_dn for update;
        if not found then perform public.geg_refus('Bon de livraison introuvable'); end if;
        if v_dn.status = 'delivered' then
          perform public.geg_refus('Ce bon de livraison est déjà confirmé : le stock est déjà sorti. Rien n''a été fait.', jsonb_build_object('code', 'deja_confirme'));
        end if;
        if v_dn.status is distinct from 'draft' then perform public.geg_refus('Ce bon de livraison n''est plus en brouillon'); end if;
        if v_dn.invoice_id is not null then
          select status into v_inv_status from invoices where id = v_dn.invoice_id;
          if v_inv_status in ('draft', 'cancelled') then
            perform public.geg_refus('La facture de ce bon de livraison est en brouillon ou annulée : livraison impossible');
          end if;
          -- deux BL différents de la même facture, confirmés en même temps : l'un attend l'autre (plafond fiable)
          perform 1 from invoices where id = v_dn.invoice_id for update;
        end if;
        if v_dn.order_id is not null then perform 1 from sales_orders where id = v_dn.order_id for update; end if;

        -- 1. quantités, dépôts et répartitions saisis à l'écran
        for v_e in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
          v_q := (v_e ->> 'quantity')::numeric;
          if v_q is null or v_q < 0 then perform public.geg_refus('Quantité invalide sur une ligne du bon de livraison'); end if;
          if v_e ? 'split_of' then
            select * into v_src from delivery_note_lines where id = (v_e ->> 'split_of')::uuid and delivery_note_id = p_dn;
            if not found or v_src.line_type = 'comment' then perform public.geg_refus('Ligne à répartir introuvable'); end if;
            insert into delivery_note_lines (delivery_note_id, product_id, description, quantity, qty_delivered, position, line_type,
                                             print_on_delivery, warehouse_id, invoice_line_id, order_line_id)
            values (p_dn, v_src.product_id, v_src.description, v_q, v_q, v_src.position, 'product', v_src.print_on_delivery,
                    nullif(v_e ->> 'warehouse_id', '')::uuid, v_src.invoice_line_id, v_src.order_line_id);
          else
            update delivery_note_lines set quantity = v_q, qty_delivered = v_q, warehouse_id = nullif(v_e ->> 'warehouse_id', '')::uuid
            where id = (v_e ->> 'id')::uuid and delivery_note_id = p_dn and line_type <> 'comment';
          end if;
        end loop;

        -- 2. contrôles sur les lignes finales
        select string_agg('« ' || description || ' »', ', ') into v_txt from delivery_note_lines
        where delivery_note_id = p_dn and line_type <> 'comment' and product_id is null and quantity > 0;
        if v_txt is not null then
          perform public.geg_refus('Ligne(s) non rattachée(s) au catalogue : ' || v_txt || '. Rattachez chaque ligne à sa fiche (produit ou prestation) avant de valider.');
        end if;
        select string_agg('« ' || l.description || ' »', ', ') into v_txt
        from delivery_note_lines l join products p on p.id = l.product_id
        where l.delivery_note_id = p_dn and l.line_type <> 'comment' and l.quantity > 0
          and coalesce(p.product_type, 'storable') not in ('service', 'discount') and l.warehouse_id is null;
        if v_txt is not null then perform public.geg_refus('Choisissez le dépôt de sortie pour : ' || v_txt); end if;
        select string_agg(distinct w.name, ', ') into v_txt
        from delivery_note_lines l join warehouses w on w.id = l.warehouse_id
        where l.delivery_note_id = p_dn and l.quantity > 0 and not coalesce(w.is_active, false);
        if v_txt is not null then perform public.geg_refus('Dépôt inactif : ' || v_txt); end if;

        -- livraison directe : seulement une ligne liée à une ligne de facture, dans la limite de ce qui a été réceptionné en direct pour elle
        for v_l in select l.invoice_line_id, sum(l.quantity) as q, min(l.description) as d
                   from delivery_note_lines l join warehouses w on w.id = l.warehouse_id
                   where l.delivery_note_id = p_dn and w.kind = 'direct' and l.quantity > 0 group by l.invoice_line_id loop
          if v_l.invoice_line_id is null then
            perform public.geg_refus(format('Livraison directe : la ligne « %%s » doit être liée à une ligne de facture du client', v_l.d));
          end if;
          select coalesce(sum(rl.quantity), 0) into v_rec from purchase_reception_lines rl join warehouses w on w.id = rl.warehouse_id
          where rl.invoice_line_id = v_l.invoice_line_id and w.kind = 'direct';
          select coalesce(sum(l2.quantity), 0) into v_out from delivery_note_lines l2 join delivery_notes d2 on d2.id = l2.delivery_note_id
            join warehouses w on w.id = l2.warehouse_id
          where d2.status = 'delivered' and l2.invoice_line_id = v_l.invoice_line_id and w.kind = 'direct';
          if v_l.q > v_rec - v_out then
            perform public.geg_refus(format('Livraison directe impossible pour « %%s » : %%s réceptionné(s) en direct pour cette ligne de facture, %%s déjà livré(s), %%s demandé(s). La marchandise doit d''abord être réceptionnée. Rien n''a été enregistré.',
              v_l.d, geg_qte(v_rec), geg_qte(v_out), geg_qte(v_l.q)));
          end if;
        end loop;

        -- plafond : reste à livrer de chaque ligne de facture (tous BL confirmés compris)
        for v_l in select l.invoice_line_id, sum(l.quantity) as q from delivery_note_lines l
                   where l.delivery_note_id = p_dn and l.invoice_line_id is not null and l.line_type <> 'comment' and l.quantity > 0 group by 1 loop
          select il.invoice_id, il.description, il.quantity into v_il from invoice_lines il where il.id = v_l.invoice_line_id;
          if v_il.invoice_id is distinct from v_dn.invoice_id then perform public.geg_refus('Ligne de facture d''une autre facture : livraison refusée'); end if;
          select coalesce(sum(delivered), 0) into v_done from invoice_line_delivery where invoice_line_id = v_l.invoice_line_id;
          if v_l.q > v_il.quantity - v_done then
            perform public.geg_refus(format('Quantité supérieure au reste à livrer de la facture : « %%s » (facturé %%s, déjà livré %%s, reste %%s, demandé %%s). Rien n''a été enregistré.',
              v_il.description, geg_qte(v_il.quantity), geg_qte(v_done), geg_qte(v_il.quantity - v_done), geg_qte(v_l.q)));
          end if;
        end loop;
        -- plafond par produit pour les lignes HISTORIQUES sans lien vers une ligne de facture (les autres sont plafonnées
        -- ligne par ligne ci-dessus : une ligne libre de facture rattachée sur le BL ne porte pas le produit sur la facture)
        if v_dn.invoice_id is not null then
          for v_l in select l.product_id, sum(l.quantity) as q, min(l.description) as d
                     from delivery_note_lines l join products p on p.id = l.product_id
                     where l.delivery_note_id = p_dn and l.line_type <> 'comment' and l.quantity > 0 and l.invoice_line_id is null
                       and coalesce(p.product_type, 'storable') in ('storable', 'consumable') group by 1 loop
            select coalesce(sum(quantity), 0), coalesce(sum(delivered), 0) into v_fact, v_done from invoice_line_delivery
            where invoice_id = v_dn.invoice_id and product_id = v_l.product_id;
            if v_l.q > v_fact - v_done then
              perform public.geg_refus(format('Quantité supérieure au reste à livrer de la facture : « %%s » (facturé %%s, déjà livré %%s, reste %%s, demandé %%s). Rien n''a été enregistré.',
                v_l.d, geg_qte(v_fact), geg_qte(v_done), geg_qte(greatest(v_fact - v_done, 0)), geg_qte(v_l.q)));
            end if;
          end loop;
        end if;
        -- plafond : reste à livrer de chaque ligne de devis (livraison depuis un devis)
        for v_l in select l.order_line_id, sum(l.quantity) as q from delivery_note_lines l
                   where l.delivery_note_id = p_dn and l.order_line_id is not null and l.line_type <> 'comment' and l.quantity > 0 group by 1 loop
          select description, quantity, coalesce(qty_delivered, 0) as done into v_src from sales_order_lines where id = v_l.order_line_id;
          if v_l.q > v_src.quantity - v_src.done then
            perform public.geg_refus(format('Quantité supérieure au reste à livrer du devis : « %%s » (reste %%s, demandé %%s). Rien n''a été enregistré.',
              v_src.description, geg_qte(v_src.quantity - v_src.done), geg_qte(v_l.q)));
          end if;
        end loop;

        -- 3. stock : verrouillé dans un ordre stable, revérifié au moment même, jamais négatif
        for v_l in select l.product_id, l.warehouse_id, sum(l.quantity) as q
                   from delivery_note_lines l join products p on p.id = l.product_id
                   where l.delivery_note_id = p_dn and l.line_type <> 'comment' and l.quantity > 0
                     and coalesce(p.product_type, 'storable') not in ('service', 'discount')
                   group by 1, 2 order by 2, 1 loop
          v_q := stock_verrouiller(v_l.product_id, v_l.warehouse_id);
          if v_q < v_l.q then
            v_short := v_short || jsonb_build_object('product_id', v_l.product_id, 'product', geg_libelle_produit(v_l.product_id),
              'warehouse_id', v_l.warehouse_id, 'warehouse', (select name from warehouses where id = v_l.warehouse_id),
              'requested', v_l.q, 'available', v_q, 'missing', v_l.q - v_q);
          end if;
        end loop;
        if jsonb_array_length(v_short) > 0 then
          perform public.geg_refus(
            'Stock insuffisant : ' || (select string_agg(format('%%s — dépôt %%s : %%s disponible(s), %%s demandé(s)', je ->> 'product', je ->> 'warehouse',
              geg_qte((je ->> 'available')::numeric), geg_qte((je ->> 'requested')::numeric)), ' ; ') from jsonb_array_elements(v_short) je) ||
            '. Rien n''a été enregistré.', jsonb_build_object('shortages', v_short));
        end if;

        -- 4. écritures, en une fois
        for v_l in select l.id, l.product_id, l.warehouse_id, l.quantity
                   from delivery_note_lines l join products p on p.id = l.product_id
                   where l.delivery_note_id = p_dn and l.line_type <> 'comment' and l.quantity > 0
                     and coalesce(p.product_type, 'storable') not in ('service', 'discount') order by l.warehouse_id, l.product_id loop
          select quantity into v_q from stock_levels where product_id = v_l.product_id and warehouse_id = v_l.warehouse_id;
          perform stock_fixer(v_l.product_id, v_l.warehouse_id, coalesce(v_q, 0) - v_l.quantity);
          insert into stock_moves (type, product_id, from_warehouse_id, quantity, notes, reference, user_id, doc_type, doc_id, doc_line_id)
          values ('out', v_l.product_id, v_l.warehouse_id, v_l.quantity, 'Livraison BL ' || v_dn.number, v_dn.number, p_user, 'delivery_note', p_dn, v_l.id);
          n := n + 1;
        end loop;
        update sales_order_lines s set qty_delivered = coalesce(s.qty_delivered, 0) + x.q
        from (select order_line_id, sum(quantity) as q from delivery_note_lines
              where delivery_note_id = p_dn and order_line_id is not null and line_type <> 'comment' and quantity > 0 group by 1) x
        where s.id = x.order_line_id;
        update delivery_note_lines set qty_delivered = quantity where delivery_note_id = p_dn and line_type <> 'comment';
        update delivery_notes set status = 'delivered', delivery_date = coalesce(delivery_date, current_date) where id = p_dn;
        return jsonb_build_object('ok', true, 'number', v_dn.number, 'moves', n);
      end $b$ $f$, s);

    -- A1 : « Livrer » une facture : reprend le BL brouillon existant, sinon le crée avec les restes à livrer
    execute format($f$
      create or replace function %1$I.livraison_preparer(p_invoice uuid, p_number text, p_user uuid) returns jsonb
      language plpgsql set search_path = %1$I, public as $b$
      declare v_inv record; v_dn record; v_id uuid;
      begin
        select * into v_inv from invoices where id = p_invoice for update;
        if not found then perform public.geg_refus('Facture introuvable'); end if;
        if v_inv.status in ('draft', 'cancelled') or coalesce(v_inv.number, '') like 'AVR-%%' then
          perform public.geg_refus('Seule une facture émise (ni brouillon, ni annulée, ni avoir) peut être livrée');
        end if;
        select id, number into v_dn from delivery_notes where invoice_id = p_invoice and status = 'draft' order by created_at desc limit 1;
        if found then return jsonb_build_object('ok', true, 'id', v_dn.id, 'number', v_dn.number, 'reused', true); end if;
        if not exists (select 1 from invoice_line_delivery where invoice_id = p_invoice and remaining > 0) then
          perform public.geg_refus('Facture entièrement livrée : aucune marchandise ne reste à livrer');
        end if;
        insert into delivery_notes (number, invoice_id, account_id, status, user_id)
        values (p_number, p_invoice, v_inv.account_id, 'draft', p_user) returning id into v_id;
        insert into delivery_note_lines (delivery_note_id, product_id, description, quantity, qty_delivered, position, line_type, print_on_delivery, invoice_line_id)
        select v_id,
               case when il.line_type = 'comment' then null else x.product_id end,
               il.description,
               case when il.line_type = 'comment' then 0 else x.remaining end,
               case when il.line_type = 'comment' then 0 else x.remaining end,
               (row_number() over (order by il.position, il.id) - 1)::int,
               case when il.line_type = 'comment' then 'comment' else 'product' end,
               case when il.line_type = 'comment' then coalesce(il.print_on_delivery, false) else true end,  -- commentaires : choix « imprimer sur le BL » conservé
               case when il.line_type = 'comment' then null else il.id end
        from invoice_lines il left join invoice_line_delivery x on x.invoice_line_id = il.id
        where il.invoice_id = p_invoice
          and (il.line_type = 'comment' or (il.line_type <> 'comment' and x.remaining > 0));
        select number into v_dn from delivery_notes where id = v_id;
        return jsonb_build_object('ok', true, 'id', v_id, 'number', v_dn.number, 'reused', false);
      end $b$ $f$, s);

    -- M1 / A3 : réception d'une commande d'achat (reste à recevoir, prestations sans stock, livraison directe)
    execute format($f$
      create or replace function %1$I.achat_receptionner(p_order uuid, p_number text, p_lines jsonb, p_user uuid) returns jsonb
      language plpgsql set search_path = %1$I, public as $b$
      declare v_po record; v_g record; v_pol record; v_e jsonb; v_q numeric; v_recv numeric; v_type text; v_kind text; v_active boolean;
              v_il record; v_rec_id uuid; v_rl uuid; v_lvl numeric; v_status text; v_pending numeric; v_inv_status text; n int := 0;
      begin
        select * into v_po from purchase_orders where id = p_order for update;
        if not found then perform public.geg_refus('Commande d''achat introuvable'); end if;
        if v_po.status not in ('confirmed', 'ordered', 'in_transit', 'partial') then
          perform public.geg_refus(format('Commande %%s au statut « %%s » : réception impossible', v_po.number, v_po.status));
        end if;
        if p_lines is null or jsonb_typeof(p_lines) <> 'array' then perform public.geg_refus('Aucune ligne à réceptionner'); end if;

        -- contrôles par ligne de commande (quantités cumulées de la demande)
        for v_g in select (je ->> 'order_line_id')::uuid as ol, sum((je ->> 'quantity')::numeric) as q, bool_or((je ->> 'quantity')::numeric < 0) as neg
                   from jsonb_array_elements(p_lines) je group by 1 loop
          if v_g.q is null or v_g.neg then perform public.geg_refus('Quantité reçue invalide'); end if;
          if v_g.q = 0 then continue; end if;
          select * into v_pol from purchase_order_lines where id = v_g.ol and order_id = p_order;
          if not found then perform public.geg_refus('Ligne de commande inconnue'); end if;
          select greatest(coalesce(v_pol.qty_received, 0), coalesce(sum(rl.quantity), 0)) into v_recv
          from purchase_reception_lines rl where rl.order_line_id = v_pol.id;
          if v_g.q > v_pol.quantity - v_recv then
            perform public.geg_refus(format('Quantité supérieure au reste à recevoir : « %%s » (commandé %%s, déjà reçu %%s, reste %%s, saisi %%s). Rien n''a été enregistré.',
              v_pol.description, geg_qte(v_pol.quantity), geg_qte(v_recv), geg_qte(greatest(v_pol.quantity - v_recv, 0)), geg_qte(v_g.q)));
          end if;
          if v_pol.product_id is null then
            perform public.geg_refus(format('Ligne « %%s » non rattachée au catalogue : rattachez-la à sa fiche avant de réceptionner', v_pol.description));
          end if;
        end loop;

        -- contrôles par ligne saisie (dépôt, livraison directe)
        for v_e in select * from jsonb_array_elements(p_lines) loop
          v_q := (v_e ->> 'quantity')::numeric;
          if v_q = 0 then continue; end if;
          select * into v_pol from purchase_order_lines where id = (v_e ->> 'order_line_id')::uuid;
          select product_type into v_type from products where id = v_pol.product_id;
          if v_type in ('service', 'discount') then continue; end if;   -- prestation : réceptionnée sans stock (T-01)
          if nullif(v_e ->> 'warehouse_id', '') is null then
            perform public.geg_refus(format('Choisissez le dépôt de réception pour « %%s »', v_pol.description));
          end if;
          select kind, coalesce(is_active, false) into v_kind, v_active from warehouses where id = (v_e ->> 'warehouse_id')::uuid;
          if not coalesce(v_active, false) then perform public.geg_refus('Dépôt de réception introuvable ou inactif'); end if;
          if v_kind = 'direct' then
            if nullif(v_e ->> 'invoice_line_id', '') is null then
              perform public.geg_refus(format('Livraison directe : indiquez la ligne de facture du client pour « %%s »', v_pol.description));
            end if;
            select il.id, il.product_id, il.quantity, il.description, il.invoice_id into v_il from invoice_lines il where il.id = (v_e ->> 'invoice_line_id')::uuid;
            if not found or v_il.product_id is distinct from v_pol.product_id then
              perform public.geg_refus(format('Livraison directe : la ligne de facture choisie ne porte pas le même produit que « %%s »', v_pol.description));
            end if;
            select status into v_inv_status from invoices where id = v_il.invoice_id for update;
            if v_inv_status in ('draft', 'cancelled') then perform public.geg_refus('Livraison directe : la facture du client doit être émise'); end if;
            select coalesce(sum(rl.quantity), 0) - coalesce((select sum(l2.quantity) from delivery_note_lines l2 join delivery_notes d2 on d2.id = l2.delivery_note_id
                     join warehouses w2 on w2.id = l2.warehouse_id where d2.status = 'delivered' and l2.invoice_line_id = v_il.id and w2.kind = 'direct'), 0)
              into v_pending
            from purchase_reception_lines rl join warehouses w on w.id = rl.warehouse_id where rl.invoice_line_id = v_il.id and w.kind = 'direct';
            if v_q > (select remaining from invoice_line_delivery where invoice_line_id = v_il.id) - v_pending then
              perform public.geg_refus(format('Livraison directe : %%s saisi(s) pour « %%s », plus que le reste à livrer de la ligne de facture (déjà %%s en attente de livraison directe)',
                geg_qte(v_q), v_il.description, geg_qte(v_pending)));
            end if;
          end if;
        end loop;

        if not exists (select 1 from jsonb_array_elements(p_lines) je where (je ->> 'quantity')::numeric > 0) then
          perform public.geg_refus('Aucune quantité à réceptionner');
        end if;

        -- verrous du stock dans un ordre stable
        perform stock_verrouiller(x.pid, x.wid) from (
          select distinct l.product_id as pid, (je ->> 'warehouse_id')::uuid as wid
          from jsonb_array_elements(p_lines) je join purchase_order_lines l on l.id = (je ->> 'order_line_id')::uuid
          join products p on p.id = l.product_id
          where (je ->> 'quantity')::numeric > 0 and coalesce(p.product_type, 'storable') not in ('service', 'discount')
          order by 2, 1) x;

        insert into purchase_receptions (order_id, number, received_at, user_id) values (p_order, p_number, now(), p_user) returning id into v_rec_id;
        for v_e in select * from jsonb_array_elements(p_lines) loop
          v_q := (v_e ->> 'quantity')::numeric;
          if v_q = 0 then continue; end if;
          select * into v_pol from purchase_order_lines where id = (v_e ->> 'order_line_id')::uuid;
          select product_type into v_type from products where id = v_pol.product_id;
          insert into purchase_reception_lines (reception_id, order_line_id, product_id, description, quantity, unit_price, warehouse_id, invoice_line_id)
          values (v_rec_id, v_pol.id, v_pol.product_id, v_pol.description, v_q, coalesce((v_e ->> 'unit_price')::numeric, 0),
                  case when coalesce(v_type, 'storable') in ('service', 'discount') then null else nullif(v_e ->> 'warehouse_id', '')::uuid end,
                  nullif(v_e ->> 'invoice_line_id', '')::uuid)
          returning id into v_rl;
          if coalesce(v_type, 'storable') not in ('service', 'discount') then
            select quantity into v_lvl from stock_levels where product_id = v_pol.product_id and warehouse_id = (v_e ->> 'warehouse_id')::uuid;
            perform stock_fixer(v_pol.product_id, (v_e ->> 'warehouse_id')::uuid, coalesce(v_lvl, 0) + v_q);
            insert into stock_moves (type, product_id, to_warehouse_id, quantity, notes, reference, user_id, doc_type, doc_id, doc_line_id)
            values ('in', v_pol.product_id, (v_e ->> 'warehouse_id')::uuid, v_q, coalesce(nullif(v_e ->> 'notes', ''), 'Réception ' || v_po.number), p_number, p_user,
                    'reception', v_rec_id, v_rl);
            n := n + 1;
          end if;
        end loop;
        -- qty_received tenu à jour (cumul fiable : maximum de l'ancien compteur et des lignes de réception)
        update purchase_order_lines l set qty_received = x.r
        from (select l2.id, greatest(coalesce(l2.qty_received, 0) + coalesce((select sum((je ->> 'quantity')::numeric) from jsonb_array_elements(p_lines) je where (je ->> 'order_line_id')::uuid = l2.id), 0),
                                     coalesce((select sum(rl.quantity) from purchase_reception_lines rl where rl.order_line_id = l2.id), 0)) as r
              from purchase_order_lines l2 where l2.order_id = p_order) x
        where l.id = x.id and l.qty_received is distinct from x.r;
        v_status := case when exists (select 1 from purchase_order_lines where order_id = p_order and quantity > 0 and qty_received < quantity) then 'partial' else 'received' end;
        update purchase_orders set status = v_status where id = p_order;
        if to_regclass('purchase_order_events') is not null then
          insert into purchase_order_events (order_id, event_type, payload, user_id)
          values (p_order, 'reception', jsonb_build_object('reception_id', v_rec_id, 'from', v_po.status, 'to', v_status,
                  'lines', (select jsonb_agg(jsonb_build_object('order_line_id', je ->> 'order_line_id', 'quantity', (je ->> 'quantity')::numeric)) from jsonb_array_elements(p_lines) je where (je ->> 'quantity')::numeric > 0)), p_user);
        end if;
        return jsonb_build_object('ok', true, 'reception_id', v_rec_id, 'number', p_number, 'status', v_status, 'moves', n);
      end $b$ $f$, s);

    -- M4 : marchandise facturée couverte par le stock et les achats enregistrés (sans double comptage)
    execute format($f$
      create or replace function %1$I.controle_achat_vente(p_invoice uuid) returns jsonb
      language sql stable set search_path = %1$I, public as $b$
        with need as (
          select x.product_id, sum(x.quantity) as q from invoice_line_delivery x where x.invoice_id = p_invoice and x.product_id is not null group by 1
        ), stock as (
          select product_id, sum(quantity) as s from stock_levels where product_id in (select product_id from need) group by 1
        ), po as (
          select l.product_id, sum(greatest(l.quantity - greatest(coalesce(l.qty_received, 0), coalesce(r.q, 0)), 0)) as p
          from purchase_order_lines l join purchase_orders o on o.id = l.order_id
          left join (select order_line_id, sum(quantity) as q from purchase_reception_lines group by 1) r on r.order_line_id = l.id
          where o.status in ('confirmed', 'ordered', 'in_transit', 'partial') and l.product_id in (select product_id from need) group by 1
        ), other as (
          select x.product_id, sum(x.remaining) as o from invoice_line_delivery x join invoices i on i.id = x.invoice_id
          where i.status in ('sent', 'partial', 'paid') and i.id <> p_invoice and coalesce(i.number, '') not like 'AVR-%%'
            and x.product_id in (select product_id from need) group by 1
        )
        select coalesce(jsonb_agg(jsonb_build_object('product_id', n.product_id, 'product', geg_libelle_produit(n.product_id), 'invoiced', n.q,
                 'stock', coalesce(s.s, 0), 'purchased_not_received', coalesce(p.p, 0), 'invoiced_not_delivered', coalesce(o.o, 0),
                 'missing', n.q - (coalesce(s.s, 0) + coalesce(p.p, 0) - coalesce(o.o, 0)))), '[]'::jsonb)
        from need n left join stock s on s.product_id = n.product_id left join po p on p.product_id = n.product_id left join other o on o.product_id = n.product_id
        where coalesce(s.s, 0) + coalesce(p.p, 0) - coalesce(o.o, 0) < n.q
      $b$ $f$, s);

    -- droits : uniquement le serveur (service_role), jamais le navigateur
    foreach f in array array['geg_libelle_produit(uuid)', 'geg_qte(numeric)', 'stock_verrouiller(uuid,uuid)', 'stock_fixer(uuid,uuid,numeric)',
                             'stock_appliquer(text,uuid,uuid,uuid,numeric,uuid,text,text)', 'inventaire_valider(jsonb,uuid,text)',
                             'livraison_confirmer(uuid,jsonb,uuid)', 'livraison_preparer(uuid,text,uuid)', 'achat_receptionner(uuid,text,jsonb,uuid)',
                             'controle_achat_vente(uuid)'] loop
      execute format('revoke all on function %I.%s from public, anon, authenticated', s, f);
      execute format('grant execute on function %I.%s to service_role', s, f);
    end loop;
  end loop;
end $do$;

-- M4 : contrôle à l'émission (brouillon -> émise), quel que soit l'écran ou la route
create or replace function public.controle_achat_vente_emission() returns trigger
language plpgsql set search_path = public as $function$
declare v jsonb;
begin
  if old.status = 'draft' and new.status = 'sent' and coalesce(new.number, '') not like 'AVR-%' then
    execute format('select %I.controle_achat_vente($1)', tg_table_schema) into v using new.id;
    if jsonb_array_length(v) > 0 then
      raise exception using
        message = 'Facture non émise : marchandise non couverte par le stock ni par un achat enregistré — ' ||
          (select string_agg(format('%s : facturé %s, en stock %s, acheté non réceptionné %s, déjà facturé non livré %s, manque %s',
              x ->> 'product', x ->> 'invoiced', x ->> 'stock', x ->> 'purchased_not_received', x ->> 'invoiced_not_delivered', x ->> 'missing'), ' ; ')
           from jsonb_array_elements(v) x) || '. Enregistrez d''abord l''achat correspondant.',
        detail = jsonb_build_object('achats_manquants', v)::text, hint = 'GEG_REFUS', errcode = 'P0001';
    end if;
  end if;
  return new;
end $function$;

do $$
declare s text;
begin
  foreach s in array array['geg_guinee', 'geg_singapore'] loop
    execute format('drop trigger if exists controle_achat_vente on %I.invoices', s);
    execute format('create trigger controle_achat_vente before update of status on %I.invoices for each row execute function public.controle_achat_vente_emission()', s);
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;
