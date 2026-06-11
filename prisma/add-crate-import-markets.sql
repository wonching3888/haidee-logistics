-- Crate import source markets (ABIBA, ALPS, ECONSAVE, OTHERS)
INSERT INTO markets (code, name, active)
VALUES
  ('ABIBA', 'ABIBA', true),
  ('ALPS', 'ALPS', true),
  ('ECONSAVE', 'ECONSAVE', true),
  ('OTHERS', 'OTHERS', true)
ON CONFLICT (code) DO NOTHING;
