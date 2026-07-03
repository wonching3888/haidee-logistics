import { getHaideeAccountingInvoiceDetails } from "@/lib/constants/haidee-company-details";
import {
  HUPDEE_INVOICE_COMPANY_HEADER,
  HUPDEE_MODE1A_BBL_INVOICE_DETAILS,
  HUPDEE_MODE1A_KBANK_INVOICE_DETAILS,
} from "@/lib/constants/hupdee-company-details";
import { INVOICE_COMPANY_HEADERS } from "@/lib/constants/monthly-invoice";
import type { ShipperInvoiceCompany } from "@/lib/constants/shipper-invoice-company";

export interface Mode1aIssuerPrintBlock {
  nameZh: string;
  nameEn: string;
  nameTh?: string;
  addressLines: string[];
  phone: string;
  registrationNo: string;
  terms: string;
  bankAccount: string;
  computerGeneratedNote: string;
}

export function resolveMode1aIssuerPrint(
  invoiceCompany: ShipperInvoiceCompany | undefined
): Mode1aIssuerPrintBlock {
  if (invoiceCompany === "hupdee_bbl") {
    return {
      nameZh: HUPDEE_INVOICE_COMPANY_HEADER.nameZh,
      nameEn: HUPDEE_INVOICE_COMPANY_HEADER.nameEn,
      nameTh: HUPDEE_INVOICE_COMPANY_HEADER.nameTh,
      ...HUPDEE_MODE1A_BBL_INVOICE_DETAILS,
      addressLines: [...HUPDEE_MODE1A_BBL_INVOICE_DETAILS.addressLines],
    };
  }
  if (invoiceCompany === "hupdee_kbank") {
    return {
      nameZh: HUPDEE_INVOICE_COMPANY_HEADER.nameZh,
      nameEn: HUPDEE_INVOICE_COMPANY_HEADER.nameEn,
      nameTh: HUPDEE_INVOICE_COMPANY_HEADER.nameTh,
      ...HUPDEE_MODE1A_KBANK_INVOICE_DETAILS,
      addressLines: [...HUPDEE_MODE1A_KBANK_INVOICE_DETAILS.addressLines],
    };
  }
  const company = INVOICE_COMPANY_HEADERS.haidee;
  const details = getHaideeAccountingInvoiceDetails("1a");
  return {
    nameZh: company.nameZh,
    nameEn: company.nameEn,
    nameTh: "บริษัท ไฮดี โลจิสติกส์ จำกัด",
    ...details,
    addressLines: [...details.addressLines],
  };
}

/** Mode 1a bank line: payee company name + bank account (matches 1b/2 accounting style). */
export function formatMode1aBankAccountLine(
  issuer: Pick<Mode1aIssuerPrintBlock, "nameEn" | "bankAccount">
): string {
  return `${issuer.nameEn}, ${issuer.bankAccount}`;
}
