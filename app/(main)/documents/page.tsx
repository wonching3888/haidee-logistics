import { Suspense } from "react";
import {
  getDocumentDispatchOrders,
  getMarketTongCombos,
} from "@/app/actions/documents";
import { DocumentsClient } from "@/components/documents/DocumentsClient";
import { resolveDateParam } from "@/lib/date-utils";

interface DocumentsPageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function DocumentsPage({
  searchParams,
}: DocumentsPageProps) {
  const params = await searchParams;
  const date = resolveDateParam(params.date);

  const [dispatchOrders, marketTongCombos] = await Promise.all([
    getDocumentDispatchOrders(date),
    getMarketTongCombos(date),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-haidee-text">
          文件生成 Documents
        </h2>
        <p className="text-sm text-haidee-muted">
          内部/外部 D/O、市场 D/O、桶型记录 Internal/External/Market D/O & Crate records
        </p>
      </div>

      <Suspense
        fallback={
          <div className="h-40 animate-pulse rounded-xl bg-haidee-border/30" />
        }
      >
        <DocumentsClient
          date={date}
          dispatchOrders={dispatchOrders}
          marketTongCombos={marketTongCombos}
        />
      </Suspense>
    </div>
  );
}
