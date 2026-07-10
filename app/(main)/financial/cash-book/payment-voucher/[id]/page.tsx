import { getPaymentVoucher } from "@/app/actions/cash-book-payment-voucher";
import { PaymentVoucherPrintView } from "@/components/cash-book/PaymentVoucherPrintView";
import { PageError } from "@/components/shared/PageError";
import { requirePageUser } from "@/lib/auth";
import { canAccessCashBook, canWriteCashBook } from "@/lib/auth-roles";
import { notFound, redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PaymentVoucherDetailPage({ params }: PageProps) {
  const user = await requirePageUser();
  if (!canAccessCashBook(user.role)) redirect("/dashboard");

  const { id } = await params;

  try {
    const voucher = await getPaymentVoucher(id);
    if (!voucher) notFound();

    return (
      <PaymentVoucherPrintView
        voucher={voucher}
        canWrite={canWriteCashBook(user.role)}
      />
    );
  } catch (error) {
    return <PageError error={error} />;
  }
}
