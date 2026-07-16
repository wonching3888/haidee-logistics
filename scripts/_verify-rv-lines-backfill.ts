/**
 * Stage-1 readonly verify: RV header ↔ lineOrder=1 backfill + closing balance regress.
 *
 * Env:
 *   PRE_CLOSING_THB / PRE_CLOSING_MYR — closing balances captured BEFORE migration
 *   (from scripts/_snapshot-cash-book-closing-readonly.ts). Required.
 *
 * Run: npx tsx --env-file=.env.local scripts/_verify-rv-lines-backfill.ts
 * Exit 0 only when all checks pass.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function money(n: unknown) {
  return roundMoney(Number(n ?? 0));
}

async function closingForBook(
  prisma: PrismaClient,
  book: "THB" | "MYR"
) {
  const [openingRow, rvAgg, pvAgg] = await Promise.all([
    prisma.cashBookOpeningBalanceAdjustment.findFirst({
      where: { book },
      orderBy: { createdAt: "desc" },
      select: { newAmount: true },
    }),
    prisma.cashBookReceiptVoucher.aggregate({
      where: { book, status: "confirmed" },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.cashBookPaymentVoucher.aggregate({
      where: { book, status: "confirmed" },
      _sum: { totalAmount: true },
      _count: true,
    }),
  ]);
  const opening = money(openingRow?.newAmount);
  const receiptSum = money(rvAgg._sum.amount);
  const paymentSum = money(pvAgg._sum.totalAmount);
  return {
    book,
    opening,
    confirmedReceiptCount: rvAgg._count,
    confirmedReceiptSum: receiptSum,
    confirmedPaymentCount: pvAgg._count,
    confirmedPaymentSum: paymentSum,
    closing: roundMoney(opening + receiptSum - paymentSum),
  };
}

async function main() {
  const preThbRaw = process.env.PRE_CLOSING_THB;
  const preMyrRaw = process.env.PRE_CLOSING_MYR;
  if (preThbRaw == null || preThbRaw === "" || preMyrRaw == null || preMyrRaw === "") {
    throw new Error(
      "PRE_CLOSING_THB and PRE_CLOSING_MYR are required (run _snapshot-cash-book-closing-readonly.ts first)"
    );
  }
  const preThb = roundMoney(Number(preThbRaw));
  const preMyr = roundMoney(Number(preMyrRaw));
  if (!Number.isFinite(preThb) || !Number.isFinite(preMyr)) {
    throw new Error("PRE_CLOSING_THB / PRE_CLOSING_MYR must be finite numbers");
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  try {
    const voucherCount = await prisma.cashBookReceiptVoucher.count();
    const lineCount = await prisma.cashBookReceiptVoucherLine.count();
    const lineOrderStats = await prisma.cashBookReceiptVoucherLine.groupBy({
      by: ["lineOrder"],
      _count: true,
    });
    const vouchersWithLineCount = await prisma.$queryRaw<
      Array<{ vouchers_with_n_lines: bigint; n: bigint }>
    >`
      SELECT COUNT(*)::bigint AS vouchers_with_n_lines, line_count AS n
      FROM (
        SELECT v.id, COUNT(l.id)::bigint AS line_count
        FROM cash_book_receipt_vouchers v
        LEFT JOIN cash_book_receipt_voucher_lines l ON l.voucher_id = v.id
        GROUP BY v.id
      ) t
      GROUP BY line_count
      ORDER BY n
    `;

    const mismatches = await prisma.$queryRaw<
      Array<{
        voucher_no: string;
        header_amount: unknown;
        line_amount: unknown;
        header_account_code: string;
        line_account_code: string;
        header_account_name: string;
        line_account_name: string;
        header_notes: string | null;
        line_particulars: string | null;
        amount_diff: boolean;
        account_code_diff: boolean;
        account_name_diff: boolean;
        notes_diff: boolean;
      }>
    >`
      SELECT
        v.voucher_no,
        v.amount AS header_amount,
        l.amount AS line_amount,
        v.account_code AS header_account_code,
        l.account_code AS line_account_code,
        v.account_name AS header_account_name,
        l.account_name AS line_account_name,
        v.notes AS header_notes,
        l.particulars AS line_particulars,
        (v.amount IS DISTINCT FROM l.amount) AS amount_diff,
        (v.account_code IS DISTINCT FROM l.account_code) AS account_code_diff,
        (v.account_name IS DISTINCT FROM l.account_name) AS account_name_diff,
        (v.notes IS DISTINCT FROM l.particulars) AS notes_diff
      FROM cash_book_receipt_vouchers v
      LEFT JOIN cash_book_receipt_voucher_lines l
        ON l.voucher_id = v.id AND l.line_order = 1
      WHERE l.id IS NULL
         OR v.amount IS DISTINCT FROM l.amount
         OR v.account_code IS DISTINCT FROM l.account_code
         OR v.account_name IS DISTINCT FROM l.account_name
         OR v.notes IS DISTINCT FROM l.particulars
      ORDER BY v.voucher_no
    `;

    const amountDiffCount = mismatches.filter((m) => m.amount_diff).length;
    const accountCodeDiffCount = mismatches.filter(
      (m) => m.account_code_diff
    ).length;
    const accountNameDiffCount = mismatches.filter(
      (m) => m.account_name_diff
    ).length;
    const notesDiffCount = mismatches.filter((m) => m.notes_diff).length;
    const missingLineCount = mismatches.filter(
      (m) => m.line_amount == null && m.line_account_code == null
    ).length;

    const thb = await closingForBook(prisma, "THB");
    const myr = await closingForBook(prisma, "MYR");

    const thbClosingDiff = roundMoney(thb.closing - preThb);
    const myrClosingDiff = roundMoney(myr.closing - preMyr);

    const failures: string[] = [];
    if (voucherCount !== lineCount) {
      failures.push(
        `voucherCount(${voucherCount}) !== lineCount(${lineCount})`
      );
    }
    const onlyOneLineOrder =
      lineOrderStats.length === 1 && lineOrderStats[0]?.lineOrder === 1;
    if (voucherCount > 0 && !onlyOneLineOrder) {
      failures.push(
        `unexpected lineOrder distribution: ${JSON.stringify(lineOrderStats)}`
      );
    }
    const allHaveExactlyOneLine =
      vouchersWithLineCount.length === 1 &&
      Number(vouchersWithLineCount[0]?.n) === 1 &&
      Number(vouchersWithLineCount[0]?.vouchers_with_n_lines) === voucherCount;
    if (voucherCount > 0 && !allHaveExactlyOneLine) {
      failures.push(
        `not every voucher has exactly 1 line: ${JSON.stringify(
          vouchersWithLineCount.map((r) => ({
            n: Number(r.n),
            vouchers: Number(r.vouchers_with_n_lines),
          }))
        )}`
      );
    }
    if (mismatches.length > 0) {
      failures.push(`header↔line mismatches: ${mismatches.length}`);
    }
    if (thbClosingDiff !== 0) {
      failures.push(
        `THB closing regress: pre=${preThb} post=${thb.closing} diff=${thbClosingDiff}`
      );
    }
    if (myrClosingDiff !== 0) {
      failures.push(
        `MYR closing regress: pre=${preMyr} post=${myr.closing} diff=${myrClosingDiff}`
      );
    }

    const report = {
      voucherCount,
      lineCount,
      lineOrderStats,
      vouchersWithLineCount: vouchersWithLineCount.map((r) => ({
        lineCount: Number(r.n),
        voucherCount: Number(r.vouchers_with_n_lines),
      })),
      mismatchTotals: {
        rows: mismatches.length,
        missingLineCount,
        amountDiffCount,
        accountCodeDiffCount,
        accountNameDiffCount,
        notesDiffCount,
      },
      mismatchesSample: mismatches.slice(0, 20),
      closing: {
        pre: { THB: preThb, MYR: preMyr },
        post: { THB: thb, MYR: myr },
        diff: { THB: thbClosingDiff, MYR: myrClosingDiff },
      },
      failures,
      pass: failures.length === 0,
    };

    console.log(JSON.stringify(report, null, 2));
    if (!report.pass) process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
