import { decimalToNumber } from "@/lib/freight-rates";
import { listGlobalCostSettings } from "@/lib/global-cost-settings-service";
import type { OperationsAssignedInboundLine } from "@/lib/operations-inbound-lines";
import { fetchOperationsAssignedInboundLines } from "@/lib/operations-inbound-lines";

const DEFAULT_LKIM_MAQIS_RATE_CRATE_MYR = 2.5;
const DEFAULT_LKIM_MAQIS_RATE_BOX_MYR = 1.0;

function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export async function aggregateLkimMaqisCost(
  year: number,
  month: number,
  preloadedLines?: OperationsAssignedInboundLine[]
) {
  const [globalCosts, lines] = await Promise.all([
    listGlobalCostSettings(),
    preloadedLines
      ? Promise.resolve(preloadedLines)
      : fetchOperationsAssignedInboundLines(year, month),
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
