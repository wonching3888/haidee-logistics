import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { resolveSessionPickupLocation } from "@/lib/constants/pickup-locations";
import { loadInboundFreightContext } from "@/lib/freight-context";
import {
  computeInboundLineFreight,
  normalizeMcDeliveryMode,
} from "@/lib/inbound-freight";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import { aggregateOperationsIncome } from "@/lib/operations-income";

async function main() {
  const { start, end } = getMonthDateRange(2026, 6);

  const mode3Shippers = await prisma.paymentRelation.findMany({
    where: { paymentMode: "3" },
    include: {
      shipper: { select: { code: true, name: true } },
      consignee: { select: { code: true, name: true, billingCompany: true } },
    },
  });
  console.log("=== payment_relations mode 3 ===");
  for (const row of mode3Shippers) {
    console.log(
      `  ${row.shipper.code} ${row.shipper.name} + ${row.consignee.code} ${row.consignee.name} (${row.consignee.billingCompany})`
    );
  }

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
      id: true,
      quantity: true,
      mcDeliveryMode: true,
      paymentMode: true,
      freightAmount: true,
      currency: true,
      billingCompany: true,
      stallId: true,
      tongTypeId: true,
      session: {
        select: {
          shipperId: true,
          pickupLocation: true,
          shipper: { select: { code: true, name: true, pickupLocation: true } },
        },
      },
      stall: {
        select: {
          code: true,
          consigneeId: true,
          consignee: { select: { code: true, name: true, billingCompany: true } },
          market: { select: { code: true } },
        },
      },
    },
  });

  const mode3Lines: object[] = [];
  const linesByShipper = new Map<string, typeof lines>();

  for (const line of lines) {
    const group = linesByShipper.get(line.session.shipperId) ?? [];
    group.push(line);
    linesByShipper.set(line.session.shipperId, group);
  }

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
      const marketCode = ctx.stalls.get(line.stallId)?.marketCode ?? line.stall.market?.code ?? "";
      const snapshot = computeInboundLineFreight(
        {
          stallId: line.stallId,
          tongTypeId: line.tongTypeId,
          quantity: line.quantity,
          mcDeliveryMode: normalizeMcDeliveryMode(marketCode, line.mcDeliveryMode),
        },
        ctx
      );
      if (snapshot.paymentMode !== "3") continue;

      mode3Lines.push({
        shipper: `${line.session.shipper.code} ${line.session.shipper.name}`,
        market: marketCode,
        stall: line.stall.code,
        consignee: line.stall.consignee
          ? `${line.stall.consignee.code} ${line.stall.consignee.name}`
          : null,
        qty: line.quantity,
        mcDeliveryMode: line.mcDeliveryMode ?? "self",
        computed: {
          paymentMode: snapshot.paymentMode,
          currency: snapshot.currency,
          billingCompany: snapshot.billingCompany,
          freightRate: snapshot.freightRate,
          freightAmount: snapshot.freightAmount,
          thirdPartyFee: snapshot.thirdPartyFee,
        },
        stored: {
          paymentMode: line.paymentMode,
          freightAmount: line.freightAmount,
          billingCompany: line.billingCompany,
        },
      });
    }
  }

  console.log("\n=== June 2026 computed payment_mode = 3 lines ===");
  console.log(`count: ${mode3Lines.length}`);
  console.log(JSON.stringify(mode3Lines, null, 2));

  const income = await aggregateOperationsIncome(2026, 6);
  console.log("\n=== aggregateOperationsIncome ===");
  console.log(
    JSON.stringify(
      {
        wtlMode3Myr: income.wtlMode3Myr,
        mode2Myr: income.mode2Myr,
        gapReasons: income.gapReasons,
      },
      null,
      2
    )
  );

  const sophonJune = lines.filter((l) => l.session.shipper.code === "3001-008");
  console.log(`\nSOPHON (3001-008) June dispatched lines: ${sophonJune.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
