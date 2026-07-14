/** Prefill URL for THB Payment Voucher new form (account left blank). */
export function buildThbPaymentVoucherPrefillHref(input: {
  voucherDate: string;
  particulars: string;
  amountThb: number;
  paidTo?: string;
}): string {
  const params = new URLSearchParams({
    book: "THB",
    voucherDate: input.voucherDate,
    particulars: input.particulars,
    amount: String(input.amountThb),
  });
  if (input.paidTo?.trim()) {
    params.set("paidTo", input.paidTo.trim());
  }
  return `/financial/cash-book/payment-voucher/new?${params.toString()}`;
}
