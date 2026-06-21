import { Suspense } from "react";
import { CrateReturnMonthlyInvoicePicker } from "@/components/documents/CrateReturnMonthlyInvoicePicker";

export default async function CrateReturnInvoicePage() {
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
          <Suspense
            fallback={
              <div className="h-32 animate-pulse rounded-lg bg-haidee-border/30" />
            }
          >
            <CrateReturnMonthlyInvoicePicker />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
