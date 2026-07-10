import { listPaymentVouchers } from "@/app/actions/cash-book-payment-voucher";
import { PaymentVoucherListView } from "@/components/cash-book/PaymentVoucherListView";
import { PageError } from "@/components/shared/PageError";
import { requirePageUser } from "@/lib/auth";
import { canAccessCashBook, canWriteCashBook } from "@/lib/auth-roles";
import { redirect } from "next/navigation";

export default async function PaymentVoucherListPage() {
  const user = await requirePageUser();
  if (!canAccessCashBook(user.role)) redirect("/dashboard");

  try {
    const vouchers = await listPaymentVouchers();
    return (
      <PaymentVoucherListView
        vouchers={vouchers}
        canWrite={canWriteCashBook(user.role)}
      />
    );
  } catch (error) {
    return <PageError error={error} />;
  }
}
