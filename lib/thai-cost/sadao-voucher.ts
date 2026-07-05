/**
 * Daily Sadao porter voucher (handling commission reimbursement).
 * Excludes statutory deductions and monthly salaried workers.
 */
import {
  type SadaoHandlingRates,
} from "@/lib/constants/thai-cost";
import { prisma } from "@/lib/prisma";
import { parseDateInput, toDateInputValue } from "@/lib/date-utils";
import {
  buildPublicHolidayKeySet,
  isHolidayRate,
} from "@/lib/thai-cost/holiday";
import {
  computeSadaoHandlingCommission,
  type SadaoBillableCrates,
} from "@/lib/thai-cost/sadao-cost";
import { resolveThaiCostRatesForMonth } from "@/lib/thai-cost/rate-settings";
import { aggregateSadaoDispatchTotalsForDate } from "@/lib/thai-cost/dispatch-crate-aggregate";

export interface SadaoVoucherLine {
  bucket: "small" | "large" | "box";
  label: string;
  billableQty: number;
  unitRateThb: number;
  amountThb: number;
}

export interface SadaoVoucherDetail {
  date: string;
  holidayRate: boolean;
  rates: SadaoHandlingRates;
  totals: {
    smallCrateTotalQty: number;
    largeCrateTotalQty: number;
    boxTotalQty: number;
  };
  directQty: {
    smallCrateNoCheckQty: number;
    largeCrateNoCheckQty: number;
    boxNoCheckQty: number;
  };
  billable: SadaoBillableCrates;
  lines: SadaoVoucherLine[];
  totalThb: number;
  notes: string | null;
  fromDispatch: boolean;
}

const BUCKET_LABELS: Record<SadaoVoucherLine["bucket"], string> = {
  small: "ถังเล็ก / Small crate",
  large: "ถังใหญ่ / Large crate",
  box: "กล่อง / Box",
};

function buildVoucherLines(
  billable: SadaoBillableCrates,
  rates: SadaoHandlingRates
): SadaoVoucherLine[] {
  const lines: SadaoVoucherLine[] = [
    {
      bucket: "small",
      label: BUCKET_LABELS.small,
      billableQty: billable.smallBillableQty,
      unitRateThb: rates.small,
      amountThb: billable.smallBillableQty * rates.small,
    },
    {
      bucket: "large",
      label: BUCKET_LABELS.large,
      billableQty: billable.largeBillableQty,
      unitRateThb: rates.large,
      amountThb: billable.largeBillableQty * rates.large,
    },
    {
      bucket: "box",
      label: BUCKET_LABELS.box,
      billableQty: billable.boxBillableQty,
      unitRateThb: rates.box,
      amountThb: billable.boxBillableQty * rates.box,
    },
  ];
  return lines.filter((l) => l.billableQty > 0 || l.amountThb > 0);
}

export async function getSadaoVoucherForDate(
  dateInput: string
): Promise<SadaoVoucherDetail | null> {
  const date = parseDateInput(dateInput);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;

  const [stored, holiday, rates] = await Promise.all([
    prisma.sadaoCrateHandlingDaily.findUnique({ where: { date } }),
    prisma.thaiPublicHoliday.findUnique({
      where: { date },
      select: { date: true },
    }),
    resolveThaiCostRatesForMonth(year, month),
  ]);

  const holidayKeys = buildPublicHolidayKeySet(holiday ? [holiday] : []);
  const holidayRate = isHolidayRate(date, holidayKeys);

  if (stored) {
    const commission = computeSadaoHandlingCommission(stored, {
      holidayRate,
      rateConfig: rates,
    });
    const lines = buildVoucherLines(commission, commission.rates);
    return {
      date: toDateInputValue(date),
      holidayRate,
      rates: commission.rates,
      totals: {
        smallCrateTotalQty: stored.smallCrateTotalQty,
        largeCrateTotalQty: stored.largeCrateTotalQty,
        boxTotalQty: stored.boxTotalQty,
      },
      directQty: {
        smallCrateNoCheckQty: stored.smallCrateNoCheckQty,
        largeCrateNoCheckQty: stored.largeCrateNoCheckQty,
        boxNoCheckQty: stored.boxNoCheckQty,
      },
      billable: {
        smallBillableQty: commission.smallBillableQty,
        largeBillableQty: commission.largeBillableQty,
        boxBillableQty: commission.boxBillableQty,
      },
      lines,
      totalThb: commission.totalCommissionThb,
      notes: stored.notes,
      fromDispatch: false,
    };
  }

  const dispatchTotals = await aggregateSadaoDispatchTotalsForDate(date, rates);
  if (
    dispatchTotals.small === 0 &&
    dispatchTotals.large === 0 &&
    dispatchTotals.box === 0
  ) {
    return null;
  }

  const qtyInput = {
    smallCrateTotalQty: dispatchTotals.small,
    largeCrateTotalQty: dispatchTotals.large,
    boxTotalQty: dispatchTotals.box,
    smallCrateNoCheckQty: 0,
    largeCrateNoCheckQty: 0,
    boxNoCheckQty: 0,
  };
  const commission = computeSadaoHandlingCommission(qtyInput, {
    holidayRate,
    rateConfig: rates,
  });
  const lines = buildVoucherLines(commission, commission.rates);

  return {
    date: toDateInputValue(date),
    holidayRate,
    rates: commission.rates,
    totals: {
      smallCrateTotalQty: dispatchTotals.small,
      largeCrateTotalQty: dispatchTotals.large,
      boxTotalQty: dispatchTotals.box,
    },
    directQty: {
      smallCrateNoCheckQty: 0,
      largeCrateNoCheckQty: 0,
      boxNoCheckQty: 0,
    },
    billable: {
      smallBillableQty: commission.smallBillableQty,
      largeBillableQty: commission.largeBillableQty,
      boxBillableQty: commission.boxBillableQty,
    },
    lines,
    totalThb: commission.totalCommissionThb,
    notes: null,
    fromDispatch: true,
  };
}
