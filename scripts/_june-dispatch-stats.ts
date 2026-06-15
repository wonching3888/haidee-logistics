import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { resolveSessionPickupLocation } from "@/lib/constants/pickup-locations";
import { loadInboundFreightContext } from "@/lib/freight-context";
import {
  computeInboundLineFreight,
  freightAmountMyrEquivalent,
  normalizeMcDeliveryMode,
} from "@/lib/inbound-freight";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import { aggregateOperationsIncome } from "@/lib/operations-income";
import { DEFAULT_EXCHANGE_RATE } from "@/lib/constants/freight-settings";
import { convertThbToMyr, decimalToNumber } from "@/lib/freight-rates";

async function main() {
  const year = 2026;
  const month = 6;
  const { start, end } = getMonthDateRange(year, month);

  const exchangeRateRow = await prisma.exchangeRate.findUnique({
    where: { yearMonth: "2026-06" },
  });
  const exchangeRate = decimalToNumber(exchangeRateRow?.rate) ?? DEFAULT_EXCHANGE_RATE;

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
      isBox: true,
      mcDeliveryMode: true,
      session: {
        select: {
          shipperId: true,
          pickupLocation: true,
          shipper: {
            select: {
              code: true,
              name: true,
              pickupLocation: true,
              currency: true,
            },
          },
        },
      },
    },
  });

  const modeQty: Record<string, number> = {
    "1a": 0,
    "1b": 0,
    "2": 0,
    "3": 0,
    other: 0,
    zero_revenue: 0,
  };
  const modeLines: Record<string, number> = {
    "1a": 0,
    "1b": 0,
    "2": 0,
    "3": 0,
    other: 0,
    zero_revenue: 0,
  };
  const mode1bSamples: object[] = [];
  const shipperRevenue = new Map<
    string,
    {
      code: string;
      name: string;
      mode1aThb: number;
      mode1bMyr: number;
      mode2Myr: number;
      mode3Myr: number;
      totalMyr: number;
      quantity: number;
    }
  >();

  let totalQuantity = 0;
  let tongQuantity = 0;

  const linesByShipper = new Map<string, typeof lines>();
  for (const line of lines) {
    totalQuantity += line.quantity;
    if (!line.isBox) tongQuantity += line.quantity;
    const group = linesByShipper.get(line.session.shipperId) ?? [];
    group.push(line);
    linesByShipper.set(line.session.shipperId, group);
  }

  for (const [shipperId, shipperLines] of Array.from(linesByShipper.entries())) {
    const shipper = shipperLines[0]!.session.shipper;
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

    let stats = shipperRevenue.get(shipperId);
    if (!stats) {
      stats = {
        code: shipper.code,
        name: shipper.name,
        mode1aThb: 0,
        mode1bMyr: 0,
        mode2Myr: 0,
        mode3Myr: 0,
        totalMyr: 0,
        quantity: 0,
      };
      shipperRevenue.set(shipperId, stats);
    }

    for (const line of shipperLines) {
      stats.quantity += line.quantity;
      const marketCode = ctx.stalls.get(line.stallId)?.marketCode ?? "";
      const snapshot = computeInboundLineFreight(
        {
          stallId: line.stallId,
          tongTypeId: line.tongTypeId,
          quantity: line.quantity,
          mcDeliveryMode: normalizeMcDeliveryMode(marketCode, line.mcDeliveryMode),
        },
        ctx
      );

      const mode = snapshot.paymentMode;
      const amount = snapshot.freightAmount ?? 0;

      if (amount <= 0) {
        modeQty.zero_revenue += line.quantity;
        modeLines.zero_revenue += 1;
        if (mode === "1b" && mode1bSamples.length < 10) {
          mode1bSamples.push({
            shipper: `${shipper.code} ${shipper.name}`,
            market: marketCode,
            qty: line.quantity,
            shipperCurrency: shipper.currency,
            freightRate: snapshot.freightRate,
            freightAmount: snapshot.freightAmount,
            currency: snapshot.currency,
          });
        }
        continue;
      }

      const modeKey =
        mode === "1a" || mode === "1b" || mode === "2" || mode === "3"
          ? mode
          : "other";
      modeQty[modeKey] += line.quantity;
      modeLines[modeKey] += 1;

      if (mode === "1a" && snapshot.currency === "THB") {
        stats.mode1aThb += amount;
      } else if (mode === "1b" && snapshot.currency === "MYR") {
        stats.mode1bMyr += amount;
      } else if (mode === "2" && snapshot.currency === "MYR") {
        stats.mode2Myr += amount;
      } else if (mode === "3" && snapshot.currency === "MYR") {
        stats.mode3Myr += amount;
      }

      const myr = freightAmountMyrEquivalent(snapshot) ?? 0;
      stats.totalMyr += myr;
    }
  }

  const income = await aggregateOperationsIncome(year, month);

  const shippersWithMyrCurrency = await prisma.shipper.findMany({
    where: { currency: "MYR" },
    select: { code: true, name: true, _count: { select: { freightRates: true } } },
  });

  const mode1bShippersInMaster = shippersWithMyrCurrency.filter(
    (s) => s._count.freightRates > 0
  );

  const top10 = Array.from(shipperRevenue.values())
    .filter((s) => s.totalMyr > 0)
    .sort((a, b) => b.totalMyr - a.totalMyr)
    .slice(0, 10)
    .map((s) => ({
      code: s.code,
      name: s.name,
      quantity: s.quantity,
      mode1aMyr: Math.round(convertThbToMyr(s.mode1aThb, exchangeRate) * 100) / 100,
      mode1bMyr: Math.round(s.mode1bMyr * 100) / 100,
      mode2Myr: Math.round(s.mode2Myr * 100) / 100,
      mode3Myr: Math.round(s.mode3Myr * 100) / 100,
      totalMyr: Math.round(s.totalMyr * 100) / 100,
    }));

  console.log(
    JSON.stringify(
      {
        summary: {
          lineCount: lines.length,
          totalQuantity,
          tongQuantityNonBox: tongQuantity,
          exchangeRate,
        },
        dashboardIncome: {
          mode1aThb: income.mode1aThb,
          mode1aMyr: Math.round(convertThbToMyr(income.mode1aThb, exchangeRate) * 100) / 100,
          mode1bMyr: income.mode1bMyr,
          mode2Myr: income.mode2Myr,
          wtlMode3Myr: income.wtlMode3Myr,
          haideeTotalMyr:
            Math.round(
              (convertThbToMyr(income.mode1aThb, exchangeRate) +
                income.mode1bMyr +
                income.mode2Myr) *
                100
            ) / 100,
          totalMyr:
            Math.round(
              (convertThbToMyr(income.mode1aThb, exchangeRate) +
                income.mode1bMyr +
                income.mode2Myr +
                income.wtlMode3Myr) *
                100
            ) / 100,
        },
        quantityByPaymentMode: {
          lines: modeLines,
          barrels: modeQty,
        },
        mode1bAnalysis: {
          revenueMyr: income.mode1bMyr,
          dispatchedBarrels: modeQty["1b"],
          dispatchedLines: modeLines["1b"],
          zeroRevenueMode1bSamples: mode1bSamples,
          myrShippersWithFreightRatesCount: mode1bShippersInMaster.length,
          myrShippersWithRatesSample: mode1bShippersInMaster.slice(0, 15).map((s) => s.code),
        },
        top10ShippersByRevenueMyr: top10,
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
