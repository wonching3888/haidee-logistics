-- Operations monthly manual costs (reference SQL for Supabase SQL Editor)
-- Prefer: node scripts/migrate-operations-monthly-costs.mjs

CREATE TABLE IF NOT EXISTS operations_monthly_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month TEXT NOT NULL UNIQUE,
  toll_fee DECIMAL(12, 2),
  crate_rental DECIMAL(12, 2),
  load_unload_fee DECIMAL(12, 2),
  lkim_maqis_fee DECIMAL(12, 2),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
