import { getPaymentVoucher } from "@/app/actions/cash-book-payment-voucher";
import { PaymentVoucherFormView } from "@/components/cash-book/PaymentVoucherFormView";
import { PageError } from "@/components/shared/PageError";
import { requirePageUser } from "@/lib/auth";
import { canAccessCashBook, canWriteCashBook } from "@/lib/auth-roles";
import { notFound, redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PaymentVoucherEditPage({ params }: PageProps) {
  const user = await requirePageUser();
  if (!canAccessCashBook(user.role)) redirect("/dashboard");
  if (!canWriteCashBook(user.role)) redirect("/financial/cash-book/payment-voucher");

  const { id } = await params;

  try {
    const voucher = await getPaymentVoucher(id);
    if (!voucher) notFound();

    return <PaymentVoucherFormView existing={voucher} canWrite />;
  } catch (error) {
    return <PageError error={error} />;
  }
}
