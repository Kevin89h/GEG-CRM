@AGENTS.md

# Analyse des données existantes : historique complet obligatoire (règle GEG du 10/11/2026)

Toute analyse de données existantes (produits, clients, fournisseurs, devis, factures, stocks, paiements,
écritures comptables ou autres) porte sur l'INTÉGRALITÉ de l'historique disponible, des premières entrées aux plus récentes.

- Aucun filtre temporel implicite : ni 30 jours, ni 90 jours, ni année en cours.
- Vérifier que les requêtes, la pagination et les limites techniques (limit, plafond de lignes de l'API, troncature
  d'affichage, encodage) permettent bien d'extraire toutes les entrées concernées.
- Contrôler les volumes totaux (count(*) sans filtre) et signaler tout écart avec ce qui a été extrait.
- Indiquer explicitement dans chaque rapport : le périmètre analysé (sociétés, tables, période réelle couverte),
  le nombre d'enregistrements et toute exclusion éventuelle.
- Si une analyse exhaustive est techniquement impossible, le signaler AVANT de présenter des conclusions comme complètes.
- Ne limiter la période que si GEG le demande explicitement.
