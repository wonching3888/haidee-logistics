import { Suspense } from "react";
import { PartnerTripInvoicePicker } from "@/components/documents/PartnerTripInvoicePicker";

export default async function PartnerTripInvoicePage() {
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
          <Suspense
            fallback={
              <div className="h-32 animate-pulse rounded-lg bg-haidee-border/30" />
            }
          >
            <PartnerTripInvoicePicker />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
