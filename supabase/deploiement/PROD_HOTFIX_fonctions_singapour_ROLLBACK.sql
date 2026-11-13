-- RETOUR ARRIÈRE du correctif PROD_HOTFIX_fonctions_singapour.sql — à n'utiliser que si une fonction du site cessait
-- de marcher après le correctif. ATTENTION : rouvre la faille (accès anonyme aux 10 fonctions Singapour).
begin;
grant execute on function public.get_singapore_deals()                                                     to public, anon, authenticated;
grant execute on function public.get_singapore_deal(uuid)                                                  to public, anon, authenticated;
grant execute on function public.delete_singapore_deal(uuid)                                               to public, anon, authenticated;
grant execute on function public.transfer_singapore_to_guinee(uuid)                                        to public, anon, authenticated;
grant execute on function public.insert_singapore_lead(text, text, text, text, text, text, text, text)     to public, anon, authenticated;
grant execute on function public.insert_singapore_account(text, text, text, text, text, text, text, text, text) to public, anon, authenticated;
grant execute on function public.get_singapore_suppliers()                                                 to public, anon, authenticated;
grant execute on function public.insert_singapore_supplier(text, text, text, text, text, text, text, text, text, text, text, text) to public, anon, authenticated;
grant execute on function public.update_singapore_supplier(uuid, text, text, text, text, text, text, text, text, text, text, text, text) to public, anon, authenticated;
grant execute on function public.delete_singapore_supplier(uuid)                                           to public, anon, authenticated;
commit;
