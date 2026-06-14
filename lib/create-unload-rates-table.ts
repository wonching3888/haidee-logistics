import { prisma } from "@/lib/prisma";

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS unload_rates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  market_code VARCHAR(10) NOT NULL,
  crate_type VARCHAR(10) NOT NULL,
  rate_myr DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  notes VARCHAR(200),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(market_code, crate_type)
);
`;

const SEED_FROM_MARKETS_SQL = `
INSERT INTO unload_rates (market_code, crate_type, rate_myr)
SELECT m.code, ct.crate_type, COALESCE(m.load_unload_per_crate, 0.00)
FROM markets m
CROSS JOIN (
  VALUES
    ('ABB'), ('WTL'), ('BHR'), ('VIO'), ('SHK'), ('GKS'), ('BRO'),
    ('GLY'), ('BS'), ('SHS'), ('BOX')
) AS ct(crate_type)
WHERE m.active = true AND m.code <> 'OTHER'
ON CONFLICT (market_code, crate_type) DO NOTHING;
`;

const SEED_GKS_SQL = `
INSERT INTO unload_rates (market_code, crate_type, rate_myr)
SELECT m.market_code, 'GKS', 0.00
FROM (VALUES
  ('KL'),('BP'),('MP'),('SL'),('MC'),('A'),
  ('BM'),('P'),('TP'),('NT'),('KT'),('SA'),('KD'),('JB')
) AS m(market_code)
ON CONFLICT (market_code, crate_type) DO NOTHING;
`;

/** Create and seed unload_rates on Postgres (via DATABASE_URL). */
export async function createUnloadRatesTable() {
  await prisma.$executeRawUnsafe(CREATE_TABLE_SQL);
  await prisma.$executeRawUnsafe(SEED_FROM_MARKETS_SQL);
  await prisma.$executeRawUnsafe(SEED_GKS_SQL);
}

export function isMissingUnloadRatesTableError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  const message = "message" in error ? String(error.message) : "";
  return (
    code === "P2021" ||
    message.includes("unload_rates") ||
    message.includes("does not exist")
  );
}
