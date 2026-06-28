import type { InvoiceBankAccount } from "@/lib/constants/invoice-bank-accounts";
import { ledgerCollectionKey, roundMoney } from "@/lib/invoice-allocation";
import { buildPaymentDateBounds } from "@/lib/invoice-collections-overview";
import { prisma } from "@/lib/prisma";
import type { ReceivableCurrency } from "@/lib/receivable-invoices";

export async function loadPaymentOverviewForRange(input: {
  fromYear: number;
  fromMonth: number;
  toYear: number;
  toMonth: number;
}) {
  const { start, end } = buildPaymentDateBounds(input);

  const [currencyRows, bankRows, ledgerBankRows] = await Promise.all([
    prisma.invoicePayment.groupBy({
      by: ["currency"],
      where: {
        paymentDate: { gte: start, lte: end },
      },
      _sum: { amount: true, unallocatedAmount: true },
    }),
    prisma.invoicePayment.groupBy({
      by: ["currency", "bankAccount"],
      where: {
        paymentDate: { gte: start, lte: end },
      },
      _sum: { amount: true },
    }),
    prisma.invoicePayment.groupBy({
      by: ["customerKey", "currency", "bankAccount"],
      where: {
        paymentDate: { gte: start, lte: end },
      },
      _sum: { amount: true },
    }),
  ]);

  const paymentTotalsByCurrency: Record<
    ReceivableCurrency,
    { received: number; prepaid: number }
  > = {
    THB: { received: 0, prepaid: 0 },
    MYR: { received: 0, prepaid: 0 },
  };

  for (const row of currencyRows) {
    const currency = row.currency as ReceivableCurrency;
    if (currency !== "THB" && currency !== "MYR") continue;
    paymentTotalsByCurrency[currency] = {
      received: roundMoney(Number(row._sum.amount ?? 0)),
      prepaid: roundMoney(Number(row._sum.unallocatedAmount ?? 0)),
    };
  }

  const bankAmountsByCurrency: Record<
    ReceivableCurrency,
    Map<InvoiceBankAccount, number>
  > = {
    THB: new Map(),
    MYR: new Map(),
  };

  for (const row of bankRows) {
    const currency = row.currency as ReceivableCurrency;
    if (currency !== "THB" && currency !== "MYR") continue;
    const bankAccount = row.bankAccount as InvoiceBankAccount;
    bankAmountsByCurrency[currency].set(
      bankAccount,
      roundMoney(Number(row._sum.amount ?? 0))
    );
  }

  const ledgerBankAccounts = new Map<string, InvoiceBankAccount[]>();
  for (const row of ledgerBankRows) {
    const amount = Number(row._sum.amount ?? 0);
    if (amount <= 0) continue;
    const currency = row.currency as ReceivableCurrency;
    if (currency !== "THB" && currency !== "MYR") continue;
    const key = ledgerCollectionKey(row.customerKey, currency);
    const bankAccount = row.bankAccount as InvoiceBankAccount;
    const existing = ledgerBankAccounts.get(key) ?? [];
    if (!existing.includes(bankAccount)) {
      existing.push(bankAccount);
    }
    ledgerBankAccounts.set(key, existing);
  }

  return { paymentTotalsByCurrency, bankAmountsByCurrency, ledgerBankAccounts };
}
