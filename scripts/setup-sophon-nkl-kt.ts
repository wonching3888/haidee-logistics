import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { parseDateInput } from "@/lib/date-utils";
import { resolveSessionPickupLocation } from "@/lib/constants/pickup-locations";
import { loadInboundFreightContext } from "@/lib/freight-context";
import {
  classifyInboundFreightGap,
  computeInboundLineFreight,
  normalizeMcDeliveryMode,
} from "@/lib/inbound-freight";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import { aggregateOperationsIncome } from "@/lib/operations-income";
import { WTL_SST_MULTIPLIER } from "@/lib/constants/freight-settings";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const SHIPPER_CODE = "3001-008";
const CONSIGNEE_CODE = "3000-N001";
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

async function linkStallConsignee(
  marketCode: string,
  stallCode: string,
  consigneeCode: string
) {
  const market = await requireMarket(marketCode);
  const consignee = await requireConsignee(consigneeCode);
  const stall = await prisma.stall.findFirst({
    where: { marketId: market.id, code: stallCode },
  });
  if (!stall) throw new Error(`Stall not found: ${marketCode} ${stallCode}`);

  await prisma.stall.update({
    where: { id: stall.id },
    data: { consigneeId: consignee.id },
  });
  console.log(`  linked stall ${marketCode}/${stallCode} -> ${consigneeCode}`);
  return stall;
}

async function upsertPaymentRelation() {
  const shipper = await requireShipper(SHIPPER_CODE);
  const consignee = await requireConsignee(CONSIGNEE_CODE);

  await prisma.paymentRelation.upsert({
    where: {
      shipperId_consigneeId: {
        shipperId: shipper.id,
        consigneeId: consignee.id,
      },
    },
    update: { paymentMode: "3" },
    create: {
      shipperId: shipper.id,
      consigneeId: consignee.id,
      paymentMode: "3",
    },
  });
  console.log(`  payment_relation ${SHIPPER_CODE} + ${CONSIGNEE_CODE} mode 3`);
}

async function upsertNklKtRate() {
  const consignee = await requireConsignee(CONSIGNEE_CODE);
  const market = await requireMarket("KT");

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
      permitPerTrip: null,
    },
    create: {
      consigneeId: consignee.id,
      marketId: market.id,
      effectiveDate: EFFECTIVE_DATE,
      rateBoxThai: 8,
      rateBox: 12,
      sstApplicable: true,
    },
  });
  console.log(
    "  NKL KT rate: thai_box=8 MYR, box=12 MYR (+SST), same as NT box tariff"
  );
}

async function verifySophonKtJune() {
  const { start, end } = getMonthDateRange(2026, 6);
  const shipper = await requireShipper(SHIPPER_CODE);

  const lines = await prisma.inboundLine.findMany({
    where: {
      session: { shipperId: shipper.id },
      stall: { market: { code: "KT" } },
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
      stall: {
        select: {
          code: true,
          consignee: { select: { code: true, name: true } },
          market: { select: { code: true } },
        },
      },
      tongType: { select: { code: true, isBox: true } },
      session: {
        select: {
          pickupLocation: true,
          shipper: { select: { pickupLocation: true } },
        },
      },
    },
  });

  if (lines.length === 0) {
    return { note: "No June SOPHON KT dispatched lines" };
  }

  const pickupLocation = resolveSessionPickupLocation(
    lines[0]?.session.pickupLocation,
    lines[0]?.session.shipper.pickupLocation
  );
  const { ctx } = await loadInboundFreightContext(
    shipper.id,
    Array.from(new Set(lines.map((l) => l.stallId))),
    Array.from(new Set(lines.map((l) => l.tongTypeId))),
    end,
    pickupLocation
  );

  const perCrateMyr = 8 + 12 * WTL_SST_MULTIPLIER;
  const details = lines.map((line) => {
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
    const gap = classifyInboundFreightGap(
      {
        stallId: line.stallId,
        tongTypeId: line.tongTypeId,
        quantity: line.quantity,
        mcDeliveryMode: normalizeMcDeliveryMode(marketCode, line.mcDeliveryMode),
      },
      ctx,
      snapshot
    );
    return {
      stall: line.stall.code,
      consignee: line.stall.consignee?.code ?? null,
      tong: line.tongType.code,
      quantity: line.quantity,
      paymentMode: snapshot.paymentMode,
      paymentParty: snapshot.paymentParty,
      billingCompany: snapshot.billingCompany,
      thSegmentMyr: snapshot.thFreightAmount,
      mySegmentMyr: snapshot.mySegmentFreightAmount,
      totalMyr: snapshot.freightAmount,
      gapReason: gap,
      expectedTotal: Math.round(line.quantity * perCrateMyr * 100) / 100,
    };
  });

  const income = await aggregateOperationsIncome(2026, 6);
  return { details, incomeMissing: income.missingRateLineCount, wtlMode3Myr: income.wtlMode3Myr };
}

async function main() {
  console.log("\n=== Step 1: payment_relation SOPHON + NKL mode 3 ===");
  await upsertPaymentRelation();

  console.log("\n=== Step 2: link KT stall NKL -> consignee 3000-N001 ===");
  await linkStallConsignee("KT", "NKL", CONSIGNEE_CODE);

  console.log("\n=== Step 3: NKL consignee_freight_rates for KT ===");
  await upsertNklKtRate();

  console.log("\n=== Verification ===");
  const verification = await verifySophonKtJune();
  console.log(JSON.stringify(verification, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
