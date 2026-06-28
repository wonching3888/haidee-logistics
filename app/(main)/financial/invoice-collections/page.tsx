import { Suspense } from "react";
import { InvoiceCollectionsView } from "@/components/invoice-collections/InvoiceCollectionsView";

export default function InvoiceCollectionsPage() {
  return (
    <Suspense
      fallback={
        <div className="h-32 animate-pulse rounded-lg bg-haidee-border/30" />
      }
    >
      <InvoiceCollectionsView />
    </Suspense>
  );
}
