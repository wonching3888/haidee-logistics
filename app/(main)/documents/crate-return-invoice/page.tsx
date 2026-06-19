import { redirect } from "next/navigation";
import { CrateReturnMonthlyInvoicePicker } from "@/components/documents/CrateReturnMonthlyInvoicePicker";
import { getCurrentUser } from "@/lib/auth";
import { canViewFreightInfo } from "@/lib/auth-roles";
import type { UserRole } from "@/types";

export default async function CrateReturnInvoicePage() {
  const user = await getCurrentUser();
  if (!user || !canViewFreightInfo(user.role as UserRole)) {
    redirect("/documents");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-haidee-text">
          回收桶月结单 Crate Return Monthly Invoice
        </h2>
        <p className="text-sm text-haidee-muted">
          顾客自有桶回收（GLY/GKS）· HAIDEE INVOICE · 车力费 + 收桶费
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border border-haidee-border bg-white shadow-sm">
        <div className="p-4">
          <CrateReturnMonthlyInvoicePicker />
        </div>
      </section>
    </div>
  );
}
