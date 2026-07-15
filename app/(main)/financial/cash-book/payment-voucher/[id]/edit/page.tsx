import { getPaymentVoucher } from "@/app/actions/cash-book-payment-voucher";
import { getPaymentVoucherThaiSettlementLink } from "@/app/actions/thai-cash-book-settlement";
import { PaymentVoucherFormView } from "@/components/cash-book/PaymentVoucherFormView";
import { PageError } from "@/components/shared/PageError";
import { requirePageUser } from "@/lib/auth";
import { canAccessCashBook, canWriteCashBook } from "@/lib/auth-roles";
import { notFound, redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}

export default async function PaymentVoucherEditPage({
  params,
  searchParams,
}: PageProps) {
  const user = await requirePageUser();
  if (!canAccessCashBook(user.role)) redirect("/dashboard");
  if (!canWriteCashBook(user.role)) redirect("/financial/cash-book/payment-voucher");

  const { id } = await params;
  const { from } = await searchParams;

  try {
    const voucher = await getPaymentVoucher(id);
    if (!voucher) notFound();
    const linked = await getPaymentVoucherThaiSettlementLink(id);
    const thaiSettlementConfirmMode =
      linked && voucher.status === "draft";
    const returnTo =
      from === "thai-settlement"
        ? "thai-settlement"
        : from === "ledger-thb"
          ? "ledger-thb"
          : thaiSettlementConfirmMode
            ? "thai-settlement"
            : "payment-list";

    return (
      <PaymentVoucherFormView
        existing={voucher}
        canWrite
        thaiSettlementConfirmMode={thaiSettlementConfirmMode}
        returnTo={returnTo}
      />
    );
  } catch (error) {
    return <PageError error={error} />;
  }
}
