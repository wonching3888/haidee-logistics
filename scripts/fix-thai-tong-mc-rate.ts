import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { parseDateInput } from "@/lib/date-utils";
import { aggregateOperationsIncome } from "@/lib/operations-income";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const EFFECTIVE_DATE = parseDateInput("2026-06-15");

async function main() {
  const shipper = await prisma.shipper.findUnique({ where: { code: "3001-T003" } });
  const market = await prisma.market.findUnique({ where: { code: "MC" } });
  if (!shipper) throw new Error("Shipper 3001-T003 not found");
  if (!market) throw new Error("Market MC not found");

  await prisma.freightRate.upsert({
    where: {
      shipperId_marketId_effectiveDate: {
        shipperId: shipper.id,
        marketId: market.id,
        effectiveDate: EFFECTIVE_DATE,
      },
    },
    update: { rateTong: 250, currency: "THB" },
    create: {
      shipperId: shipper.id,
      marketId: market.id,
      effectiveDate: EFFECTIVE_DATE,
      rateTong: 250,
      currency: "THB",
    },
  });

  console.log("upserted 3001-T003 MC rate_tong=250 THB");

  const income = await aggregateOperationsIncome(2026, 6);
  console.log(
    JSON.stringify(
      {
        missingRateLineCount: income.missingRateLineCount,
        missingRateQuantity: income.missingRateQuantity,
        gapReasons: income.gapReasons,
        mode1aThb: income.mode1aThb,
        totalMyrApprox:
          Math.round(
            ((income.mode1aThb / 8.2 +
              income.mode1bMyr +
              income.mode2Myr +
              income.wtlMode3Myr) *
              100) /
              100
          ) / 100,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
