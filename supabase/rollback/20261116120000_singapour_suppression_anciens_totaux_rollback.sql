-- Retour arrière de 20261116120000_singapour_suppression_anciens_totaux : recrée les 6 colonnes à l'identique
-- (numeric(18,2), défaut 0, nullable). Elles valaient toutes 0 avant suppression : l'état est restauré exactement.
begin;
alter table geg_singapore.invoices          add column if not exists total_ht numeric(18,2) default 0,
                                            add column if not exists total_paid numeric(18,2) default 0,
                                            add column if not exists balance numeric(18,2) default 0;
alter table geg_singapore.treasury_accounts add column if not exists total_in numeric(18,2) default 0,
                                            add column if not exists total_out numeric(18,2) default 0;
alter table geg_singapore.supplier_invoices add column if not exists balance numeric(18,2) default 0;
notify pgrst, 'reload schema';
commit;
