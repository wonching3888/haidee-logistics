import {
  bankAccountsForCurrency,
  isInvoiceBankAccount,
} from "@/lib/constants/invoice-bank-accounts";
import { roundMoney } from "@/lib/invoice-allocation";
import {
  type BankReconciliationAccountGroup,
  type BankReconciliationData,
  type BankReconciliationPaymentRow,
} from "@/lib/bank-reconciliation-shared";
import { prisma } from "@/lib/prisma";
import {
  loadReceivableInvoicesForRange,
  parseReceivableCustomerKey,
  type ReceivableCurrency,
} from "@/lib/receivable-invoices";

export type {
  BankReconciliationAccountGroup,
  BankReconciliationData,
  BankReconciliationPaymentRow,
} from "@/lib/bank-reconciliation-shared";
export {
  buildBankReconciliationCsv,
  defaultBankReconciliationMonthRange,
  flattenBankReconciliationRows,
} from "@/lib/bank-reconciliation-shared";

function invoiceLedgerKey(invoiceType: string, invoiceKey: string) {
  return `${invoiceType}|${invoiceKey}`;
}

function parseDateInput(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("无效日期 Invalid date");
  }
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function resolveCustomerNamesByKeys(
  customerKeys: string[]
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const shipperIds: string[] = [];
  const consigneeIds: string[] = [];

  for (const key of customerKeys) {
    try {
      const { kind, idOrName } = parseReceivableCustomerKey(key);
      if (kind === "charter_manual") {
        names.set(key, idOrName);
      } else if (kind === "shipper") {
        if (UUID_RE.test(idOrName)) shipperIds.push(idOrName);
        else names.set(key, idOrName);
      } else if (kind === "consignee") {
        if (UUID_RE.test(idOrName)) consigneeIds.push(idOrName);
        else names.set(key, idOrName);
      }
    } catch {
      names.set(key, key);
    }
  }

  const uniqueShipperIds = Array.from(new Set(shipperIds));
  const uniqueConsigneeIds = Array.from(new Set(consigneeIds));

  const [shippers, consignees] = await Promise.all([
    uniqueShipperIds.length > 0
      ? prisma.shipper.findMany({
          where: { id: { in: uniqueShipperIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    uniqueConsigneeIds.length > 0
      ? prisma.consignee.findMany({
          where: { id: { in: uniqueConsigneeIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const shipperNameById = new Map(shippers.map((s) => [s.id, s.name]));
  const consigneeNameById = new Map(consignees.map((c) => [c.id, c.name]));

  for (const key of customerKeys) {
    if (names.has(key)) continue;
    try {
      const { kind, idOrName } = parseReceivableCustomerKey(key);
      if (kind === "shipper") {
        names.set(key, shipperNameById.get(idOrName) ?? idOrName);
      } else if (kind === "consignee") {
        names.set(key, consigneeNameById.get(idOrName) ?? idOrName);
      }
    } catch {
      names.set(key, key);
    }
  }

  return names;
}

function buildEmptyGroups(
  currency: ReceivableCurrency
): BankReconciliationAccountGroup[] {
  return bankAccountsForCurrency(currency).map((bankAccount) => ({
    bankAccount,
    currency,
    totalAmount: 0,
    reconciledAmount: 0,
    unreconciledAmount: 0,
    payments: [],
  }));
}

/**
 * Line-level invoice payments for bank reconciliation, grouped by bank account.
 * Totals per account must match invoice-collections "Bank account receipts"
 * for the same calendar date range (month bounds).
 */
export async function loadPaymentsForBankReconciliation(
  dateFrom: string,
  dateTo: string
): Promise<BankReconciliationData> {
  const start = parseDateInput(dateFrom);
  const end = parseDateInput(dateTo);
  if (start.getTime() > end.getTime()) {
    throw new Error("起始日期不能晚于结束日期 Invalid date range");
  }

  const rows = await prisma.invoicePayment.findMany({
    where: {
      paymentDate: { gte: start, lte: end },
    },
    orderBy: [{ paymentDate: "asc" }, { createdAt: "asc" }],
    include: {
      allocations: {
        orderBy: [{ yearMonth: "asc" }, { invoiceKey: "asc" }],
      },
    },
  });

  const customerKeys = Array.from(new Set(rows.map((r) => r.customerKey)));
  const customerNames = await resolveCustomerNamesByKeys(customerKeys);

  const yearMonths = new Set<string>();
  for (const row of rows) {
    for (const alloc of row.allocations) {
      if (alloc.yearMonth) yearMonths.add(alloc.yearMonth);
    }
  }

  let invoiceNoByKey = new Map<string, string | null>();
  if (yearMonths.size > 0) {
    const months = Array.from(yearMonths).sort();
    const first = months[0];
    const last = months[months.length - 1];
    const [fromYear, fromMonth] = first.split("-").map(Number);
    const [toYear, toMonth] = last.split("-").map(Number);
    const invoices = await loadReceivableInvoicesForRange({
      fromYear,
      fromMonth,
      toYear,
      toMonth,
    });
    invoiceNoByKey = new Map(
      invoices.map((invoice) => [
        invoiceLedgerKey(invoice.invoiceType, invoice.invoiceKey),
        invoice.invoiceNo,
      ])
    );
  }

  const thbGroups = buildEmptyGroups("THB");
  const myrGroups = buildEmptyGroups("MYR");
  const groupIndex = new Map<string, BankReconciliationAccountGroup>();
  for (const group of [...thbGroups, ...myrGroups]) {
    groupIndex.set(`${group.currency}|${group.bankAccount}`, group);
  }

  for (const row of rows) {
    const currency = row.currency as ReceivableCurrency;
    if (currency !== "THB" && currency !== "MYR") continue;
    if (!isInvoiceBankAccount(row.bankAccount)) continue;

    const group = groupIndex.get(`${currency}|${row.bankAccount}`);
    if (!group) continue;

    const invoiceNos = Array.from(
      new Set(
        row.allocations
          .map(
            (alloc) =>
              invoiceNoByKey.get(
                invoiceLedgerKey(alloc.invoiceType, alloc.invoiceKey)
              ) ?? null
          )
          .filter((no): no is string => Boolean(no && no.trim()))
      )
    ).join(", ");

    const amount = roundMoney(Number(row.amount));
    const payment: BankReconciliationPaymentRow = {
      id: row.id,
      paymentDate: row.paymentDate.toISOString().slice(0, 10),
      customerKey: row.customerKey,
      customerName: customerNames.get(row.customerKey) ?? row.customerKey,
      amount,
      currency,
      bankAccount: row.bankAccount,
      invoiceNos,
      isReconciled: row.isReconciled,
      reconciledAt: row.reconciledAt
        ? row.reconciledAt.toISOString()
        : null,
      reconciledBy: row.reconciledBy,
    };

    group.payments.push(payment);
    group.totalAmount = roundMoney(group.totalAmount + amount);
    if (payment.isReconciled) {
      group.reconciledAmount = roundMoney(group.reconciledAmount + amount);
    } else {
      group.unreconciledAmount = roundMoney(
        group.unreconciledAmount + amount
      );
    }
  }

  return { dateFrom, dateTo, thbGroups, myrGroups };
}
