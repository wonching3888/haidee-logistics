import { isOtherMarket, sortMarkets } from "@/lib/markets";
import { decimalToNumber } from "@/lib/freight-rates";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import { prisma } from "@/lib/prisma";

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function buildRouteKey(markets: string[]) {
  return sortMarkets(
    markets.filter((code) => code && !isOtherMarket(code))
  ).join(" / ");
}

export async function aggregateDispatchOperationalCosts(
  year: number,
  month: number
) {
  const { start, end } = getMonthDateRange(year, month);

  const [markets, dispatches] = await Promise.all([
    prisma.market.findMany({
      where: { active: true },
      select: {
        code: true,
        tollFee: true,
        loadUnloadPerCrate: true,
        crateRentalPerCrate: true,
      },
    }),
    prisma.dispatchOrder.findMany({
      where: {
        status: { not: "cancelled" },
        date: { gte: start, lte: end },
      },
      select: {
        id: true,
        markets: true,
        lines: {
          select: {
            inboundLine: {
              select: {
                quantity: true,
                isBox: true,
                stall: {
                  select: {
                    market: {
                      select: { code: true },
                    },
                  },
                },
                tongType: {
                  select: {
                    trackInventory: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  const marketByCode = new Map(
    markets.map((market) => [market.code, market])
  );

  let tollFee = 0;
  let loadUnloadFee = 0;
  let crateRental = 0;
  let tripCount = 0;

  for (const dispatch of dispatches) {
    tripCount += 1;
    const visitedMarkets = new Set<string>();

    for (const code of dispatch.markets) {
      if (!code || isOtherMarket(code) || visitedMarkets.has(code)) continue;
      visitedMarkets.add(code);
      const market = marketByCode.get(code);
      if (!market) continue;
      tollFee += decimalToNumber(market.tollFee) ?? 0;
    }

    for (const line of dispatch.lines) {
      const inboundLine = line.inboundLine;
      const marketCode = inboundLine.stall.market?.code;
      if (!marketCode || isOtherMarket(marketCode)) continue;
      const market = marketByCode.get(marketCode);
      if (!market) continue;

      const quantity = inboundLine.quantity;
      loadUnloadFee +=
        quantity * (decimalToNumber(market.loadUnloadPerCrate) ?? 0);

      if (
        !inboundLine.isBox &&
        inboundLine.tongType.trackInventory === false
      ) {
        crateRental +=
          quantity * (decimalToNumber(market.crateRentalPerCrate) ?? 0);
      }
    }
  }

  return {
    tollFee: roundMoney(tollFee),
    loadUnloadFee: roundMoney(loadUnloadFee),
    crateRental: roundMoney(crateRental),
    tripCount,
    routeCount: new Set(
      dispatches.map((dispatch) => buildRouteKey(dispatch.markets))
    ).size,
  };
}
