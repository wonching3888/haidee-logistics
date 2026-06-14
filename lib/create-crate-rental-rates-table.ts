import { prisma } from "@/lib/prisma";

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS crate_rental_rates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  crate_type VARCHAR(10) NOT NULL UNIQUE,
  is_rental BOOLEAN NOT NULL DEFAULT true,
  rate_myr DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  notes VARCHAR(200),
  updated_at TIMESTAMP DEFAULT NOW()
);
`;

const SEED_DATA_SQL = `
INSERT INTO crate_rental_rates (crate_type, is_rental, rate_myr, notes) VALUES
('ABB', true, 10.50, NULL),
('WTL', true, 8.00, NULL),
('BHR', true, 10.50, NULL),
('VIO', true, 11.00, NULL),
('SHK', true, 0.00, '待确认'),
('BRO', true, 0.00, '待确认'),
('GLY', false, 0.00, '顾客自有'),
('BS', false, 0.00, '顾客自有'),
('SHS', false, 0.00, '顾客自有'),
('BOX', false, 0.00, '无租桶费')
ON CONFLICT (crate_type) DO NOTHING;
`;

/** Create and seed crate_rental_rates on Supabase Postgres (via DATABASE_URL). */
export async function createCrateRentalRatesTable() {
  await prisma.$executeRawUnsafe(CREATE_TABLE_SQL);
  await prisma.$executeRawUnsafe(SEED_DATA_SQL);
}

export function isMissingCrateRentalRatesTableError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  const message = "message" in error ? String(error.message) : "";
  return (
    code === "P2021" ||
    message.includes("crate_rental_rates") ||
    message.includes("does not exist")
  );
}
