import { ReceiptVoucherFormView } from "@/components/cash-book/ReceiptVoucherFormView";
import { requirePageUser } from "@/lib/auth";
import { canAccessCashBook, canWriteCashBook } from "@/lib/auth-roles";
import { redirect } from "next/navigation";

export default async function ReceiptVoucherNewPage() {
  const user = await requirePageUser();
  if (!canAccessCashBook(user.role)) redirect("/dashboard");
  if (!canWriteCashBook(user.role)) {
    redirect("/financial/cash-book/receipt-voucher");
  }

  return <ReceiptVoucherFormView canWrite />;
}
