-- RETOUR ARRIÈRE du correctif PROD_HOTFIX_2_acces_anonyme.sql — à n'utiliser que si une fonction du site cessait de
-- marcher. ATTENTION : rouvre la faille (accès anonyme aux factures et paiements fournisseurs, coûts, documents).
begin;
grant usage on schema geg_guinee, geg_singapore to anon;
create policy allow_all_supplier_invoices_anon      on geg_guinee.supplier_invoices      as permissive for all to anon using (true) with check (true);
create policy allow_all_supplier_invoice_lines_anon on geg_guinee.supplier_invoice_lines as permissive for all to anon using (true) with check (true);
create policy allow_all_supplier_payments_anon      on geg_guinee.supplier_payments      as permissive for all to anon using (true) with check (true);
alter policy "Authenticated users can manage deal_costs" on geg_guinee.deal_costs       to public;
alter policy product_documents_all                         on geg_guinee.product_documents to public;
alter policy "Service role inserts notifications"          on public.notifications       to public;
grant select, insert, update, delete on geg_guinee.supplier_invoices, geg_guinee.supplier_invoice_lines, geg_guinee.supplier_payments,
                                       geg_guinee.deal_costs, geg_guinee.product_documents to anon;
commit;
