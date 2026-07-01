import { buildArDocNoRegistry } from "@/lib/ar-invoice-export/ar-invoice-docno-registry";
import type { MonthlyInvoiceMode } from "@/lib/constants/monthly-invoice";
import type { HaideeMonthlyInvoiceBillToRole } from "@/lib/monthly-invoice-mode-haidee";

function formatYearMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function buildFreightReceivableInvoiceKey(input: {
  mode: MonthlyInvoiceMode;
  billToRole: HaideeMonthlyInvoiceBillToRole;
  customerId: string;
  year: number;
  month: number;
}): string {
  return `freight:${input.mode}:${input.billToRole}:${input.customerId}:${formatYearMonth(input.year, input.month)}`;
}

/** Resolve HD-/HDR-/EXP- DocNo for a monthly freight invoice (AR export registry). */
export async function resolveFreightInvoiceDocNo(input: {
  mode: MonthlyInvoiceMode;
  billToRole: HaideeMonthlyInvoiceBillToRole;
  customerId: string;
  year: number;
  month: number;
}): Promise<string | null> {
  const entityKey = buildFreightReceivableInvoiceKey(input);
  const registry = await buildArDocNoRegistry(input.year, input.month);
  return registry.byEntityKey.get(entityKey) ?? null;
}
