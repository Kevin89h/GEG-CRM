-- Applique en production le 03/11/2026, a la demande de Coline Quinty.
-- habakomou86@gmail.com ne fait plus partie de l'entreprise. Compte bloque plutot que supprime :
-- il a cree 108 mouvements de stock, 11 bons de livraison et 10 commandes d'achat en Guinee,
-- dont on conserve la tracabilite (et les bons de livraison empechent la suppression).
-- Pour debloquer : update auth.users set banned_until = null where email = 'habakomou86@gmail.com';

update auth.users
set banned_until = '2999-12-31 00:00:00+00', updated_at = now()
where email = 'habakomou86@gmail.com';

delete from auth.sessions
where user_id = (select id from auth.users where email = 'habakomou86@gmail.com');
