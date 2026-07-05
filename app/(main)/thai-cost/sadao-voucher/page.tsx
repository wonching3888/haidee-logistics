import { getSadaoVoucher } from "@/app/actions/thai-cost";
import { SadaoVoucherView } from "@/components/thai-cost/SadaoVoucherView";
import { PageError } from "@/components/shared/PageError";
import { requirePageUser } from "@/lib/auth";
import { canAccessThaiCost } from "@/lib/auth-roles";
import { toDateInputValue } from "@/lib/date-utils";
import { redirect } from "next/navigation";
import Link from "next/link";

interface PageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function SadaoVoucherPage({ searchParams }: PageProps) {
  const user = await requirePageUser();
  if (!canAccessThaiCost(user.role)) redirect("/dashboard");

  const params = await searchParams;
  const date =
    params.date ?? toDateInputValue(new Date());

  try {
    const voucher = await getSadaoVoucher(date);

    return (
      <div className="space-y-4">
        <div className="no-print">
          <Link
            href={`/thai-cost/sadao-handling?year=${date.slice(0, 4)}&month=${Number(date.slice(5, 7))}`}
            className="text-sm text-haidee-blue underline"
          >
            ← 返回 Sadao 搬运
          </Link>
        </div>
        {!voucher ? (
          <p className="rounded-lg border p-8 text-center text-haidee-muted">
            {date} 无搬运记录且无派车数据
          </p>
        ) : (
          <SadaoVoucherView voucher={voucher} canPrint />
        )}
      </div>
    );
  } catch (error) {
    return <PageError error={error} />;
  }
}
