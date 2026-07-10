import { listReceiptVouchers } from "@/app/actions/cash-book-receipt-voucher";
import { ReceiptVoucherListView } from "@/components/cash-book/ReceiptVoucherListView";
import { PageError } from "@/components/shared/PageError";
import { requirePageUser } from "@/lib/auth";
import { canAccessCashBook, canWriteCashBook } from "@/lib/auth-roles";
import { redirect } from "next/navigation";

export default async function ReceiptVoucherListPage() {
  const user = await requirePageUser();
  if (!canAccessCashBook(user.role)) redirect("/dashboard");

  try {
    const vouchers = await listReceiptVouchers();
    return (
      <ReceiptVoucherListView
        vouchers={vouchers}
        canWrite={canWriteCashBook(user.role)}
      />
    );
  } catch (error) {
    return <PageError error={error} />;
  }
}
