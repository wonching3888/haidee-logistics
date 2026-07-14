import { config } from "dotenv";
config({ path: ".env.local" });
import { prisma } from "@/lib/prisma";
import { buildCashBookLedgerRows } from "@/lib/cash-book/ledger";
import { toDateInputValue } from "@/lib/date-utils";
import { decimalToNumber } from "@/lib/freight-rates";

async function main() {
  const openingRow = await prisma.cashBookOpeningBalanceAdjustment.findFirst({
    where: { book: "THB" },
    orderBy: { createdAt: "desc" },
  });
  const opening = openingRow ? Number(openingRow.newAmount) : 0;
  const [payments, receipts] = await Promise.all([
    prisma.cashBookPaymentVoucher.findMany({
      where: { book: "THB", status: "confirmed" },
      include: { lines: { orderBy: { lineOrder: "asc" }, take: 1 } },
    }),
    prisma.cashBookReceiptVoucher.findMany({
      where: { book: "THB", status: "confirmed" },
    }),
  ]);
  const sourceRows = [
    ...payments.map((p) => ({
      kind: "payment" as const,
      id: p.id,
      voucherNo: p.voucherNo,
      voucherDate: toDateInputValue(p.voucherDate),
      description: p.paidTo,
      amount: decimalToNumber(p.totalAmount) ?? 0,
      sortKey: (p.confirmedAt ?? p.createdAt).toISOString(),
    })),
    ...receipts.map((r) => ({
      kind: "receipt" as const,
      id: r.id,
      voucherNo: r.voucherNo,
      voucherDate: toDateInputValue(r.voucherDate),
      description: r.receivedFrom,
      amount: decimalToNumber(r.amount) ?? 0,
      sortKey: (r.confirmedAt ?? r.createdAt).toISOString(),
    })),
  ];
  const rows = buildCashBookLedgerRows({
    book: "THB",
    openingBalance: opening,
    sourceRows,
  });
  const closing = rows[rows.length - 1]?.balance;
  const byAcc = new Map<string, { n: number; amount: number; type: string }>();
  for (const p of payments) {
    const code = p.lines[0]?.accountCode ?? "?";
    const cur = byAcc.get(code) || { n: 0, amount: 0, type: "PV" };
    cur.n += 1;
    cur.amount = Math.round((cur.amount + Number(p.totalAmount)) * 100) / 100;
    byAcc.set(code, cur);
  }
  for (const r of receipts) {
    const code = r.accountCode;
    const cur = byAcc.get(code) || { n: 0, amount: 0, type: "RV" };
    cur.n += 1;
    cur.amount = Math.round((cur.amount + Number(r.amount)) * 100) / 100;
    cur.type = "RV";
    byAcc.set(code, cur);
  }
  const importedPv = payments.filter((p) => p.preparedBy === "JULY2026_IMPORT").length;
  const importedRv = receipts.filter((r) => r.preparedBy === "JULY2026_IMPORT").length;
  const pvSum = payments.reduce((s, p) => s + Number(p.totalAmount), 0);
  const rvSum = receipts.reduce((s, r) => s + Number(r.amount), 0);
  console.log(
    JSON.stringify(
      {
        opening,
        importedPv,
        importedRv,
        confirmedPv: payments.length,
        confirmedRv: receipts.length,
        pvSum: Math.round(pvSum * 100) / 100,
        rvSum: Math.round(rvSum * 100) / 100,
        closing,
        expectedClosing: 135509,
        match: closing === 135509,
        byAccount: Object.fromEntries([...byAcc.entries()].sort()),
        rvSample: receipts.map((r) => ({
          voucherNo: r.voucherNo,
          accountCode: r.accountCode,
          amount: Number(r.amount),
          receivedFrom: r.receivedFrom,
        })),
      },
      null,
      2
    )
  );
  await prisma.$disconnect();
}
main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
