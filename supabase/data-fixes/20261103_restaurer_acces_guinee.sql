-- Rétablit l'accès d'avant le 02/11/2026 : GEG Guinée pour les profils qui n'ont aucune société.
-- Jusqu'au déploiement du 02/11/2026, ces utilisateurs voyaient GEG Guinée par défaut.
-- Ne modifie ni les rôles, ni les permissions, ni l'accès Singapore, ni les profils qui ont déjà une société.
-- Les nouveaux droits par utilisateur restent à l'étude (UTILISATEURS_PRODUCTION_ACCES.md).

update public.profiles
set company_access = array['7a4b55ad-a2c4-4170-b907-9dab7c4d484f']::uuid[]  -- GEG Guinée
where coalesce(array_length(company_access, 1), 0) = 0
returning email, role, company_access;

-- 03/11/2026 apres-midi : sales.gn@globalenergy.group et sekoumarlybarry@gmail.com, recrees dans le CRM
-- (l'ecran de creation n'attribue pas de societe), ont recu GEG Guinee de la meme facon.

-- 03/11/2026 : GEG Guinee par defaut pour tout nouveau profil (comportement d'avant le 02/11 pour les nouveaux comptes),
-- en attendant un choix des societes dans l'ecran de creation d'utilisateur.
alter table public.profiles
  alter column company_access set default array['7a4b55ad-a2c4-4170-b907-9dab7c4d484f']::uuid[];
