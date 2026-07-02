import { getHaideeAccountingInvoiceDetails } from "@/lib/constants/haidee-company-details";
import { getWtlAccountingInvoiceDetails } from "@/lib/constants/wtl-company-details";
import type { MonthlyInvoiceMode } from "@/lib/constants/monthly-invoice";
import type { HaideeMonthlyInvoiceData } from "@/lib/monthly-invoice-mode-haidee";
import type { WtlMonthlyInvoiceData } from "@/lib/monthly-invoice-mode4";
import { formatDisplayDate } from "@/lib/date-utils";
import { resolveFreightInvoiceDocNo } from "@/lib/monthly-invoice-docno";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";

export interface AccountingPrintMeta {
  invoiceNo: string;
  invoiceDateLabel: string;
  termsLabel: string;
}

type AccountingPrintInvoiceData = WtlMonthlyInvoiceData | HaideeMonthlyInvoiceData;

export async function buildAccountingPrintMeta(input: {
  mode: MonthlyInvoiceMode;
  billToRole: "shipper" | "consignee";
  customerId: string;
  year: number;
  month: number;
}): Promise<AccountingPrintMeta> {
  const { end } = getMonthDateRange(input.year, input.month);
  const invoiceNo = await resolveFreightInvoiceDocNo(input);
  const details =
    input.mode === "3" || input.mode === "4"
      ? getWtlAccountingInvoiceDetails()
      : getHaideeAccountingInvoiceDetails(
          input.mode === "1b" ? "1b" : input.mode === "2" ? "2" : "1a"
        );

  return {
    invoiceNo: invoiceNo ?? "—",
    invoiceDateLabel: formatDisplayDate(end),
    termsLabel: details.terms,
  };
}

export async function attachAccountingPrint(
  data: AccountingPrintInvoiceData,
  input: {
    mode: MonthlyInvoiceMode;
    customerId: string;
    year: number;
    month: number;
  }
): Promise<AccountingPrintInvoiceData> {
  return {
    ...data,
    accountingPrint: await buildAccountingPrintMeta({
      mode: input.mode,
      billToRole: data.billToRole,
      customerId: input.customerId,
      year: input.year,
      month: input.month,
    }),
  };
}
