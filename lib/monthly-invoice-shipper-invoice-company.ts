import type { MonthlyInvoiceMode } from "@/lib/constants/monthly-invoice";
import {
  normalizeShipperInvoiceCompany,
  type ShipperInvoiceCompany,
} from "@/lib/constants/shipper-invoice-company";
import { prisma } from "@/lib/prisma";

export async function resolveShipperInvoiceCompanyForPrint(input: {
  mode: MonthlyInvoiceMode;
  billToRole: "shipper" | "consignee";
  customerId: string;
}): Promise<ShipperInvoiceCompany> {
  if (input.mode !== "1a" || input.billToRole !== "shipper") {
    return "haidee";
  }

  const shipper = await prisma.shipper.findUnique({
    where: { id: input.customerId },
    select: { invoiceCompany: true },
  });

  return normalizeShipperInvoiceCompany(shipper?.invoiceCompany);
}
