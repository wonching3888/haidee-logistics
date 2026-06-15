import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { parseDateInput } from "@/lib/date-utils";
import { aggregateOperationsIncome } from "@/lib/operations-income";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const EFFECTIVE_DATE = parseDateInput("2026-06-15");

async function requireShipper(code: string) {
  const shipper = await prisma.shipper.findUnique({ where: { code } });
  if (!shipper) throw new Error(`Shipper not found: ${code}`);
  return shipper;
}

async function requireMarket(code: string) {
  const market = await prisma.market.findUnique({ where: { code } });
  if (!market) throw new Error(`Market not found: ${code}`);
  return market;
}

async function findFonShipper() {
  const shippers = await prisma.shipper.findMany({
    where: { name: { contains: "FON", mode: "insensitive" } },
    select: { id: true, name: true, code: true, currency: true },
  });
  console.log("FON shippers:", JSON.stringify(shippers, null, 2));
  if (shippers.length !== 1) {
    throw new Error(`Expected exactly 1 FON shipper, found ${shippers.length}`);
  }
  return shippers[0];
}

async function upsertShipperRate(input: {
  code: string;
  market: string;
  tong: number;
  currency?: string;
}) {
  const shipper = await requireShipper(input.code);
  const market = await requireMarket(input.market);
  const currency = input.currency ?? shipper.currency;

  await prisma.freightRate.upsert({
    where: {
      shipperId_marketId_effectiveDate: {
        shipperId: shipper.id,
        marketId: market.id,
        effectiveDate: EFFECTIVE_DATE,
      },
    },
    update: { rateTong: input.tong, currency },
    create: {
      shipperId: shipper.id,
      marketId: market.id,
      effectiveDate: EFFECTIVE_DATE,
      rateTong: input.tong,
      currency,
    },
  });
  console.log(
    `  freight_rate ${input.code} ${input.market} tong=${input.tong} ${currency}`
  );
}

async function main() {
  const before = await aggregateOperationsIncome(2026, 6);
  console.log("Before missing-rate lines:", before.missingRateLineCount);

  const fon = await findFonShipper();
  console.log(`Using FON autocount_code (shipper.code): ${fon.code}`);

  await upsertShipperRate({
    code: fon.code,
    market: "P",
    tong: 220,
    currency: "THB",
  });
  await upsertShipperRate({
    code: "3002-S006",
    market: "BM",
    tong: 33,
    currency: "MYR",
  });
  await upsertShipperRate({
    code: "3001-Y001",
    market: "TP",
    tong: 270,
    currency: "THB",
  });
  await upsertShipperRate({
    code: "3001-S002",
    market: "SL",
    tong: 310,
    currency: "THB",
  });

  const after = await aggregateOperationsIncome(2026, 6);
  console.log("After missing-rate lines:", after.missingRateLineCount);
  console.log(
    "Reduced by:",
    before.missingRateLineCount - after.missingRateLineCount
  );
  console.log(
    JSON.stringify(
      {
        fonAutocountCode: fon.code,
        beforeMissingRateLineCount: before.missingRateLineCount,
        afterMissingRateLineCount: after.missingRateLineCount,
        reducedBy: before.missingRateLineCount - after.missingRateLineCount,
        gapReasons: after.gapReasons,
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
