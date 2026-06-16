import { prisma } from "@/lib/prisma";
import { DEFAULT_EXCHANGE_RATE } from "@/lib/constants/freight-settings";
import { resolveSessionPickupLocation } from "@/lib/constants/pickup-locations";
import { parseThaiSegmentRates } from "@/lib/constants/thai-segment-rates";
import { decimalToNumber } from "@/lib/freight-rates";
import { listGlobalCostSettings } from "@/lib/global-cost-settings-service";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import { computeLineThaiSegmentCostMyr } from "@/lib/thai-segment-freight";

function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export async function aggregateThaiSegmentFreightCost(year: number, month: number) {
  const { start, end } = getMonthDateRange(year, month);
  const yearMonth = `${year}-${String(month).padStart(2, "0")}`;

  const [globalCosts, exchangeRateRow, lines] = await Promise.all([
    listGlobalCostSettings(),
    prisma.exchangeRate.findUnique({ where: { yearMonth } }),
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
      select: {
        quantity: true,
        freightAmount: true,
        currency: true,
        paymentMode: true,
        tongType: { select: { isBox: true } },
        stall: { select: { market: { select: { code: true } } } },
        session: {
          select: {
            pickupLocation: true,
            shipper: { select: { pickupLocation: true } },
          },
        },
      },
    }),
  ]);

  const rates = parseThaiSegmentRates(globalCosts);
  const exchangeRate =
    decimalToNumber(exchangeRateRow?.rate) ?? DEFAULT_EXCHANGE_RATE;

  let totalAmountMyr = 0;
  let assignedLineCount = 0;

  for (const line of lines) {
    const marketCode = line.stall?.market?.code ?? "";
    const quantity = decimalToNumber(line.quantity) ?? 0;
    if (quantity <= 0) continue;

    const pickup = resolveSessionPickupLocation(
      line.session.pickupLocation,
      line.session.shipper.pickupLocation
    );

    const costMyr = computeLineThaiSegmentCostMyr({
      pickupLocation: pickup,
      quantity,
      isBox: line.tongType?.isBox ?? false,
      freightAmount: line.freightAmount,
      currency: line.currency,
      paymentMode: line.paymentMode,
      exchangeRate,
      rates,
      marketCode,
    });

    if (costMyr > 0) {
      totalAmountMyr = roundMoney(totalAmountMyr + costMyr);
      assignedLineCount += 1;
    }
  }

  return {
    totalAmountMyr: roundMoney(totalAmountMyr),
    assignedLineCount,
    rates,
    exchangeRate,
  };
}
