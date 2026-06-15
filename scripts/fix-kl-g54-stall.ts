import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { resolveSessionPickupLocation } from "@/lib/constants/pickup-locations";
import { loadInboundFreightContext } from "@/lib/freight-context";
import {
  classifyInboundFreightGap,
  computeInboundLineFreight,
  normalizeMcDeliveryMode,
} from "@/lib/inbound-freight";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import { aggregateOperationsIncome } from "@/lib/operations-income";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

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

async function linkStallConsignee(marketCode: string, stallCode: string, consigneeCode: string) {
  const market = await requireMarket(marketCode);
  const consignee = await requireConsignee(consigneeCode);
  const stall = await prisma.stall.findFirst({
    where: { marketId: market.id, code: stallCode, active: true },
  });
  if (!stall) throw new Error(`Stall not found: ${marketCode} ${stallCode}`);

  await prisma.stall.update({
    where: { id: stall.id },
    data: { consigneeId: consignee.id },
  });
  console.log(`  linked ${marketCode} ${stallCode} -> consignee ${consigneeCode}`);
  return stall;
}

async function upsertShipperStallDefault(
  shipperCode: string,
  marketCode: string,
  stallCode: string,
  consigneeCode: string,
  tongTypeId: string
) {
  const shipper = await requireShipper(shipperCode);
  const stall = await linkStallConsignee(marketCode, stallCode, consigneeCode);
  await prisma.shipperStallDefault.upsert({
    where: { shipperId_stallId: { shipperId: shipper.id, stallId: stall.id } },
    update: { tongTypeId },
    create: { shipperId: shipper.id, stallId: stall.id, tongTypeId },
  });
  console.log(`  shipper_stall_default ${shipperCode} + ${marketCode} ${stallCode}`);
}

async function upsertPaymentRelation(shipperCode: string, consigneeCode: string) {
  const shipper = await requireShipper(shipperCode);
  const consignee = await requireConsignee(consigneeCode);
  await prisma.paymentRelation.upsert({
    where: {
      shipperId_consigneeId: {
        shipperId: shipper.id,
        consigneeId: consignee.id,
      },
    },
    update: { paymentMode: "2" },
    create: {
      shipperId: shipper.id,
      consigneeId: consignee.id,
      paymentMode: "2",
    },
  });
  console.log(`  payment_relation ${shipperCode} + ${consigneeCode} mode 2`);
}

async function backfillInboundLineConsignees(shipperCode: string, stallId: string, consigneeId: string) {
  const shipper = await requireShipper(shipperCode);
  const result = await prisma.inboundLine.updateMany({
    where: {
      stallId,
      session: { shipperId: shipper.id },
      OR: [{ consigneeId: null }, { consigneeId: { not: consigneeId } }],
    },
    data: { consigneeId },
  });
  if (result.count > 0) {
    console.log(`  backfilled ${result.count} inbound_lines for ${shipperCode}`);
  }
}

async function listMissingBoxRateJune() {
  const { start, end } = getMonthDateRange(2026, 6);
  const lines = await prisma.inboundLine.findMany({
    where: {
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
      stallId: true,
      tongTypeId: true,
      quantity: true,
      mcDeliveryMode: true,
      isBox: true,
      session: {
        select: {
          shipperId: true,
          pickupLocation: true,
          shipper: { select: { name: true, code: true, pickupLocation: true } },
        },
      },
      stall: { select: { code: true, market: { select: { code: true } } } },
      tongType: { select: { code: true, isBox: true } },
    },
  });

  const linesByShipper = new Map<string, typeof lines>();
  for (const line of lines) {
    const group = linesByShipper.get(line.session.shipperId) ?? [];
    group.push(line);
    linesByShipper.set(line.session.shipperId, group);
  }

  const hits: object[] = [];
  for (const [shipperId, shipperLines] of Array.from(linesByShipper.entries())) {
    const stallIds = Array.from(new Set(shipperLines.map((l) => l.stallId)));
    const tongTypeIds = Array.from(new Set(shipperLines.map((l) => l.tongTypeId)));
    const pickupLocation = resolveSessionPickupLocation(
      shipperLines[0]?.session.pickupLocation,
      shipperLines[0]?.session.shipper.pickupLocation
    );
    const { ctx } = await loadInboundFreightContext(
      shipperId,
      stallIds,
      tongTypeIds,
      end,
      pickupLocation
    );

    for (const line of shipperLines) {
      const marketCode =
        ctx.stalls.get(line.stallId)?.marketCode ?? line.stall.market?.code ?? "";
      const input = {
        stallId: line.stallId,
        tongTypeId: line.tongTypeId,
        quantity: line.quantity,
        mcDeliveryMode: normalizeMcDeliveryMode(marketCode, line.mcDeliveryMode),
      };
      const snapshot = computeInboundLineFreight(input, ctx);
      const reason = classifyInboundFreightGap(input, ctx, snapshot);
      if (reason !== "shipper_missing_box_rate") continue;
      hits.push({
        shipperName: line.session.shipper.name,
        shipperCode: line.session.shipper.code,
        marketCode,
        stallCode: line.stall.code,
        tongType: line.tongType.code,
        isBox: line.tongType.isBox,
        quantity: line.quantity,
        paymentMode: snapshot.paymentMode,
      });
    }
  }

  console.log("\nshipper_missing_box_rate details:");
  console.log(JSON.stringify(hits, null, 2));
}

async function main() {
  const tongTypeId = await defaultTongTypeId();
  const consignee = await requireConsignee("3002-H002");

  console.log("=== Step 1: Bind KL G54 stall ===");
  const stall = await linkStallConsignee("KL", "G54", "3002-H002");

  console.log("\n=== Step 2: Shipper stall defaults + payment relations ===");
  const shippers = [
    "3001-P007",
    "3001-009",
    "3001-002",
    "3001-006",
  ] as const;

  for (const shipperCode of shippers) {
    await upsertShipperStallDefault(
      shipperCode,
      "KL",
      "G54",
      "3002-H002",
      tongTypeId
    );
    await upsertPaymentRelation(shipperCode, "3002-H002");
    await backfillInboundLineConsignees(shipperCode, stall.id, consignee.id);
  }

  console.log("\n=== Step 3: Missing box rate ===");
  await listMissingBoxRateJune();

  console.log("\n=== Step 4: Verify June 2026 missing-rate lines ===");
  const income = await aggregateOperationsIncome(2026, 6);
  console.log(
    JSON.stringify(
      {
        missingRateLineCount: income.missingRateLineCount,
        missingRateQuantity: income.missingRateQuantity,
        gapReasons: income.gapReasons,
        mode2Myr: income.mode2Myr,
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
