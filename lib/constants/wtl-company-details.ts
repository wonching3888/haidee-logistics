/** WTL EXPRESS accounting invoice footer block (modes 3 / 4). */
export const WTL_ACCOUNTING_INVOICE_DETAILS = {
  terms: "Net 7 days",
  bankAccount: "Public Bank 323-024-1725",
  bankNotes:
    "All cheques should be crossed and made payable to WTL EXPRESS SDN BHD",
  computerGeneratedNote:
    "This is computer generated invoice no signature required",
} as const;

export function getWtlAccountingInvoiceDetails() {
  return WTL_ACCOUNTING_INVOICE_DETAILS;
}
