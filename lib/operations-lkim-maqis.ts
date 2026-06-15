import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/freight-rates";
import { listGlobalCostSettings } from "@/lib/global-cost-settings-service";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";

const DEFAULT_LKIM_MAQIS_RATE_MYR = 2.5;

function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export async function aggregateLkimMaqisCost(year: number, month: number) {
  const { start, end } = getMonthDateRange(year, month);

  const [globalCosts, lines] = await Promise.all([
    listGlobalCostSettings(),
    prisma.inboundLine.findMany({
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
      select: { quantity: true },
    }),
  ]);

  const ratePerCrate =
    globalCosts.find((row) => row.key === "lkim_maqis_per_crate")?.valueMyr ??
    DEFAULT_LKIM_MAQIS_RATE_MYR;

  const totalCrates = lines.reduce(
    (sum, line) => sum + (decimalToNumber(line.quantity) ?? 0),
    0
  );

  const totalAmountMyr = roundMoney(totalCrates * ratePerCrate);

  return {
    totalAmountMyr,
    totalCrates,
    ratePerCrate,
  };
}
