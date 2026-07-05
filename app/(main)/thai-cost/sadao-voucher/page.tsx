import { getSadaoVoucher } from "@/app/actions/thai-cost";
import { SadaoVoucherPageClient } from "@/components/thai-cost/SadaoVoucherPageClient";
import { PageError } from "@/components/shared/PageError";
import { requirePageUser } from "@/lib/auth";
import { canAccessThaiCost } from "@/lib/auth-roles";
import { toDateInputValue } from "@/lib/date-utils";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function SadaoVoucherPage({ searchParams }: PageProps) {
  const user = await requirePageUser();
  if (!canAccessThaiCost(user.role)) redirect("/dashboard");

  const params = await searchParams;
  const date = params.date ?? toDateInputValue(new Date());

  try {
    const voucher = await getSadaoVoucher(date);
    return <SadaoVoucherPageClient date={date} voucher={voucher} />;
  } catch (error) {
    return <PageError error={error} />;
  }
}
