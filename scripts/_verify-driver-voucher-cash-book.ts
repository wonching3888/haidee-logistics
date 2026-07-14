/**
 * One-off verification for driver voucher ↔ cash book PV sync + Autocount filter.
 * Usage: npx tsx scripts/_verify-driver-voucher-cash-book.ts
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import { prisma } from "@/lib/prisma";
import {
  syncDriverVoucherAdvanceCashBook,
  syncDriverVoucherSettlementCashBook,
} from "@/lib/cash-book/driver-voucher-cash-book";
import {
  filterCashBookPvLinesForAutocountExport,
  loadCashBookPvAutocountExport,
} from "@/lib/cash-book/payment-voucher-autocount-export";
import { writeFileSync } from "fs";

async function main() {
  const admin = await prisma.user.findFirst({
    where: { email: "admin@haideelogistics.com" },
  });
  if (!admin) throw new Error("admin user missing");

  // Find a draft advance-pending voucher or any voucher with cash book link from today
  let voucher = await prisma.driverVoucher.findFirst({
    where: {
      status: "draft",
      duitJalan: { gt: 0 },
      chopBorderActual: null,
      parkingActual: null,
      kpbActual: null,
    },
    orderBy: { updatedAt: "desc" },
  });

  if (!voucher) {
    // Pick any recent voucher we can use for sync API smoke only — skip write if none
    console.log("No advance-pending draft found; looking for any linked voucher");
    voucher = await prisma.driverVoucher.findFirst({
      where: { cashBookPaymentVoucherId: { not: null } },
      orderBy: { updatedAt: "desc" },
    });
  }

  if (!voucher) {
    console.log("No usable voucher — creating link via advance sync requires an existing draft with duitJalan");
    process.exit(1);
  }

  console.log("VOUCHER_BEFORE", {
    id: voucher.id,
    voucherNo: voucher.voucherNo,
    status: voucher.status,
    duitJalan: voucher.duitJalan,
    cashBookPaymentVoucherId: voucher.cashBookPaymentVoucherId,
  });

  if (voucher.status === "draft") {
    // Ensure advance PV
    const pvId = await syncDriverVoucherAdvanceCashBook({
      driverVoucherId: voucher.id,
      actorUserId: admin.id,
    });
    console.log("ADVANCE_PV", pvId);

    let pv = await prisma.cashBookPaymentVoucher.findUnique({
      where: { id: pvId },
      include: { lines: { orderBy: { lineOrder: "asc" } } },
    });
    console.log("ADVANCE_SNAPSHOT", {
      voucherNo: pv?.voucherNo,
      status: pv?.status,
      totalAmount: pv?.totalAmount?.toString(),
      confirmedAt: pv?.confirmedAt?.toISOString(),
      lines: pv?.lines.map((l) => ({
        code: l.accountCode,
        amount: l.amount.toString(),
      })),
    });
    const confirmedAt1 = pv?.confirmedAt?.toISOString() ?? null;

    // Bump duit jalan and resync
    await prisma.driverVoucher.update({
      where: { id: voucher.id },
      data: { duitJalan: 320 },
    });
    await syncDriverVoucherAdvanceCashBook({
      driverVoucherId: voucher.id,
      actorUserId: admin.id,
    });
    pv = await prisma.cashBookPaymentVoucher.findUnique({
      where: { id: pvId },
      include: { lines: { orderBy: { lineOrder: "asc" } } },
    });
    console.log("AFTER_AMOUNT_SYNC", {
      totalAmount: pv?.totalAmount?.toString(),
      confirmedAt: pv?.confirmedAt?.toISOString(),
      confirmedAtUnchanged: pv?.confirmedAt?.toISOString() === confirmedAt1,
      lines: pv?.lines.map((l) => ({
        code: l.accountCode,
        amount: l.amount.toString(),
      })),
    });

    // Apply settlement actuals then replace PV
    await prisma.driverVoucher.update({
      where: { id: voucher.id },
      data: {
        chopBorderActual: 10,
        parkingActual: 15,
        kpbActual: 20,
        upahTurunActual: 30,
        fishCheckActual: 5,
        upahNaikTongActual: 4,
        minyakMotoEnabled: true,
        minyakMotoActual: 8,
        otherActual: 3,
        belanja: 95,
        baki: 320 - 95,
      },
    });
    await syncDriverVoucherSettlementCashBook({
      driverVoucherId: voucher.id,
      actorUserId: admin.id,
    });
    pv = await prisma.cashBookPaymentVoucher.findUnique({
      where: { id: pvId },
      include: { lines: { orderBy: { lineOrder: "asc" } } },
    });
    console.log("AFTER_SETTLE", {
      voucherNo: pv?.voucherNo,
      totalAmount: pv?.totalAmount?.toString(),
      confirmedAt: pv?.confirmedAt?.toISOString(),
      confirmedAtUnchanged: pv?.confirmedAt?.toISOString() === confirmedAt1,
      lines: pv?.lines.map((l) => ({
        code: l.accountCode,
        amount: l.amount.toString(),
      })),
    });

    const filtered = filterCashBookPvLinesForAutocountExport(pv?.lines ?? []);
    console.log(
      "AUTOCOUNT_FILTERED",
      filtered.map((l) => l.accountCode)
    );
    console.log(
      "AUTOCOUNT_EXCLUDES_3500",
      !filtered.some((l) => l.accountCode.startsWith("3500"))
    );
  }

  const exportResult = await loadCashBookPvAutocountExport({
    fromDate: "2026-07-01",
    toDate: "2026-07-31",
  });
  writeFileSync(
    "/tmp/haidee-export/cash-book-pv-autocount.csv",
    exportResult.csv,
    "utf8"
  );
  console.log("EXPORT", {
    rowCount: exportResult.rows.length,
    pendingAdvanceCount: exportResult.pendingAdvanceCount,
    sampleAccNos: [...new Set(exportResult.rows.map((r) => r.accNo))].slice(
      0,
      10
    ),
    has3500: exportResult.rows.some((r) => r.accNo.startsWith("3500")),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
