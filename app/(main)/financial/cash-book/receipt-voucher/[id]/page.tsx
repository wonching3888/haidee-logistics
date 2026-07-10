import { getReceiptVoucher } from "@/app/actions/cash-book-receipt-voucher";
import { ReceiptVoucherPrintView } from "@/components/cash-book/ReceiptVoucherPrintView";
import { PageError } from "@/components/shared/PageError";
import { requirePageUser } from "@/lib/auth";
import { canAccessCashBook, canWriteCashBook } from "@/lib/auth-roles";
import { notFound, redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ReceiptVoucherDetailPage({ params }: PageProps) {
  const user = await requirePageUser();
  if (!canAccessCashBook(user.role)) redirect("/dashboard");

  const { id } = await params;

  try {
    const voucher = await getReceiptVoucher(id);
    if (!voucher) notFound();

    return (
      <ReceiptVoucherPrintView
        voucher={voucher}
        canWrite={canWriteCashBook(user.role)}
      />
    );
  } catch (error) {
    return <PageError error={error} />;
  }
}
