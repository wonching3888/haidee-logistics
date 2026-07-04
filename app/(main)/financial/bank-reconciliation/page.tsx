import { Suspense } from "react";
import { BankReconciliationView } from "@/components/bank-reconciliation/BankReconciliationView";

export default function BankReconciliationPage() {
  return (
    <Suspense
      fallback={
        <div className="h-32 animate-pulse rounded-lg bg-haidee-border/30" />
      }
    >
      <BankReconciliationView />
    </Suspense>
  );
}
