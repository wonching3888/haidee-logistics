/**
 * THB Cash Book settlement for Thai handling commissions (6502) and
 * driver trip wages (6500). One-shot confirmed PVs — no advance phase.
 *
 * Does NOT touch sadao_handling_other_expenses (manual shortcut only).
 * Does NOT touch MYR driver_vouchers or PNL calc paths.
 */

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { findCashBookAccount } from "@/lib/constants/cash-book-accounts";
import { nextPaymentVoucherNo } from "@/lib/cash-book/payment-voucher-no";
import {
  PaymentVoucherValidationError,
} from "@/lib/cash-book/payment-voucher-lines";
import { parseDateInput, toDateInputValue } from "@/lib/date-utils";
import { decimalToNumber } from "@/lib/freight-rates";
import { prisma } from "@/lib/prisma";
import {
  buildPublicHolidayKeySet,
  isHolidayRate,
} from "@/lib/thai-cost/holiday";
import { computePattaniHandlingCosts } from "@/lib/thai-cost/pattani-handling-cost";
import {
  resolveThaiCostRatesForMonth,
  type ThaiCostRates,
} from "@/lib/thai-cost/rate-settings";
import { computeSadaoHandlingCommission } from "@/lib/thai-cost/sadao-cost";
import { computeSongkhlaHandlingCommission } from "@/lib/thai-cost/songkhla-handling-cost";
import {
  resolvePattaniEffectiveQty,
  resolveSongkhlaEffectiveQty,
} from "@/lib/thai-cost/station-handling-qty";

export const THAI_HANDLING_PV_ACCOUNT_CODE = "6502-0000";
export const THAI_DRIVER_TRIP_PV_ACCOUNT_CODE = "6500-0000";

export type ThaiHandlingStation = "SADAO" | "SONGKHLA" | "PATTANI";

export type ThaiHandlingTodoItem = {
  kind: "handling";
  station: ThaiHandlingStation;
  id: string;
  date: string;
  amountThb: number;
  paidTo: string;
  particulars: string;
  cashBookPaymentVoucherId: string | null;
};

export type ThaiDriverTripTodoItem = {
  kind: "driver_trip";
  id: string;
  date: string;
  driverId: string;
  driverName: string;
  songkhlaTripCount: number;
  pattaniTripCount: number;
  tripCommissionThb: number;
  amountThb: number;
  paidTo: string;
  particulars: string;
  cashBookPaymentVoucherId: string | null;
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

function stationPaidTo(station: ThaiHandlingStation): string {
  switch (station) {
    case "SADAO":
      return "SADAO 搬运";
    case "SONGKHLA":
      return "宋卡搬运";
    case "PATTANI":
      return "北大年搬运";
  }
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

export function buildHandlingParticulars(
  date: string,
  station: ThaiHandlingStation
): string {
  return `${date} / ${stationLabel(station)} / 搬运费`;
}

export function buildDriverTripParticulars(
  date: string,
  driverName: string
): string {
  return `${date} / ${driverName} / 趋次工资`;
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
} {
  const tripCommissionThb = roundMoney(
    input.songkhlaTripCount * input.driverTripSongkhla +
      input.pattaniTripCount * input.driverTripPattani
  );
  return {
    tripCommissionThb,
    amountThb: tripCommissionThb,
  };
}

async function createConfirmedThbPv(input: {
  voucherDate: Date;
  paidTo: string;
  accountCode: string;
  particulars: string;
  amountThb: number;
  actorUserId: string;
  tx: Prisma.TransactionClient;
}): Promise<string> {
  if (!(input.amountThb > 0)) {
    throw new PaymentVoucherValidationError("结账金额须大于 0");
  }
  const account = requireThbAccount(input.accountCode);
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
      status: "confirmed",
      confirmedAt: new Date(),
      confirmedBy: input.actorUserId,
      totalAmount: input.amountThb,
      createdBy: input.actorUserId,
      lines: {
        create: [
          {
            id: randomUUID(),
            lineOrder: 0,
            accountCode: account.code,
            accountName: account.name,
            particulars: input.particulars,
            amount: input.amountThb,
          },
        ],
      },
    },
  });
  return pvId;
}

export async function listThaiHandlingSettlementTodos(input?: {
  fromDate?: string;
  toDate?: string;
}): Promise<ThaiHandlingTodoItem[]> {
  const from = input?.fromDate
    ? parseDateInput(input.fromDate)
    : parseDateInput("2020-01-01");
  const to = input?.toDate ? parseDateInput(input.toDate) : new Date();

  const [sadaoRows, songkhlaRows, pattaniRows, holidays] = await Promise.all([
    prisma.sadaoCrateHandlingDaily.findMany({
      where: {
        cashBookPaymentVoucherId: null,
        date: { gte: from, lte: to },
      },
      orderBy: { date: "desc" },
    }),
    prisma.songkhlaCrateHandlingDaily.findMany({
      where: {
        cashBookPaymentVoucherId: null,
        date: { gte: from, lte: to },
      },
      orderBy: { date: "desc" },
    }),
    prisma.pattaniCrateHandlingDaily.findMany({
      where: {
        cashBookPaymentVoucherId: null,
        date: { gte: from, lte: to },
      },
      orderBy: { date: "desc" },
    }),
    prisma.thaiPublicHoliday.findMany({
      where: { date: { gte: from, lte: to } },
      select: { date: true },
    }),
  ]);

  const holidayKeys = buildPublicHolidayKeySet(holidays);
  const ratesCache = new Map<string, ThaiCostRates>();
  async function ratesFor(d: Date) {
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
    let rates = ratesCache.get(key);
    if (!rates) {
      rates = await resolveThaiCostRatesForMonth(
        d.getUTCFullYear(),
        d.getUTCMonth() + 1
      );
      ratesCache.set(key, rates);
    }
    return rates;
  }

  const items: ThaiHandlingTodoItem[] = [];

  for (const row of sadaoRows) {
    const date = toDateInputValue(row.date);
    const rates = await ratesFor(row.date);
    const commission = computeSadaoHandlingCommission(row, {
      holidayRate: isHolidayRate(row.date, holidayKeys),
      rateConfig: rates,
    });
    const amountThb = roundMoney(commission.totalCommissionThb);
    if (!(amountThb > 0)) continue;
    items.push({
      kind: "handling",
      station: "SADAO",
      id: row.id,
      date,
      amountThb,
      paidTo: stationPaidTo("SADAO"),
      particulars: buildHandlingParticulars(date, "SADAO"),
      cashBookPaymentVoucherId: null,
    });
  }

  for (const row of songkhlaRows) {
    const date = toDateInputValue(row.date);
    const rates = await ratesFor(row.date);
    const qty = await resolveSongkhlaEffectiveQty(row, rates);
    const amountThb = roundMoney(
      computeSongkhlaHandlingCommission(qty, { rateConfig: rates })
        .totalCommissionThb
    );
    if (!(amountThb > 0)) continue;
    items.push({
      kind: "handling",
      station: "SONGKHLA",
      id: row.id,
      date,
      amountThb,
      paidTo: stationPaidTo("SONGKHLA"),
      particulars: buildHandlingParticulars(date, "SONGKHLA"),
      cashBookPaymentVoucherId: null,
    });
  }

  for (const row of pattaniRows) {
    const date = toDateInputValue(row.date);
    const rates = await ratesFor(row.date);
    const qty = await resolvePattaniEffectiveQty(row, rates);
    const amountThb = roundMoney(
      computePattaniHandlingCosts(qty, rates).dayTotalThb
    );
    if (!(amountThb > 0)) continue;
    items.push({
      kind: "handling",
      station: "PATTANI",
      id: row.id,
      date,
      amountThb,
      paidTo: stationPaidTo("PATTANI"),
      particulars: buildHandlingParticulars(date, "PATTANI"),
      cashBookPaymentVoucherId: null,
    });
  }

  return items.sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    if (byDate !== 0) return byDate;
    return a.station.localeCompare(b.station);
  });
}

export async function listThaiDriverTripSettlementTodos(input?: {
  fromDate?: string;
  toDate?: string;
}): Promise<ThaiDriverTripTodoItem[]> {
  const from = input?.fromDate
    ? parseDateInput(input.fromDate)
    : parseDateInput("2020-01-01");
  const to = input?.toDate ? parseDateInput(input.toDate) : new Date();

  const rows = await prisma.thaiDriverTripDaily.findMany({
    where: {
      cashBookPaymentVoucherId: null,
      date: { gte: from, lte: to },
      OR: [{ songkhlaTripCount: { gt: 0 } }, { pattaniTripCount: { gt: 0 } }],
    },
    include: { driver: { select: { name: true } } },
    orderBy: [{ date: "desc" }, { driver: { name: "asc" } }],
  });

  const ratesCache = new Map<string, ThaiCostRates>();
  async function ratesFor(d: Date) {
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
    let rates = ratesCache.get(key);
    if (!rates) {
      rates = await resolveThaiCostRatesForMonth(
        d.getUTCFullYear(),
        d.getUTCMonth() + 1
      );
      ratesCache.set(key, rates);
    }
    return rates;
  }

  const items: ThaiDriverTripTodoItem[] = [];
  for (const row of rows) {
    const rates = await ratesFor(row.date);
    const settled = computeThaiDriverTripSettlementAmount({
      songkhlaTripCount: row.songkhlaTripCount,
      pattaniTripCount: row.pattaniTripCount,
      driverTripSongkhla: rates.driverTripSongkhla,
      driverTripPattani: rates.driverTripPattani,
    });
    if (!(settled.amountThb > 0)) continue;
    const date = toDateInputValue(row.date);
    items.push({
      kind: "driver_trip",
      id: row.id,
      date,
      driverId: row.driverId,
      driverName: row.driver.name,
      songkhlaTripCount: row.songkhlaTripCount,
      pattaniTripCount: row.pattaniTripCount,
      tripCommissionThb: settled.tripCommissionThb,
      amountThb: settled.amountThb,
      paidTo: row.driver.name,
      particulars: buildDriverTripParticulars(date, row.driver.name),
      cashBookPaymentVoucherId: null,
    });
  }
  return items;
}

export async function settleThaiHandlingDay(input: {
  station: ThaiHandlingStation;
  id: string;
  actorUserId: string;
}): Promise<{ paymentVoucherId: string; voucherNo: string }> {
  const todos = await listThaiHandlingSettlementTodos({
    fromDate: "2020-01-01",
  });
  const todo = todos.find(
    (t) => t.station === input.station && t.id === input.id
  );
  if (!todo) {
    throw new Error("待办不存在或金额为 0 / Todo missing or zero amount");
  }

  const date = parseDateInput(todo.date);
  const pvId = await prisma.$transaction(async (tx) => {
    const existing =
      input.station === "SADAO"
        ? await tx.sadaoCrateHandlingDaily.findUnique({ where: { id: input.id } })
        : input.station === "SONGKHLA"
          ? await tx.songkhlaCrateHandlingDaily.findUnique({
              where: { id: input.id },
            })
          : await tx.pattaniCrateHandlingDaily.findUnique({
              where: { id: input.id },
            });
    if (!existing) throw new Error("记录不存在");
    if (existing.cashBookPaymentVoucherId) {
      throw new Error("已结账 / Already settled");
    }

    const createdId = await createConfirmedThbPv({
      voucherDate: date,
      paidTo: todo.paidTo,
      accountCode: THAI_HANDLING_PV_ACCOUNT_CODE,
      particulars: todo.particulars,
      amountThb: todo.amountThb,
      actorUserId: input.actorUserId,
      tx,
    });

    if (input.station === "SADAO") {
      await tx.sadaoCrateHandlingDaily.update({
        where: { id: input.id },
        data: { cashBookPaymentVoucherId: createdId },
      });
    } else if (input.station === "SONGKHLA") {
      await tx.songkhlaCrateHandlingDaily.update({
        where: { id: input.id },
        data: { cashBookPaymentVoucherId: createdId },
      });
    } else {
      await tx.pattaniCrateHandlingDaily.update({
        where: { id: input.id },
        data: { cashBookPaymentVoucherId: createdId },
      });
    }
    return createdId;
  });

  const pv = await prisma.cashBookPaymentVoucher.findUniqueOrThrow({
    where: { id: pvId },
    select: { voucherNo: true },
  });
  revalidateThaiSettlement(pvId);
  return { paymentVoucherId: pvId, voucherNo: pv.voucherNo };
}

export async function settleThaiDriverTripDay(input: {
  id: string;
  actorUserId: string;
}): Promise<{ paymentVoucherId: string; voucherNo: string }> {
  const todos = await listThaiDriverTripSettlementTodos({
    fromDate: "2020-01-01",
  });
  const todo = todos.find((t) => t.id === input.id);
  if (!todo) {
    throw new Error("待办不存在或金额为 0 / Todo missing or zero amount");
  }

  const date = parseDateInput(todo.date);
  const pvId = await prisma.$transaction(async (tx) => {
    const existing = await tx.thaiDriverTripDaily.findUnique({
      where: { id: input.id },
    });
    if (!existing) throw new Error("记录不存在");
    if (existing.cashBookPaymentVoucherId) {
      throw new Error("已结账 / Already settled");
    }

    const createdId = await createConfirmedThbPv({
      voucherDate: date,
      paidTo: todo.paidTo,
      accountCode: THAI_DRIVER_TRIP_PV_ACCOUNT_CODE,
      particulars: todo.particulars,
      amountThb: todo.amountThb,
      actorUserId: input.actorUserId,
      tx,
    });

    await tx.thaiDriverTripDaily.update({
      where: { id: input.id },
      data: { cashBookPaymentVoucherId: createdId },
    });
    return createdId;
  });

  const pv = await prisma.cashBookPaymentVoucher.findUniqueOrThrow({
    where: { id: pvId },
    select: { voucherNo: true },
  });
  revalidateThaiSettlement(pvId);
  return { paymentVoucherId: pvId, voucherNo: pv.voucherNo };
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
