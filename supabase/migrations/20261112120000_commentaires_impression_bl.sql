-- Comment lines: two independent printing choices (decision of 10/11/2026, point 2)
--   print_on_pdf      = "Imprimer sur le devis / la facture" (existing column, default true)
--   print_on_delivery = "Imprimer sur le bon de livraison"   (new, default false: a logistics instruction is ticked on purpose)
-- Delivery notes receive the comment lines of their quote / invoice with their choice, so that the choice is kept
-- from quote to invoice to delivery note. Comments never carry an amount, VAT nor stock movement.
-- Requires 20261111120000_catalogue_complements.sql. Rollback: supabase/rollback/20261112120000_commentaires_impression_bl_rollback.sql

begin;

do $$
declare s text; t text;
begin
  foreach s in array array['geg_guinee', 'geg_singapore'] loop
    foreach t in array array['sales_order_lines', 'invoice_lines'] loop
      execute format('alter table %I.%I add column if not exists print_on_delivery boolean not null default false', s, t);
      -- existing rows are not rewritten (locked documents stay untouched): their comments are not printed on delivery notes
    end loop;
    execute format('alter table %I.delivery_note_lines add column if not exists line_type text not null default %L', s, 'product');
    execute format('alter table %I.delivery_note_lines add column if not exists print_on_delivery boolean not null default true', s);
    execute format('alter table %I.delivery_note_lines drop constraint if exists delivery_note_lines_line_type_check', s);
    execute format('alter table %I.delivery_note_lines add constraint delivery_note_lines_line_type_check check (line_type in (%L, %L))', s, 'product', 'comment');
  end loop;
end $$;

-- A comment line of a delivery note is text only: never a product, a quantity nor a delivered quantity
create or replace function public.delivery_line_rules()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.line_type = 'comment' then
    -- qty_delivered does not exist on GEG Singapour delivery lines: read it through jsonb
    if new.product_id is not null or new.quantity <> 0 or coalesce((to_jsonb(new) ->> 'qty_delivered')::numeric, 0) <> 0 then
      raise exception 'Ligne de commentaire du bon de livraison : ni produit, ni quantité';
    end if;
    if btrim(coalesce(new.description, '')) = '' then raise exception 'Ligne de commentaire vide'; end if;
  elsif tg_op = 'UPDATE' and old.line_type = 'comment' then
    raise exception 'Une ligne de commentaire ne peut pas devenir une ligne livrée';
  end if;
  return new;
end $$;

do $$
declare s text;
begin
  foreach s in array array['geg_guinee', 'geg_singapore'] loop
    execute format('drop trigger if exists delivery_line_rules on %I.delivery_note_lines', s);
    execute format('create trigger delivery_line_rules before insert or update on %I.delivery_note_lines for each row execute function public.delivery_line_rules()', s);
  end loop;
end $$;

notify pgrst, 'reload schema';

commit;
