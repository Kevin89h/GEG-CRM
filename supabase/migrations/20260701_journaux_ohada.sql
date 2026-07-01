-- Journaux comptables (treasury_accounts) par défaut pour GEG Guinée
-- Ces comptes apparaissent dans le champ "Journal" lors des paiements

INSERT INTO geg_guinee.treasury_accounts
  (name, type, institution, account_number, currency, initial_balance, color, is_active)
VALUES
  ('Caisse GNF',        'cash',         null,          null,                  'GNF', 0, 'green',  true),
  ('ECOBANK GNF',       'bank',         'ECOBANK',     '10001730805226290',   'GNF', 0, 'blue',   true),
  ('ECOBANK GNF (2)',   'bank',         'ECOBANK',     '100017308064086',     'GNF', 0, 'blue',   true),
  ('ACCESS BANK GNF',   'bank',         'ACCESS BANK', '36001010000215460',   'GNF', 0, 'purple', true),
  ('VISTA BANK GNF',    'bank',         'VISTA BANK',  '2842400145744130',    'GNF', 0, 'orange', true),
  ('Orange Money',      'mobile_money', 'Orange',      null,                  'GNF', 0, 'orange', true),
  ('Caisse USD',        'cash',         null,          null,                  'USD', 0, 'green',  true)
ON CONFLICT DO NOTHING;
