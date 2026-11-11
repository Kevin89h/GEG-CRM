-- PRODUCTION — À EXÉCUTER UNIQUEMENT APRÈS AUTORISATION EXPLICITE, APRÈS PROD_01.
-- Pré-remplit la table de correspondance historique en statut « proposé » (jamais validé automatiquement).
-- Les documents historiques ne sont pas modifiés : aucun montant, TVA, PDF, stock ni écriture comptable.
-- Une ligne n'est proposée que si sa fiche cible est unique et active ; les lignes vides / « Nouvelle ligne » sont ignorées.
-- Idempotent : une ligne qui a déjà une correspondance active n'est pas reprise.

begin;

with m(k, target, unit, ptype, note) as (values
  ('burin', 'Burin', null, null, 'Rapprochement H4, catégorie 1'),
  ('meule', 'Meule', null, null, 'Rapprochement H4, catégorie 1'),
  ('marteaupiqueur2200w', 'Marteau piqueur - 2 200W', null, null, 'Rapprochement H4, catégorie 1'),
  ('24570r17', '245/70R17', null, null, 'Rapprochement H4, catégorie 1'),
  ('26565r17', '265/65R17', null, null, 'Rapprochement H4, catégorie 1'),
  ('fraisdetransport', 'FRAIS DE TRANSPORT', null, 'service', 'Service générique de transport ; libellé d''origine : Frais de transport'),
  ('transportmaritime', 'FRAIS DE TRANSPORT', null, 'service', 'Service générique de transport ; libellé d''origine : Transport Maritime'),
  ('gegcompressorpao4620l', 'GEG COMPRESSOR PAO ISO VG46', null, null, 'Rapprochement H4, catégorie 1'),
  ('gegreductorclp220200l', 'GEG REDUCTOR CLP 220 200 L', null, null, 'Rapprochement H4, catégorie 1'),
  ('gegreductorclp320200l', 'GEG REDUCTOR CLP 320 200 L', null, null, 'Rapprochement H4, catégorie 1'),
  ('gegdieselextra15w40200l61000070005weichai', 'GEG DIESEL EXTRA 15W40', '200 L', null, 'Rapprochement H4, catégorie 1'),
  ('filtreaairchargeuse250501140057', 'Filtre à Air Chargeuse', null, null, 'Rapprochement H4, catégorie 1'),
  ('filtreagasoilchargeuse100422384weichai', 'Filtre à Gasoil Chargeuse', null, null, 'Rapprochement H4, catégorie 1'),
  ('filtreagasoilexcavateur100422382weichai', 'Filtre à Gasoil Excavateur', null, null, 'Rapprochement H4, catégorie 1'),
  ('filtreahuilechargeuse61000070005weichai', 'Filtre à huile chargeuse', null, null, 'Rapprochement H4, catégorie 1'),
  ('filtreahuileexcavateur100042655weichai', 'Filtre à Huile Excavateur', null, null, 'Rapprochement H4, catégorie 1'),
  ('filtredecanteurchargeusepl420', 'Filtre décanteur Chargeuse', null, null, 'Rapprochement H4, catégorie 1'),
  ('filtredecanteurexcavateurpl420weichai', 'Filtre décanteur Excavateur', null, null, 'Rapprochement H4, catégorie 1'),
  ('fretaerien', 'FRAIS DE TRANSPORT', null, 'service', 'Service générique de transport ; libellé d''origine : Frêt aérien'),
  ('rabais', 'Remise commerciale', null, null, 'Rapprochement H4, catégorie 2'),
  ('gegreductorclp460200l', 'GEG REDUCTOR CLP 460 200 L', null, null, 'Rapprochement H4, catégorie 2'),
  ('fuchsrenolinclp320200l', 'FUCHS RENOLIN CLP 320 200 L', null, null, 'Rapprochement H4, catégorie 2'),
  ('fuchsrenolinclp460200l', 'FUCHS RENOLIN CLP 460 200 L', null, null, 'Rapprochement H4, catégorie 2'),
  ('petronasgearfl220200l', 'PETRONAS GEAR FL 220 200 L', null, null, 'Rapprochement H4, catégorie 2'),
  ('petronasgearfl320200l', 'PETRONAS GEAR FL 320 200 L', null, null, 'Rapprochement H4, catégorie 2'),
  ('shell20w50200l', 'SHELL 20W50 200 L', null, null, 'Rapprochement H4, catégorie 2'),
  ('totalcarterxep320200l', 'TOTAL CARTER XEP 320', null, null, 'Rapprochement H4, catégorie 2 ; Conditionnement à confirmer : 200 L ou 205 L'),
  ('11r225doubleroad', 'Pneu 11R22.5 Double Road', null, null, 'Rapprochement H4, catégorie 2'),
  ('12r225triangle', 'Pneu 12R22.5 Triangle', null, null, 'Rapprochement H4, catégorie 2'),
  ('24570r16ltdoubleroad', 'Pneu 245/70R16 LT Double Road', null, null, 'Rapprochement H4, catégorie 2'),
  ('groupeelectrogene10kva', 'Groupe électrogène 10 kVA', null, null, 'Rapprochement H4, catégorie 2'),
  ('scieelectrique1600w', 'Scie électrique 1600 W', null, null, 'Rapprochement H4, catégorie 2'),
  ('scieelectrique2200w', 'Scie électrique 2200 W', null, null, 'Rapprochement H4, catégorie 2'),
  ('marteau1kg', 'Marteau 1 kg', null, null, 'Rapprochement H4, catégorie 2'),
  ('marteau2kg', 'Marteau 2 kg', null, null, 'Rapprochement H4, catégorie 2'),
  ('marteau5kg', 'Marteau 5 kg', null, null, 'Rapprochement H4, catégorie 2'),
  ('decametre30m', 'Décamètre 30 m', null, null, 'Rapprochement H4, catégorie 2'),
  ('centimetre5m', 'Mètre ruban 5 m', null, null, 'Rapprochement H4, catégorie 2'),
  ('rallonge50m', 'Rallonge électrique 50 m', null, null, 'Rapprochement H4, catégorie 2'),
  ('sonneriemarchearriere', 'Sonnerie de marche arrière', null, null, 'Rapprochement H4, catégorie 2'),
  ('cordemacons', 'Corde de maçon', null, null, 'Rapprochement H4, catégorie 2'),
  ('sceauxmacons', 'Seau de maçon', null, null, 'Rapprochement H4, catégorie 2'),
  ('filaplomb', 'Fil à plomb', null, null, 'Rapprochement H4, catégorie 2'),
  ('niveaudeau', 'Niveau à bulle', null, null, 'Rapprochement H4, catégorie 2'),
  ('ambulance4', 'Ambulance 4', null, null, 'Rapprochement H4, catégorie 3'),
  ('ambulance5', 'Ambulance 5', null, null, 'Rapprochement H4, catégorie 3'),
  ('filapointe', 'Fil à pointe', null, null, 'Rapprochement H4, catégorie 3'),
  ('filtreaairexcavateurprimaireetsecondaire', 'Filtre à air excavateur primaire et secondaire', null, null, 'Rapprochement H4, catégorie 3'),
  ('filtreagasoil', 'Filtre à gasoil', null, null, 'Rapprochement H4, catégorie 3'),
  ('gegantifreezesf12200l', 'GEG ANTIFREEZE SF12+ 200 L', null, null, 'Rapprochement H4, catégorie 3'),
  ('gegatfvi200l', 'GEG ATF VI 200 L', null, null, 'Rapprochement H4, catégorie 3'),
  ('marteaupiqueur', 'Marteau piqueur', null, null, 'Rapprochement H4, catégorie 3'),
  ('pneujoyroad26565r17', 'Pneu JOYROAD 265/65R17', null, null, 'Rapprochement H4, catégorie 3'),
  ('pneuluxxan24570r17', 'Pneu LUXXAN 245/70R17', null, null, 'Rapprochement H4, catégorie 3'),
  ('totalcarterxep220200l', 'TOTAL CARTER XEP 220 200 L', null, null, 'Rapprochement H4, catégorie 3'),
  ('totalcarterxep460200l', 'TOTAL CARTER XEP 460 200 L', null, null, 'Rapprochement H4, catégorie 3'),
  ('4x4neuf', '4x4 neuf', null, null, 'Rapprochement H4, catégorie 4'),
  ('4x4usage', '4x4 usagé', null, null, 'Rapprochement H4, catégorie 4'),
  ('disqueacouper', 'Disque à couper', null, null, 'Rapprochement H4, catégorie 4'),
  ('disqueameuler', 'Disque à meuler', null, null, 'Rapprochement H4, catégorie 4'),
  ('lamepoursciegrand', 'Lame pour scie (grand modèle)', null, null, 'Rapprochement H4, catégorie 4'),
  ('lamepoursciepetit', 'Lame pour scie (petit modèle)', null, null, 'Rapprochement H4, catégorie 4'),
  ('meuleuse', 'Meuleuse', null, null, 'Rapprochement H4, catégorie 4'),
  ('perceuse', 'Perceuse', null, null, 'Rapprochement H4, catégorie 4'),
  ('vibrateuramoteur', 'Vibrateur à moteur', null, null, 'Rapprochement H4, catégorie 4'),
  ('vibrateurelectrique', 'Vibrateur électrique', null, null, 'Rapprochement H4, catégorie 4'),
  ('fut', 'Fût', null, null, 'Rapprochement H4, catégorie 4'),
  ('decanteur', 'decanteur', null, null, 'Lignes antérieures — correspondance exacte'),
  ('discount', 'DISCOUNT', null, null, 'Lignes antérieures — correspondance exacte'),
  ('embout', 'EMBOUT', '1 L', null, 'Lignes antérieures — correspondance exacte'),
  ('filtreahuile', 'filtre à huile', null, null, 'Lignes antérieures — correspondance exacte'),
  ('flexible', 'FLEXIBLE', '1 L', null, 'Lignes antérieures — correspondance exacte'),
  ('gegliquidederefroidissement200l', 'GEG Liquide de refroidissement (200L)', '200 L', null, 'Lignes antérieures — correspondance exacte'),
  ('gegdieselextra15w4020l', 'GEG DIESEL EXTRA 15W40 20 L', '20 L', null, 'Lignes antérieures — correspondance exacte'),
  ('gegdieselpremium15w40200l', 'GEG DIESEL PREMIUM 15W40 (200 l)', '200 L', null, 'Lignes antérieures — correspondance exacte'),
  ('geggeargl580w90200l', 'GEG GEAR GL-5 80W90 200 L', null, null, 'Lignes antérieures — correspondance exacte'),
  ('geghydraulichlp68200l', 'GEG HYDRAULIC HLP 68 200 L', null, null, 'Lignes antérieures — correspondance exacte'),
  ('gegto410w200l', 'GEG TO-4 10W   (200L)', '200 L', null, 'Lignes antérieures — correspondance exacte'),
  ('gpndieselextra15w40200l', 'GPN DIESEL EXTRA 15W40   200 L', '200 L', null, 'Lignes antérieures — correspondance exacte'),
  ('gpnhydraulichlp6820l', 'GPN HYDRAULIC HLP-68      20 L', '20 L', null, 'Lignes antérieures — correspondance exacte'),
  ('gpnreductorclp320200l', 'GPN REDUCTOR CLP-320 200 L', null, null, 'Lignes antérieures — correspondance exacte'),
  ('motopompe', 'MOTOPOMPE', '1 L', null, 'Lignes antérieures — correspondance exacte'),
  ('piecesdetacheesmitsubishil200kitembrayagevolantmoteurrecepteurbaguesspijointbv', 'Pièces Détachées - Mitsubishi L200 (Kit Embrayage, Volant moteur, Récepteur, Bagues SPI, Joint BV)', '1 L', null, 'Lignes antérieures — correspondance exacte'),
  ('piecesdetacheestoyotacorollamatrixcardantdgjointsspysupportsbvjeepwranglerbougiesbobines', 'Pièces Détachées - Toyota Corolla Matrix (Cardant D/G, Joints spy, Supports BV) + Jeep Wrangler (Bougies, Bobines)', '1 L', null, 'Lignes antérieures — correspondance exacte'),
  ('piecesdetacheestoyotarav4amortisseurarrierenb2', 'Pièces Détachées - Toyota RAV4 - Amortisseur Arrière NB2', '1 L', null, 'Lignes antérieures — correspondance exacte'),
  ('15w40', '15W40 (à identifier)', null, null, 'Lignes antérieures — fiche distincte (caractéristique différente ou manquante)'),
  ('bridgestone31580r225', '315/80R22.5 154M BRIDGESTONE', 'Unité', null, 'Lignes antérieures — même article, libellé différent'),
  ('dieselextra15w40cuve', 'DIESEL EXTRA 15W40 (cuve)', null, null, 'Lignes antérieures — fiche distincte (caractéristique différente ou manquante)'),
  ('dieselextra15w40fut', 'DIESEL EXTRA 15W40 (fût)', null, null, 'Lignes antérieures — fiche distincte (caractéristique différente ou manquante)'),
  ('dieselpremium15w40fut', 'DIESEL PREMIUM 15W40 (fût)', null, null, 'Lignes antérieures — fiche distincte (caractéristique différente ou manquante)'),
  ('eurotecclassicoldiesel15w40cf4sg200l', 'EUROTEC 15W40 CF-4/SG - 200L', '200 L', null, 'Lignes antérieures — même article, libellé différent'),
  ('eurotecclassicoldiesel15w40cf4sg20l', 'EUROTEC 15W40 CF-4/SG - 20L', '20 L', null, 'Lignes antérieures — même article, libellé différent'),
  ('eurotecmonotechdsae50cf4sg200l', 'EUROTEC HD SAE 50 CF-4/SG - 200L', '200 L', null, 'Lignes antérieures — même article, libellé différent'),
  ('eurotecmonotechdsae50cf4sg20l', 'EUROTEC HD SAE 50 CF-4/SG - 20L', '20 L', null, 'Lignes antérieures — même article, libellé différent'),
  ('gegdieselextra15w40200l', 'GEG DIESEL EXTRA 15W40', '200 L', null, 'Lignes antérieures — même article, libellé différent'),
  ('gegdieselextrasae50200l', 'GEG DIESEL EXTRA SAE 50', '200 L', null, 'Lignes antérieures — même article, libellé différent'),
  ('geggreaselep2180kg', 'GEG GREASE L EP2 180 kg', null, null, 'Lignes antérieures — fiche distincte (caractéristique différente ou manquante)'),
  ('geghydraulichlp68200lremise2', 'GEG HYDRAULIC HLP 68 200 L', null, null, 'Lignes antérieures — même article, libellé différent ; détail d''origine : remise 2 %'),
  ('gegspecialt0430200l', 'GEG SPECIAL TO4-30 (200L)', '200 L', null, 'Lignes antérieures — même article, libellé différent'),
  ('gpnhydraulichlp68205l', 'GPN HYDROLIC HLP 68 205 L', '205 L', null, 'Lignes antérieures — même article, libellé différent'),
  ('gpnpremium5w405l', 'GPN PREMIUM 5W40 5 L', null, null, 'Lignes antérieures — fiche distincte (caractéristique différente ou manquante)'),
  ('multiscomplexmhd220orequ180kg', 'Multis  Complex MHD 220 OR Equ 180KG', '1 L', null, 'Lignes antérieures — même article, libellé différent'),
  ('filtreseparateurelectrique', 'Filtre séparateur électrique', null, null, 'Lignes antérieures — article absent, fiche créée'),
  ('fraisdedeboursdeplacementsbordeauxparisstrasbourgforbach', 'Frais de débours', null, 'service', 'Lignes antérieures — service générique ; libellé d''origine : Déplacements Bordeaux/Paris/Strasbourg/Forbach'),
  ('fretdakar40ft', 'FRAIS DE TRANSPORT', null, 'service', 'Lignes antérieures — service générique ; libellé d''origine : FRET DAKAR 40FT'),
  ('gpngreaseep25l', 'GPN GREASE EP 2 5 L', null, null, 'Lignes antérieures — article absent, fiche créée'),
  ('kitchalumeausansbouteilles', 'Kit chalumeau sans bouteilles', null, null, 'Lignes antérieures — article absent, fiche créée'),
  ('ardeca80w90', 'Ardeca 80W-90', null, null, 'Lignes antérieures — fiche distincte'),
  ('bouteilledoxygeneoccasion', 'Bouteille d''oxygène (occasion)', null, null, 'Lignes antérieures — fiche distincte'),
  ('bouteilledegazoccasion', 'Bouteille de gaz (occasion)', null, null, 'Lignes antérieures — fiche distincte'),
  ('charriotdetransport', 'Chariot de transport', null, null, 'Lignes antérieures — fiche distincte'),
  ('container20', 'Conteneur 20 pieds', null, null, 'Lignes antérieures — fiche distincte'),
  ('dieselextra20w50fut', 'DIESEL EXTRA 20W50 (fût)', null, null, 'Lignes antérieures — fiche distincte'),
  ('eurotecclassicoldiesel15w40cf4sg4l', 'EUROTEC Classicol Diesel 15W-40 CF-4/SG 4 L', null, null, 'Lignes antérieures — fiche distincte'),
  ('eurotechydraulicoilhlp68200l', 'EUROTEC Hydraulic Oil HLP 68 200 L', null, null, 'Lignes antérieures — fiche distincte'),
  ('eurotechydraulicoilhlp6820l', 'EUROTEC Hydraulic Oil HLP 68 20 L', null, null, 'Lignes antérieures — fiche distincte'),
  ('eurotecmonotechdsae50cf4sg4l', 'EUROTEC Monotec HD SAE 50 CF-4/SG 4 L', null, null, 'Lignes antérieures — fiche distincte'),
  ('eurotecmotoprime4t20w501l', 'EUROTEC MotoPrime 4T 20W-50 1 L', null, null, 'Lignes antérieures — fiche distincte'),
  ('fraisdetransportlivraisonboffabalandougou', 'FRAIS DE TRANSPORT', null, 'service', 'Lignes antérieures — service générique ; libellé d''origine : Frais de transport - Livraison Boffa/Balandougou'),
  ('fraisdetransportlivraisonmandiana', 'FRAIS DE TRANSPORT', null, 'service', 'Lignes antérieures — service générique ; libellé d''origine : Frais de transport - Livraison Mandiana'),
  ('gegcoolantsf12premix', 'GEG Coolant SF12 Premix', null, null, 'Lignes antérieures — fiche distincte'),
  ('gpndieselextra15w4020l', 'GPN DIESEL EXTRA 15W40 20 L', null, null, 'Lignes antérieures — fiche distincte'),
  ('gpndieselextra15w405l', 'GPN DIESEL EXTRA 15W40 5 L', null, null, 'Lignes antérieures — fiche distincte'),
  ('gpnpremium10w40premiuml10w405l', 'GPN PREMIUM 10W40 5 L', null, null, 'Lignes antérieures — fiche distincte'),
  ('gpnpremium5w305l', 'GPN PREMIUM 5W30 5 L', null, null, 'Lignes antérieures — fiche distincte'),
  ('hd50fut', 'HD 50 (fût)', null, null, 'Lignes antérieures — fiche distincte'),
  ('hlp68cuve', 'HLP 68 (cuve)', null, null, 'Lignes antérieures — fiche distincte'),
  ('pneu205r16ctypecontinentaletbridgestone', 'Pneu 205R16C', null, null, 'Lignes antérieures — fiche distincte'),
  ('prestationdeservices', 'Prestation de services', null, 'service', 'Lignes antérieures — service générique'),
  ('transportconteneurenbateaufraisdetransport', 'FRAIS DE TRANSPORT', null, 'service', 'Lignes antérieures — service générique ; libellé d''origine : TRANSPORT CONTENEUR EN BATEAU - FRAIS DE TRANSPORT')
), target as (
  -- exactly one active fiche per target (name, and unit / type when several fiches share the name)
  select m.k, m.note, min(p.id::text)::uuid as product_id, count(*) n
  from m join geg_guinee.products p on p.name = m.target and p.is_active
    and (m.unit is null or exists (select 1 from geg_guinee.units u where u.id = p.unit_id and u.name = m.unit))
    and (m.ptype is null or p.product_type = m.ptype)
  group by m.k, m.note
), free as (
  select 'invoice_lines' t, id, regexp_replace(translate(lower(description), 'àâäáãéèêëíìîïóòôöõúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'), '[^a-z0-9]', '', 'g') k from geg_guinee.invoice_lines where product_id is null and line_type = 'product'
  union all
  select 'sales_order_lines', id, regexp_replace(translate(lower(description), 'àâäáãéèêëíìîïóòôöõúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'), '[^a-z0-9]', '', 'g') from geg_guinee.sales_order_lines where product_id is null and line_type = 'product'
)
insert into geg_guinee.historical_line_links (line_table, line_id, product_id, status, source, note)
select f.t, f.id, t.product_id, 'proposed', 'auto_h4', t.note
from free f join target t on t.k = f.k and t.n = 1
where not exists (select 1 from geg_guinee.historical_line_links l where l.line_id = f.id and l.status <> 'cancelled');

with m(k, target, unit, ptype, note) as (values
  ('rationdecomabet4000kcal18kg', 'Ration de Combat 24H - 4000Kcal -1,8Kg', null, null, 'Rapprochement H4 Singapour, catégorie 1'),
  ('transportaerienpour10000rations', 'FRAIS DE TRANSPORT', null, 'service', 'Service générique de transport ; libellé d''origine : Transport aerien pour 10 000rations')
), target as (
  -- exactly one active fiche per target (name, and unit / type when several fiches share the name)
  select m.k, m.note, min(p.id::text)::uuid as product_id, count(*) n
  from m join geg_singapore.products p on p.name = m.target and p.is_active
    and (m.unit is null or exists (select 1 from geg_singapore.units u where u.id = p.unit_id and u.name = m.unit))
    and (m.ptype is null or p.product_type = m.ptype)
  group by m.k, m.note
), free as (
  select 'invoice_lines' t, id, regexp_replace(translate(lower(description), 'àâäáãéèêëíìîïóòôöõúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'), '[^a-z0-9]', '', 'g') k from geg_singapore.invoice_lines where product_id is null and line_type = 'product'
  union all
  select 'sales_order_lines', id, regexp_replace(translate(lower(description), 'àâäáãéèêëíìîïóòôöõúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'), '[^a-z0-9]', '', 'g') from geg_singapore.sales_order_lines where product_id is null and line_type = 'product'
)
insert into geg_singapore.historical_line_links (line_table, line_id, product_id, status, source, note)
select f.t, f.id, t.product_id, 'proposed', 'auto_h4', t.note
from free f join target t on t.k = f.k and t.n = 1
where not exists (select 1 from geg_singapore.historical_line_links l where l.line_id = f.id and l.status <> 'cancelled');

-- Contrôle : correspondances proposées par société, et lignes libres restant sans correspondance
select 'geg_guinee' societe, (select count(*) from geg_guinee.historical_line_links where status = 'proposed') proposees,
  (select count(*) from (select id from geg_guinee.invoice_lines where product_id is null and line_type = 'product' union all select id from geg_guinee.sales_order_lines where product_id is null and line_type = 'product') f
   where not exists (select 1 from geg_guinee.historical_line_links l where l.line_id = f.id and l.status <> 'cancelled')) sans_correspondance
union all
select 'geg_singapore', (select count(*) from geg_singapore.historical_line_links where status = 'proposed'),
  (select count(*) from (select id from geg_singapore.invoice_lines where product_id is null and line_type = 'product' union all select id from geg_singapore.sales_order_lines where product_id is null and line_type = 'product') f
   where not exists (select 1 from geg_singapore.historical_line_links l where l.line_id = f.id and l.status <> 'cancelled'));

commit;
