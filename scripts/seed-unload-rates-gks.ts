import "dotenv/config";
import { prisma } from "../lib/prisma";
import { listUnloadRates } from "../lib/unload-rates-service";

const SEED_GKS_SQL = `
INSERT INTO unload_rates (market_code, crate_type, rate_myr)
SELECT m.market_code, 'GKS', 0.00
FROM (VALUES
  ('KL'),('BP'),('MP'),('SL'),('MC'),('A'),
  ('BM'),('P'),('TP'),('NT'),('KT'),('SA'),('KD'),('JB')
) AS m(market_code)
ON CONFLICT (market_code, crate_type) DO NOTHING;
`;

async function main() {
  await prisma.$executeRawUnsafe(SEED_GKS_SQL);
  const rates = await listUnloadRates();
  const gksCount = rates.filter((row) => row.crateType === "GKS").length;
  console.log(
    JSON.stringify(
      {
        ok: true,
        totalCount: rates.length,
        gksCount,
        message: "GKS unload rates seeded",
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
