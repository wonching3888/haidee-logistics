import { redirect } from "next/navigation";
import { PartnerTripInvoicePicker } from "@/components/documents/PartnerTripInvoicePicker";
import { getCurrentUser } from "@/lib/auth";
import { canViewFreightInfo } from "@/lib/auth-roles";
import type { UserRole } from "@/types";

export default async function PartnerTripInvoicePage() {
  const user = await getCurrentUser();
  if (!user || !canViewFreightInfo(user.role as UserRole)) {
    redirect("/documents");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-haidee-text">
          合作伙伴车力单 Partner Trip Invoice
        </h2>
        <p className="text-sm text-haidee-muted">
          按趟开具物流合作伙伴回桶车力费（ESV-6 0% SST）· 数据源：空桶回收 SKTN
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border border-haidee-border bg-white shadow-sm">
        <div className="p-4">
          <PartnerTripInvoicePicker />
        </div>
      </section>
    </div>
  );
}
