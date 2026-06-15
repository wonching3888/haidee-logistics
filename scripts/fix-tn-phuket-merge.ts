import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { aggregateOperationsIncome } from "@/lib/operations-income";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function requireShipper(code: string) {
  const shipper = await prisma.shipper.findUnique({ where: { code } });
  if (!shipper) throw new Error(`Shipper not found: ${code}`);
  return shipper;
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

async function main() {
  console.log("=== Merge TN PHUKET 3001/T005 -> 3001-011 ===");
  await mergeShipper(["3001/T005", "3001-T005"], "3001-011");

  console.log("\n=== Verify June 2026 missing-rate lines ===");
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
