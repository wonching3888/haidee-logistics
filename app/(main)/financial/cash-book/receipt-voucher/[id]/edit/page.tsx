import { getReceiptVoucher } from "@/app/actions/cash-book-receipt-voucher";
import { ReceiptVoucherFormView } from "@/components/cash-book/ReceiptVoucherFormView";
import { PageError } from "@/components/shared/PageError";
import { requirePageUser } from "@/lib/auth";
import { canAccessCashBook, canWriteCashBook } from "@/lib/auth-roles";
import { notFound, redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ReceiptVoucherEditPage({ params }: PageProps) {
  const user = await requirePageUser();
  if (!canAccessCashBook(user.role)) redirect("/dashboard");
  if (!canWriteCashBook(user.role)) {
    redirect("/financial/cash-book/receipt-voucher");
  }

  const { id } = await params;

  try {
    const voucher = await getReceiptVoucher(id);
    if (!voucher) notFound();

    return <ReceiptVoucherFormView existing={voucher} canWrite />;
  } catch (error) {
    return <PageError error={error} />;
  }
}
