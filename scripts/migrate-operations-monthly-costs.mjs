/**
 * Create operations_monthly_costs table for Phase 1.5e dashboard.
 * Run: node scripts/migrate-operations-monthly-costs.mjs
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS operations_monthly_costs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      year_month TEXT NOT NULL UNIQUE,
      toll_fee DECIMAL(12, 2),
      crate_rental DECIMAL(12, 2),
      load_unload_fee DECIMAL(12, 2),
      lkim_maqis_fee DECIMAL(12, 2),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  console.log("operations_monthly_costs table is ready.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
