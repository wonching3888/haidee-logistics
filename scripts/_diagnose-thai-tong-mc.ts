import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import { resolveSessionPickupLocation } from "@/lib/constants/pickup-locations";
import { loadInboundFreightContext } from "@/lib/freight-context";
import {
  classifyInboundFreightGap,
  computeInboundLineFreight,
  normalizeMcDeliveryMode,
} from "@/lib/inbound-freight";

async function main() {
  const shipper = await prisma.shipper.findUnique({
    where: { code: "3001-T003" },
    include: {
      freightRates: { include: { market: { select: { code: true } } } },
    },
  });
  console.log("shipper:", shipper?.name, shipper?.code, shipper?.currency);
  console.log(
    "freight_rates:",
    shipper?.freightRates.map((r) => ({
      market: r.market.code,
      tong: r.rateTong,
      box: r.rateBox,
      currency: r.currency,
      effectiveDate: r.effectiveDate,
    }))
  );

  const mcMarket = await prisma.market.findUnique({ where: { code: "MC" } });
  const allMcRates = await prisma.freightRate.findMany({
    where: { marketId: mcMarket?.id },
    include: { shipper: { select: { code: true, name: true } } },
    take: 5,
  });
  console.log("\nSample MC rates from other shippers:", allMcRates.map((r) => ({
    shipper: r.shipper.code,
    tong: r.rateTong,
    currency: r.currency,
  })));

  const { start, end } = getMonthDateRange(2026, 6);
  const lines = await prisma.inboundLine.findMany({
    where: {
      session: { shipperId: shipper?.id },
      dispatchStatus: "assigned",
      stall: { market: { code: "MC" } },
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
      mcDeliveryMode: true,
      stallId: true,
      tongTypeId: true,
      stall: { select: { code: true, market: { select: { code: true } } } },
      tongType: { select: { code: true, isBox: true } },
      session: {
        select: {
          pickupLocation: true,
          shipper: { select: { pickupLocation: true } },
        },
      },
    },
  });

  console.log("\nJune MC dispatched lines:", lines);

  if (shipper && lines.length > 0) {
    const { ctx } = await loadInboundFreightContext(
      shipper.id,
      lines.map((l) => l.stallId),
      lines.map((l) => l.tongTypeId),
      end,
      resolveSessionPickupLocation(
        lines[0]?.session.pickupLocation,
        lines[0]?.session.shipper.pickupLocation
      )
    );
    for (const line of lines) {
      const marketCode = "MC";
      const input = {
        stallId: line.stallId,
        tongTypeId: line.tongTypeId,
        quantity: line.quantity,
        mcDeliveryMode: normalizeMcDeliveryMode(marketCode, line.mcDeliveryMode),
      };
      const snap = computeInboundLineFreight(input, ctx);
      const gap = classifyInboundFreightGap(input, ctx, snap);
      console.log("\ncomputed:", snap, "gap:", gap);
    }
  }
}

main().finally(() => prisma.$disconnect());
