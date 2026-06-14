import { redirect } from "next/navigation";
import { MonthlyInvoicePicker } from "@/components/documents/MonthlyInvoicePicker";
import { getCurrentUser } from "@/lib/auth";
import { canViewFreightInfo } from "@/lib/auth-roles";
import type { UserRole } from "@/types";

export default async function MonthlyInvoicePage() {
  const user = await getCurrentUser();
  if (!user || !canViewFreightInfo(user.role as UserRole)) {
    redirect("/documents");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-haidee-text">
          月结账单 Monthly Invoice
        </h2>
        <p className="text-sm text-haidee-muted">
          按客户与月份生成月结账单 PDF
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border border-haidee-border bg-white shadow-sm">
        <div className="p-4">
          <MonthlyInvoicePicker />
        </div>
      </section>
    </div>
  );
}
