import { isOtherMarket } from "@/lib/markets";
import { decimalToNumber } from "@/lib/freight-rates";
import { prisma } from "@/lib/prisma";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import {
  listCrateRentalRates,
  type CrateRentalRateRow,
} from "@/lib/crate-rental-rates-service";
import {
  computeCrateRentalLineCostMyr,
  resolveCrateRentalMyrPerUnit,
  type CrateRentalCurrency,
} from "@/lib/crate-rental-cost";
import { loadExchangeRate } from "@/lib/exchange-rate";
import { sortCrateRentalRates } from "@/lib/constants/crate-rental-rates";

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export interface CrateRentalMonthlyRow {
  crateType: string;
  isRental: boolean;
  quantity: number;
  rate: number;
  currency: CrateRentalCurrency;
  amountOriginal: number;
  amountMyr: number;
  notes: string | null;
}

export interface CrateRentalMonthlyReport {
  year: number;
  month: number;
  yearMonth: string;
  exchangeRate: number;
  rows: CrateRentalMonthlyRow[];
  totals: {
    quantity: number;
    amountMyr: number;
  };
}

async function aggregateCrateRentalQuantities(year: number, month: number) {
  const { start, end } = getMonthDateRange(year, month);
  const dispatches = await prisma.dispatchOrder.findMany({
    where: {
      status: { not: "cancelled" },
      date: { gte: start, lte: end },
    },
    select: {
      lines: {
        select: {
          inboundLine: {
            select: {
              quantity: true,
              tongType: { select: { code: true } },
              stall: { select: { market: { select: { code: true } } } },
            },
          },
        },
      },
    },
  });

  const quantityByType = new Map<string, number>();
  for (const dispatch of dispatches) {
    for (const line of dispatch.lines) {
      const inboundLine = line.inboundLine;
      if (!inboundLine?.tongType?.code) continue;

      const marketCode = inboundLine.stall?.market?.code;
      if (!marketCode || isOtherMarket(marketCode)) continue;

      const quantity = decimalToNumber(inboundLine.quantity) ?? 0;
      if (quantity <= 0) continue;

      const crateType = inboundLine.tongType.code;
      quantityByType.set(
        crateType,
        (quantityByType.get(crateType) ?? 0) + quantity
      );
    }
  }

  return quantityByType;
}

function buildMonthlyRow(
  rateRow: CrateRentalRateRow,
  quantity: number,
  exchangeRate: number
): CrateRentalMonthlyRow {
  const ratePerUnitMyr = resolveCrateRentalMyrPerUnit(
    rateRow.rate,
    rateRow.currency,
    exchangeRate
  );
  const amountOriginal =
    rateRow.isRental && rateRow.rate > 0 && quantity > 0
      ? roundMoney(quantity * rateRow.rate)
      : 0;
  const amountMyr = computeCrateRentalLineCostMyr(quantity, ratePerUnitMyr);

  return {
    crateType: rateRow.crateType,
    isRental: rateRow.isRental,
    quantity,
    rate: rateRow.rate,
    currency: rateRow.currency,
    amountOriginal,
    amountMyr,
    notes: rateRow.notes,
  };
}

export async function buildCrateRentalMonthlyReport(
  year: number,
  month: number
): Promise<CrateRentalMonthlyReport> {
  const [rates, exchangeRate, quantityByType] = await Promise.all([
    listCrateRentalRates(),
    loadExchangeRate(year, month),
    aggregateCrateRentalQuantities(year, month),
  ]);

  const yearMonth = `${year}-${String(month).padStart(2, "0")}`;
  const rows = sortCrateRentalRates(
    rates.map((rateRow) =>
      buildMonthlyRow(rateRow, quantityByType.get(rateRow.crateType) ?? 0, exchangeRate)
    )
  ).filter((row) => row.isRental);

  const totals = rows.reduce(
    (acc, row) => ({
      quantity: acc.quantity + row.quantity,
      amountMyr: roundMoney(acc.amountMyr + row.amountMyr),
    }),
    { quantity: 0, amountMyr: 0 }
  );

  return {
    year,
    month,
    yearMonth,
    exchangeRate,
    rows,
    totals,
  };
}
