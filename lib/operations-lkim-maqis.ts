import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/freight-rates";
import { listGlobalCostSettings } from "@/lib/global-cost-settings-service";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";

const DEFAULT_LKIM_MAQIS_RATE_CRATE_MYR = 2.5;
const DEFAULT_LKIM_MAQIS_RATE_BOX_MYR = 1.0;

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
      select: { quantity: true, tongType: { select: { isBox: true } } },
    }),
  ]);

  const ratePerCrate =
    globalCosts.find((row) => row.key === "lkim_maqis_per_crate")?.valueMyr ??
    DEFAULT_LKIM_MAQIS_RATE_CRATE_MYR;
  const ratePerBox =
    globalCosts.find((row) => row.key === "lkim_maqis_per_box")?.valueMyr ??
    DEFAULT_LKIM_MAQIS_RATE_BOX_MYR;

  const totals = lines.reduce(
    (acc, line) => {
      const qty = decimalToNumber(line.quantity) ?? 0;
      if (line.tongType?.isBox) {
        acc.totalBoxes += qty;
      } else {
        acc.totalCrates += qty;
      }
      return acc;
    },
    { totalCrates: 0, totalBoxes: 0 }
  );

  const totalAmountMyr = roundMoney(
    totals.totalCrates * ratePerCrate + totals.totalBoxes * ratePerBox
  );

  return {
    totalAmountMyr,
    totalCrates: totals.totalCrates,
    totalBoxes: totals.totalBoxes,
    ratePerCrate,
    ratePerBox,
  };
}
