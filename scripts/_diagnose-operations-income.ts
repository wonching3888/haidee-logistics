import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { resolveSessionPickupLocation } from "@/lib/constants/pickup-locations";
import { loadInboundFreightContext } from "@/lib/freight-context";
import {
  classifyInboundFreightGap,
  computeInboundLineFreight,
  normalizeMcDeliveryMode,
} from "@/lib/inbound-freight";
import { DEFAULT_EXCHANGE_RATE } from "@/lib/constants/freight-settings";
import { convertThbToMyr, decimalToNumber } from "@/lib/freight-rates";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import { aggregateOperationsIncome } from "@/lib/operations-income";

async function main() {
  const year = 2026;
  const month = 6;
  const { start, end } = getMonthDateRange(year, month);

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
      stallId: true,
      tongTypeId: true,
      quantity: true,
      isBox: true,
      mcDeliveryMode: true,
      freightRate: true,
      session: {
        select: {
          shipperId: true,
          pickupLocation: true,
          shipper: { select: { name: true, code: true, pickupLocation: true } },
        },
      },
      stall: { select: { market: { select: { code: true } } } },
      tongType: { select: { code: true, isBox: true } },
    },
  });

  const exchangeRateRow = await prisma.exchangeRate.findUnique({
    where: { yearMonth: "2026-06" },
  });
  const exchangeRate = decimalToNumber(exchangeRateRow?.rate) ?? DEFAULT_EXCHANGE_RATE;

  let totalQty = 0;
  let tongQty = 0;
  let withComputedRevenue = 0;
  let zeroRevenue = 0;
  const zeroReasons = new Map<string, number>();
  const samples: object[] = [];

  const linesByShipper = new Map<string, typeof lines>();
  for (const line of lines) {
    totalQty += line.quantity;
    if (!line.isBox) tongQty += line.quantity;
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

      const storedRate = decimalToNumber(line.freightRate);
      const amount = snapshot.freightAmount ?? 0;

      if (amount > 0) {
        withComputedRevenue += 1;
        continue;
      }

      zeroRevenue += 1;
      const reason =
        classifyInboundFreightGap(
          {
            stallId: line.stallId,
            tongTypeId: line.tongTypeId,
            quantity: line.quantity,
            mcDeliveryMode: normalizeMcDeliveryMode(marketCode, line.mcDeliveryMode),
          },
          ctx,
          snapshot
        ) ?? "unknown";

      zeroReasons.set(reason, (zeroReasons.get(reason) ?? 0) + 1);
      if (samples.length < 12) {
        const isBox = ctx.tongTypes.get(line.tongTypeId)?.isBox ?? line.isBox;
        samples.push({
          shipper: line.session.shipper.name,
          code: line.session.shipper.code,
          market: marketCode,
          tong: line.tongType.code,
          isBox,
          qty: line.quantity,
          mode: snapshot.paymentMode,
          storedFreightRate: storedRate,
          reason,
        });
      }
    }
  }

  const income = await aggregateOperationsIncome(year, month);
  const totalMyr =
    convertThbToMyr(income.mode1aThb, exchangeRate) +
    income.mode1bMyr +
    income.mode2Myr +
    income.wtlMode3Myr;

  console.log(
    JSON.stringify(
      {
        lineCount: lines.length,
        totalQuantity: totalQty,
        tongQuantityNonBox: tongQty,
        withRevenue: withComputedRevenue,
        zeroRevenue,
        zeroReasons: Object.fromEntries(zeroReasons),
        income,
        missingRateLineCount: income.missingRateLineCount,
        missingRateQuantity: income.missingRateQuantity,
        exchangeRate,
        totalMyrRounded: Math.round(totalMyr * 100) / 100,
        samples,
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
