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

async function mergeShipper(fromCodes: string[], toCode: string) {
  const target = await requireShipper(toCode);
  const sources = await prisma.shipper.findMany({
    where: { code: { in: fromCodes } },
  });

  if (sources.length === 0) {
    console.log(`mergeShipper: no source records for ${fromCodes.join(", ")}`);
    return;
  }

  for (const source of sources) {
    if (source.id === target.id) continue;
    console.log(`Merging shipper ${source.code} -> ${target.code}`);

    await prisma.inboundSession.updateMany({
      where: { shipperId: source.id },
      data: { shipperId: target.id },
    });
    await prisma.tongExport.updateMany({
      where: { shipperId: source.id },
      data: { shipperId: target.id },
    });
    await prisma.thVehicle.updateMany({
      where: { shipperId: source.id },
      data: { shipperId: target.id },
    });
    await prisma.customerCrateLedger.updateMany({
      where: { shipperId: source.id },
      data: { shipperId: target.id },
    });

    const sourceStocks = await prisma.customerCrateStock.findMany({
      where: { shipperId: source.id },
    });
    for (const stock of sourceStocks) {
      const existing = await prisma.customerCrateStock.findUnique({
        where: {
          shipperId_crateTypeId_location: {
            shipperId: target.id,
            crateTypeId: stock.crateTypeId,
            location: stock.location,
          },
        },
      });
      if (existing) {
        await prisma.customerCrateStock.update({
          where: { id: existing.id },
          data: { quantity: existing.quantity + stock.quantity },
        });
        await prisma.customerCrateStock.delete({ where: { id: stock.id } });
      } else {
        await prisma.customerCrateStock.update({
          where: { id: stock.id },
          data: { shipperId: target.id },
        });
      }
    }

    const sourceDefaults = await prisma.shipperStallDefault.findMany({
      where: { shipperId: source.id },
    });
    for (const row of sourceDefaults) {
      const conflict = await prisma.shipperStallDefault.findUnique({
        where: {
          shipperId_stallId: { shipperId: target.id, stallId: row.stallId },
        },
      });
      if (conflict) {
        await prisma.shipperStallDefault.delete({ where: { id: row.id } });
      } else {
        await prisma.shipperStallDefault.update({
          where: { id: row.id },
          data: { shipperId: target.id },
        });
      }
    }

    const sourceRates = await prisma.freightRate.findMany({
      where: { shipperId: source.id },
    });
    for (const rate of sourceRates) {
      const conflict = await prisma.freightRate.findUnique({
        where: {
          shipperId_marketId_effectiveDate: {
            shipperId: target.id,
            marketId: rate.marketId,
            effectiveDate: rate.effectiveDate,
          },
        },
      });
      if (conflict) {
        await prisma.freightRate.delete({ where: { id: rate.id } });
      } else {
        await prisma.freightRate.update({
          where: { id: rate.id },
          data: { shipperId: target.id },
        });
      }
    }

    const sourceRelations = await prisma.paymentRelation.findMany({
      where: { shipperId: source.id },
    });
    for (const relation of sourceRelations) {
      const conflict = await prisma.paymentRelation.findUnique({
        where: {
          shipperId_consigneeId: {
            shipperId: target.id,
            consigneeId: relation.consigneeId,
          },
        },
      });
      if (conflict) {
        await prisma.paymentRelation.delete({ where: { id: relation.id } });
      } else {
        await prisma.paymentRelation.update({
          where: { id: relation.id },
          data: { shipperId: target.id },
        });
      }
    }

    await prisma.shipper.delete({ where: { id: source.id } });
    console.log(`  deleted source shipper ${source.code}`);
  }
}

async function copyFreightRates(fromCode: string, toCode: string) {
  const source = await requireShipper(fromCode);
  const target = await requireShipper(toCode);
  const rates = await prisma.freightRate.findMany({
    where: { shipperId: source.id },
  });

  let copied = 0;
  for (const rate of rates) {
    await prisma.freightRate.upsert({
      where: {
        shipperId_marketId_effectiveDate: {
          shipperId: target.id,
          marketId: rate.marketId,
          effectiveDate: rate.effectiveDate,
        },
      },
      update: {
        rateTong: rate.rateTong,
        rateBox: rate.rateBox,
        currency: rate.currency,
      },
      create: {
        shipperId: target.id,
        marketId: rate.marketId,
        effectiveDate: rate.effectiveDate,
        rateTong: rate.rateTong,
        rateBox: rate.rateBox,
        currency: rate.currency,
      },
    });
    copied += 1;
  }
  console.log(`  copied ${copied} freight_rates from ${fromCode} -> ${toCode}`);
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
  console.log("=== Step 1: Merge duplicate shippers ===");
  await mergeShipper(["300-L002"], "3002-L002");
  await mergeShipper(["3001/T007"], "3001-009");
  await mergeShipper(["300-M001"], "3002-M002");
  await mergeShipper(["300-X001"], "3002-X001");
  await mergeShipper(["3001/B003"], "3001-B001");
  await mergeShipper(["3001/P031"], "3001-C003");

  console.log("\n=== Step 2: Copy CT FISHERY rates from CH FISHERY ===");
  await copyFreightRates("3001-C003", "3001/C030");

  console.log("\n=== Step 3: Fill missing market rates ===");
  await upsertShipperRate({ code: "3001-S008", market: "KT", tong: 150, currency: "THB" });
  await upsertShipperRate({ code: "3001-S008", market: "P", tong: 150, currency: "THB" });
  await upsertShipperRate({ code: "3000-B001", market: "MP", tong: 24, currency: "MYR" });
  await upsertShipperRate({ code: "3001-S004", market: "KT", tong: 250, currency: "THB" });

  console.log("\n=== Step 4: Verify June 2026 missing-rate lines ===");
  const income = await aggregateOperationsIncome(2026, 6);
  console.log(
    JSON.stringify(
      {
        missingRateLineCount: income.missingRateLineCount,
        missingRateQuantity: income.missingRateQuantity,
        gapReasons: income.gapReasons,
        mode1aThb: income.mode1aThb,
        mode1bMyr: income.mode1bMyr,
        mode2Myr: income.mode2Myr,
        wtlMode3Myr: income.wtlMode3Myr,
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
