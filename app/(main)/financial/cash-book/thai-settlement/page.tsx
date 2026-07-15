import { ThaiCashBookSettlementView } from "@/components/cash-book/ThaiCashBookSettlementView";
import { requirePageUser } from "@/lib/auth";
import { canAccessCashBook, canWriteCashBook } from "@/lib/auth-roles";
import { redirect } from "next/navigation";

export default async function ThaiCashBookSettlementPage() {
  const user = await requirePageUser();
  if (!canAccessCashBook(user.role)) redirect("/dashboard");

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-haidee-text">
          THB 结账待办 Thai Cash Book Settlement
        </h1>
        <p className="mt-1 text-sm text-haidee-muted">
          搬运费（6502，不含北大年）与司机趋次工资（6500）生成草稿付款凭证，人工确认后入账。
        </p>
      </div>
      <ThaiCashBookSettlementView canWrite={canWriteCashBook(user.role)} />
    </div>
  );
}
