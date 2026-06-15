import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { parseDateInput } from "@/lib/date-utils";
import { WTL_SST_MULTIPLIER } from "@/lib/constants/freight-settings";
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

const WTL_SHIPPER_CODES = ["3000-B001", "3000-B002"] as const;

type ShipperWtlRate = {
  code: string;
  market: string;
  thaiTong?: number | null;
  thaiBox?: number | null;
  tong?: number | null;
  box?: number | null;
};

const WTL_SHIPPER_RATES: ShipperWtlRate[] = [
  { code: "3000-B001", market: "KL", thaiTong: 16, tong: 24 },
  { code: "3000-B001", market: "BP", thaiTong: 16, tong: 24 },
  {
    code: "3000-B002",
    market: "KL",
    thaiTong: 16,
    thaiBox: 8,
    tong: 20,
    box: 7,
  },
  { code: "3000-B002", market: "BP", thaiTong: 16, thaiBox: 8, tong: 20 },
  { code: "3000-B002", market: "MC", thaiTong: 16, thaiBox: 8, tong: 34 },
  { code: "3000-B002", market: "A", thaiTong: 16, thaiBox: 8, tong: 19 },
  { code: "3000-B002", market: "KD", thaiTong: 16, thaiBox: 8, tong: 16 },
];

async function runSchemaMigration() {
  const sql = readFileSync(
    join(process.cwd(), "prisma", "add-wtl-freight-rates.sql"),
    "utf8"
  );
  const statements = sql
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }
  console.log("Applied prisma/add-wtl-freight-rates.sql");
}

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

async function deleteWrongJbRates() {
  for (const code of WTL_SHIPPER_CODES) {
    const shipper = await requireShipper(code);
    const jb = await requireMarket("JB");
    const deleted = await prisma.freightRate.deleteMany({
      where: { shipperId: shipper.id, marketId: jb.id },
    });
    console.log(`  deleted ${deleted.count} JB rate(s) for ${code}`);
  }
}

async function upsertWtlShipperRate(row: ShipperWtlRate) {
  const shipper = await requireShipper(row.code);
  const market = await requireMarket(row.market);

  await prisma.freightRate.upsert({
    where: {
      shipperId_marketId_effectiveDate: {
        shipperId: shipper.id,
        marketId: market.id,
        effectiveDate: EFFECTIVE_DATE,
      },
    },
    update: {
      rateTongThai: row.thaiTong ?? null,
      rateBoxThai: row.thaiBox ?? null,
      rateTong: row.tong ?? null,
      rateBox: row.box ?? null,
      isWtl: true,
      sstApplicable: true,
      currency: "MYR",
    },
    create: {
      shipperId: shipper.id,
      marketId: market.id,
      effectiveDate: EFFECTIVE_DATE,
      rateTongThai: row.thaiTong ?? null,
      rateBoxThai: row.thaiBox ?? null,
      rateTong: row.tong ?? null,
      rateBox: row.box ?? null,
      isWtl: true,
      sstApplicable: true,
      currency: "MYR",
    },
  });
  console.log(
    `  WTL shipper ${row.code} ${row.market} TH tong=${row.thaiTong ?? "—"} box=${row.thaiBox ?? "—"} | MY tong=${row.tong ?? "—"} box=${row.box ?? "—"}`
  );
}

async function upsertNklConsigneeRate() {
  const consignee = await requireConsignee("3000-N001");
  const market = await requireMarket("NT");

  await prisma.consigneeFreightRate.upsert({
    where: {
      consigneeId_marketId_effectiveDate: {
        consigneeId: consignee.id,
        marketId: market.id,
        effectiveDate: EFFECTIVE_DATE,
      },
    },
    update: {
      rateBoxThai: 8,
      rateBox: 12,
      rateTong: null,
      rateTongThai: null,
      sstApplicable: true,
      permitPerTrip: 25,
    },
    create: {
      consigneeId: consignee.id,
      marketId: market.id,
      effectiveDate: EFFECTIVE_DATE,
      rateBoxThai: 8,
      rateBox: 12,
      sstApplicable: true,
      permitPerTrip: 25,
    },
  });
  console.log(
    "  NKL NT: thai_box=8, box=12 (+SST), permit_per_trip=25 (+SST)"
  );

  const jb = await requireMarket("JB");
  const removed = await prisma.consigneeFreightRate.deleteMany({
    where: { consigneeId: consignee.id, marketId: jb.id },
  });
  if (removed.count > 0) {
    console.log(`  removed ${removed.count} obsolete NKL JB consignee rate(s)`);
  }
}

async function upsertMcIs14ConsigneeRate() {
  const consignee = await requireConsignee("3000-P001");
  const market = await requireMarket("MC");

  await prisma.consigneeFreightRate.upsert({
    where: {
      consigneeId_marketId_effectiveDate: {
        consigneeId: consignee.id,
        marketId: market.id,
        effectiveDate: EFFECTIVE_DATE,
      },
    },
    update: {
      rateTong: 42.45,
      rateBox: null,
      rateTongThai: null,
      rateBoxThai: null,
      sstApplicable: true,
      permitPerTrip: null,
    },
    create: {
      consigneeId: consignee.id,
      marketId: market.id,
      effectiveDate: EFFECTIVE_DATE,
      rateTong: 42.45,
      sstApplicable: true,
    },
  });
  console.log("  MC IS14 (3000-P001) MC tong=42.45 (+SST)");
}

async function markWtlShippers() {
  const updated = await prisma.shipper.updateMany({
    where: { code: { in: [...WTL_SHIPPER_CODES] } },
    data: { company: "wtl", currency: "MYR" },
  });
  console.log(`  marked ${updated.count} shipper(s) company=wtl`);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

async function verifyWtlShipper(code: string) {
  const shipper = await requireShipper(code);
  const sampleMarket = code === "3000-B001" ? "KL" : "KL";
  const market = await requireMarket(sampleMarket);
  const stall = await prisma.stall.findFirst({
    where: { marketId: market.id, active: true },
    select: { id: true, code: true },
  });
  const tongType = await prisma.tongType.findFirst({
    where: { isBox: false, active: true },
    select: { id: true },
  });
  if (!stall || !tongType) {
    throw new Error(`Missing stall/tong type for ${code} verification`);
  }

  const quantity = 10;
  const { ctx } = await loadInboundFreightContext(
    shipper.id,
    [stall.id],
    [tongType.id],
    EFFECTIVE_DATE,
    "SADAO"
  );
  const snapshot = computeInboundLineFreight(
    {
      stallId: stall.id,
      tongTypeId: tongType.id,
      quantity,
      mcDeliveryMode: null,
    },
    ctx
  );

  return {
    code,
    stall: stall.code,
    market: sampleMarket,
    quantity,
    paymentMode: snapshot.paymentMode,
    billingCompany: snapshot.billingCompany,
    thFreightAmount: snapshot.thFreightAmount,
    mySegmentFreightAmount: snapshot.mySegmentFreightAmount,
    freightAmount: snapshot.freightAmount,
  };
}

async function verifyNklJune() {
  const { start, end } = getMonthDateRange(2026, 6);
  const shipper = await prisma.shipper.findFirst({
    where: { code: "3001-008" },
    select: { id: true, code: true },
  });
  if (!shipper) return { note: "SOPHON not found" };

  const lines = await prisma.inboundLine.findMany({
    where: {
      session: { shipperId: shipper.id },
      dispatchStatus: "assigned",
      stall: { consignee: { code: "3000-N001" } },
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
      quantity: true,
      stallId: true,
      tongTypeId: true,
      mcDeliveryMode: true,
      session: {
        select: {
          pickupLocation: true,
          shipper: { select: { pickupLocation: true } },
        },
      },
      stall: { select: { market: { select: { code: true } } } },
    },
    take: 3,
  });

  if (lines.length === 0) {
    return { note: "No June SOPHON→NKL dispatched lines; logic-only check skipped" };
  }

  const { ctx } = await loadInboundFreightContext(
    shipper.id,
    Array.from(new Set(lines.map((line) => line.stallId))),
    Array.from(new Set(lines.map((line) => line.tongTypeId))),
    end,
    resolveSessionPickupLocation(
      lines[0]?.session.pickupLocation,
      lines[0]?.session.shipper.pickupLocation
    )
  );

  return lines.map((line) => {
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
    return {
      qty: line.quantity,
      paymentMode: snapshot.paymentMode,
      thFreightAmount: snapshot.thFreightAmount,
      mySegmentFreightAmount: snapshot.mySegmentFreightAmount,
      freightAmount: snapshot.freightAmount,
    };
  });
}

async function main() {
  console.log("\n=== Step 1: Schema migration ===");
  await runSchemaMigration();

  const beforeIncome = await aggregateOperationsIncome(2026, 6);
  console.log("Before missing-rate lines:", beforeIncome.missingRateLineCount);

  console.log("\n=== Step 2: Delete wrong JB rates ===");
  await deleteWrongJbRates();

  console.log("\n=== Step 3: Upsert WTL shipper rates ===");
  for (const row of WTL_SHIPPER_RATES) {
    await upsertWtlShipperRate(row);
  }

  console.log("\n=== Step 4: Upsert WTL consignee rates ===");
  await upsertNklConsigneeRate();
  await upsertMcIs14ConsigneeRate();

  console.log("\n=== Step 5: Mark WTL shippers ===");
  await markWtlShippers();

  console.log("\n=== Verification ===");
  const shipperChecks = [];
  for (const code of WTL_SHIPPER_CODES) {
    shipperChecks.push(await verifyWtlShipper(code));
  }
  const nklCheck = await verifyNklJune();
  const afterIncome = await aggregateOperationsIncome(2026, 6);

  console.log(
    JSON.stringify(
      {
        shipperChecks,
        nklCheck,
        income: {
          beforeMissing: beforeIncome.missingRateLineCount,
          afterMissing: afterIncome.missingRateLineCount,
          mode1aThb: afterIncome.mode1aThb,
          mode1bMyr: afterIncome.mode1bMyr,
          wtlMode3Myr: afterIncome.wtlMode3Myr,
        },
        expectedBestBrotherKlPerCrate: roundMoney(16 + 20 * WTL_SST_MULTIPLIER),
        expectedBestBrotherKlTotal10: roundMoney((16 + 20 * WTL_SST_MULTIPLIER) * 10),
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
