-- Rollback of 20261112120000_commentaires_impression_bl.sql
-- Removes the delivery-note comment rule. The columns are kept (no data loss): drop them by hand only after
-- checking that no comment line of a delivery note must be kept.

begin;

do $$
declare s text;
begin
  foreach s in array array['geg_guinee', 'geg_singapore'] loop
    execute format('drop trigger if exists delivery_line_rules on %I.delivery_note_lines', s);
  end loop;
end $$;
drop function if exists public.delivery_line_rules();

notify pgrst, 'reload schema';

commit;
