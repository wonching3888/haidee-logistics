import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { resolveSessionPickupLocation } from "@/lib/constants/pickup-locations";
import { loadInboundFreightContext } from "@/lib/freight-context";
import {
  computeInboundLineFreight,
  normalizeMcDeliveryMode,
} from "@/lib/inbound-freight";
import { convertThbToMyr, decimalToNumber } from "@/lib/freight-rates";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import { DEFAULT_EXCHANGE_RATE } from "@/lib/constants/freight-settings";

async function main() {
  const year = 2026;
  const month = 6;
  const { start, end } = getMonthDateRange(year, month);

  const allShippers = await prisma.shipper.findMany({
    select: { id: true, code: true, name: true, _count: { select: { freightRates: true } } },
  });
  const byName = new Map<string, typeof allShippers>();
  for (const s of allShippers) {
    const key = s.name.trim().toUpperCase();
    const g = byName.get(key) ?? [];
    g.push(s);
    byName.set(key, g);
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
      stallId: true,
      tongTypeId: true,
      quantity: true,
      mcDeliveryMode: true,
      session: {
        select: {
          shipperId: true,
          pickupLocation: true,
          shipper: { select: { name: true, code: true, pickupLocation: true } },
        },
      },
    },
  });

  const exchangeRateRow = await prisma.exchangeRate.findUnique({
    where: { yearMonth: "2026-06" },
  });
  const exchangeRate = decimalToNumber(exchangeRateRow?.rate) ?? DEFAULT_EXCHANGE_RATE;

  let extraThb = 0;
  let extraMyr = 0;
  let fixedBySibling = 0;

  const linesByShipper = new Map<string, typeof lines>();
  for (const line of lines) {
    const g = linesByShipper.get(line.session.shipperId) ?? [];
    g.push(line);
    linesByShipper.set(line.session.shipperId, g);
  }

  for (const [shipperId, shipperLines] of Array.from(linesByShipper.entries())) {
    const shipper = shipperLines[0]!.session.shipper;
    const siblings = byName.get(shipper.name.trim().toUpperCase()) ?? [];
    const siblingWithRates = siblings.find((s) => s._count.freightRates > 0 && s.id !== shipperId);

    const stallIds = Array.from(new Set(shipperLines.map((l) => l.stallId)));
    const tongTypeIds = Array.from(new Set(shipperLines.map((l) => l.tongTypeId)));
    const pickupLocation = resolveSessionPickupLocation(
      shipperLines[0]?.session.pickupLocation,
      shipper.pickupLocation
    );

    const { ctx } = await loadInboundFreightContext(
      shipperId,
      stallIds,
      tongTypeIds,
      end,
      pickupLocation
    );

    let siblingCtx = ctx;
    if (siblingWithRates) {
      const loaded = await loadInboundFreightContext(
        siblingWithRates.id,
        stallIds,
        tongTypeIds,
        end,
        pickupLocation
      );
      siblingCtx = {
        ...ctx,
        shipperRatesByMarket: loaded.ctx.shipperRatesByMarket,
        paymentRelations: new Map([
          ...Array.from(loaded.ctx.paymentRelations.entries()),
          ...Array.from(ctx.paymentRelations.entries()),
        ]),
      };
    }

    for (const line of shipperLines) {
      const marketCode = ctx.stalls.get(line.stallId)?.marketCode ?? "";
      const current = computeInboundLineFreight(
        {
          stallId: line.stallId,
          tongTypeId: line.tongTypeId,
          quantity: line.quantity,
          mcDeliveryMode: normalizeMcDeliveryMode(marketCode, line.mcDeliveryMode),
        },
        ctx
      );
      if ((current.freightAmount ?? 0) > 0) continue;

      if (!siblingWithRates) continue;

      const alt = computeInboundLineFreight(
        {
          stallId: line.stallId,
          tongTypeId: line.tongTypeId,
          quantity: line.quantity,
          mcDeliveryMode: normalizeMcDeliveryMode(marketCode, line.mcDeliveryMode),
        },
        siblingCtx
      );
      const amt = alt.freightAmount ?? 0;
      if (amt <= 0) continue;
      fixedBySibling += 1;
      if (alt.currency === "THB") extraThb += amt;
      else extraMyr += amt;
    }
  }

  console.log({
    fixedBySibling,
    extraThb,
    extraMyr,
    extraMyrFromThb: convertThbToMyr(extraThb, exchangeRate),
    totalExtraMyr: convertThbToMyr(extraThb, exchangeRate) + extraMyr,
  });
}

main().finally(() => prisma.$disconnect());
