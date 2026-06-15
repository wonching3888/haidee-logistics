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

async function requireConsignee(code: string) {
  const consignee = await prisma.consignee.findUnique({ where: { code } });
  if (!consignee) throw new Error(`Consignee not found: ${code}`);
  return consignee;
}

async function requireMarket(code: string) {
  const market = await prisma.market.findUnique({ where: { code } });
  if (!market) throw new Error(`Market not found: ${code}`);
  return market;
}

async function defaultTongTypeId() {
  const tong =
    (await prisma.tongType.findFirst({ where: { code: "ABB" } })) ??
    (await prisma.tongType.findFirst({ where: { active: true } }));
  if (!tong) throw new Error("No tong type found");
  return tong.id;
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

async function linkStallConsigneeByCode(
  marketCode: string,
  stallCode: string,
  consigneeCode: string
) {
  const market = await requireMarket(marketCode);
  const consignee = await requireConsignee(consigneeCode);
  let stall = await prisma.stall.findFirst({
    where: { marketId: market.id, code: stallCode, active: true },
  });
  if (!stall) {
    stall = await prisma.stall.create({
      data: {
        code: stallCode,
        marketId: market.id,
        consigneeId: consignee.id,
        active: true,
      },
    });
    console.log(`  created stall ${marketCode} ${stallCode}`);
  } else {
    await prisma.stall.update({
      where: { id: stall.id },
      data: { consigneeId: consignee.id },
    });
    console.log(`  linked stall ${marketCode} ${stallCode} -> consignee ${consigneeCode}`);
  }
  return stall;
}

async function bindShipperStall(
  shipperCode: string,
  marketCode: string,
  stallCode: string,
  consigneeCode: string,
  tongTypeId: string
) {
  const shipper = await requireShipper(shipperCode);
  const stall = await linkStallConsigneeByCode(marketCode, stallCode, consigneeCode);

  await prisma.shipperStallDefault.upsert({
    where: {
      shipperId_stallId: { shipperId: shipper.id, stallId: stall.id },
    },
    update: { tongTypeId },
    create: { shipperId: shipper.id, stallId: stall.id, tongTypeId },
  });

  console.log(
    `  bound ${shipperCode} + ${marketCode} ${stallCode} -> consignee ${consigneeCode}`
  );
  return stall;
}

async function upsertPaymentRelation(
  shipperCode: string,
  consigneeCode: string,
  paymentMode: "2" | "3"
) {
  const shipper = await requireShipper(shipperCode);
  const consignee = await requireConsignee(consigneeCode);

  await prisma.paymentRelation.upsert({
    where: {
      shipperId_consigneeId: {
        shipperId: shipper.id,
        consigneeId: consignee.id,
      },
    },
    update: { paymentMode },
    create: {
      shipperId: shipper.id,
      consigneeId: consignee.id,
      paymentMode,
    },
  });
  console.log(`  payment_relation ${shipperCode} + ${consigneeCode} mode ${paymentMode}`);
}

async function upsertConsigneeRate(
  consigneeCode: string,
  marketCode: string,
  rateTong: number
) {
  const consignee = await requireConsignee(consigneeCode);
  const market = await requireMarket(marketCode);

  await prisma.consigneeFreightRate.upsert({
    where: {
      consigneeId_marketId_effectiveDate: {
        consigneeId: consignee.id,
        marketId: market.id,
        effectiveDate: EFFECTIVE_DATE,
      },
    },
    update: { rateTong },
    create: {
      consigneeId: consignee.id,
      marketId: market.id,
      effectiveDate: EFFECTIVE_DATE,
      rateTong,
    },
  });
  console.log(`  consignee rate ${consigneeCode} ${marketCode} tong=${rateTong}`);
}

async function backfillInboundLineConsignees(shipperCode: string) {
  const shipper = await requireShipper(shipperCode);
  const defaults = await prisma.shipperStallDefault.findMany({
    where: { shipperId: shipper.id },
    include: { stall: { select: { id: true, consigneeId: true } } },
  });
  const consigneeByStall = new Map(
    defaults
      .filter((row) => row.stall.consigneeId)
      .map((row) => [row.stall.id, row.stall.consigneeId!])
  );

  let updated = 0;
  for (const [stallId, consigneeId] of consigneeByStall) {
    const result = await prisma.inboundLine.updateMany({
      where: {
        stallId,
        session: { shipperId: shipper.id },
        OR: [{ consigneeId: null }, { consigneeId: { not: consigneeId } }],
      },
      data: { consigneeId },
    });
    updated += result.count;
  }
  console.log(`  backfilled inbound_lines.consignee_id for ${shipperCode}: ${updated}`);
}

async function main() {
  console.log("=== Step 1: Merge SAKDA ===");
  await mergeShipper(["300-Y002"], "3002-S006");

  console.log("\n=== Step 2: Merge TATA ===");
  await mergeShipper(["3001/T006", "3001-T006"], "3001-010");

  console.log("\n=== Step 3: Rename TN + merge PU -> CH FISHERY ===");
  await prisma.shipper.updateMany({
    where: { code: "3001-011" },
    data: { name: "TN PHUKET" },
  });
  console.log("  renamed 3001-011 -> TN PHUKET");
  await mergeShipper(["3001/P030", "3001-P030"], "3001-C003");

  console.log("\n=== Step 4: Merge JIAB/JIT duplicates + bind stalls ===");
  await mergeShipper(["3001/J001", "3001-J001"], "3001-003");
  await mergeShipper(["3001/J002", "3001-J002"], "3001-004");

  const tongTypeId = await defaultTongTypeId();

  console.log("JIAB stall defaults:");
  await bindShipperStall("3001-003", "KL", "B53", "3002-L006", tongTypeId);
  await bindShipperStall("3001-003", "KL", "G36", "3002-L005", tongTypeId);
  await bindShipperStall("3001-003", "KL", "F56", "3002-L001", tongTypeId);
  await bindShipperStall("3001-003", "MC", "MC65", "3000-P001", tongTypeId);

  console.log("JIAB payment relations:");
  await upsertPaymentRelation("3001-003", "3002-L006", "2");
  await upsertPaymentRelation("3001-003", "3002-L005", "2");
  await upsertPaymentRelation("3001-003", "3002-L001", "2");
  await upsertPaymentRelation("3001-003", "3000-P001", "3");

  console.log("JIT RANONG stall defaults:");
  await bindShipperStall("3001-004", "KL", "A53", "3002-S003", tongTypeId);
  await bindShipperStall("3001-004", "KL", "B39", "3002-L004", tongTypeId);
  await bindShipperStall("3001-004", "KL", "D46", "3002-N001", tongTypeId);
  await bindShipperStall("3001-004", "KL", "F49", "3002-R001", tongTypeId);
  await bindShipperStall("3001-004", "A", "A43", "3002-S001", tongTypeId);
  await bindShipperStall("3001-004", "BM", "BM45", "3002-H001", tongTypeId);

  console.log("JIT RANONG payment relations:");
  await upsertPaymentRelation("3001-004", "3002-S003", "2");
  await upsertPaymentRelation("3001-004", "3002-L004", "2");
  await upsertPaymentRelation("3001-004", "3002-N001", "2");
  await upsertPaymentRelation("3001-004", "3002-R001", "2");
  await upsertPaymentRelation("3001-004", "3002-S001", "2");
  await upsertPaymentRelation("3001-004", "3002-H001", "2");

  await backfillInboundLineConsignees("3001-003");
  await backfillInboundLineConsignees("3001-004");

  console.log("Link JIAB June stall consignees:");
  await linkStallConsigneeByCode("KL", "B53", "3002-L006");
  await linkStallConsigneeByCode("KL", "G36", "3002-L005");
  await linkStallConsigneeByCode("KL", "F56", "3002-L001");
  await linkStallConsigneeByCode("MC", "IS14", "3000-P001");
  await linkStallConsigneeByCode("MC", "MC65", "3000-P001");

  console.log("\n=== Step 5: Consignee rates + payment relations ===");
  await upsertConsigneeRate("3002-N002", "KL", 40);
  await upsertPaymentRelation("3001-010", "3002-N002", "2");
  await linkStallConsigneeByCode("KL", "F40", "3002-N002");
  await upsertConsigneeRate("3002-F003", "KL", 40);
  await upsertPaymentRelation("3001-011", "3002-F003", "2");
  await linkStallConsigneeByCode("KL", "A56", "3002-F003");

  console.log("\n=== Step 6: Verify June 2026 missing-rate lines ===");
  const income = await aggregateOperationsIncome(2026, 6);
  console.log(
    JSON.stringify(
      {
        missingRateLineCount: income.missingRateLineCount,
        missingRateQuantity: income.missingRateQuantity,
        gapReasons: income.gapReasons,
        mode1aThb: income.mode1aThb,
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
