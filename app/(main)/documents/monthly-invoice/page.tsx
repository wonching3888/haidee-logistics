import { Suspense } from "react";
import { InvoiceHubTabs } from "@/components/documents/InvoiceHubTabs";

export default async function MonthlyInvoicePage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-haidee-text">账单 INVOICE</h2>
        <p className="text-sm text-haidee-muted">
          按客户与月份生成派车账单 PDF；包车发票见下方「包车发票」标签页
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border border-haidee-border bg-white shadow-sm">
        <div className="p-4">
          <Suspense
            fallback={
              <div className="h-32 animate-pulse rounded-lg bg-haidee-border/30" />
            }
          >
            <InvoiceHubTabs />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
