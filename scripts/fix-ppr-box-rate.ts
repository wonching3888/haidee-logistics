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
  const shipper = await prisma.shipper.findUnique({ where: { code: "3001-P008" } });
  const market = await prisma.market.findUnique({ where: { code: "KL" } });
  if (!shipper) throw new Error("Shipper 3001-P008 not found");
  if (!market) throw new Error("Market KL not found");

  const existing = await prisma.freightRate.findFirst({
    where: { shipperId: shipper.id, marketId: market.id },
    orderBy: { effectiveDate: "desc" },
  });

  await prisma.freightRate.upsert({
    where: {
      shipperId_marketId_effectiveDate: {
        shipperId: shipper.id,
        marketId: market.id,
        effectiveDate: EFFECTIVE_DATE,
      },
    },
    update: { rateBox: 200, currency: shipper.currency },
    create: {
      shipperId: shipper.id,
      marketId: market.id,
      effectiveDate: EFFECTIVE_DATE,
      rateBox: 200,
      rateTong: existing?.rateTong ?? 310,
      currency: shipper.currency,
    },
  });

  console.log("upserted 3001-P008 KL rate_box=200 THB");

  const income = await aggregateOperationsIncome(2026, 6);
  console.log(
    JSON.stringify(
      {
        missingRateLineCount: income.missingRateLineCount,
        missingRateQuantity: income.missingRateQuantity,
        gapReasons: income.gapReasons,
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
