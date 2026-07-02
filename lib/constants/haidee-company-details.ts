/** HAIDEE company block for mode 1a THB invoices (accounting print layout). */
export const HAIDEE_MODE1A_INVOICE_DETAILS = {
  registrationNo: "0905567001730",
  addressLines: [
    "38/88 Moo1, Kanjanawanid Road, Samnakkham, Sadao, Songkhla 90320",
  ],
  phone: "Tel: 092-270 1477",
  terms: "Net 7 days",
  bankAccount: "Bangkok Bank 259-3-12533-5",
  computerGeneratedNote:
    "This is computer generated invoice no signature required",
} as const;

/** HAIDEE mode 1b MYR invoices — same company block, WTL collection bank. */
export const HAIDEE_MODE1B_INVOICE_DETAILS = {
  registrationNo: HAIDEE_MODE1A_INVOICE_DETAILS.registrationNo,
  addressLines: [...HAIDEE_MODE1A_INVOICE_DETAILS.addressLines],
  phone: HAIDEE_MODE1A_INVOICE_DETAILS.phone,
  terms: HAIDEE_MODE1A_INVOICE_DETAILS.terms,
  bankAccount: "WTL EXPRESS SDN BHD, Public Bank 323-024-1725",
  computerGeneratedNote: HAIDEE_MODE1A_INVOICE_DETAILS.computerGeneratedNote,
} as const;

export type HaideeAccountingInvoiceMode = "1a" | "1b" | "2";

export function getHaideeAccountingInvoiceDetails(mode: HaideeAccountingInvoiceMode) {
  if (mode === "1a") return HAIDEE_MODE1A_INVOICE_DETAILS;
  return HAIDEE_MODE1B_INVOICE_DETAILS;
}
