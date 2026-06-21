import { Suspense } from "react";
import {
  getCrateTypeRecordOptions,
  getDocumentDispatchOrders,
  getMarketTongCombos,
} from "@/app/actions/documents";
import { DocumentsClient } from "@/components/documents/DocumentsClient";
import { PageError } from "@/components/shared/PageError";
import { resolveDateParam } from "@/lib/date-utils";
import { getCurrentUser } from "@/lib/auth";
import { canViewFreightInfo } from "@/lib/auth-roles";
import type { UserRole } from "@/types";

interface DocumentsPageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function DocumentsPage({
  searchParams,
}: DocumentsPageProps) {
  const params = await searchParams;
  const date = resolveDateParam(params.date);
  const user = await getCurrentUser();
  const showMonthlyInvoice = user
    ? canViewFreightInfo(user.role as UserRole)
    : false;

  try {
    const [dispatchOrders, marketTongCombos, crateTypeRecordOptions] =
      await Promise.all([
        getDocumentDispatchOrders(date),
        getMarketTongCombos(date),
        getCrateTypeRecordOptions(date),
      ]);

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            文件生成 Documents
          </h2>
          <p className="text-sm text-haidee-muted">
            内部/外部 D/O、市场 D/O、桶型记录、桶型总计、账单
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
            crateTypeRecordOptions={crateTypeRecordOptions}
            showMonthlyInvoice={showMonthlyInvoice}
          />
        </Suspense>
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            文件生成 Documents
          </h2>
          <p className="text-sm text-haidee-muted">
            内部/外部 D/O、市场 D/O、桶型记录、桶型总计、账单
          </p>
        </div>
        <PageError error={error} />
      </div>
    );
  }
}
