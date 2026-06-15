import { prisma } from "@/lib/prisma";
import { listGlobalCostSettings } from "@/lib/global-cost-settings-service";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";

const DEFAULT_LKIM_MAQIS_RATE_MYR = 2.5;

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export async function aggregateLkimMaqisCost(year: number, month: number) {
  const { start, end } = getMonthDateRange(year, month);

  const [globalCosts, dispatchLines] = await Promise.all([
    listGlobalCostSettings(),
    prisma.dispatchLine.findMany({
      where: {
        dispatchOrder: {
          status: { not: "cancelled" },
          date: { gte: start, lte: end },
        },
      },
      select: {
        inboundLine: {
          select: { quantity: true },
        },
      },
    }),
  ]);

  const ratePerCrate =
    globalCosts.find((row) => row.key === "lkim_maqis_per_crate")?.valueMyr ??
    DEFAULT_LKIM_MAQIS_RATE_MYR;

  const totalCrates = dispatchLines.reduce(
    (sum, line) => sum + line.inboundLine.quantity,
    0
  );

  return {
    amountMyr: roundMoney(totalCrates * ratePerCrate),
    totalCrates,
    ratePerCrate,
  };
}
