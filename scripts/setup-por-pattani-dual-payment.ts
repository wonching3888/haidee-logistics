import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { parseDateInput } from "@/lib/date-utils";
import { resolveSessionPickupLocation } from "@/lib/constants/pickup-locations";
import { loadInboundFreightContext } from "@/lib/freight-context";
import {
  computeInboundLineFreight,
  normalizeMcDeliveryMode,
} from "@/lib/inbound-freight";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import { aggregateOperationsIncome } from "@/lib/operations-income";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const EFFECTIVE_DATE = parseDateInput("2026-06-15");
const SHIPPER_CODE = "3001-P004";
const CONSIGNEE_CODE = "3000-P001";

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

async function runSchemaMigration() {
  const sql = readFileSync(
    join(process.cwd(), "prisma", "add-dual-payment.sql"),
    "utf8"
  );
  const statements = sql
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }
  console.log("Applied prisma/add-dual-payment.sql");
}

async function upsertShipperRate(
  code: string,
  market: string,
  tong: number,
  currency: string
) {
  const shipper = await requireShipper(code);
  const marketRow = await requireMarket(market);

  await prisma.freightRate.upsert({
    where: {
      shipperId_marketId_effectiveDate: {
        shipperId: shipper.id,
        marketId: marketRow.id,
        effectiveDate: EFFECTIVE_DATE,
      },
    },
    update: { rateTong: tong, currency },
    create: {
      shipperId: shipper.id,
      marketId: marketRow.id,
      effectiveDate: EFFECTIVE_DATE,
      rateTong: tong,
      currency,
    },
  });
  console.log(`  shipper rate ${code} ${market} tong=${tong} ${currency}`);
}

async function upsertConsigneeRate(code: string, market: string, tong: number) {
  const consignee = await requireConsignee(code);
  const marketRow = await requireMarket(market);

  await prisma.consigneeFreightRate.upsert({
    where: {
      consigneeId_marketId_effectiveDate: {
        consigneeId: consignee.id,
        marketId: marketRow.id,
        effectiveDate: EFFECTIVE_DATE,
      },
    },
    update: { rateTong: tong },
    create: {
      consigneeId: consignee.id,
      marketId: marketRow.id,
      effectiveDate: EFFECTIVE_DATE,
      rateTong: tong,
    },
  });
  console.log(`  consignee rate ${code} ${market} tong=${tong} MYR`);
}

async function upsertDualPaymentRelation() {
  const shipper = await requireShipper(SHIPPER_CODE);
  const consignee = await requireConsignee(CONSIGNEE_CODE);

  await prisma.paymentRelation.upsert({
    where: {
      shipperId_consigneeId: {
        shipperId: shipper.id,
        consigneeId: consignee.id,
      },
    },
    update: {
      paymentMode: "1a",
      dualPayment: true,
      secondaryConsigneeId: consignee.id,
      secondaryPaymentMode: "3",
    },
    create: {
      shipperId: shipper.id,
      consigneeId: consignee.id,
      paymentMode: "1a",
      dualPayment: true,
      secondaryConsigneeId: consignee.id,
      secondaryPaymentMode: "3",
    },
  });
  console.log(
    `  payment_relation ${SHIPPER_CODE} + ${CONSIGNEE_CODE} dual_payment=true (1a + WTL 3)`
  );
}

async function verifyDualPaymentLogic(shipperId: string) {
  const consignee = await requireConsignee(CONSIGNEE_CODE);
  const stall = await prisma.stall.findFirst({
    where: {
      consigneeId: consignee.id,
      market: { code: "MC" },
      active: true,
    },
    select: { id: true, code: true },
  });
  const tongType = await prisma.tongType.findFirst({
    where: { isBox: false, active: true },
    select: { id: true },
  });
  if (!stall || !tongType) {
    throw new Error("Missing MC stall or tong type for logic verification");
  }

  const quantity = 10;
  const { ctx } = await loadInboundFreightContext(
    shipperId,
    [stall.id],
    [tongType.id],
    parseDateInput("2026-06-15"),
    "SADAO"
  );
  const snapshot = computeInboundLineFreight(
    {
      stallId: stall.id,
      tongTypeId: tongType.id,
      quantity,
      mcDeliveryMode: "self",
    },
    ctx
  );

  return {
    stall: stall.code,
    quantity,
    paymentMode: snapshot.paymentMode,
    mode1aThb: snapshot.freightAmount,
    wtlMyr: snapshot.dualPaymentWtlAmount,
    expectedMode1aThb: quantity * 50,
    expectedWtlMyr: roundMoney(quantity * 42.45),
    crateCountNotDoubled: quantity,
  };
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

async function verifyPorPattaniJune() {
  const { start, end } = getMonthDateRange(2026, 6);
  const shipper = await requireShipper(SHIPPER_CODE);

  const lines = await prisma.inboundLine.findMany({
    where: {
      session: { shipperId: shipper.id },
      dispatchStatus: "assigned",
      dispatchLines: {
        some: {
          dispatchOrder: {
            date: { gte: start, lte: end },
            status: { notIn: ["draft", "cancelled"] },
          },
        },
      },
    },
    select: {
      id: true,
      quantity: true,
      mcDeliveryMode: true,
      stallId: true,
      tongTypeId: true,
      stall: { select: { code: true, market: { select: { code: true } } } },
      session: {
        select: {
          pickupLocation: true,
          shipper: { select: { pickupLocation: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const stallIds = Array.from(new Set(lines.map((line) => line.stallId)));
  const tongTypeIds = Array.from(new Set(lines.map((line) => line.tongTypeId)));
  const pickupLocation = resolveSessionPickupLocation(
    lines[0]?.session.pickupLocation,
    lines[0]?.session.shipper.pickupLocation
  );
  const { ctx } = await loadInboundFreightContext(
    shipper.id,
    stallIds,
    tongTypeIds,
    end,
    pickupLocation
  );

  let totalQty = 0;
  let mode1aThb = 0;
  let wtlMyr = 0;
  const details: object[] = [];

  for (const line of lines) {
    const marketCode = line.stall.market?.code ?? "";
    const snapshot = computeInboundLineFreight(
      {
        stallId: line.stallId,
        tongTypeId: line.tongTypeId,
        quantity: line.quantity,
        mcDeliveryMode: normalizeMcDeliveryMode(marketCode, line.mcDeliveryMode),
      },
      ctx
    );

    totalQty += line.quantity;
    mode1aThb += snapshot.freightAmount ?? 0;
    wtlMyr += snapshot.dualPaymentWtlAmount ?? 0;

    details.push({
      stall: line.stall.code,
      market: marketCode,
      quantity: line.quantity,
      paymentMode: snapshot.paymentMode,
      mode1aThb: snapshot.freightAmount,
      wtlMyr: snapshot.dualPaymentWtlAmount,
      freightRate: snapshot.freightRate,
      wtlRate: snapshot.dualPaymentWtlRate,
    });
  }

  const income = await aggregateOperationsIncome(2026, 6);
  const logicCheck = await verifyDualPaymentLogic(shipper.id);

  return {
    lineCount: lines.length,
    totalQty,
    computedMode1aThb: Math.round(mode1aThb * 100) / 100,
    computedWtlMyr: Math.round(wtlMyr * 100) / 100,
    expectedMode1aThb: totalQty * 50,
    expectedWtlMyr: Math.round(totalQty * 42.45 * 100) / 100,
    crateCountNotDoubled: totalQty,
    details,
    logicCheck,
    note:
      lines.length === 0
        ? "No June dispatched lines for POR PATTANI in DB; logicCheck validates dual payment computation."
        : undefined,
    aggregateIncome: {
      mode1aThb: income.mode1aThb,
      wtlMode3Myr: income.wtlMode3Myr,
    },
  };
}

async function main() {
  console.log("\n=== Step 1: Schema migration ===");
  await runSchemaMigration();

  const beforeIncome = await aggregateOperationsIncome(2026, 6);
  console.log("Before income warning lines:", beforeIncome.missingRateLineCount);

  console.log("\n=== Step 2: Update POR PATTANI name ===");
  const updated = await prisma.shipper.update({
    where: { code: SHIPPER_CODE },
    data: { name: "POR PATTANI" },
  });
  console.log(`  ${SHIPPER_CODE} -> ${updated.name}`);

  console.log("\n=== Step 3: Upsert freight rates ===");
  await upsertShipperRate(SHIPPER_CODE, "MC", 50, "THB");
  await upsertConsigneeRate(CONSIGNEE_CODE, "MC", 42.45);

  console.log("\n=== Step 4: Upsert dual payment relation ===");
  await upsertDualPaymentRelation();

  console.log("\n=== Step 5: Verify June POR PATTANI ===");
  const verification = await verifyPorPattaniJune();
  console.log(JSON.stringify(verification, null, 2));

  const afterIncome = await aggregateOperationsIncome(2026, 6);
  console.log("\nAfter income warning lines:", afterIncome.missingRateLineCount);
  console.log(
    "Warning reduced by:",
    beforeIncome.missingRateLineCount - afterIncome.missingRateLineCount
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
