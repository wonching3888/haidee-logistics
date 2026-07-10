import { PaymentVoucherFormView } from "@/components/cash-book/PaymentVoucherFormView";
import { requirePageUser } from "@/lib/auth";
import { canAccessCashBook, canWriteCashBook } from "@/lib/auth-roles";
import { redirect } from "next/navigation";

export default async function PaymentVoucherNewPage() {
  const user = await requirePageUser();
  if (!canAccessCashBook(user.role)) redirect("/dashboard");
  if (!canWriteCashBook(user.role)) redirect("/financial/cash-book/payment-voucher");

  return <PaymentVoucherFormView canWrite />;
}
