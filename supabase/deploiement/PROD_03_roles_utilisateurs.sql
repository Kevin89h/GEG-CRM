-- PRODUCTION — À EXÉCUTER UNIQUEMENT APRÈS VALIDATION DU TABLEAU AUDIT_UTILISATEURS_PERMISSIONS.xlsx ET AUTORISATION EXPLICITE.
-- Rôles cibles décidés au chantier permissions (PLAN_PERMISSIONS_PERSONNALISABLES_GEG.md §9, réponses Q1–Q8).
-- Prérequis : migrations 20261104120000_super_admin et 20261105120000_permissions_personnalisables appliquées.
-- Chaque changement est inscrit au journal d'audit par le déclencheur audit_profile. Aucune exception individuelle.
-- Contrôle d'état préalable : le script s'arrête si un compte n'a pas le rôle attendu aujourd'hui (rien n'est modifié).

begin;

do $$
declare n int;
begin
  -- état attendu avant changement (audit du 11/11/2026)
  select count(*) into n from public.profiles p join auth.users u on u.id = p.id
  where (u.email, p.role) in (values
    ('coline@globalenergy.group', 'admin'), ('kevin@globalenergy.group', 'admin'), ('m.diakhaby@globalenergy.group', 'admin'),
    ('nils@globalenergy.group', 'admin'), ('gnfinance@globalenergy.group', 'admin'), ('h.dacorogna@essore.com', 'admin'),
    ('ramadanediallo381@gmail.com', 'manager'), ('benjamin@globalenergy.group', 'sales_rep'), ('sales.gn@globalenergy.group', 'sales_rep'),
    ('h.dacorogna@globalenergy.group', 'sales_rep'), ('alkaboua@gmail.com', 'sales_rep'));
  if n <> 11 then raise exception 'État des comptes différent de l''audit du 11/11/2026 (% sur 11) : script arrêté, rien n''est modifié', n; end if;
end $$;

-- rôles
update public.profiles p set role = v.role
from (values
  ('coline@globalenergy.group', 'super_admin'), ('kevin@globalenergy.group', 'super_admin'),
  ('nils@globalenergy.group', 'manager'), ('gnfinance@globalenergy.group', 'manager'),
  ('benjamin@globalenergy.group', 'manager'), ('sales.gn@globalenergy.group', 'manager'), ('h.dacorogna@globalenergy.group', 'manager')
) v(email, role), auth.users u
where u.id = p.id and u.email = v.email and p.role is distinct from v.role;

-- sociétés : h.dacorogna@globalenergy.group passe en Guinée + Singapour (Q7)
update public.profiles p set company_access = (select array_agg(id order by schema_name) from public.companies where schema_name in ('geg_guinee', 'geg_singapore'))
from auth.users u where u.id = p.id and u.email = 'h.dacorogna@globalenergy.group';

-- comptes bloqués (aucune donnée supprimée ; le rôle est conservé)
update public.profiles p set is_blocked = true, blocked_at = now()
from auth.users u where u.id = p.id and u.email in ('h.dacorogna@essore.com', 'alkaboua@gmail.com') and not p.is_blocked;

-- contrôle : rôle, sociétés et blocage de chaque compte
select u.email, p.role, (select string_agg(c.schema_name, '+' order by c.schema_name) from public.companies c where c.id = any (p.company_access)) societes, p.is_blocked
from public.profiles p join auth.users u on u.id = p.id order by p.role, u.email;

commit;
