/**
 * Snapshot THB/MYR cash-book closing balances from voucher headers
 * (opening + confirmed RV − confirmed PV). Run BEFORE applying the RV-lines
 * migration so Stage-1 verify can regress closing amounts.
 *
 * Run: npx tsx --env-file=.env.local scripts/_snapshot-cash-book-closing-readonly.ts
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
  const [openingRow, rvAgg, pvAgg, rvCount, pvCount] = await Promise.all([
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
    prisma.cashBookReceiptVoucher.count({ where: { book } }),
    prisma.cashBookPaymentVoucher.count({ where: { book } }),
  ]);
  const opening = money(openingRow?.newAmount);
  const receiptSum = money(rvAgg._sum.amount);
  const paymentSum = money(pvAgg._sum.totalAmount);
  const closing = roundMoney(opening + receiptSum - paymentSum);
  return {
    book,
    opening,
    confirmedReceiptCount: rvAgg._count,
    confirmedReceiptSum: receiptSum,
    allReceiptCount: rvCount,
    confirmedPaymentCount: pvAgg._count,
    confirmedPaymentSum: paymentSum,
    allPaymentCount: pvCount,
    closing,
  };
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });
  try {
    const thb = await closingForBook(prisma, "THB");
    const myr = await closingForBook(prisma, "MYR");
    const out = {
      capturedAt: new Date().toISOString(),
      formula:
        "closing = opening(latest adjustment or 0) + sum(confirmed RV.amount) - sum(confirmed PV.totalAmount)",
      thb,
      myr,
    };
    console.log(JSON.stringify(out, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
