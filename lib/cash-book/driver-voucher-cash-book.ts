/**
 * Sync Malaysian driver vouchers ↔ MYR Cash Book Payment Vouchers.
 *
 * Advance: one confirmed line on 3500-0000 (duit jalan).
 * Settle: replace same PV lines with belanja accounts; keep confirmedAt.
 * Reject / reopen: intentionally do NOT touch the cash-book PV.
 */

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import {
  DRIVER_VOUCHER_ADVANCE_ACCOUNT_CODE,
  findCashBookAccount,
} from "@/lib/constants/cash-book-accounts";
import { nextPaymentVoucherNo } from "@/lib/cash-book/payment-voucher-no";
import {
  PaymentVoucherValidationError,
  sumPaymentVoucherLines,
  type NormalizedPaymentVoucherLine,
  type PaymentVoucherLineInput,
} from "@/lib/cash-book/payment-voucher-lines";
import { toDateInputValue } from "@/lib/date-utils";
import { prisma } from "@/lib/prisma";

const REVALIDATE_PATHS = [
  "/financial/cash-book/payment-voucher",
  "/financial/cash-book/ledger/myr",
];

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function revalidateDriverCashBook(pvId?: string) {
  if (process.env.BACKFILL_SKIP_REVALIDATE === "1") return;
  try {
    for (const path of REVALIDATE_PATHS) {
      revalidatePath(path);
    }
    if (pvId) {
      revalidatePath(`/financial/cash-book/payment-voucher/${pvId}`);
    }
  } catch {
    // Scripts/CLI have no Next static-generation store — skip cache bust.
  }
}

function requireAccount(
  code: string
): { accountCode: string; accountName: string } {
  const account = findCashBookAccount("MYR", code);
  if (!account) {
    throw new PaymentVoucherValidationError(
      `科目 ${code} 不属于 MYR 账本 / Account not on MYR book`
    );
  }
  return { accountCode: account.code, accountName: account.name };
}

function pushPositiveLine(
  out: PaymentVoucherLineInput[],
  accountCode: string,
  amount: number | null | undefined,
  particulars: string
) {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return;
  out.push({
    accountCode,
    amount: roundMoney(amount),
    particulars,
  });
}

export function buildDriverVoucherParticulars(input: {
  driverName: string;
  lorry: string;
  tripDate: Date | string;
}): string {
  const date =
    typeof input.tripDate === "string"
      ? input.tripDate
      : toDateInputValue(input.tripDate);
  return `${input.driverName} / ${input.lorry} / ${date}`;
}

/**
 * Map driver-voucher Actuals → Cash Book PV lines (MYR belanja accounts).
 * Zero / empty Actuals are omitted. Upah Turun+Naik → 6304; Minyak+Other → 6306.
 */
export function buildDriverVoucherSettlementLines(input: {
  chopBorderActual?: number | null;
  fishCheckActual?: number | null;
  kpbActual?: number | null;
  upahTurunActual?: number | null;
  upahNaikTongActual?: number | null;
  parkingActual?: number | null;
  minyakMotoEnabled?: boolean;
  minyakMotoActual?: number | null;
  otherActual?: number | null;
  particulars: string;
}): NormalizedPaymentVoucherLine[] {
  const draft: PaymentVoucherLineInput[] = [];
  pushPositiveLine(
    draft,
    "6301-0000",
    input.chopBorderActual,
    input.particulars
  );
  pushPositiveLine(draft, "6302-0000", input.fishCheckActual, input.particulars);
  pushPositiveLine(draft, "6303-0000", input.kpbActual, input.particulars);

  const loadUnload = roundMoney(
    (input.upahTurunActual != null && Number.isFinite(input.upahTurunActual)
      ? input.upahTurunActual
      : 0) +
      (input.upahNaikTongActual != null &&
      Number.isFinite(input.upahNaikTongActual)
        ? input.upahNaikTongActual
        : 0)
  );
  pushPositiveLine(draft, "6304-0000", loadUnload, input.particulars);
  pushPositiveLine(draft, "6305-0000", input.parkingActual, input.particulars);

  const general = roundMoney(
    (input.minyakMotoEnabled &&
    input.minyakMotoActual != null &&
    Number.isFinite(input.minyakMotoActual)
      ? input.minyakMotoActual
      : 0) +
      (input.otherActual != null && Number.isFinite(input.otherActual)
        ? input.otherActual
        : 0)
  );
  pushPositiveLine(draft, "6306-0000", general, input.particulars);

  if (draft.length === 0) {
    throw new PaymentVoucherValidationError("至少需要一行明细");
  }

  return draft.map((row) => {
    const account = requireAccount(row.accountCode);
    return {
      ...account,
      particulars: row.particulars?.trim() || null,
      amount: roundMoney(row.amount),
    };
  });
}

async function replacePaymentVoucherLinesInTx(
  tx: Prisma.TransactionClient,
  voucherId: string,
  lines: NormalizedPaymentVoucherLine[],
  totalAmount: number
) {
  await tx.cashBookPaymentVoucher.update({
    where: { id: voucherId },
    data: { totalAmount },
  });
  await tx.cashBookPaymentVoucherLine.deleteMany({ where: { voucherId } });
  await tx.cashBookPaymentVoucherLine.createMany({
    data: lines.map((line, index) => ({
      id: randomUUID(),
      voucherId,
      lineOrder: index,
      accountCode: line.accountCode,
      accountName: line.accountName,
      particulars: line.particulars,
      amount: line.amount,
    })),
  });
}

type DriverVoucherCashBookSource = {
  id: string;
  cashBookPaymentVoucherId: string | null;
  driverName: string;
  lorry: string;
  tripDate: Date;
  duitJalan: number | null;
  chopBorderActual: number | null;
  fishCheckActual: number | null;
  kpbActual: number | null;
  upahTurunActual: number | null;
  upahNaikTongActual: number | null;
  parkingActual: number | null;
  minyakMotoEnabled: boolean;
  minyakMotoActual: number | null;
  otherActual: number | null;
};

/**
 * Create or update the advance PV (3500-0000, confirmed immediately).
 */
export async function syncDriverVoucherAdvanceCashBook(input: {
  driverVoucherId: string;
  actorUserId: string;
}): Promise<string> {
  const voucher = await prisma.driverVoucher.findUnique({
    where: { id: input.driverVoucherId },
  });
  if (!voucher) throw new Error("Voucher not found");

  const amount = voucher.duitJalan;
  if (amount == null || !(amount > 0)) {
    throw new Error("预支须填写 Duit Jalan / Duit Jalan required for advance");
  }

  const particulars = buildDriverVoucherParticulars(voucher);
  const advanceAccount = requireAccount(DRIVER_VOUCHER_ADVANCE_ACCOUNT_CODE);
  const rounded = roundMoney(amount);

  if (voucher.cashBookPaymentVoucherId) {
    const existing = await prisma.cashBookPaymentVoucher.findUnique({
      where: { id: voucher.cashBookPaymentVoucherId },
    });
    if (!existing) {
      throw new Error("关联现金簿凭证不存在 / Linked payment voucher missing");
    }

    await prisma.$transaction(async (tx) => {
      await replacePaymentVoucherLinesInTx(
        tx,
        existing.id,
        [
          {
            accountCode: advanceAccount.accountCode,
            accountName: advanceAccount.accountName,
            particulars,
            amount: rounded,
          },
        ],
        rounded
      );
      await tx.cashBookPaymentVoucher.update({
        where: { id: existing.id },
        data: {
          paidTo: voucher.driverName,
          voucherDate: voucher.tripDate,
        },
      });
    });

    revalidateDriverCashBook(existing.id);
    return existing.id;
  }

  const voucherNo = await nextPaymentVoucherNo(voucher.tripDate);
  const pvId = randomUUID();

  await prisma.$transaction(async (tx) => {
    await tx.cashBookPaymentVoucher.create({
      data: {
        id: pvId,
        voucherNo,
        book: "MYR",
        voucherDate: voucher.tripDate,
        paidTo: voucher.driverName,
        paymentMethod: "CASH",
        status: "confirmed",
        confirmedAt: new Date(),
        confirmedBy: input.actorUserId,
        totalAmount: rounded,
        createdBy: input.actorUserId,
        lines: {
          create: [
            {
              id: randomUUID(),
              lineOrder: 0,
              accountCode: advanceAccount.accountCode,
              accountName: advanceAccount.accountName,
              particulars,
              amount: rounded,
            },
          ],
        },
      },
    });
    await tx.driverVoucher.update({
      where: { id: voucher.id },
      data: { cashBookPaymentVoucherId: pvId },
    });
  });

  revalidateDriverCashBook(pvId);
  return pvId;
}

async function syncDriverVoucherSettlementCashBookInTx(
  tx: Prisma.TransactionClient,
  input: {
    voucher: DriverVoucherCashBookSource;
    actorUserId: string;
  }
): Promise<string> {
  const { voucher } = input;
  const particulars = buildDriverVoucherParticulars(voucher);
  const lines = buildDriverVoucherSettlementLines({
    chopBorderActual: voucher.chopBorderActual,
    fishCheckActual: voucher.fishCheckActual,
    kpbActual: voucher.kpbActual,
    upahTurunActual: voucher.upahTurunActual,
    upahNaikTongActual: voucher.upahNaikTongActual,
    parkingActual: voucher.parkingActual,
    minyakMotoEnabled: voucher.minyakMotoEnabled,
    minyakMotoActual: voucher.minyakMotoActual,
    otherActual: voucher.otherActual,
    particulars,
  });
  const totalAmount = sumPaymentVoucherLines(lines);

  if (voucher.cashBookPaymentVoucherId) {
    const existing = await tx.cashBookPaymentVoucher.findUnique({
      where: { id: voucher.cashBookPaymentVoucherId },
    });
    if (!existing) {
      throw new Error("关联现金簿凭证不存在 / Linked payment voucher missing");
    }

    await replacePaymentVoucherLinesInTx(
      tx,
      existing.id,
      lines,
      totalAmount
    );
    await tx.cashBookPaymentVoucher.update({
      where: { id: existing.id },
      data: {
        paidTo: voucher.driverName,
        voucherDate: voucher.tripDate,
        status: "confirmed",
        confirmedAt: existing.confirmedAt ?? new Date(),
        confirmedBy: existing.confirmedBy ?? input.actorUserId,
      },
    });
    return existing.id;
  }

  const voucherNo = await nextPaymentVoucherNo(voucher.tripDate);
  const pvId = randomUUID();

  await tx.cashBookPaymentVoucher.create({
    data: {
      id: pvId,
      voucherNo,
      book: "MYR",
      voucherDate: voucher.tripDate,
      paidTo: voucher.driverName,
      paymentMethod: "CASH",
      status: "confirmed",
      confirmedAt: new Date(),
      confirmedBy: input.actorUserId,
      totalAmount,
      createdBy: input.actorUserId,
      lines: {
        create: lines.map((line, index) => ({
          id: randomUUID(),
          lineOrder: index,
          accountCode: line.accountCode,
          accountName: line.accountName,
          particulars: line.particulars,
          amount: line.amount,
        })),
      },
    },
  });
  await tx.driverVoucher.update({
    where: { id: voucher.id },
    data: { cashBookPaymentVoucherId: pvId },
  });
  return pvId;
}

/**
 * Replace advance PV with belanja account lines (same voucher no / confirmedAt).
 * Creates a confirmed PV if advance was never recorded.
 * Pass `tx` to run inside an outer transaction (status + cash book together).
 */
export async function syncDriverVoucherSettlementCashBook(input: {
  driverVoucherId: string;
  actorUserId: string;
  tx?: Prisma.TransactionClient;
}): Promise<string> {
  const run = async (tx: Prisma.TransactionClient) => {
    const voucher = (await tx.driverVoucher.findUnique({
      where: { id: input.driverVoucherId },
    })) as DriverVoucherCashBookSource | null;
    if (!voucher) throw new Error("Voucher not found");

    return syncDriverVoucherSettlementCashBookInTx(tx, {
      voucher,
      actorUserId: input.actorUserId,
    });
  };

  if (input.tx) {
    const pvId = await run(input.tx);
    revalidateDriverCashBook(pvId);
    return pvId;
  }

  const pvId = await prisma.$transaction((tx) => run(tx));
  revalidateDriverCashBook(pvId);
  return pvId;
}
