import {
  getCashBookLedger,
  listOpeningBalanceAdjustments,
} from "@/app/actions/cash-book-ledger";
import { CashBookLedgerView } from "@/components/cash-book/CashBookLedgerView";
import { PageError } from "@/components/shared/PageError";
import { requirePageUser } from "@/lib/auth";
import { canAccessCashBook, canWriteCashBook } from "@/lib/auth-roles";
import { redirect } from "next/navigation";

export default async function ThbCashBookLedgerPage() {
  const user = await requirePageUser();
  if (!canAccessCashBook(user.role)) redirect("/dashboard");

  try {
    const [ledger, adjustments] = await Promise.all([
      getCashBookLedger("THB"),
      listOpeningBalanceAdjustments("THB"),
    ]);
    return (
      <CashBookLedgerView
        book="THB"
        openingBalance={ledger.openingBalance}
        rows={ledger.rows}
        adjustments={adjustments}
        canWrite={canWriteCashBook(user.role)}
      />
    );
  } catch (error) {
    return <PageError error={error} />;
  }
}
