/**
 * THB Cash Book auto-draft sync for Thai handling (6502) and driver trip wages (6500).
 *
 * Triggered silently on clerk save of SADAO/Songkhla handling days and driver-trip
 * aggregates. Pattani handling is excluded. Accountant confirms via「待确认」only —
 * opening the draft and saving confirms (no todo checklist).
 *
 * Does NOT touch sadao_handling_other_expenses, MYR driver_vouchers, or PNL paths.
 */

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { findCashBookAccount } from "@/lib/constants/cash-book-accounts";
import { nextPaymentVoucherNo } from "@/lib/cash-book/payment-voucher-no";
import { PaymentVoucherValidationError } from "@/lib/cash-book/payment-voucher-lines";
import { parseDateInput, toDateInputValue } from "@/lib/date-utils";
import { decimalToNumber } from "@/lib/freight-rates";
import { prisma } from "@/lib/prisma";
import {
  buildPublicHolidayKeySet,
  isHolidayRate,
} from "@/lib/thai-cost/holiday";
import {
  resolveThaiCostRatesForMonth,
  type ThaiCostRates,
} from "@/lib/thai-cost/rate-settings";
import { computeSadaoHandlingCommission } from "@/lib/thai-cost/sadao-cost";
import { computeSongkhlaHandlingCommission } from "@/lib/thai-cost/songkhla-handling-cost";
import { resolveSongkhlaEffectiveQty } from "@/lib/thai-cost/station-handling-qty";

export const THAI_HANDLING_PV_ACCOUNT_CODE = "6502-0000";
export const THAI_DRIVER_TRIP_PV_ACCOUNT_CODE = "6500-0000";

export type ThaiHandlingStation = "SADAO" | "SONGKHLA" | "PATTANI";

export type ThaiSettlementPendingSource =
  | "handling_sadao"
  | "handling_songkhla"
  | "handling_pattani"
  | "driver_trip";

export type ThaiSettlementPendingConfirmItem = {
  paymentVoucherId: string;
  voucherNo: string;
  voucherDate: string;
  paidTo: string;
  totalAmount: number;
  accountCode: string | null;
  particulars: string | null;
  source: ThaiSettlementPendingSource;
  sourceLabel: string;
  sourceDate: string;
};

type PvLineSpec = {
  accountCode: string;
  particulars: string;
  amountThb: number;
};

const REVALIDATE_PATHS = [
  "/financial/cash-book/payment-voucher",
  "/financial/cash-book/ledger/thb",
  "/financial/cash-book/thai-settlement",
  "/thai-cost/handling",
  "/thai-cost/sadao-handling",
  "/thai-cost/songkhla-handling",
  "/thai-cost/pattani-handling",
  "/thai-cost/driver-trips",
];

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function revalidateThaiSettlement(pvId?: string) {
  if (process.env.BACKFILL_SKIP_REVALIDATE === "1") return;
  try {
    for (const path of REVALIDATE_PATHS) {
      revalidatePath(path);
    }
    if (pvId) {
      revalidatePath(`/financial/cash-book/payment-voucher/${pvId}`);
      revalidatePath(`/financial/cash-book/payment-voucher/${pvId}/edit`);
    }
  } catch {
    // Scripts/CLI may not have Next revalidate store.
  }
}

function requireThbAccount(code: string) {
  const account = findCashBookAccount("THB", code);
  if (!account) {
    throw new PaymentVoucherValidationError(
      `科目 ${code} 不属于 THB 账本 / Account not on THB book`
    );
  }
  return account;
}

function stationPaidTo(station: Exclude<ThaiHandlingStation, "PATTANI">): string {
  return station === "SADAO" ? "SADAO 搬运" : "宋卡搬运";
}

function stationLabel(station: ThaiHandlingStation): string {
  switch (station) {
    case "SADAO":
      return "SADAO";
    case "SONGKHLA":
      return "宋卡 Songkhla";
    case "PATTANI":
      return "北大年 Pattani";
  }
}

/** Handling PV line text — includes billable crate/box qty when provided. */
export function buildHandlingParticulars(
  date: string,
  station: ThaiHandlingStation,
  qty?: { crateQty: number; boxQty: number }
): string {
  const base = `${date} / ${stationLabel(station)} / 搬运费`;
  if (!qty) return base;
  const parts = [`桶 ${qty.crateQty}`];
  if (qty.boxQty > 0) parts.push(`盒 ${qty.boxQty}`);
  return `${base} / ${parts.join(" ")}`;
}

/** Header-style trip particulars (legacy helper / tests). */
export function buildDriverTripParticulars(
  date: string,
  driverName: string
): string {
  return `${date} / ${driverName} / 趋次工资`;
}

export function buildDriverTripLineParticulars(
  date: string,
  driverName: string,
  destination: "SONGKHLA" | "PATTANI"
): string {
  return `${date} / ${driverName} / 趋次 / ${destination}`;
}

/** Trip wages only — standby ALLOWANCE is manual (not auto-added). */
export function computeThaiDriverTripSettlementAmount(input: {
  songkhlaTripCount: number;
  pattaniTripCount: number;
  driverTripSongkhla: number;
  driverTripPattani: number;
}): {
  tripCommissionThb: number;
  amountThb: number;
  songkhlaAmountThb: number;
  pattaniAmountThb: number;
} {
  const songkhlaAmountThb = roundMoney(
    input.songkhlaTripCount * input.driverTripSongkhla
  );
  const pattaniAmountThb = roundMoney(
    input.pattaniTripCount * input.driverTripPattani
  );
  const tripCommissionThb = roundMoney(songkhlaAmountThb + pattaniAmountThb);
  return {
    tripCommissionThb,
    amountThb: tripCommissionThb,
    songkhlaAmountThb,
    pattaniAmountThb,
  };
}

async function ratesForDate(d: Date, cache: Map<string, ThaiCostRates>) {
  const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
  let rates = cache.get(key);
  if (!rates) {
    rates = await resolveThaiCostRatesForMonth(
      d.getUTCFullYear(),
      d.getUTCMonth() + 1
    );
    cache.set(key, rates);
  }
  return rates;
}

async function createDraftThbPv(input: {
  voucherDate: Date;
  paidTo: string;
  lines: PvLineSpec[];
  actorUserId: string;
  tx: Prisma.TransactionClient;
}): Promise<string> {
  const total = roundMoney(
    input.lines.reduce((sum, line) => sum + line.amountThb, 0)
  );
  if (!(total > 0) || input.lines.length === 0) {
    throw new PaymentVoucherValidationError("结账金额须大于 0");
  }
  const voucherNo = await nextPaymentVoucherNo(input.voucherDate);
  const pvId = randomUUID();
  await input.tx.cashBookPaymentVoucher.create({
    data: {
      id: pvId,
      voucherNo,
      book: "THB",
      voucherDate: input.voucherDate,
      paidTo: input.paidTo,
      paymentMethod: "CASH",
      status: "draft",
      confirmedAt: null,
      confirmedBy: null,
      totalAmount: total,
      createdBy: input.actorUserId,
      lines: {
        create: input.lines.map((line, index) => {
          const account = requireThbAccount(line.accountCode);
          return {
            id: randomUUID(),
            lineOrder: index,
            accountCode: account.code,
            accountName: account.name,
            particulars: line.particulars,
            amount: line.amountThb,
          };
        }),
      },
    },
  });
  return pvId;
}

async function updateDraftThbPv(input: {
  paymentVoucherId: string;
  voucherDate: Date;
  paidTo: string;
  lines: PvLineSpec[];
  tx: Prisma.TransactionClient;
}) {
  const total = roundMoney(
    input.lines.reduce((sum, line) => sum + line.amountThb, 0)
  );
  if (!(total > 0) || input.lines.length === 0) {
    throw new PaymentVoucherValidationError("结账金额须大于 0");
  }
  await input.tx.cashBookPaymentVoucher.update({
    where: { id: input.paymentVoucherId },
    data: {
      voucherDate: input.voucherDate,
      paidTo: input.paidTo,
      totalAmount: total,
      status: "draft",
      confirmedAt: null,
      confirmedBy: null,
    },
  });
  await input.tx.cashBookPaymentVoucherLine.deleteMany({
    where: { voucherId: input.paymentVoucherId },
  });
  await input.tx.cashBookPaymentVoucherLine.createMany({
    data: input.lines.map((line, index) => {
      const account = requireThbAccount(line.accountCode);
      return {
        id: randomUUID(),
        voucherId: input.paymentVoucherId,
        lineOrder: index,
        accountCode: account.code,
        accountName: account.name,
        particulars: line.particulars,
        amount: line.amountThb,
      };
    }),
  });
}

async function deleteDraftPvAndClearLinks(
  tx: Prisma.TransactionClient,
  paymentVoucherId: string
) {
  await tx.sadaoCrateHandlingDaily.updateMany({
    where: { cashBookPaymentVoucherId: paymentVoucherId },
    data: { cashBookPaymentVoucherId: null },
  });
  await tx.songkhlaCrateHandlingDaily.updateMany({
    where: { cashBookPaymentVoucherId: paymentVoucherId },
    data: { cashBookPaymentVoucherId: null },
  });
  await tx.thaiDriverTripDaily.updateMany({
    where: { cashBookPaymentVoucherId: paymentVoucherId },
    data: { cashBookPaymentVoucherId: null },
  });
  const pv = await tx.cashBookPaymentVoucher.findUnique({
    where: { id: paymentVoucherId },
    select: { status: true },
  });
  if (pv?.status === "draft") {
    await tx.cashBookPaymentVoucher.delete({ where: { id: paymentVoucherId } });
  }
}

/**
 * Create or refresh a draft 6502 PV for one SADAO/Songkhla handling day.
 * Confirmed PVs are left untouched. Pattani is rejected by callers (no-op).
 */
export async function syncHandlingDraftFromDaily(input: {
  station: "SADAO" | "SONGKHLA";
  dailyId: string;
  actorUserId: string;
}): Promise<{ paymentVoucherId: string | null }> {
  const ratesCache = new Map<string, ThaiCostRates>();

  const result = await prisma.$transaction(async (tx) => {
    if (input.station === "SADAO") {
      const row = await tx.sadaoCrateHandlingDaily.findUnique({
        where: { id: input.dailyId },
      });
      if (!row) return { paymentVoucherId: null as string | null };

      if (row.cashBookPaymentVoucherId) {
        const existing = await tx.cashBookPaymentVoucher.findUnique({
          where: { id: row.cashBookPaymentVoucherId },
          select: { id: true, status: true },
        });
        if (existing?.status === "confirmed") {
          return { paymentVoucherId: existing.id };
        }
      }

      const rates = await ratesForDate(row.date, ratesCache);
      const holidays = await tx.thaiPublicHoliday.findMany({
        where: { date: row.date },
        select: { date: true },
      });
      const holidayKeys = buildPublicHolidayKeySet(holidays);
      const commission = computeSadaoHandlingCommission(row, {
        holidayRate: isHolidayRate(row.date, holidayKeys),
        rateConfig: rates,
      });
      const amountThb = roundMoney(commission.totalCommissionThb);
      const dateStr = toDateInputValue(row.date);
      const lines: PvLineSpec[] = [
        {
          accountCode: THAI_HANDLING_PV_ACCOUNT_CODE,
          particulars: buildHandlingParticulars(dateStr, "SADAO", {
            crateQty:
              commission.smallBillableQty + commission.largeBillableQty,
            boxQty: commission.boxBillableQty,
          }),
          amountThb,
        },
      ];
      const paidTo = stationPaidTo("SADAO");

      if (!(amountThb > 0)) {
        if (row.cashBookPaymentVoucherId) {
          await deleteDraftPvAndClearLinks(tx, row.cashBookPaymentVoucherId);
        }
        return { paymentVoucherId: null };
      }

      if (row.cashBookPaymentVoucherId) {
        await updateDraftThbPv({
          paymentVoucherId: row.cashBookPaymentVoucherId,
          voucherDate: row.date,
          paidTo,
          lines,
          tx,
        });
        return { paymentVoucherId: row.cashBookPaymentVoucherId };
      }

      const createdId = await createDraftThbPv({
        voucherDate: row.date,
        paidTo,
        lines,
        actorUserId: input.actorUserId,
        tx,
      });
      await tx.sadaoCrateHandlingDaily.update({
        where: { id: input.dailyId },
        data: { cashBookPaymentVoucherId: createdId },
      });
      return { paymentVoucherId: createdId };
    }

    const row = await tx.songkhlaCrateHandlingDaily.findUnique({
      where: { id: input.dailyId },
    });
    if (!row) return { paymentVoucherId: null as string | null };

    if (row.cashBookPaymentVoucherId) {
      const existing = await tx.cashBookPaymentVoucher.findUnique({
        where: { id: row.cashBookPaymentVoucherId },
        select: { id: true, status: true },
      });
      if (existing?.status === "confirmed") {
        return { paymentVoucherId: existing.id };
      }
    }

    const rates = await ratesForDate(row.date, ratesCache);
    const qty = await resolveSongkhlaEffectiveQty(row, rates);
    const commission = computeSongkhlaHandlingCommission(qty, {
      rateConfig: rates,
    });
    const amountThb = roundMoney(commission.totalCommissionThb);
    const dateStr = toDateInputValue(row.date);
    const lines: PvLineSpec[] = [
      {
        accountCode: THAI_HANDLING_PV_ACCOUNT_CODE,
        particulars: buildHandlingParticulars(dateStr, "SONGKHLA", {
          crateQty: commission.crateBillableQty,
          boxQty: commission.boxBillableQty,
        }),
        amountThb,
      },
    ];
    const paidTo = stationPaidTo("SONGKHLA");

    if (!(amountThb > 0)) {
      if (row.cashBookPaymentVoucherId) {
        await deleteDraftPvAndClearLinks(tx, row.cashBookPaymentVoucherId);
      }
      return { paymentVoucherId: null };
    }

    if (row.cashBookPaymentVoucherId) {
      await updateDraftThbPv({
        paymentVoucherId: row.cashBookPaymentVoucherId,
        voucherDate: row.date,
        paidTo,
        lines,
        tx,
      });
      return { paymentVoucherId: row.cashBookPaymentVoucherId };
    }

    const createdId = await createDraftThbPv({
      voucherDate: row.date,
      paidTo,
      lines,
      actorUserId: input.actorUserId,
      tx,
    });
    await tx.songkhlaCrateHandlingDaily.update({
      where: { id: input.dailyId },
      data: { cashBookPaymentVoucherId: createdId },
    });
    return { paymentVoucherId: createdId };
  });

  if (result.paymentVoucherId) {
    revalidateThaiSettlement(result.paymentVoucherId);
  } else {
    revalidateThaiSettlement();
  }
  return result;
}

/**
 * Create or refresh a draft 6500 PV for one driver-trip day.
 * Multi-station days get one line per destination (SONGKHLA / PATTANI).
 */
export async function syncDriverTripDraftFromDaily(input: {
  dailyId: string;
  actorUserId: string;
}): Promise<{ paymentVoucherId: string | null }> {
  const ratesCache = new Map<string, ThaiCostRates>();

  const result = await prisma.$transaction(async (tx) => {
    const row = await tx.thaiDriverTripDaily.findUnique({
      where: { id: input.dailyId },
      include: { driver: { select: { name: true } } },
    });
    if (!row) return { paymentVoucherId: null as string | null };

    if (row.cashBookPaymentVoucherId) {
      const existing = await tx.cashBookPaymentVoucher.findUnique({
        where: { id: row.cashBookPaymentVoucherId },
        select: { id: true, status: true },
      });
      if (existing?.status === "confirmed") {
        return { paymentVoucherId: existing.id };
      }
    }

    const rates = await ratesForDate(row.date, ratesCache);
    const settled = computeThaiDriverTripSettlementAmount({
      songkhlaTripCount: row.songkhlaTripCount,
      pattaniTripCount: row.pattaniTripCount,
      driverTripSongkhla: rates.driverTripSongkhla,
      driverTripPattani: rates.driverTripPattani,
    });
    const dateStr = toDateInputValue(row.date);
    const lines: PvLineSpec[] = [];
    if (row.songkhlaTripCount > 0 && settled.songkhlaAmountThb > 0) {
      lines.push({
        accountCode: THAI_DRIVER_TRIP_PV_ACCOUNT_CODE,
        particulars: buildDriverTripLineParticulars(
          dateStr,
          row.driver.name,
          "SONGKHLA"
        ),
        amountThb: settled.songkhlaAmountThb,
      });
    }
    if (row.pattaniTripCount > 0 && settled.pattaniAmountThb > 0) {
      lines.push({
        accountCode: THAI_DRIVER_TRIP_PV_ACCOUNT_CODE,
        particulars: buildDriverTripLineParticulars(
          dateStr,
          row.driver.name,
          "PATTANI"
        ),
        amountThb: settled.pattaniAmountThb,
      });
    }

    if (lines.length === 0 || !(settled.amountThb > 0)) {
      if (row.cashBookPaymentVoucherId) {
        await deleteDraftPvAndClearLinks(tx, row.cashBookPaymentVoucherId);
      }
      return { paymentVoucherId: null };
    }

    if (row.cashBookPaymentVoucherId) {
      await updateDraftThbPv({
        paymentVoucherId: row.cashBookPaymentVoucherId,
        voucherDate: row.date,
        paidTo: row.driver.name,
        lines,
        tx,
      });
      return { paymentVoucherId: row.cashBookPaymentVoucherId };
    }

    const createdId = await createDraftThbPv({
      voucherDate: row.date,
      paidTo: row.driver.name,
      lines,
      actorUserId: input.actorUserId,
      tx,
    });
    await tx.thaiDriverTripDaily.update({
      where: { id: input.dailyId },
      data: { cashBookPaymentVoucherId: createdId },
    });
    return { paymentVoucherId: createdId };
  });

  if (result.paymentVoucherId) {
    revalidateThaiSettlement(result.paymentVoucherId);
  } else {
    revalidateThaiSettlement();
  }
  return result;
}

/**
 * Before deleting a driver-trip aggregate row (zero vehicle trips), drop its
 * linked draft PV if any. Confirmed PVs are left alone (link cleared by FK SetNull).
 */
export async function clearDriverTripDraftBeforeAggregateDelete(input: {
  date: Date;
  driverId: string;
}): Promise<void> {
  const existing = await prisma.thaiDriverTripDaily.findUnique({
    where: {
      date_driverId: { date: input.date, driverId: input.driverId },
    },
    select: { cashBookPaymentVoucherId: true },
  });
  if (!existing?.cashBookPaymentVoucherId) return;

  await prisma.$transaction(async (tx) => {
    const pv = await tx.cashBookPaymentVoucher.findUnique({
      where: { id: existing.cashBookPaymentVoucherId! },
      select: { status: true },
    });
    if (pv?.status === "draft") {
      await deleteDraftPvAndClearLinks(tx, existing.cashBookPaymentVoucherId!);
    } else {
      await tx.thaiDriverTripDaily.updateMany({
        where: {
          date: input.date,
          driverId: input.driverId,
        },
        data: { cashBookPaymentVoucherId: null },
      });
    }
  });
  revalidateThaiSettlement(existing.cashBookPaymentVoucherId);
}

/** True when this PV is linked from a Thai handling/trip daily row. */
export async function isThaiSettlementLinkedPaymentVoucher(
  paymentVoucherId: string
): Promise<boolean> {
  const [sadao, songkhla, pattani, trip] = await Promise.all([
    prisma.sadaoCrateHandlingDaily.findFirst({
      where: { cashBookPaymentVoucherId: paymentVoucherId },
      select: { id: true },
    }),
    prisma.songkhlaCrateHandlingDaily.findFirst({
      where: { cashBookPaymentVoucherId: paymentVoucherId },
      select: { id: true },
    }),
    prisma.pattaniCrateHandlingDaily.findFirst({
      where: { cashBookPaymentVoucherId: paymentVoucherId },
      select: { id: true },
    }),
    prisma.thaiDriverTripDaily.findFirst({
      where: { cashBookPaymentVoucherId: paymentVoucherId },
      select: { id: true },
    }),
  ]);
  return Boolean(sadao || songkhla || pattani || trip);
}

/**
 * Draft PVs still linked to a handling/trip daily row — awaiting accountant confirm.
 */
export async function listThaiSettlementPendingConfirm(input?: {
  fromDate?: string;
  toDate?: string;
}): Promise<ThaiSettlementPendingConfirmItem[]> {
  const from = input?.fromDate
    ? parseDateInput(input.fromDate)
    : parseDateInput("2020-01-01");
  const to = input?.toDate ? parseDateInput(input.toDate) : new Date();

  const voucherSelect = {
    id: true,
    voucherNo: true,
    voucherDate: true,
    paidTo: true,
    totalAmount: true,
    status: true,
    lines: {
      orderBy: { lineOrder: "asc" as const },
      take: 1,
      select: { accountCode: true, particulars: true },
    },
  };

  const [sadao, songkhla, pattani, trips] = await Promise.all([
    prisma.sadaoCrateHandlingDaily.findMany({
      where: {
        cashBookPaymentVoucherId: { not: null },
        date: { gte: from, lte: to },
      },
      select: {
        date: true,
        cashBookPaymentVoucher: { select: voucherSelect },
      },
    }),
    prisma.songkhlaCrateHandlingDaily.findMany({
      where: {
        cashBookPaymentVoucherId: { not: null },
        date: { gte: from, lte: to },
      },
      select: {
        date: true,
        cashBookPaymentVoucher: { select: voucherSelect },
      },
    }),
    prisma.pattaniCrateHandlingDaily.findMany({
      where: {
        cashBookPaymentVoucherId: { not: null },
        date: { gte: from, lte: to },
      },
      select: {
        date: true,
        cashBookPaymentVoucher: { select: voucherSelect },
      },
    }),
    prisma.thaiDriverTripDaily.findMany({
      where: {
        cashBookPaymentVoucherId: { not: null },
        date: { gte: from, lte: to },
      },
      select: {
        date: true,
        driver: { select: { name: true } },
        cashBookPaymentVoucher: { select: voucherSelect },
      },
    }),
  ]);

  const items: ThaiSettlementPendingConfirmItem[] = [];

  function pushLinked(
    source: ThaiSettlementPendingSource,
    sourceLabel: string,
    sourceDate: Date,
    voucher: {
      id: string;
      voucherNo: string;
      voucherDate: Date;
      paidTo: string;
      totalAmount: unknown;
      status: string;
      lines: Array<{ accountCode: string; particulars: string | null }>;
    } | null
  ) {
    if (!voucher || voucher.status !== "draft") return;
    items.push({
      paymentVoucherId: voucher.id,
      voucherNo: voucher.voucherNo,
      voucherDate: toDateInputValue(voucher.voucherDate),
      paidTo: voucher.paidTo,
      totalAmount: roundMoney(decimalToNumber(voucher.totalAmount) ?? 0),
      accountCode: voucher.lines[0]?.accountCode ?? null,
      particulars: voucher.lines[0]?.particulars ?? null,
      source,
      sourceLabel,
      sourceDate: toDateInputValue(sourceDate),
    });
  }

  for (const row of sadao) {
    pushLinked("handling_sadao", "SADAO 搬运", row.date, row.cashBookPaymentVoucher);
  }
  for (const row of songkhla) {
    pushLinked(
      "handling_songkhla",
      "宋卡搬运",
      row.date,
      row.cashBookPaymentVoucher
    );
  }
  for (const row of pattani) {
    pushLinked(
      "handling_pattani",
      "北大年搬运",
      row.date,
      row.cashBookPaymentVoucher
    );
  }
  for (const row of trips) {
    pushLinked(
      "driver_trip",
      `趋次 / ${row.driver.name}`,
      row.date,
      row.cashBookPaymentVoucher
    );
  }

  return items.sort((a, b) => {
    const byDate = b.voucherDate.localeCompare(a.voucherDate);
    if (byDate !== 0) return byDate;
    return a.voucherNo.localeCompare(b.voucherNo);
  });
}

/** Convenience for tests: verify linked total amount. */
export async function getLinkedPaymentVoucherTotal(
  paymentVoucherId: string
): Promise<number> {
  const row = await prisma.cashBookPaymentVoucher.findUnique({
    where: { id: paymentVoucherId },
  });
  return decimalToNumber(row?.totalAmount) ?? 0;
}
